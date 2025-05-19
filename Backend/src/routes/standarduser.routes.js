const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const StandardUser = require('../models/StandardUser');
const Complaint = require('../models/Complaint');
const Category = require('../models/Category');
const Response = require('../models/Response');
const StandardUserNotification = require('../models/StandardUserNotification');
const { createUploadMiddleware } = require('../multerConfig');
const jwt = require('jsonwebtoken');
const { UserType } = require('../models/Response');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

// Initialize nodemailer transporter with Brevo SMTP
const transporter = nodemailer.createTransport({
  host: process.env.BREVO_SMTP_HOST,
  port: process.env.BREVO_SMTP_PORT,
  secure: false,
  auth: {
    user: process.env.BREVO_SMTP_USER,
    pass: process.env.BREVO_SMTP_KEY,
  },
});

// Create upload middleware instances for different file types
const profileImageUpload = createUploadMiddleware('profile_images', 1);
const complaintAttachmentsUpload = createUploadMiddleware('complaint_attachments', 5);
const responseAttachmentsUpload = createUploadMiddleware('response_attachments', 3);

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
    from: `"${process.env.EMAIL_FROM_NAME || 'SAYIT Platform'}" <${process.env.EMAIL_FROM || 'noreply@sayit.com'}>`,
    to: options.email,
    subject: options.subject,
    html: options.message,
  };

  // Add retry logic for Render deployment (can have intermittent connectivity)
  let retries = 3;
  while (retries > 0) {
    try {
      return await transporter.sendMail(mailOptions);
    } catch (error) {
      retries--;
      if (retries === 0) throw error;
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
};

/**
 * @route   POST /api/standarduser/register
 * @desc    Register a new standard user
 * @access  Public
 */
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, phone, address, language } = req.body;

    // Validate required fields
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide name, email, and password'
      });
    }

    // Check password strength
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long'
      });
    }

    // Check if user already exists
    const existingUser = await StandardUser.findByEmail(email);
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'Email is already registered'
      });
    }

    // Process address if provided
    let parsedAddress;
    if (address) {
      try {
        parsedAddress = typeof address === 'string' ? JSON.parse(address) : address;
      } catch (e) {
        return res.status(400).json({
          success: false,
          message: 'Invalid address format'
        });
      }
    }

    // Create new user with MongoDB transaction for data consistency
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Create the user
      const user = new StandardUser({
        name,
        email,
        password,
        phone,
        address: parsedAddress,
        preferences: {
          language: language || 'en',
          notificationSettings: {
            email: true,
            app: true
          }
        }
      });

      // Generate verification token
      const verificationToken = user.generateVerificationToken();

      await user.save({ session });

      await session.commitTransaction();
      session.endSession();

      // Send verification email (non-blocking)
      setImmediate(async () => {
        try {
          const verificationUrl = `${process.env.FRONTEND_URL || 'https://sayit.com'}/verify-email?token=${verificationToken}`;
          
          const message = `
            <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px;">
              <h2 style="color: #2a9d8f;">Welcome to SAYIT!</h2>
              <p>Hello ${name},</p>
              <p>Thank you for registering with the SAYIT platform. To complete your registration, please verify your email address.</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${verificationUrl}" 
                  style="background-color: #2a9d8f; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                  Verify Email Address
                </a>
              </div>
              <p>This verification link will expire in 24 hours.</p>
              <p>If you did not create this account, please ignore this email.</p>
              <hr style="border: 1px solid #eee; margin-top: 20px;">
              <p style="font-size: 12px; color: #777;">
                This is an automated message from SAYIT. Please do not reply to this email.
              </p>
            </div>
          `;

          await sendEmail({
            email: user.email,
            subject: 'SAYIT - Verify Your Email Address',
            message
          });
        } catch (error) {
          console.warn('Failed to send verification email:', error);
          // Continue execution even if email fails
        }
      });

      // Return success without sensitive data
      res.status(201).json({
        success: true,
        message: 'Registration successful! Please check your email to verify your account.',
        data: {
          id: user._id,
          name: user.name,
          email: user.email,
          isEmailVerified: user.isEmailVerified
        }
      });
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  } catch (error) {
    console.error('Registration error:', error);
    
    // Handle duplicate key error specifically
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email already exists'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to register user',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/standarduser/verify/:token
 * @desc    Verify user email
 * @access  Public
 */
router.get('/verify/:token', async (req, res) => {
  try {
    const { token } = req.params;
    
    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Verification token is required'
      });
    }

    // Hash the token to compare with stored hash
    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    // Find user with this verification token that hasn't expired
    const user = await StandardUser.findOne({
      verificationToken: hashedToken,
      verificationExpire: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired verification token'
      });
    }

    // Update user as verified
    user.isEmailVerified = true;
    user.verificationToken = undefined;
    user.verificationExpire = undefined;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Email verification successful. You can now log in.'
    });
  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Email verification failed',
      error: error.message
    });
  }
});

// Authentication middleware with performance optimizations
const authMiddleware = async (req, res, next) => {
  try {
    // Check for Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please log in.'
      });
    }

    // Extract token
    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token format'
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }

    // Get user ID from token 
    const userId = decoded.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token structure'
      });
    }

    // Find user - use lean() for better performance when we don't need a Mongoose document
    const user = await StandardUser.findById(userId);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been deactivated. Please contact support.'
      });
    }

    // Add user to request object
    req.user = user;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Server error during authentication'
    });
  }
};

/**
 * @route   GET /api/standarduser/profile
 * @desc    Get standard user profile
 * @access  Private
 */
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    // User is already attached to req by authMiddleware
    return res.status(200).json({
      success: true,
      data: req.user.getPublicProfile()
    });
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user profile'
    });
  }
});

/**
 * @route   PUT /api/standarduser/profile
 * @desc    Update user profile
 * @access  Private
 */
router.put('/profile', authMiddleware, profileImageUpload.single('profileImage'), handleUploadError, async (req, res) => {
  try {
    const { name, phone, address, language } = req.body;
    const user = req.user;

    // Update allowed fields
    if (name) user.name = name;
    if (phone) user.phone = phone;
    
    // Update address if provided - improved JSON parsing with error handling
    if (address) {
      try {
        user.address = typeof address === 'string' ? JSON.parse(address) : address;
      } catch (e) {
        return res.status(400).json({
          success: false,
          message: 'Invalid address format'
        });
      }
    }

    // Update language preference
    if (language) user.preferences.language = language;

    // Update profile image if uploaded
    if (req.file) {
      user.profileImage = req.file.path;
    }

    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: user.getPublicProfile()
    });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating profile'
    });
  }
});

/**
 * @route   POST /api/standarduser/complaints
 * @desc    Submit a new complaint
 * @access  Private
 */
router.post('/complaints', authMiddleware, complaintAttachmentsUpload.array('attachments', 5), handleUploadError, async (req, res) => {
  try {
    const { title, description, category, location } = req.body;
    
    // Validate required fields
    if (!title || !description || !category) {
      return res.status(400).json({
        success: false,
        message: 'Please provide title, description, and category'
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
          format: file.format || file.mimetype.split('/')[1],
          resourceType: file.resource_type || 
                      (file.mimetype.startsWith('image') ? 'image' : 
                      file.mimetype.startsWith('video') ? 'video' : 
                      file.mimetype.startsWith('audio') ? 'audio' : 'raw')
        });
      }
    }
    
    // Validate category exists and get default agency - lean() for better performance
    const categoryDoc = await Category.findById(category).populate('defaultAgency').lean();
    if (!categoryDoc) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }
    
    // Parse location with better error handling
    let parsedLocation;
    if (location) {
      try {
        parsedLocation = typeof location === 'string' ? JSON.parse(location) : location;
      } catch (e) {
        return res.status(400).json({
          success: false,
          message: 'Invalid location format'
        });
      }
    }
    
    // Create new complaint using MongoDB's transaction capability
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      // Create new complaint
      const complaint = new Complaint({
        title,
        description,
        submissionType: 'standard',
        standardUser: req.user._id,
        category,
        agency: categoryDoc.defaultAgency ? categoryDoc.defaultAgency._id : null,
        location: parsedLocation,
        attachments,
        status: 'pending'
      });
      
      await complaint.save({ session });
      
      // Create notification for the user
      await StandardUserNotification.createComplaintSubmissionNotification(
        req.user._id,
        complaint._id,
        complaint.title,
        complaint.trackingId
      );
      
      await session.commitTransaction();
      session.endSession();
      
      // Send confirmation email if user has email notifications enabled (non-blocking)
      if (req.user.preferences?.notificationSettings?.email) {
        setImmediate(async () => {
          try {
            const message = `
              <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px;">
                <h2 style="color: #2a9d8f;">Complaint Submitted Successfully</h2>
                <p>Hello ${req.user.name},</p>
                <p>Your complaint "${title}" has been submitted successfully to the SAYIT platform.</p>
                <p><strong>Tracking ID:</strong> ${complaint.trackingId}</p>
                <p>You can track the status of your complaint using this tracking ID on our platform.</p>
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${process.env.FRONTEND_URL || 'https://sayit.com'}/dashboard/track/${complaint.trackingId}" 
                    style="background-color: #2a9d8f; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                    Track Your Complaint
                  </a>
                </div>
                <p>We will notify you as there are updates to your complaint.</p>
                <hr style="border: 1px solid #eee; margin-top: 20px;">
                <p style="font-size: 12px; color: #777;">
                  This is an automated message from SAYIT. Please do not reply to this email.
                </p>
              </div>
            `;

            await sendEmail({
              email: req.user.email,
              subject: `SAYIT - Complaint Submitted (${complaint.trackingId})`,
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
      error: error.message
    });
  }
});

/**
 * @route   POST /api/standarduser/complaints/:id/responses
 * @desc    Add a response to a complaint
 * @access  Private
 */
router.post('/complaints/:id/responses', authMiddleware, responseAttachmentsUpload.array('attachments', 3), handleUploadError, async (req, res) => {
  try {
    const { content } = req.body;
    const { id } = req.params;
    
    // Validate input
    if (!content) {
      return res.status(400).json({
        success: false,
        message: 'Response content is required'
      });
    }
    
    // Check if complaint exists and belongs to user - Use projection to get only needed fields
    const complaint = await Complaint.findOne(
      {
        _id: id,
        standardUser: req.user._id,
        submissionType: 'standard'
      }, 
      'status title'
    );
    
    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: 'Complaint not found'
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
          format: file.format || file.mimetype.split('/')[1],
          resourceType: file.resource_type || 
                      (file.mimetype.startsWith('image') ? 'image' : 
                      file.mimetype.startsWith('video') ? 'video' : 
                      file.mimetype.startsWith('audio') ? 'audio' : 'raw')
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
        userType: UserType.STANDARD_USER,
        standardUser: req.user._id,
        content,
        attachments,
        isInternal: false
      });
      
      await response.save({ session });
      
      // If complaint is resolved or closed, and user adds a response, reopen it
      if (['resolved', 'closed'].includes(complaint.status)) {
        const oldStatus = complaint.status;
        complaint.status = 'in_progress';
        complaint.statusNote = 'Reopened due to user response';
        await complaint.save({ session });
        
        // Create notification for status change
        await StandardUserNotification.createStatusChangeNotification(
          req.user._id,
          complaint._id,
          complaint.title,
          oldStatus,
          'in_progress'
        );
      }
      
      await session.commitTransaction();
      session.endSession();
      
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
      error: error.message
    });
  }
});

/**
 * @route   GET /api/standarduser/notifications
 * @desc    Get user's notifications
 * @access  Private
 */
router.get('/notifications', authMiddleware, async (req, res) => {
  try {
    // Get pagination parameters with better validation
    const page = Math.max(1, parseInt(req.query.page) || 1); // Prevent negative page
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10)); // Limit between 1-50
    const skip = (page - 1) * limit;
    
    // Build query based on filters
    const query = { user: req.user._id };
    
    // Filter by read/unread status if specified
    if (req.query.read === 'true') {
      query.read = true;
    } else if (req.query.read === 'false') {
      query.read = false;
    }
    
    // Filter by type if specified
    if (req.query.type && ['complaint_update', 'response_received', 'system', 'agency_update'].includes(req.query.type)) {
      query.type = req.query.type;
    }
    
    // Use Promise.all to parallelize DB queries for better performance
    const [total, notifications, unreadCount] = await Promise.all([
      StandardUserNotification.countDocuments(query),
      StandardUserNotification.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(), // Use lean() for better performance as we don't need Mongoose document methods
      StandardUserNotification.countDocuments({
        user: req.user._id,
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
      error: error.message
    });
  }
});

/**
 * @route   PUT /api/standarduser/notifications/:id/read
 * @desc    Mark a notification as read
 * @access  Private
 */
router.put('/notifications/:id/read', authMiddleware, async (req, res) => {
  try {
    // Validate MongoDB ObjectId to prevent unnecessary DB queries
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid notification ID'
      });
    }
    
    const notification = await StandardUserNotification.findOne({
      _id: req.params.id,
      user: req.user._id
    });
    
    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }
    
    // Only update if not already read to avoid unnecessary DB writes
    if (!notification.read) {
      await notification.markAsRead();
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
      error: error.message
    });
  }
});

/**
 * @route   PUT /api/standarduser/notifications/read-all
 * @desc    Mark all notifications as read
 * @access  Private
 */
router.put('/notifications/read-all', authMiddleware, async (req, res) => {
  try {
    // Optimized query to only update those that need updating
    const result = await StandardUserNotification.updateMany(
      { user: req.user._id, read: false },
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
      error: error.message
    });
  }
});

/**
 * @route   GET /api/standarduser/track/:trackingId
 * @desc    Track a complaint by tracking ID
 * @access  Private
 */
router.get('/track/:trackingId', authMiddleware, async (req, res) => {
  try {
    const { trackingId } = req.params;
    
    // Trim and sanitize tracking ID
    const sanitizedTrackingId = trackingId.trim();
    if (!sanitizedTrackingId) {
      return res.status(400).json({
        success: false,
        message: 'Invalid tracking ID'
      });
    }
    
    // Find complaint with selective population to minimize data transfer
    const complaint = await Complaint.findOne({ trackingId: sanitizedTrackingId })
      .populate('category', 'name')
      .populate('agency', 'name shortName')
      .populate('assignedTo', 'name');
    
    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: 'No complaint found with this tracking ID'
      });
    }

    // Check if this is the user's own complaint or publicly trackable
    const isOwnComplaint = complaint.standardUser && 
      complaint.standardUser.toString() === req.user._id.toString();
    
    if (!isOwnComplaint && !complaint.isPublic) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to view this complaint'
      });
    }
    
    // Get responses only if it's the user's own complaint
    let responses = [];
    if (isOwnComplaint) {
      responses = await Response.find({ complaint: complaint._id })
        .populate('agent', 'name')
        .populate('staff', 'name')
        .sort({ createdAt: 1 })
        .lean(); // Use lean() for better performance
    }
    
    res.status(200).json({
      success: true,
      data: {
        complaint,
        responses: isOwnComplaint ? responses : [],
        isOwner: isOwnComplaint
      }
    });
  } catch (error) {
    console.error('Error tracking complaint:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to track complaint',
      error: error.message
    });
  }
});

/**
 * @route   PUT /api/standarduser/settings
 * @desc    Update user notification settings
 * @access  Private
 */
router.put('/settings', authMiddleware, async (req, res) => {
  try {
    const { emailNotifications, appNotifications, language } = req.body;
    
    // Validate inputs
    if (language && typeof language !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Invalid language format'
      });
    }
    
    // Update notification preferences
    if (emailNotifications !== undefined) {
      req.user.preferences.notificationSettings.email = Boolean(emailNotifications);
    }
    
    if (appNotifications !== undefined) {
      req.user.preferences.notificationSettings.app = Boolean(appNotifications);
    }
    
    if (language) {
      req.user.preferences.language = language;
    }
    
    await req.user.save();
    
    res.status(200).json({
      success: true,
      message: 'Settings updated successfully',
      data: {
        preferences: req.user.preferences
      }
    });
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update settings',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/standarduser/change-password
 * @desc    Change user password
 * @access  Private
 */
router.post('/change-password', authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Please provide current and new password'
      });
    }
    
    // Validate new password strength
    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 8 characters long'
      });
    }
    
    // Get user with password
    const user = await StandardUser.findById(req.user._id).select('+password');
    
    // Check current password
    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }
    
    // Update password
    user.password = newPassword;
    await user.save();
    
    // Send password change confirmation email (non-blocking)
    setImmediate(async () => {
      try {
        const message = `
          <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px;">
            <h2 style="color: #2a9d8f;">Password Changed</h2>
            <p>Hello ${user.name},</p>
            <p>Your password for the SAYIT platform has been successfully changed.</p>
            <p>If you did not make this change, please contact us immediately.</p>
            <hr style="border: 1px solid #eee; margin-top: 20px;">
            <p style="font-size: 12px; color: #777;">
              This is an automated message from SAYIT. Please do not reply to this email.
            </p>
          </div>
        `;
        
        await sendEmail({
          email: user.email,
          subject: 'SAYIT - Password Changed',
          message
        });
      } catch (error) {
        console.warn('Failed to send password change email:', error);
      }
    });
    
    res.status(200).json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to change password',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/standarduser/stats
 * @desc    Get user statistics dashboard
 * @access  Private
 */
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    // For MongoDB compatibility, ensure ObjectId is properly formatted
    const userObjectId = new mongoose.Types.ObjectId(req.user._id);
    
    // Use Promise.all to execute queries in parallel for better performance
    const [statusCounts, totalComplaints, unreadNotifications, recentComplaints] = await Promise.all([
      // Count complaints by status
      Complaint.aggregate([
        { $match: { standardUser: userObjectId } },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      
      // Get total complaints count
      Complaint.countDocuments({ standardUser: userObjectId }),
      
      // Get unread notifications count
      StandardUserNotification.countDocuments({
        user: userObjectId,
        read: false
      }),
      
      // Get IDs of user's complaints for recent activity lookup
      Complaint.find({ standardUser: userObjectId })
        .select('_id')
        .lean()
    ]);
    
    // Format status counts
    const formattedStatusCounts = {
      pending: 0,
      under_review: 0,
      assigned: 0,
      in_progress: 0,
      resolved: 0,
      closed: 0,
      rejected: 0
    };
    
    statusCounts.forEach(item => {
      formattedStatusCounts[item._id] = item.count;
    });
    
    // Get complaint IDs for recent activity query
    const complaintIds = recentComplaints.map(c => c._id);
    
    // Get recent activity (last 5 responses or status changes)
    const recentActivity = await Response.find({
      complaint: { $in: complaintIds }
    })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('complaint', 'title trackingId')
      .populate('agent', 'name')
      .populate('staff', 'name')
      .populate('standardUser', 'name')
      .lean(); // Use lean() for better performance
    
    res.status(200).json({
      success: true,
      data: {
        complaintsCount: totalComplaints,
        statusCounts: formattedStatusCounts,
        unreadNotifications,
        recentActivity
      }
    });
  } catch (error) {
    console.error('Error fetching user stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user statistics',
      error: error.message
    });
  }
});

module.exports = router;