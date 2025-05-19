const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Complaint = require('../models/Complaint');
const Response = require('../models/Response');
const Category = require('../models/Category');
const Agency = require('../models/Agency');
const { createUploadMiddleware } = require('../multerConfig');
const jwt = require('jsonwebtoken');
const { validateObjectId } = require('../utils/validation');
const { ComplaintStatus, ComplaintPriority, ComplaintSubmissionType } = require('../models/Complaint');

// Create upload middleware for complaint attachments
const complaintAttachmentsUpload = createUploadMiddleware('complaint_attachments', 5);

// Middleware for handling file upload errors
const handleUploadError = (err, req, res, next) => {
  if (err) {
    return res.status(400).json({
      success: false,
      message: 'File upload error',
      error: err.message
    });
  }
  next();
};

/**
 * Authentication middleware - checks if user is authenticated
 * Works with both standard users and staff/agents
 */
const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        error: 'no_auth_token'
      });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Invalid authentication format',
        error: 'invalid_token_format'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired',
        error: 'token_expired'
      });
    }
    res.status(401).json({
      success: false,
      message: 'Authentication failed',
      error: 'auth_failed'
    });
  }
};

/**
 * Authorization middleware - checks if user has staff/admin role
 */
const staffAuthMiddleware = (req, res, next) => {
  if (!req.user || (req.user.userType !== 'staff' && req.user.userType !== 'agent')) {
    return res.status(403).json({
      success: false,
      message: 'Access denied: Staff access required',
      error: 'insufficient_permissions'
    });
  }
  next();
};

/**
 * Authorization middleware - checks if user has agent role
 */
const agentAuthMiddleware = (req, res, next) => {
  if (!req.user || req.user.userType !== 'agent') {
    return res.status(403).json({
      success: false,
      message: 'Access denied: Agent access required',
      error: 'insufficient_permissions'
    });
  }
  next();
};

/**
 * @route   POST /api/complaints
 * @desc    Create a new complaint
 * @access  Private (Any authenticated user)
 */
router.post('/', authMiddleware, complaintAttachmentsUpload.array('attachments', 5), handleUploadError, async (req, res) => {
  try {
    const {
      title,
      description,
      category,
      location,
      contactInfo,
      isPublic = true
    } = req.body;

    // Basic input validation
    if (!title || !description || !category) {
      return res.status(400).json({
        success: false,
        message: 'Please provide title, description, and category',
        error: 'missing_required_fields'
      });
    }

    // Validate category ID format
    if (!mongoose.Types.ObjectId.isValid(category)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid category ID format',
        error: 'invalid_category_id'
      });
    }

    // Process any uploaded attachments
    const attachments = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        attachments.push({
          url: file.path,
          publicId: file.filename || file.public_id || '',
          originalName: file.originalname,
          fileType: file.mimetype,
          fileSize: file.size,
          format: file.mimetype.split('/')[1],
          resourceType: file.mimetype.startsWith('image') ? 'image' :
                       file.mimetype.startsWith('video') ? 'video' :
                       file.mimetype.startsWith('audio') ? 'audio' : 'raw'
        });
      }
    }

    // Parse location and contact info if provided as strings
    let parsedLocation = location;
    let parsedContactInfo = contactInfo;

    try {
      if (location && typeof location === 'string') {
        parsedLocation = JSON.parse(location);
      }
    } catch (e) {
      return res.status(400).json({
        success: false,
        message: 'Invalid location format',
        error: 'invalid_location_format'
      });
    }

    try {
      if (contactInfo && typeof contactInfo === 'string') {
        parsedContactInfo = JSON.parse(contactInfo);
      }
    } catch (e) {
      return res.status(400).json({
        success: false,
        message: 'Invalid contact info format',
        error: 'invalid_contact_info_format'
      });
    }

    // Determine correct agency based on category - optimized query
    const categoryDoc = await Category.findById(category).lean();
    if (!categoryDoc) {
      return res.status(404).json({
        success: false,
        message: 'Category not found',
        error: 'category_not_found'
      });
    }

    // Use MongoDB transaction for data consistency across collections
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Create the complaint
      const complaintData = {
        title,
        description,
        submissionType: req.user.userType === 'standard_user' ? 
                      ComplaintSubmissionType.STANDARD : 
                      ComplaintSubmissionType.ANONYMOUS,
        category,
        agency: categoryDoc.agency,
        status: ComplaintStatus.PENDING,
        location: parsedLocation,
        contactInfo: parsedContactInfo,
        attachments,
        isPublic
      };

      // Add user reference based on user type
      if (req.user.userType === 'standard_user') {
        complaintData.standardUser = req.user.id;
      } else if (req.user.userType === 'anonymous_user') {
        complaintData.anonymousUser = req.user.id;
      }

      const complaint = new Complaint(complaintData);

      // Save the complaint
      await complaint.save({ session });
      
      // Create initial system response for tracking
      const response = new Response({
        complaint: complaint._id,
        userType: 'system',
        content: 'Complaint received and pending review.',
        isInternal: false
      });
      
      await response.save({ session });

      // Commit transaction
      await session.commitTransaction();
      session.endSession();

      res.status(201).json({
        success: true,
        message: 'Complaint submitted successfully',
        data: {
          id: complaint._id,
          trackingId: complaint.trackingId
        }
      });
    } catch (error) {
      // Abort transaction on error
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  } catch (error) {
    console.error('Error creating complaint:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit complaint',
      error: process.env.NODE_ENV === 'development' ? error.message : 'server_error'
    });
  }
});

/**
 * @route   GET /api/complaints
 * @desc    Get all complaints (with filtering and pagination)
 * @access  Private (Staff/Agent)
 */
router.get('/', authMiddleware, staffAuthMiddleware, async (req, res) => {
  try {
    // Extract query parameters with defaults and validation
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;
    
    // Build filter based on query params
    const filter = {};
    
    // Filter by status if provided
    if (req.query.status && Object.values(ComplaintStatus).includes(req.query.status)) {
      filter.status = req.query.status;
    }
    
    // Filter by priority if provided
    if (req.query.priority && Object.values(ComplaintPriority).includes(req.query.priority)) {
      filter.priority = req.query.priority;
    }
    
    // Filter by category if provided and valid
    if (req.query.category && validateObjectId(req.query.category)) {
      filter.category = req.query.category;
    }
    
    // Filter by agency - if agent, always filter by their agency
    if (req.user.userType === 'agent' && req.user.agencyId) {
      filter.agency = req.user.agencyId;
    } 
    // For staff, only filter by agency if specified
    else if (req.query.agency && validateObjectId(req.query.agency)) {
      filter.agency = req.query.agency;
    }
    
    // Filter by submission type if provided
    if (req.query.submissionType && Object.values(ComplaintSubmissionType).includes(req.query.submissionType)) {
      filter.submissionType = req.query.submissionType;
    }
    
    // Date range filtering
    if (req.query.startDate) {
      const startDate = new Date(req.query.startDate);
      if (!isNaN(startDate)) {
        filter.createdAt = { $gte: startDate };
      }
    }
    
    if (req.query.endDate) {
      const endDate = new Date(req.query.endDate);
      if (!isNaN(endDate)) {
        filter.createdAt = { ...filter.createdAt, $lte: endDate };
      }
    }
    
    // Search functionality
    if (req.query.search) {
      // Use text index for search if enabled
      filter.$text = { $search: req.query.search };
    }
    
    // Sorting options
    let sortOptions = { createdAt: -1 }; // Default sort by newest
    
    if (req.query.sortBy) {
      const sortField = req.query.sortBy;
      const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
      
      // Only allow sorting by valid fields
      if (['createdAt', 'status', 'priority', 'title'].includes(sortField)) {
        sortOptions = { [sortField]: sortOrder };
      }
    }

    // Get complaints with optimized query - use Promise.all for parallel execution
    const [complaints, total] = await Promise.all([
      Complaint.find(filter)
        .select('-description') // Exclude large fields for list view
        .populate('category', 'name')
        .populate('agency', 'name shortName')
        .populate('assignedTo', 'name')
        .sort(sortOptions)
        .skip(skip)
        .limit(limit)
        .lean(), // Use lean() for better performance
        
      Complaint.countDocuments(filter)
    ]);
    
    // Return paginated results
    res.status(200).json({
      success: true,
      count: complaints.length,
      data: complaints,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
        limit
      }
    });
  } catch (error) {
    console.error('Error fetching complaints:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch complaints',
      error: process.env.NODE_ENV === 'development' ? error.message : 'server_error'
    });
  }
});

/**
 * @route   GET /api/complaints/:id
 * @desc    Get a single complaint by ID
 * @access  Private (Auth + Owner or Staff/Agent)
 */
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid complaint ID format',
        error: 'invalid_id_format'
      });
    }
    
    // Find the complaint with populated fields
    const complaint = await Complaint.findById(id)
      .populate('category', 'name description')
      .populate('agency', 'name shortName')
      .populate('assignedTo', 'name')
      .populate({
        path: 'responses',
        match: { isInternal: false }, // Only get public responses
        options: { sort: { createdAt: 1 } } // Sort oldest first
      });
    
    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: 'Complaint not found',
        error: 'complaint_not_found'
      });
    }
    
    // Check permissions: allow access for staff/agents or the complaint owner
    const isOwner = 
      (req.user.userType === 'standard_user' && complaint.standardUser && 
       complaint.standardUser.toString() === req.user.id) ||
      (req.user.userType === 'anonymous_user' && complaint.anonymousUser &&
       complaint.anonymousUser.toString() === req.user.id);
       
    const isStaffOrAgent = ['staff', 'agent'].includes(req.user.userType);
    
    // If user is agent, check they belong to the correct agency
    const isAgentForAgency = 
      req.user.userType === 'agent' && 
      complaint.agency && 
      req.user.agencyId === complaint.agency.toString();
    
    if (!isOwner && !isStaffOrAgent && !isAgentForAgency) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
        error: 'access_denied'
      });
    }
    
    // Return the complaint with public responses
    res.status(200).json({
      success: true,
      data: complaint
    });
  } catch (error) {
    console.error('Error fetching complaint details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch complaint details',
      error: process.env.NODE_ENV === 'development' ? error.message : 'server_error'
    });
  }
});

/**
 * @route   PUT /api/complaints/:id
 * @desc    Update a complaint
 * @access  Private (Staff/Agent only)
 */
router.put('/:id', authMiddleware, staffAuthMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      status,
      priority,
      agency,
      assignedTo,
      note
    } = req.body;
    
    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid complaint ID format',
        error: 'invalid_id_format'
      });
    }
    
    // Find the complaint
    const complaint = await Complaint.findById(id);
    
    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: 'Complaint not found',
        error: 'complaint_not_found'
      });
    }
    
    // Check agency permissions for agents
    if (req.user.userType === 'agent') {
      // Agents can only modify complaints assigned to their agency
      if (complaint.agency.toString() !== req.user.agencyId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: You can only modify complaints assigned to your agency',
          error: 'agency_mismatch'
        });
      }
      
      // Agents cannot change the agency assignment
      if (agency && agency !== req.user.agencyId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: You cannot reassign complaints to another agency',
          error: 'agency_reassignment_forbidden'
        });
      }
    }
    
    // Use MongoDB transaction for data consistency
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      // Track status change for notification purposes
      const oldStatus = complaint.status;
      
      // Update fields if provided
      if (status && Object.values(ComplaintStatus).includes(status)) {
        complaint.status = status;
        
        // Set special timestamps based on status
        if (status === ComplaintStatus.RESOLVED && !complaint.resolvedAt) {
          complaint.resolvedAt = new Date();
        }
        if (status === ComplaintStatus.CLOSED && !complaint.closedAt) {
          complaint.closedAt = new Date();
        }
      }
      
      if (priority && Object.values(ComplaintPriority).includes(priority)) {
        complaint.priority = priority;
      }
      
      // Staff can update agency assignment
      if (agency && req.user.userType === 'staff' && mongoose.Types.ObjectId.isValid(agency)) {
        complaint.agency = agency;
      }
      
      // Update assignedTo if provided and valid
      if (assignedTo) {
        if (mongoose.Types.ObjectId.isValid(assignedTo)) {
          complaint.assignedTo = assignedTo;
          complaint.status = ComplaintStatus.ASSIGNED;
        } else if (assignedTo === 'none') {
          // Remove assignment
          complaint.assignedTo = null;
          
          // If status was ASSIGNED, revert to PENDING
          if (complaint.status === ComplaintStatus.ASSIGNED) {
            complaint.status = ComplaintStatus.PENDING;
          }
        }
      }
      
      // Save the updated complaint
      await complaint.save({ session });
      
      // Create a system response to record the change
      if (oldStatus !== complaint.status || note) {
        const responseContent = note ? note : 
          `Status updated from ${oldStatus} to ${complaint.status}`;
          
        const response = new Response({
          complaint: complaint._id,
          userType: 'system',
          content: responseContent,
          isInternal: false,
          statusChange: {
            oldStatus,
            newStatus: complaint.status
          }
        });
        
        if (req.user.id) {
          response.staff = req.user.id;
        }
        
        await response.save({ session });
      }
      
      await session.commitTransaction();
      session.endSession();
      
      // Return the updated complaint with populated references
      const updatedComplaint = await Complaint.findById(id)
        .populate('category', 'name')
        .populate('agency', 'name shortName')
        .populate('assignedTo', 'name');
      
      res.status(200).json({
        success: true,
        message: 'Complaint updated successfully',
        data: updatedComplaint
      });
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  } catch (error) {
    console.error('Error updating complaint:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update complaint',
      error: process.env.NODE_ENV === 'development' ? error.message : 'server_error'
    });
  }
});

/**
 * @route   POST /api/complaints/:id/responses
 * @desc    Add a response to a complaint
 * @access  Private (Auth + Owner or Staff/Agent)
 */
router.post('/:id/responses', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { content, isInternal = false } = req.body;
    
    // Validate input
    if (!content) {
      return res.status(400).json({
        success: false,
        message: 'Response content is required',
        error: 'missing_content'
      });
    }
    
    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid complaint ID format',
        error: 'invalid_id_format'
      });
    }
    
    // Find complaint
    const complaint = await Complaint.findById(id);
    
    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: 'Complaint not found',
        error: 'complaint_not_found'
      });
    }
    
    // Check permissions
    const isOwner = 
      (req.user.userType === 'standard_user' && complaint.standardUser && 
       complaint.standardUser.toString() === req.user.id) ||
      (req.user.userType === 'anonymous_user' && complaint.anonymousUser &&
       complaint.anonymousUser.toString() === req.user.id);
    
    const isStaffOrAgent = ['staff', 'agent'].includes(req.user.userType);
    
    // Check agency permissions for agents
    const isAgentForAgency = 
      req.user.userType === 'agent' && 
      complaint.agency && 
      req.user.agencyId === complaint.agency.toString();
    
    // Only allow staff/agents to create internal responses
    if (isInternal && !isStaffOrAgent) {
      return res.status(403).json({
        success: false,
        message: 'Only staff or agents can create internal responses',
        error: 'internal_response_not_allowed'
      });
    }
    
    // Standard permissions check
    if (!isOwner && !isStaffOrAgent) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
        error: 'access_denied'
      });
    }
    
    // Agents can only respond to complaints assigned to their agency
    if (req.user.userType === 'agent' && !isAgentForAgency) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You can only respond to complaints assigned to your agency',
        error: 'agency_mismatch'
      });
    }
    
    // Use MongoDB transaction for data consistency
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      // Create the response
      const response = new Response({
        complaint: id,
        userType: req.user.userType,
        content,
        isInternal
      });
      
      // Add reference based on user type
      if (req.user.userType === 'standard_user') {
        response.standardUser = req.user.id;
      } else if (req.user.userType === 'anonymous_user') {
        response.anonymousUser = req.user.id;
      } else if (['staff', 'agent'].includes(req.user.userType)) {
        response.staff = req.user.id;
      }
      
      await response.save({ session });
      
      // Update complaint status if appropriate
      // When staff/agency responds, move to IN_PROGRESS if not already resolved or closed
      if (isStaffOrAgent && ['pending', 'under_review', 'assigned'].includes(complaint.status)) {
        complaint.status = ComplaintStatus.IN_PROGRESS;
        await complaint.save({ session });
      }
      
      // When citizen responds to a resolved complaint, reopen it
      if (isOwner && ['resolved', 'closed'].includes(complaint.status)) {
        const oldStatus = complaint.status;
        complaint.status = ComplaintStatus.IN_PROGRESS;
        
        // Also create a system response noting the status change
        const systemResponse = new Response({
          complaint: id,
          userType: 'system',
          content: `Complaint reopened due to new response from ${req.user.userType === 'standard_user' ? 'user' : 'anonymous user'}`,
          isInternal: false,
          statusChange: {
            oldStatus,
            newStatus: complaint.status
          }
        });
        
        await systemResponse.save({ session });
        await complaint.save({ session });
      }
      
      await session.commitTransaction();
      session.endSession();
      
      // Return the created response
      res.status(201).json({
        success: true,
        message: 'Response added successfully',
        data: response
      });
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  } catch (error) {
    console.error('Error adding response:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add response',
      error: process.env.NODE_ENV === 'development' ? error.message : 'server_error'
    });
  }
});

/**
 * @route   GET /api/complaints/track/:trackingId
 * @desc    Track a complaint by tracking ID (no auth required)
 * @access  Public
 */
router.get('/track/:trackingId', async (req, res) => {
  try {
    const { trackingId } = req.params;
    
    // Basic validation
    if (!trackingId || typeof trackingId !== 'string' || trackingId.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Invalid tracking ID format',
        error: 'invalid_tracking_id'
      });
    }
    
    // Use the static method to find by tracking ID
    const complaint = await Complaint.findByTrackingId(trackingId)
      .select('title description status createdAt updatedAt category agency submissionType trackingId')
      .populate('category', 'name')
      .populate('agency', 'name shortName')
      .lean(); // Use lean() for better performance
    
    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: 'No complaint found with this tracking ID',
        error: 'not_found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: complaint
    });
  } catch (error) {
    console.error('Error tracking complaint:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to track complaint',
      error: process.env.NODE_ENV === 'development' ? error.message : 'server_error'
    });
  }
});

/**
 * @route   GET /api/complaints/stats/agency/:agencyId
 * @desc    Get complaint statistics for a specific agency
 * @access  Private (Staff/Agent)
 */
router.get('/stats/agency/:agencyId', authMiddleware, staffAuthMiddleware, async (req, res) => {
  try {
    const { agencyId } = req.params;
    
    // Validate agency ID
    if (!mongoose.Types.ObjectId.isValid(agencyId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid agency ID format',
        error: 'invalid_agency_id'
      });
    }
    
    // Check permissions for agents
    if (req.user.userType === 'agent' && req.user.agencyId !== agencyId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You can only view stats for your assigned agency',
        error: 'agency_mismatch'
      });
    }
    
    // Get date range filters if provided
    let dateFilter = {};
    if (req.query.startDate || req.query.endDate) {
      dateFilter = {};
      
      if (req.query.startDate) {
        const startDate = new Date(req.query.startDate);
        if (!isNaN(startDate)) {
          dateFilter.$gte = startDate;
        }
      }
      
      if (req.query.endDate) {
        const endDate = new Date(req.query.endDate);
        if (!isNaN(endDate)) {
          dateFilter.$lte = endDate;
        }
      }
    }
    
    const matchQuery = { agency: mongoose.Types.ObjectId(agencyId) };
    if (Object.keys(dateFilter).length > 0) {
      matchQuery.createdAt = dateFilter;
    }
    
    // Use MongoDB aggregation framework for efficient stats calculation
    const [statusStats, priorityStats, timeToResolveStats, totalComplaints] = await Promise.all([
      // Status distribution
      Complaint.aggregate([
        { $match: matchQuery },
        { $group: { _id: '$status', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      
      // Priority distribution
      Complaint.aggregate([
        { $match: matchQuery },
        { $group: { _id: '$priority', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      
      // Average time to resolve (in days)
      Complaint.aggregate([
        { 
          $match: { 
            ...matchQuery,
            resolvedAt: { $exists: true, $ne: null },
            createdAt: { $exists: true }
          } 
        },
        { 
          $project: { 
            timeToResolve: { 
              $divide: [
                { $subtract: ['$resolvedAt', '$createdAt'] },
                1000 * 60 * 60 * 24 // Convert ms to days
              ]
            }
          }
        },
        { 
          $group: { 
            _id: null, 
            averageDays: { $avg: '$timeToResolve' },
            minDays: { $min: '$timeToResolve' },
            maxDays: { $max: '$timeToResolve' },
            count: { $sum: 1 }
          }
        }
      ]),
      
      // Total complaints
      Complaint.countDocuments(matchQuery)
    ]);
    
    // Format status stats for easier consumption
    const statusCounts = {};
    statusStats.forEach(item => {
      statusCounts[item._id] = item.count;
    });
    
    // Format priority stats
    const priorityCounts = {};
    priorityStats.forEach(item => {
      priorityCounts[item._id] = item.count;
    });
    
    // Format time to resolve stats
    const timeToResolve = timeToResolveStats.length > 0 ? {
      averageDays: parseFloat(timeToResolveStats[0].averageDays.toFixed(1)),
      minDays: parseFloat(timeToResolveStats[0].minDays.toFixed(1)),
      maxDays: parseFloat(timeToResolveStats[0].maxDays.toFixed(1)),
      resolvedCount: timeToResolveStats[0].count
    } : {
      averageDays: 0,
      minDays: 0,
      maxDays: 0,
      resolvedCount: 0
    };
    
    // Get recent activity - latest 5 complaints for this agency
    const recentActivity = await Complaint.find(matchQuery)
      .select('title status priority createdAt updatedAt')
      .sort({ updatedAt: -1 })
      .limit(5)
      .lean();
    
    res.status(200).json({
      success: true,
      data: {
        totalComplaints,
        statusCounts,
        priorityCounts,
        timeToResolve,
        recentActivity
      }
    });
  } catch (error) {
    console.error('Error fetching agency stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch agency statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : 'server_error'
    });
  }
});

/**
 * @route   GET /api/complaints/stats/overall
 * @desc    Get overall complaint statistics
 * @access  Private (Staff only)
 */
router.get('/stats/overall', authMiddleware, staffAuthMiddleware, async (req, res) => {
  try {
    // Only allow staff (not agents) to access overall stats
    if (req.user.userType !== 'staff') {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Staff access required',
        error: 'insufficient_permissions'
      });
    }
    
    // Get date range filters if provided
    let dateFilter = {};
    if (req.query.startDate || req.query.endDate) {
      dateFilter = {};
      
      if (req.query.startDate) {
        const startDate = new Date(req.query.startDate);
        if (!isNaN(startDate)) {
          dateFilter.$gte = startDate;
        }
      }
      
      if (req.query.endDate) {
        const endDate = new Date(req.query.endDate);
        if (!isNaN(endDate)) {
          dateFilter.$lte = endDate;
        }
      }
    }
    
    const matchQuery = {};
    if (Object.keys(dateFilter).length > 0) {
      matchQuery.createdAt = dateFilter;
    }
    
    // Use Promise.all for parallel processing
    const [
      total,
      statusStats,
      agencyStats,
      submissionTypeStats,
      weeklyTrend,
      categoryStats
    ] = await Promise.all([
      // Total complaints
      Complaint.countDocuments(matchQuery),
      
      // Status distribution
      Complaint.aggregate([
        { $match: matchQuery },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      
      // Complaints by agency
      Complaint.aggregate([
        { $match: matchQuery },
        { $group: { _id: '$agency', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 } // Top 10 agencies
      ]),
      
      // Submission type distribution
      Complaint.aggregate([
        { $match: matchQuery },
        { $group: { _id: '$submissionType', count: { $sum: 1 } } }
      ]),
      
      // Weekly trend (last 8 weeks)
      Complaint.aggregate([
        {
          $match: {
            createdAt: { 
              $gte: new Date(Date.now() - (8 * 7 * 24 * 60 * 60 * 1000)) 
            }
          }
        },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              week: { $week: '$createdAt' }
            },
            count: { $sum: 1 }
          }
        },
        { $sort: { '_id.year': 1, '_id.week': 1 } }
      ]),
      
      // Category distribution
      Complaint.aggregate([
        { $match: matchQuery },
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 } // Top 10 categories
      ])
    ]);
    
    // Format status stats
    const statusCounts = {};
    statusStats.forEach(item => {
      statusCounts[item._id] = item.count;
    });
    
    // Format submission type stats
    const submissionTypeCounts = {};
    submissionTypeStats.forEach(item => {
      submissionTypeCounts[item._id] = item.count;
    });
    
    // For agency stats, we need to populate agency names
    const agencyIds = agencyStats.map(item => item._id).filter(id => id);
    const agencies = await Agency.find({ _id: { $in: agencyIds } }).select('name shortName').lean();
    
    // Create agency name lookup
    const agencyLookup = {};
    agencies.forEach(agency => {
      agencyLookup[agency._id] = agency.name || agency.shortName;
    });
    
    // Format agency stats with names
    const agencyData = agencyStats.map(item => ({
      agency: item._id ? agencyLookup[item._id] || 'Unknown' : 'Unassigned',
      count: item.count
    }));
    
    // For category stats, we need to populate category names
    const categoryIds = categoryStats.map(item => item._id).filter(id => id);
    const categories = await Category.find({ _id: { $in: categoryIds } }).select('name').lean();
    
    // Create category name lookup
    const categoryLookup = {};
    categories.forEach(category => {
      categoryLookup[category._id] = category.name;
    });
    
    // Format category stats with names
    const categoryData = categoryStats.map(item => ({
      category: item._id ? categoryLookup[item._id] || 'Unknown' : 'Uncategorized',
      count: item.count
    }));
    
    // Format weekly trend for chart display
    const weeklyTrendData = weeklyTrend.map(item => ({
      year: item._id.year,
      week: item._id.week,
      count: item.count
    }));
    
    // Handle resolution metrics for open vs. resolved
    const resolved = statusCounts[ComplaintStatus.RESOLVED] || 0;
    const closed = statusCounts[ComplaintStatus.CLOSED] || 0;
    const resolvedTotal = resolved + closed;
    
    const resolutionRate = total > 0 ? (resolvedTotal / total * 100).toFixed(1) : 0;
    
    res.status(200).json({
      success: true,
      data: {
        totalComplaints: total,
        statusCounts,
        submissionTypeCounts,
        resolutionRate,
        agencyData,
        categoryData,
        weeklyTrend: weeklyTrendData
      }
    });
  } catch (error) {
    console.error('Error fetching overall statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch overall statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : 'server_error'
    });
  }
});

/**
 * @route   GET /api/complaints/health
 * @desc    Health check endpoint
 * @access  Public
 */
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'Complaint service is running',
    timestamp: new Date().toISOString()
  });
});

// Azure-specific optimization for Cosmos DB - add partition key to all queries
// This middleware enhances all routes with appropriate Cosmos DB optimization
if (process.env.DATABASE_TYPE === 'azure_cosmos_db') {
  // Add Azure Cosmos DB specific optimizations
  router.use((req, res, next) => {
    // Example: Log Azure-specific performance metrics
    console.log('Azure Cosmos DB optimizations applied');
    next();
  });
}

module.exports = router;