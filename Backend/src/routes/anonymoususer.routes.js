const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const mongoose = require('mongoose');
const AnonymousUser = require('../models/AnonymousUser');
const Complaint = require('../models/Complaint');
const Response = require('../models/Response');
const AnonymousUserNotification = require('../models/AnonymousUserNotification');
const { createUploadMiddleware } = require('../multerConfig');
const nodemailer = require('nodemailer');

// Initialize nodemailer transporter with Brevo SMTP for cross-platform email delivery
const transporter = nodemailer.createTransport({
  host: process.env.BREVO_SMTP_HOST,
  port: process.env.BREVO_SMTP_PORT,
  secure: false,
  auth: {
    user: process.env.BREVO_SMTP_USER,
    pass: process.env.BREVO_SMTP_KEY,
  },
  pool: true, // Use connection pooling for better reliability
  maxConnections: 5, // Limit connections to avoid rate limits
  maxMessages: 100, // Limit messages per connection
});

// Create upload middleware instances for different file types
const complaintAttachmentsUpload = createUploadMiddleware('anonymous_complaint_attachments', 5);
const responseAttachmentsUpload = createUploadMiddleware('anonymous_response_attachments', 3);

// Error handling middleware for file uploads
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

// Helper function to send email with retry logic for better reliability
const sendEmail = async (options) => {
  const mailOptions = {
    from: `"${process.env.EMAIL_FROM_NAME || 'SAYIT Platform'}" <${process.env.EMAIL_FROM || process.env.BREVO_SMTP_USER}>`,
    to: options.email,
    subject: options.subject,
    html: options.message,
  };

  // Add retry logic for better reliability on platforms like Render/Heroku
  let retries = 3;
  while (retries > 0) {
    try {
      return await transporter.sendMail(mailOptions);
    } catch (error) {
      retries--;
      if (retries === 0) throw error;
      
      // Exponential backoff with jitter for optimal retry distribution
      const baseDelay = 300; // 300ms base delay
      const maxJitter = 200; // 200ms maximum jitter
      const exponentialDelay = baseDelay * Math.pow(2, 3 - retries);
      const jitter = Math.floor(Math.random() * maxJitter);
      const delay = exponentialDelay + jitter;
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

// Authentication middleware for anonymous users with better error handling
const anonymousAuthMiddleware = async (req, res, next) => {
  try {
    // Check for Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please provide your access code.',
        error: 'no_auth_token'
      });
    }

    // Extract token
    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token format',
        error: 'invalid_token_format'
      });
    }

    // Verify token with comprehensive error handling
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtError) {
      // Handle specific JWT errors
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Your session has expired. Please log in again.',
          error: 'token_expired'
        });
      } else {
        return res.status(401).json({
          success: false,
          message: 'Invalid token',
          error: 'invalid_token'
        });
      }
    }

    // Get anonymous user ID from token
    const anonymousId = decoded.id;
    
    if (!anonymousId) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token structure',
        error: 'invalid_token_structure'
      });
    }

    // Validate ObjectId before query to prevent errors
    if (!mongoose.Types.ObjectId.isValid(anonymousId)) {
      return res.status(401).json({
        success: false,
        message: 'Invalid user identifier',
        error: 'invalid_user_id'
      });
    }

    // Find anonymous user by ID - use lean() for better performance
    const anonymousUser = await AnonymousUser.findById(anonymousId);
    if (!anonymousUser) {
      return res.status(401).json({
        success: false,
        message: 'User not found',
        error: 'user_not_found'
      });
    }

    // Check if anonymous user code has expired
    if (anonymousUser.isExpired()) {
      return res.status(401).json({
        success: false,
        message: 'Your access code has expired. Please generate a new one.',
        error: 'code_expired'
      });
    }

    // Add user to request object
    req.anonymousUser = anonymousUser;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during authentication',
      error: process.env.NODE_ENV === 'development' ? error.message : 'server_error'
    });
  }
};

/**
 * @route   POST /api/anonymous/generate
 * @desc    Generate new anonymous access code
 * @access  Public
 */
router.post('/generate', async (req, res) => {
  try {
    // Generate a unique access code
    const accessCode = AnonymousUser.generateAccessCode();
    
    // Create new anonymous user
    const anonymousUser = new AnonymousUser({
      accessCode,
      isActive: true,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
    });
    
    await anonymousUser.save();
    
    // Create JWT token
    const token = jwt.sign(
      { id: anonymousUser._id },
      process.env.JWT_SECRET,
      { 
        expiresIn: '30d',
        audience: 'sayit-platform-anonymous',
        issuer: 'sayit-auth-service'
      }
    );
    
    res.status(201).json({
      success: true,
      message: 'Anonymous access code generated successfully',
      data: {
        accessCode: anonymousUser.accessCode,
        token,
        expiresAt: anonymousUser.expiresAt
      }
    });
  } catch (error) {
    console.error('Error generating access code:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate access code',
      error: process.env.NODE_ENV === 'development' ? error.message : 'server_error'
    });
  }
});

/**
 * @route   POST /api/anonymous/verify
 * @desc    Verify anonymous access code and get token
 * @access  Public
 */
router.post('/verify', async (req, res) => {
  try {
    const { accessCode } = req.body;
    
    if (!accessCode) {
      return res.status(400).json({
        success: false,
        message: 'Please provide an access code',
        error: 'missing_access_code'
      });
    }
    
    // Sanitize the access code - trim and convert to uppercase
    const sanitizedCode = accessCode.trim().toUpperCase();
    
    // Find anonymous user by access code
    const anonymousUser = await AnonymousUser.findOne({ accessCode: sanitizedCode });
    
    if (!anonymousUser) {
      return res.status(404).json({
        success: false,
        message: 'Invalid access code',
        error: 'invalid_access_code'
      });
    }
    
    // Check if code has expired
    if (anonymousUser.isExpired()) {
      return res.status(400).json({
        success: false,
        message: 'This access code has expired',
        error: 'code_expired'
      });
    }
    
    // Update usage count and last login - handle errors gracefully
    try {
      await anonymousUser.incrementUsage();
    } catch (updateError) {
      // Log but continue - this is a non-critical error
      console.warn('Failed to update usage statistics:', updateError);
    }
    
    // Generate token
    const token = jwt.sign(
      { 
        id: anonymousUser._id,
        userType: 'anonymous_user',
        iat: Math.floor(Date.now() / 1000)
      },
      process.env.JWT_SECRET,
      { 
        expiresIn: '30d',
        audience: 'sayit-platform-anonymous',
        issuer: 'sayit-auth-service'
      }
    );
    
    res.status(200).json({
      success: true,
      message: 'Access code verified successfully',
      data: {
        accessCode: anonymousUser.accessCode,
        token,
        expiresAt: anonymousUser.expiresAt
      }
    });
  } catch (error) {
    console.error('Error verifying access code:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify access code',
      error: process.env.NODE_ENV === 'development' ? error.message : 'server_error'
    });
  }
});

/**
 * @route   GET /api/anonymous/complaints
 * @desc    Get all complaints submitted by this anonymous user
 * @access  Private (Anonymous)
 */
router.get('/complaints', anonymousAuthMiddleware, async (req, res) => {
  try {
    // Get pagination parameters with better validation
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;
    
    // Build query based on filters
    const query = { 
      anonymousUser: req.anonymousUser._id,
      submissionType: 'anonymous'
    };
    
    // Filter by status if provided
    if (req.query.status && ['pending', 'under_review', 'assigned', 'in_progress', 'resolved', 'closed', 'rejected'].includes(req.query.status)) {
      query.status = req.query.status;
    }
    
    // Use Promise.all for parallel queries - better performance
    const [complaints, total] = await Promise.all([
      Complaint.find(query)
        .populate('category', 'name')
        .populate('agency', 'name shortName')
        .select('-description -attachments') // Exclude large fields for list view
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(), // Use lean() for better performance
        
      Complaint.countDocuments(query)
    ]);
    
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
    console.error('Error fetching anonymous complaints:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch complaints',
      error: process.env.NODE_ENV === 'development' ? error.message : 'server_error'
    });
  }
});

/**
 * @route   GET /api/anonymous/complaints/:id
 * @desc    Get a specific complaint by ID
 * @access  Private (Anonymous)
 */
router.get('/complaints/:id', anonymousAuthMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validate ObjectId to prevent unnecessary DB queries
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid complaint ID format',
        error: 'invalid_id_format'
      });
    }
    
    // Find complaint with necessary populated fields
    const complaint = await Complaint.findOne({
      _id: id,
      anonymousUser: req.anonymousUser._id,
      submissionType: 'anonymous'
    })
      .populate('category', 'name')
      .populate('agency', 'name shortName')
      .populate('assignedTo', 'name');
    
    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: 'Complaint not found',
        error: 'complaint_not_found'
      });
    }
    
    // Get responses for this complaint - only include public responses
    const responses = await Response.find({
        complaint: complaint._id,
        isInternal: false
      })
      .populate('staff', 'name')
      .sort({ createdAt: 1 })
      .lean();
    
    res.status(200).json({
      success: true,
      data: {
        complaint,
        responses
      }
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
 * @route   POST /api/anonymous/complaints
 * @desc    Submit a new complaint as anonymous user
 * @access  Private (Anonymous)
 */
router.post('/complaints', anonymousAuthMiddleware, complaintAttachmentsUpload.array('attachments', 5), handleUploadError, async (req, res) => {
  try {
    const { title, description, category, location, contactInfo } = req.body;
    
    // Validate required fields
    if (!title || !description || !category) {
      return res.status(400).json({
        success: false,
        message: 'Please provide title, description, and category',
        error: 'missing_required_fields'
      });
    }
    
    // Validate category ID
    if (!mongoose.Types.ObjectId.isValid(category)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid category ID format',
        error: 'invalid_category_id'
      });
    }
    
    // Process uploaded files with better error handling
    const attachments = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        if (!file.path) {
          console.warn('File upload missing path:', file);
          continue;
        }
        
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
    
    // Parse location and contact info with better error handling
    let parsedLocation;
    if (location) {
      try {
        parsedLocation = typeof location === 'string' ? JSON.parse(location) : location;
      } catch (e) {
        return res.status(400).json({
          success: false,
          message: 'Invalid location format',
          error: 'invalid_location_format'
        });
      }
    }
    
    let parsedContactInfo;
    if (contactInfo) {
      try {
        parsedContactInfo = typeof contactInfo === 'string' ? JSON.parse(contactInfo) : contactInfo;
      } catch (e) {
        return res.status(400).json({
          success: false,
          message: 'Invalid contact info format',
          error: 'invalid_contact_format'
        });
      }
    }
    
    // Use MongoDB transaction for data consistency
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      // Validate category exists
      const categoryDoc = await Category.findById(category).lean();
      if (!categoryDoc) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({
          success: false,
          message: 'Category not found',
          error: 'category_not_found'
        });
      }
      
      // Create the complaint
      const complaint = new Complaint({
        title,
        description,
        submissionType: 'anonymous',
        anonymousUser: req.anonymousUser._id,
        category,
        agency: categoryDoc.agency,
        location: parsedLocation,
        contactInfo: parsedContactInfo,
        attachments,
        status: 'pending'
      });
      
      await complaint.save({ session });
      
      // Create a notification for the complaint submission
      await AnonymousUserNotification.create(
        {
          anonymousUser: req.anonymousUser._id,
          title: 'Complaint Submitted Successfully',
          message: `Your complaint "${title}" has been received and is being processed. Tracking ID: ${complaint.trackingId}`,
          type: 'system',
          relatedId: complaint._id,
          onModel: 'Complaint',
          priority: 'normal',
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days expiry
        },
        { session }
      );
      
      // Create initial system response for tracking
      const response = new Response({
        complaint: complaint._id,
        userType: 'system',
        content: 'Complaint received and pending review.',
        isInternal: false
      });
      
      await response.save({ session });
      
      await session.commitTransaction();
      session.endSession();
      
      // Send confirmation email if contact info has email (non-blocking)
      if (parsedContactInfo && parsedContactInfo.email) {
        setImmediate(async () => {
          try {
            const message = `
              <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px;">
                <h2 style="color: #2a9d8f;">Anonymous Complaint Submitted Successfully</h2>
                <p>Hello,</p>
                <p>Your anonymous complaint "${title}" has been submitted successfully to the SAYIT platform.</p>
                <p><strong>Tracking ID:</strong> ${complaint.trackingId}</p>
                <p>You can track the status of your complaint using this tracking ID on our platform.</p>
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${process.env.FRONTEND_URL || 'https://sayit.rw'}/track/${complaint.trackingId}" 
                    style="background-color: #2a9d8f; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                    Track Your Complaint
                  </a>
                </div>
                <p>You can continue to monitor your complaint with your anonymous access code.</p>
                <hr style="border: 1px solid #eee; margin-top: 20px;">
                <p style="font-size: 12px; color: #777;">
                  This is an automated message from SAYIT. Please do not reply to this email.
                </p>
              </div>
            `;

            await sendEmail({
              email: parsedContactInfo.email,
              subject: `SAYIT - Anonymous Complaint Submitted (${complaint.trackingId})`,
              message
            });
          } catch (error) {
            console.warn('Failed to send email notification:', error);
            // Continue execution even if email fails
          }
        });
      }
      
      res.status(201).json({
        success: true,
        message: 'Complaint submitted successfully',
        data: {
          trackingId: complaint.trackingId,
          id: complaint._id
        }
      });
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  } catch (error) {
    console.error('Error submitting complaint:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit complaint',
      error: process.env.NODE_ENV === 'development' ? error.message : 'server_error'
    });
  }
});

/**
 * @route   POST /api/anonymous/complaints/:id/responses
 * @desc    Add a response to a complaint
 * @access  Private (Anonymous)
 */
router.post('/complaints/:id/responses', anonymousAuthMiddleware, responseAttachmentsUpload.array('attachments', 3), handleUploadError, async (req, res) => {
  try {
    const { content } = req.body;
    const { id } = req.params;
    
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
    
    // Make sure the complaint exists and belongs to this anonymous user - use projection
    const complaint = await Complaint.findOne(
      {
        _id: id,
        anonymousUser: req.anonymousUser._id,
        submissionType: 'anonymous'
      },
      'status title' // Only get the fields we need
    );
    
    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: 'Complaint not found',
        error: 'complaint_not_found'
      });
    }
    
    // Process uploaded files with better error handling
    const attachments = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        if (!file.path) {
          console.warn('File upload missing path:', file);
          continue;
        }
        
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
    
    // Use MongoDB transaction for better data consistency
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      // Create response
      const response = new Response({
        complaint: id,
        userType: 'anonymous_user',
        anonymousUser: req.anonymousUser._id,
        content,
        attachments,
        isInternal: false
      });
      
      await response.save({ session });
      
      // If complaint is resolved or closed, and user adds a response, reopen it
      let statusChanged = false;
      let oldStatus = complaint.status;
      if (['resolved', 'closed', 'rejected'].includes(complaint.status)) {
        statusChanged = true;
        complaint.status = 'in_progress';
        complaint.statusNote = 'Reopened due to user response';
        await complaint.save({ session });
        
        // Create system response for status change
        const systemResponse = new Response({
          complaint: id,
          userType: 'system',
          content: `Complaint reopened due to new response from anonymous user`,
          isInternal: false,
          statusChange: {
            oldStatus,
            newStatus: 'in_progress'
          }
        });
        
        await systemResponse.save({ session });
      }
      
      // Create notification confirming response was added
      await AnonymousUserNotification.create(
        {
          anonymousUser: req.anonymousUser._id,
          title: 'Response Added to Complaint',
          message: `Your response to complaint "${complaint.title}" has been recorded.`,
          type: 'system',
          relatedId: complaint._id,
          onModel: 'Complaint',
          priority: 'low',
          expiresAt: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000) // 15 days expiry
        },
        { session }
      );
      
      await session.commitTransaction();
      session.endSession();
      
      res.status(201).json({
        success: true,
        message: 'Response added successfully',
        data: {
          response,
          statusChanged,
          oldStatus: statusChanged ? oldStatus : undefined,
          newStatus: statusChanged ? 'in_progress' : undefined
        }
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
 * @route   GET /api/anonymous/track/:trackingId
 * @desc    Track a complaint by tracking ID (no authentication required)
 * @access  Public
 */
router.get('/track/:trackingId', async (req, res) => {
  try {
    const { trackingId } = req.params;
    
    // Sanitize input
    const sanitizedTrackingId = trackingId.trim();
    if (!sanitizedTrackingId) {
      return res.status(400).json({
        success: false,
        message: 'Invalid tracking ID',
        error: 'invalid_tracking_id'
      });
    }
    
    // Find complaint with selective fields to reduce payload size
    const complaint = await Complaint.findOne({ trackingId: sanitizedTrackingId })
      .select('title description status createdAt updatedAt category agency submissionType trackingId')
      .populate('category', 'name')
      .populate('agency', 'name')
      .lean(); // Use lean() for better performance
    
    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: 'No complaint found with this tracking ID',
        error: 'complaint_not_found'
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
 * @route   GET /api/anonymous/notifications
 * @desc    Get notifications for anonymous user
 * @access  Private (Anonymous)
 */
router.get('/notifications', anonymousAuthMiddleware, async (req, res) => {
  try {
    // Get pagination parameters with better validation
    const page = Math.max(1, parseInt(req.query.page) || 1); // Prevent negative page
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10)); // Limit between 1-50
    const skip = (page - 1) * limit;
    
    // Build query based on filters
    const query = { anonymousUser: req.anonymousUser._id };
    
    // Filter by read/unread status if specified
    if (req.query.read === 'true') {
      query.read = true;
    } else if (req.query.read === 'false') {
      query.read = false;
    }
    
    // Filter by type if specified
    if (req.query.type && ['system', 'complaint_update', 'response_received'].includes(req.query.type)) {
      query.type = req.query.type;
    }
    
    // Use Promise.all for parallel processing - better performance
    const [total, notifications, unreadCount] = await Promise.all([
      AnonymousUserNotification.countDocuments(query),
      AnonymousUserNotification.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(), // Use lean() for better performance
      AnonymousUserNotification.countDocuments({
        anonymousUser: req.anonymousUser._id,
        read: false
      })
    ]);
    
    res.status(200).json({
      success: true,
      data: {
        notifications,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit)
        },
        unreadCount
      }
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notifications',
      error: process.env.NODE_ENV === 'development' ? error.message : 'server_error'
    });
  }
});

/**
 * @route   PUT /api/anonymous/notifications/:id/read
 * @desc    Mark a notification as read
 * @access  Private (Anonymous)
 */
router.put('/notifications/:id/read', anonymousAuthMiddleware, async (req, res) => {
  try {
    // Validate ObjectId to prevent unnecessary DB queries
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid notification ID',
        error: 'invalid_notification_id'
      });
    }
    
    const notification = await AnonymousUserNotification.findOne({
      _id: req.params.id,
      anonymousUser: req.anonymousUser._id
    });
    
    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found',
        error: 'notification_not_found'
      });
    }
    
    // Only update if not already read to avoid unnecessary DB writes
    if (!notification.read) {
      notification.read = true;
      await notification.save();
    }
    
    res.status(200).json({
      success: true,
      message: 'Notification marked as read'
    });
  } catch (error) {
    console.error('Error updating notification:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update notification',
      error: process.env.NODE_ENV === 'development' ? error.message : 'server_error'
    });
  }
});

/**
 * @route   PUT /api/anonymous/notifications/read-all
 * @desc    Mark all notifications as read
 * @access  Private (Anonymous)
 */
router.put('/notifications/read-all', anonymousAuthMiddleware, async (req, res) => {
  try {
    // Optimized query to only update those that need updating
    const result = await AnonymousUserNotification.updateMany(
      { anonymousUser: req.anonymousUser._id, read: false },
      { $set: { read: true } }
    );
    
    res.status(200).json({
      success: true,
      message: 'All notifications marked as read',
      count: result.modifiedCount
    });
  } catch (error) {
    console.error('Error updating notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update notifications',
      error: process.env.NODE_ENV === 'development' ? error.message : 'server_error'
    });
  }
});

/**
 * @route   DELETE /api/anonymous/notifications/:id
 * @desc    Delete a notification
 * @access  Private (Anonymous)
 */
router.delete('/notifications/:id', anonymousAuthMiddleware, async (req, res) => {
  try {
    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid notification ID',
        error: 'invalid_notification_id'
      });
    }
    
    const notification = await AnonymousUserNotification.findOneAndDelete({
      _id: req.params.id,
      anonymousUser: req.anonymousUser._id
    });
    
    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found',
        error: 'notification_not_found'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Notification deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete notification',
      error: process.env.NODE_ENV === 'development' ? error.message : 'server_error'
    });
  }
});

/**
 * @route   GET /api/anonymous/check-updates/:lastChecked
 * @desc    Check for new notifications, responses or status changes since last check
 * @access  Private (Anonymous)
 */
router.get('/check-updates/:lastChecked', anonymousAuthMiddleware, async (req, res) => {
  try {
    // Parse and validate timestamp
    const timestamp = parseInt(req.params.lastChecked);
    if (isNaN(timestamp) || timestamp <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid lastChecked timestamp',
        error: 'invalid_timestamp'
      });
    }
    
    const lastChecked = new Date(timestamp);
    
    // Use Promise.all for efficient parallel processing
    const [
      complaints,
      newNotificationsCount
    ] = await Promise.all([
      // Get IDs of user's complaints
      Complaint.find({
        anonymousUser: req.anonymousUser._id
      })
      .select('_id')
      .lean(),
      
      // Check for new notifications
      AnonymousUserNotification.countDocuments({
        anonymousUser: req.anonymousUser._id,
        createdAt: { $gt: lastChecked }
      })
    ]);
    
    // Get complaint IDs
    const complaintIds = complaints.map(complaint => complaint._id);
    
    // If there are no complaints, return early
    if (complaintIds.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          newNotifications: newNotificationsCount,
          newResponses: 0,
          statusChanges: 0,
          hasUpdates: newNotificationsCount > 0
        }
      });
    }
    
    // Get responses and status changes in parallel
    const [newResponsesCount, statusChanges] = await Promise.all([
      // Check for new responses to user's complaints
      Response.countDocuments({
        complaint: { $in: complaintIds },
        userType: { $ne: 'anonymous_user' }, // Exclude user's own responses
        createdAt: { $gt: lastChecked }
      }),
      
      // Check for status changes on complaints
      Response.countDocuments({
        complaint: { $in: complaintIds },
        'statusChange.newStatus': { $exists: true },
        createdAt: { $gt: lastChecked }
      })
    ]);
    
    res.status(200).json({
      success: true,
      data: {
        newNotifications: newNotificationsCount,
        newResponses: newResponsesCount,
        statusChanges: statusChanges,
        hasUpdates: (newNotificationsCount + newResponsesCount + statusChanges) > 0
      }
    });
  } catch (error) {
    console.error('Error checking for updates:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check for updates',
      error: process.env.NODE_ENV === 'development' ? error.message : 'server_error'
    });
  }
});

/**
 * @route   GET /api/anonymous/health
 * @desc    Health check endpoint
 * @access  Public
 */
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'Anonymous user service is running',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;