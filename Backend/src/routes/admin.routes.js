const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const path = require('path');
const { createUploadMiddleware } = require('../multerConfig');

// Auth middleware
const authMiddleware = (req, res, next) => {
  try {
    // Get token from header
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Add user data to request
    req.user = decoded;
    
    next();
  } catch (error) {
    console.error('Auth middleware error:', error.message);
    res.status(401).json({
      success: false,
      message: 'Invalid token. Authorization denied.'
    });
  }
};

// Admin only middleware
const adminOnly = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin rights required.'
    });
  }
  next();
};

// Handle upload errors
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

// Import Models
const Staff = require('../models/Staff');
const Agency = require('../models/Agency');
const Agent = require('../models/Agent');
const StandardUser = require('../models/StandardUser');
const Category = require('../models/Category');
const TemporaryAccess = require('../models/TemporaryAccess');

const router = express.Router();

// Initialize nodemailer transporter with Brevo SMTP
const transporter = nodemailer.createTransport({
  host: process.env.BREVO_SMTP_HOST,
  port: process.env.BREVO_SMTP_PORT,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.BREVO_SMTP_USER,
    pass: process.env.BREVO_SMTP_KEY,
  },
  pool: true, // Use connection pooling for better reliability
  maxConnections: 5, // Limit connections to avoid rate limits
  maxMessages: 100, // Limit messages per connection
});

/**
 * Send an email using Brevo with retry mechanism
 * @param {Object} options - Email options
 * @param {string} options.email - Recipient email address
 * @param {string} options.subject - Email subject
 * @param {string} options.message - Email content (HTML)
 * @returns {Promise} - Resolves when email is sent
 */
const sendEmail = async (options) => {
  const mailOptions = {
    from: `"${process.env.BREVO_FROM_NAME || 'SAYIT Platform'}" <${process.env.BREVO_FROM_EMAIL || process.env.BREVO_SMTP_USER}>`,
    to: options.email,
    subject: options.subject,
    html: options.message,
  };

  // Add retry logic for better reliability
  let retries = 3;
  while (retries > 0) {
    try {
      return await transporter.sendMail(mailOptions);
    } catch (error) {
      retries--;
      if (retries === 0) throw error;
      // Wait before retrying with exponential backoff
      await new Promise(resolve => setTimeout(resolve, (4 - retries) * 1000));
    }
  }
};

// Create upload middleware for staff profile images
const profileImageUpload = createUploadMiddleware('staff_profile_images', 1);
// Create upload middleware for agency logos
const logoImageUpload = createUploadMiddleware('agency_logos', 1);
// Create upload middleware for agent profile images
const agentProfileImageUpload = createUploadMiddleware('agent_profile_images', 1);
// Create upload middleware for user profile images
const userProfileImageUpload = createUploadMiddleware('user_profile_images', 1);

/**
 * =============================================
 * STAFF MANAGEMENT ROUTES
 * =============================================
 */

/**
 * @route   GET /api/admin/staff
 * @desc    Get all staff members, optionally filtered by role
 * @access  Admin only
 */
router.get('/staff', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { role, page = 1, limit = 20, sortBy = 'name', sortOrder = 'asc', search } = req.query;
    const filter = {};
    
    // Apply role filter if provided
    if (role && ['admin', 'supervisor', 'moderator', 'analyst'].includes(role)) {
      filter.role = role;
    }

    // Only return active staff by default unless specifically requested
    if (req.query.includeInactive === 'true') {
      // If explicitly including inactive, don't filter by isActive
    } else {
      filter.isActive = true;
    }
    
    // Add name/email search if provided
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Validate ObjectId before query to prevent errors
    if (req.query.id && mongoose.Types.ObjectId.isValid(req.query.id)) {
      filter._id = req.query.id;
    }

    // Parse pagination params
    const pageNum = parseInt(page);
    const limitNum = Math.min(parseInt(limit), 100); // Cap at 100 records
    const skip = (pageNum - 1) * limitNum;
    
    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;
    
    // Use promise.all for parallel processing - better performance
    const [staffMembers, total] = await Promise.all([
      Staff.find(filter)
        .select('-password -resetPasswordToken -resetPasswordExpire')
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .lean(), // Use lean() for better MongoDB performance
      Staff.countDocuments(filter)
    ]);
    
    // Group members by role if requested
    let result = staffMembers;
    if (req.query.grouped === 'true') {
      result = staffMembers.reduce((acc, member) => {
        if (!acc[member.role]) {
          acc[member.role] = [];
        }
        acc[member.role].push(member);
        return acc;
      }, {});
    }

    res.status(200).json({
      success: true,
      message: 'Staff members fetched successfully.',
      count: staffMembers.length,
      total: total,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum)
      },
      data: result
    });
  } catch (error) {
    console.error('Error fetching staff members:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch staff members.',
      error: error.message,
    });
  }
});

/**
 * @route   GET /api/admin/staff/:id
 * @desc    Get a single staff member by ID
 * @access  Admin only
 */
router.get('/staff/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    // Validate ObjectId before query
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid staff ID format'
      });
    }
    
    const staffMember = await Staff.findById(req.params.id)
      .select('-password -resetPasswordToken -resetPasswordExpire')
      .lean();
    
    if (!staffMember) {
      return res.status(404).json({
        success: false,
        message: 'Staff member not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Staff member fetched successfully.',
      data: staffMember
    });
  } catch (error) {
    console.error('Error fetching staff member:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch staff member.',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/admin/staff
 * @desc    Add a new staff member with email notification
 * @access  Admin only
 */
router.post('/staff', authMiddleware, adminOnly, profileImageUpload.single('profileImage'),handleUploadError, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { name, email, password, role } = req.body;
    
    // Input validation
    if (!name || !email) {
      return res.status(400).json({
        success: false,
        message: 'Name and email are required fields'
      });
    }
    
    // Email format validation
    const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address'
      });
    }
    
    // Check if email already exists
    const existingStaff = await Staff.findOne({ email: email.toLowerCase() });
    if (existingStaff) {
      return res.status(400).json({
        success: false,
        message: 'Email already in use by another staff member.'
      });
    }

    // Generate a temporary password if none provided
    const generatedPassword = password || crypto.randomBytes(8).toString('hex');

    // Create new staff with provided data
    const newStaff = new Staff({
      name,
      email: email.toLowerCase(),
      password: generatedPassword,
      role: role || 'moderator', // Default role if not specified
      resetPasswordToken: crypto.randomBytes(20).toString('hex'),
      resetPasswordExpire: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
    });
    
    // Add profile image if uploaded
    if (req.file) {
      newStaff.profileImage = req.file.path;
    }
    
    await newStaff.save({ session });

    // Create password setup URL
    const baseUrl = process.env.FRONTEND_URL || `${req.protocol}://${req.get('host')}`;
    const passwordSetupUrl = `${baseUrl}/staff-setup/${newStaff.resetPasswordToken}`;
    
    // Prepare welcome email with password setup link
    const message = `
      <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px;">
        <h2 style="color: #2a9d8f;">Welcome to SAYIT Citizen Engagement Platform</h2>
        <p>Hello ${name},</p>
        <p>You have been added as a new staff member with the role of <strong>${role || 'moderator'}</strong>.</p>
        <p>To set up your account, please click the button below to create your password:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${passwordSetupUrl}" style="background-color: #2a9d8f; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Set Up My Account</a>
        </div>
        <p>This link will expire in 24 hours for security purposes.</p>
        <p>If you did not expect this invitation, please ignore this email or contact the administrator.</p>
        <hr style="border: 1px solid #eee; margin-top: 20px;">
        <p style="font-size: 12px; color: #777;">
          This is an automated message from the SAYIT platform. Please do not reply to this email.
        </p>
      </div>
    `;
    
    try {
      // Send welcome email
      await sendEmail({
        email: newStaff.email,
        subject: 'Welcome to SAYIT - Staff Account Setup',
        message
      });
      
      // Commit transaction only after email is sent successfully
      await session.commitTransaction();
      session.endSession();
    } catch (error) {
      console.warn('Email sending failed:', error);
      // Commit anyway as we still want to create the account even if email fails
      await session.commitTransaction();
      session.endSession();
    }

    // Return the created staff member without sensitive information
    const staffToReturn = newStaff.toObject();
    delete staffToReturn.password;
    delete staffToReturn.resetPasswordToken;
    delete staffToReturn.resetPasswordExpire;
    
    res.status(201).json({
      success: true,
      message: 'Staff member created successfully and invitation email sent.',
      data: staffToReturn,
    });
  } catch (error) {
    // Roll back transaction on error
    await session.abortTransaction();
    session.endSession();
    
    console.error('Error creating staff member:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create staff member.',
      error: error.message,
    });
  }
});

/**
 * @route   POST /api/admin/staff/setup-account/:token
 * @desc    Staff account setup (for initial password setting after admin creates account)
 * @access  Public (with admin-generated token)
 */
router.post('/staff/setup-account/:token', async (req, res) => {
  try {
    const { password } = req.body;
    const { token } = req.params;

    // Validate password strength
    if (!password || password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long'
      });
    }

    // Find staff by reset token and check if token is still valid
    const staff = await Staff.findOne({
      resetPasswordToken: token,
      resetPasswordExpire: { $gt: Date.now() }
    });

    if (!staff) {
      return res.status(400).json({
        success: false,
        message: 'Setup token is invalid or has expired'
      });
    }

    // Set new password and clear reset token fields
    staff.password = password;
    staff.resetPasswordToken = undefined;
    staff.resetPasswordExpire = undefined;
    staff.lastLogin = new Date(); // Set initial login time

    await staff.save();

    // Send confirmation email
    const baseUrl = process.env.FRONTEND_URL || `${req.protocol}://${req.get('host')}`;
    const loginUrl = `${baseUrl}/staff-login`;
    
    const message = `
      <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px;">
        <h2 style="color: #2a9d8f;">Account Setup Complete</h2>
        <p>Hello ${staff.name},</p>
        <p>Your SAYIT staff account has been successfully set up.</p>
        <p>You can now log in to the platform with your email address and the password you just created.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${loginUrl}" style="background-color: #2a9d8f; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Log In to Your Account</a>
        </div>
        <hr style="border: 1px solid #eee; margin-top: 20px;">
        <p style="font-size: 12px; color: #777;">
          This is an automated message from the SAYIT platform. Please do not reply to this email.
        </p>
      </div>
    `;

    try {
      await sendEmail({
        email: staff.email,
        subject: 'SAYIT - Account Setup Complete',
        message
      });
    } catch (error) {
      // Log but continue - email sending failure shouldn't block account setup
      console.warn('Confirmation email failed to send:', error);
    }

    res.status(200).json({
      success: true,
      message: 'Account setup completed successfully'
    });
  } catch (error) {
    console.error('Account setup error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred during account setup',
      error: error.message
    });
  }
});

/**
 * @route   PUT /api/admin/staff/:id
 * @desc    Update a staff member 
 * @access  Admin only
 */
router.put('/staff/:id', authMiddleware, adminOnly, profileImageUpload.single('profileImage'),handleUploadError, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, role, isActive, password } = req.body;
    
    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid staff ID format'
      });
    }

    // Find staff member
    const staff = await Staff.findById(id);
    if (!staff) {
      return res.status(404).json({ 
        success: false,
        message: 'Staff member not found.' 
      });
    }
      // Role-based access control
    // Only admins can change roles or active status
    // Staff can only update their own info
    if (req.user.role !== 'admin' && req.user._id.toString() !== id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this staff member'
      });
    }

    let wasEmailChanged = false;
    let oldEmail = staff.email;
    
    // Check if email is being changed and if it's already in use
    if (email && email.toLowerCase() !== staff.email) {
      const existingStaff = await Staff.findOne({ 
        email: email.toLowerCase(),
        _id: { $ne: id } // Exclude current user
      });
      
      if (existingStaff) {
        return res.status(400).json({
          success: false,
          message: 'Email already in use by another staff member.'
        });
      }
      wasEmailChanged = true;
      staff.email = email.toLowerCase();
    }

    // Update basic fields if provided
    if (name) staff.name = name;
      // Only admins can change roles or active status
    if (req.user.role === 'admin') {
      if (role) staff.role = role;
      if (isActive !== undefined) staff.isActive = isActive;
    }

    // Update password if provided
    if (password && password.trim() !== '') {
      // Only allow self password update or admin update
      if (req.user._id.toString() === id || req.user.role === 'admin') {
        staff.password = password; // Will be hashed by the pre-save middleware
      } else {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to change other users\' passwords'
        });
      }
    }

    // Update profile image if uploaded
    if (req.file) {
      staff.profileImage = req.file.path;
    }

    await staff.save();

    // Return updated staff without sensitive information
    const updatedStaff = await Staff.findById(id)
      .select('-password -resetPasswordToken -resetPasswordExpire');

    // Send email notification if email was changed - run in background
    if (wasEmailChanged) {
      setImmediate(async () => {
        try {
          // Notify old email address
          const messageToOldEmail = `
            <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px;">
              <h2 style="color: #2a9d8f;">Email Address Changed</h2>
              <p>Hello ${staff.name},</p>
              <p>This is to notify you that the email address associated with your SAYIT staff account has been changed.</p>
              <p>Your account email has been updated from <strong>${oldEmail}</strong> to <strong>${staff.email}</strong>.</p>
              <p>If you did not request this change, please contact the administrator immediately.</p>
              <hr style="border: 1px solid #eee; margin-top: 20px;">
              <p style="font-size: 12px; color: #777;">
                This is an automated message from the SAYIT platform. Please do not reply to this email.
              </p>
            </div>
          `;
          
          await sendEmail({
            email: oldEmail,
            subject: 'SAYIT - Your Account Email Has Been Changed',
            message: messageToOldEmail
          });
          
          // Notify new email address
          const messageToNewEmail = `
            <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px;">
              <h2 style="color: #2a9d8f;">Email Address Confirmation</h2>
              <p>Hello ${staff.name},</p>
              <p>This email confirms that your SAYIT staff account email has been updated to this address.</p>
              <p>If you did not request this change, please contact the administrator immediately.</p>
              <hr style="border: 1px solid #eee; margin-top: 20px;">
              <p style="font-size: 12px; color: #777;">
                This is an automated message from the SAYIT platform. Please do not reply to this email.
              </p>
            </div>
          `;
          
          await sendEmail({
            email: staff.email,
            subject: 'SAYIT - Your Account Email Has Been Changed',
            message: messageToNewEmail
          });
        } catch (error) {
          console.warn('Failed to send email change notifications:', error);
        }
      });
    }

    res.status(200).json({
      success: true,
      message: 'Staff member updated successfully.',
      data: updatedStaff,
    });
  } catch (error) {
    console.error('Error updating staff member:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update staff member.',
      error: error.message,
    });
  }
});

/**
 * @route   POST /api/admin/staff/reset-password/:id
 * @desc    Reset password route (for admins to reset staff passwords)
 * @access  Admin only
 */
router.post('/staff/reset-password/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid staff ID format'
      });
    }
    
    // Find staff member
    const staff = await Staff.findById(id);
    if (!staff) {
      return res.status(404).json({ 
        success: false,
        message: 'Staff member not found.' 
      });
    }
    
    // Generate reset token
    const resetToken = crypto.randomBytes(20).toString('hex');
    
    // Update staff record
    staff.resetPasswordToken = resetToken;
    staff.resetPasswordExpire = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
    
    await staff.save();
    
    // Create reset URL
    const baseUrl = process.env.FRONTEND_URL || `${req.protocol}://${req.get('host')}`;
    const resetUrl = `${baseUrl}/staff-reset/${resetToken}`;
    
    // Prepare email
    const message = `
      <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px;">
        <h2 style="color: #2a9d8f;">Password Reset Request</h2>
        <p>Hello ${staff.name},</p>
        <p>A password reset has been initiated for your SAYIT staff account by an administrator.</p>
        <p>Please click the button below to set a new password:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" style="background-color: #2a9d8f; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Reset My Password</a>
        </div>
        <p>This link will expire in 24 hours for security purposes.</p>
        <p>If you did not expect this password reset, please contact the administrator immediately.</p>
        <hr style="border: 1px solid #eee; margin-top: 20px;">
        <p style="font-size: 12px; color: #777;">
          This is an automated message from the SAYIT platform. Please do not reply to this email.
        </p>
      </div>
    `;
    
    // Send email in the background to not block response
    setImmediate(async () => {
      try {
        await sendEmail({
          email: staff.email,
          subject: 'SAYIT - Password Reset',
          message
        });
      } catch (error) {
        console.error('Failed to send password reset email:', error);
        // Don't reset the token if email fails - the admin can try again
      }
    });
    
    res.status(200).json({
      success: true,
      message: 'Password reset link sent to staff member.',
    });
  } catch (error) {
    console.error('Error resetting staff password:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process password reset.',
      error: error.message,
    });
  }
});

/**
 * @route   DELETE /api/admin/staff/:id
 * @desc    Delete a staff member (soft delete by setting isActive to false)
 * @access  Admin only
 */
router.delete('/staff/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid staff ID format'
      });
    }
    
    // Find staff before update to get email
    const staff = await Staff.findById(id);
    if (!staff) {
      return res.status(404).json({ 
        success: false,
        message: 'Staff member not found.' 
      });
    }
      // Prevent self-deactivation
    if (req.user._id.toString() === id) {
      return res.status(400).json({
        success: false,
        message: 'You cannot deactivate your own account'
      });
    }
    
    // For best practices, use soft delete instead of hard delete
    const updatedStaff = await Staff.findByIdAndUpdate(
      id, 
      { isActive: false },
      { new: true }
    );

    // Send notification email in background
    setImmediate(async () => {
      try {
        const message = `
          <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px;">
            <h2 style="color: #2a9d8f;">Account Deactivation Notice</h2>
            <p>Hello ${staff.name},</p>
            <p>This is to inform you that your SAYIT staff account has been deactivated.</p>
            <p>If you believe this is an error, please contact the administrator.</p>
            <hr style="border: 1px solid #eee; margin-top: 20px;">
            <p style="font-size: 12px; color: #777;">
              This is an automated message from the SAYIT platform. Please do not reply to this email.
            </p>
          </div>
        `;
        
        await sendEmail({
          email: staff.email,
          subject: 'SAYIT - Account Deactivation Notice',
          message
        });
      } catch (error) {
        console.warn('Failed to send deactivation email:', error);
      }
    });

    res.status(200).json({ 
      success: true,
      message: 'Staff member deactivated successfully.',
      data: { id: updatedStaff._id }
    });
  } catch (error) {
    console.error('Error deactivating staff member:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to deactivate staff member.',
      error: error.message,
    });
  }
});

/**
 * @route   DELETE /api/admin/staff/:id/permanent
 * @desc    Hard delete a staff member (admin only)
 * @access  Admin only
 */
router.delete('/staff/:id/permanent', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid staff ID format'
      });
    }
      // Prevent self-deletion
    if (req.user._id.toString() === id) {
      return res.status(400).json({
        success: false,
        message: 'You cannot delete your own account'
      });
    }
    
    const deletedStaff = await Staff.findByIdAndDelete(id);

    if (!deletedStaff) {
      return res.status(404).json({ 
        success: false,
        message: 'Staff member not found.' 
      });
    }

    res.status(200).json({ 
      success: true,
      message: 'Staff member permanently deleted successfully.' 
    });
  } catch (error) {
    console.error('Error deleting staff member:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete staff member.',
      error: error.message,
    });
  }
});

/**
 * @route   POST /api/admin/staff/change-password/:id
 * @desc    Admin endpoint for changing staff password with current password verification
 * @access  Admin only
 */
router.post('/staff/change-password/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const { id } = req.params;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid staff ID format'
      });
    }    // Admin permissions already verified by adminOnly middleware

    // Find staff with password included
    const staff = await Staff.findById(id).select('+password');
    if (!staff) {
      return res.status(404).json({ 
        success: false,
        message: 'Staff member not found' 
      });
    }    // No need to verify current password for admin-initiated password changes

    // Validate new password
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ 
        success: false,
        message: 'New password must be at least 8 characters long' 
      });
    }

    // Update password
    staff.password = newPassword;
    await staff.save();

    // Send password change notification in the background
    setImmediate(async () => {
      try {
        const message = `
          <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px;">
            <h2 style="color: #2a9d8f;">Password Change Confirmation</h2>
            <p>Hello ${staff.name},</p>
            <p>This is to confirm that your password for your SAYIT staff account has been changed successfully.</p>
            <p>If you did not make this change, please contact the administrator immediately.</p>
            <hr style="border: 1px solid #eee; margin-top: 20px;">
            <p style="font-size: 12px; color: #777;">
              This is an automated message from the SAYIT platform. Please do not reply to this email.
            </p>
          </div>
        `;
        
        await sendEmail({
          email: staff.email,
          subject: 'SAYIT - Password Changed Successfully',
          message
        });
      } catch (error) {
        console.warn('Failed to send password change confirmation email:', error);
      }
    });

    res.status(200).json({
      success: true,
      message: 'Password updated successfully'
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
 * @route   GET /api/admin/dashboard/stats
 * @desc    Get admin dashboard statistics
 * @access  Admin only
 */
router.get('/dashboard/stats', authMiddleware, adminOnly, async (req, res) => {
  try {
    // Use Promise.all for parallel processing - optimized for MongoDB
    const [
      staffCounts,
      activeStaff,
      recentStaffLogins
    ] = await Promise.all([
      // Get staff counts by role
      Staff.aggregate([
        { $group: { _id: '$role', count: { $sum: 1 } } }
      ]),
      
      // Get active staff count
      Staff.countDocuments({ isActive: true }),
      
      // Get recent staff logins
      Staff.find({ lastLogin: { $exists: true, $ne: null } })
        .sort({ lastLogin: -1 })
        .limit(10)
        .select('name role lastLogin')
        .lean()
    ]);
    
    // Format staff counts by role
    const staffByRole = staffCounts.reduce((acc, curr) => {
      acc[curr._id] = curr.count;
      return acc;
    }, {
      admin: 0,
      supervisor: 0,
      moderator: 0,
      analyst: 0
    });
    
    res.status(200).json({
      success: true,
      data: {
        staffByRole,
        totalStaff: Object.values(staffByRole).reduce((sum, count) => sum + count, 0),
        activeStaff,
        recentActivity: recentStaffLogins
      }
    });
  } catch (error) {
    console.error('Error fetching admin statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard statistics',
      error: error.message
    });
  }
});

/**
 * =============================================
 * AGENCY MANAGEMENT ROUTES
 * =============================================
 */

/**
 * @route   GET /api/admin/agencies
 * @desc    Get all agencies with filtering and pagination
 * @access  Admin only
 */
router.get('/agencies', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { page = 1, limit = 20, sortBy = 'name', sortOrder = 'asc', search, isActive } = req.query;
    const filter = {};
    
    // Apply status filter if provided
    if (isActive !== undefined) {
      filter.isActive = isActive === 'true';
    }
    
    // Add name search if provided
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { shortName: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Parse pagination params
    const pageNum = parseInt(page);
    const limitNum = Math.min(parseInt(limit), 100); // Cap at 100 records
    const skip = (pageNum - 1) * limitNum;
    
    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;
    
    // Use promise.all for parallel processing - better performance
    const [agencies, total] = await Promise.all([
      Agency.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .lean(), // Use lean() for better MongoDB performance
      Agency.countDocuments(filter)
    ]);
    
    res.status(200).json({
      success: true,
      message: 'Agencies fetched successfully.',
      count: agencies.length,
      total: total,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum)
      },
      data: agencies
    });
  } catch (error) {
    console.error('Error fetching agencies:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch agencies.',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/admin/agencies/:id
 * @desc    Get a single agency by ID
 * @access  Admin only
 */
router.get('/agencies/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    // Validate ObjectId before query
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid agency ID format'
      });
    }
    
    const agency = await Agency.findById(req.params.id).lean();
    
    if (!agency) {
      return res.status(404).json({
        success: false,
        message: 'Agency not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Agency fetched successfully.',
      data: agency
    });
  } catch (error) {
    console.error('Error fetching agency:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch agency.',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/admin/agencies
 * @desc    Create a new agency
 * @access  Admin only
 */
router.post('/agencies', authMiddleware, adminOnly, logoImageUpload.single('logo'), handleUploadError, async (req, res) => {
  try {
    const { name, shortName, description, contactEmail, contactPhone, address, website } = req.body;
    
    // Input validation
    if (!name || name.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Agency name is required'
      });
    }
    
    // Check if agency already exists
    const existingAgency = await Agency.findOne({ 
      $or: [
        { name: { $regex: new RegExp(`^${name.trim()}$`, 'i') }},
        ...(shortName ? [{ shortName: { $regex: new RegExp(`^${shortName.trim()}$`, 'i') }}] : [])
      ]
    });
    
    if (existingAgency) {
      return res.status(400).json({
        success: false,
        message: 'Agency with this name or short name already exists'
      });
    }
    
    // Email format validation if provided
    if (contactEmail) {
      const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
      if (!emailRegex.test(contactEmail)) {
        return res.status(400).json({
          success: false,
          message: 'Please provide a valid contact email address'
        });
      }
    }
    
    // Create new agency
    const newAgency = new Agency({
      name: name.trim(),
      shortName: shortName ? shortName.trim() : undefined,
      description: description ? description.trim() : undefined,
      contactEmail: contactEmail ? contactEmail.toLowerCase() : undefined,
      contactPhone: contactPhone ? contactPhone.trim() : undefined,
      address: address ? address.trim() : undefined,
      website: website ? website.trim() : undefined
    });
    
    // Add logo if uploaded
    if (req.file) {
      newAgency.logo = req.file.path;
    }
    
    await newAgency.save();
    
    res.status(201).json({
      success: true,
      message: 'Agency created successfully.',
      data: newAgency
    });
  } catch (error) {
    console.error('Error creating agency:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create agency.',
      error: error.message
    });
  }
});

/**
 * @route   PUT /api/admin/agencies/:id
 * @desc    Update an agency
 * @access  Admin only
 */
router.put('/agencies/:id', authMiddleware, adminOnly, logoImageUpload.single('logo'), handleUploadError, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, shortName, description, contactEmail, contactPhone, address, website, isActive } = req.body;
    
    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid agency ID format'
      });
    }
    
    // Find agency
    const agency = await Agency.findById(id);
    if (!agency) {
      return res.status(404).json({
        success: false,
        message: 'Agency not found'
      });
    }
    
    // Check if name or shortName already exists for another agency
    if ((name && name !== agency.name) || (shortName && shortName !== agency.shortName)) {
      const existingAgency = await Agency.findOne({
        _id: { $ne: id },
        $or: [
          ...(name ? [{ name: { $regex: new RegExp(`^${name.trim()}$`, 'i') }}] : []),
          ...(shortName ? [{ shortName: { $regex: new RegExp(`^${shortName.trim()}$`, 'i') }}] : [])
        ]
      });
      
      if (existingAgency) {
        return res.status(400).json({
          success: false,
          message: 'Another agency with this name or short name already exists'
        });
      }
    }
    
    // Email format validation if provided
    if (contactEmail) {
      const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
      if (!emailRegex.test(contactEmail)) {
        return res.status(400).json({
          success: false,
          message: 'Please provide a valid contact email address'
        });
      }
    }
    
    // Update fields if provided
    if (name) agency.name = name.trim();
    if (shortName !== undefined) agency.shortName = shortName ? shortName.trim() : '';
    if (description !== undefined) agency.description = description ? description.trim() : '';
    if (contactEmail) agency.contactEmail = contactEmail.toLowerCase();
    if (contactPhone !== undefined) agency.contactPhone = contactPhone ? contactPhone.trim() : '';
    if (address !== undefined) agency.address = address ? address.trim() : '';
    if (website !== undefined) agency.website = website ? website.trim() : '';
    if (isActive !== undefined) agency.isActive = isActive === true || isActive === 'true';
    
    // Update logo if uploaded
    if (req.file) {
      agency.logo = req.file.path;
    }
    
    agency.updatedAt = Date.now();
    await agency.save();
    
    res.status(200).json({
      success: true,
      message: 'Agency updated successfully.',
      data: agency
    });
  } catch (error) {
    console.error('Error updating agency:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update agency.',
      error: error.message
    });
  }
});

/**
 * @route   DELETE /api/admin/agencies/:id
 * @desc    Soft delete an agency by setting isActive to false
 * @access  Admin only
 */
router.delete('/agencies/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid agency ID format'
      });
    }
    
    // Find agency
    const agency = await Agency.findById(id);
    if (!agency) {
      return res.status(404).json({
        success: false,
        message: 'Agency not found'
      });
    }
    
    // Check if agency has active agents
    const activeAgentsCount = await Agent.countDocuments({
      agencyId: id,
      isActive: true
    });
    
    if (activeAgentsCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot deactivate agency with ${activeAgentsCount} active agents. Please deactivate or reassign all agents first.`
      });
    }
    
    // Soft delete by setting isActive to false
    agency.isActive = false;
    agency.updatedAt = Date.now();
    await agency.save();
    
    res.status(200).json({
      success: true,
      message: 'Agency deactivated successfully.',
      data: { id: agency._id }
    });
  } catch (error) {
    console.error('Error deactivating agency:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to deactivate agency.',
      error: error.message
    });
  }
});

/**
 * @route   DELETE /api/admin/agencies/:id/permanent
 * @desc    Permanently delete an agency and all related agents
 * @access  Admin only
 */
router.delete('/agencies/:id/permanent', authMiddleware, adminOnly, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { id } = req.params;
    
    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid agency ID format'
      });
    }
    
    // Find agency
    const agency = await Agency.findById(id);
    if (!agency) {
      return res.status(404).json({
        success: false,
        message: 'Agency not found'
      });
    }
    
    // Check if agency has active agents that would become orphaned
    const activeAgentsCount = await Agent.countDocuments({
      agencyId: id,
      isActive: true
    });
    
    if (activeAgentsCount > 0 && !req.query.force === 'true') {
      return res.status(400).json({
        success: false,
        message: `Cannot delete agency with ${activeAgentsCount} active agents. Please deactivate or reassign all agents first, or use force=true to deactivate all related agents.`
      });
    }
    
    // If force option is used, deactivate all related agents first
    if (req.query.force === 'true' && activeAgentsCount > 0) {
      await Agent.updateMany(
        { agencyId: id },
        { isActive: false },
        { session }
      );
    }
    
    // Delete the agency
    await Agency.findByIdAndDelete(id, { session });
    
    await session.commitTransaction();
    session.endSession();
    
    res.status(200).json({
      success: true,
      message: 'Agency permanently deleted successfully.',
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    
    console.error('Error deleting agency:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete agency.',
      error: error.message
    });
  }
});

/**
 * =============================================
 * AGENT MANAGEMENT ROUTES
 * =============================================
 */

/**
 * @route   GET /api/admin/agents
 * @desc    Get all agents with filtering and pagination
 * @access  Admin only
 */
router.get('/agents', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { page = 1, limit = 20, sortBy = 'name', sortOrder = 'asc', search, agencyId, isActive } = req.query;
    const filter = {};
    
    // Apply agency filter if provided
    if (agencyId && mongoose.Types.ObjectId.isValid(agencyId)) {
      filter.agencyId = agencyId;
    }
    
    // Apply status filter if provided
    if (isActive !== undefined) {
      filter.isActive = isActive === 'true';
    }
    
    // Add name or email search if provided
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { position: { $regex: search, $options: 'i' } },
        { department: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Parse pagination params
    const pageNum = parseInt(page);
    const limitNum = Math.min(parseInt(limit), 100); // Cap at 100 records
    const skip = (pageNum - 1) * limitNum;
    
    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;
    
    // Use promise.all for parallel processing - better performance
    const [agents, total] = await Promise.all([
      Agent.find(filter)
        .select('-password -resetPasswordToken -resetPasswordExpire')
        .populate('agencyId', 'name shortName')
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .lean(), // Use lean() for better MongoDB performance
      Agent.countDocuments(filter)
    ]);
    
    res.status(200).json({
      success: true,
      message: 'Agents fetched successfully.',
      count: agents.length,
      total: total,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum)
      },
      data: agents
    });
  } catch (error) {
    console.error('Error fetching agents:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch agents.',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/admin/agents/:id
 * @desc    Get a single agent by ID
 * @access  Admin only
 */
router.get('/agents/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    // Validate ObjectId before query
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid agent ID format'
      });
    }
    
    const agent = await Agent.findById(req.params.id)
      .select('-password -resetPasswordToken -resetPasswordExpire')
      .populate('agencyId', 'name shortName')
      .lean();
    
    if (!agent) {
      return res.status(404).json({
        success: false,
        message: 'Agent not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Agent fetched successfully.',
      data: agent
    });
  } catch (error) {
    console.error('Error fetching agent:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch agent.',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/admin/agents
 * @desc    Create a new agent with email notification
 * @access  Admin only
 */
router.post('/agents', authMiddleware, adminOnly, agentProfileImageUpload.single('profileImage'), handleUploadError, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { name, email, password, agencyId, position, department, phone, specializations } = req.body;
    
    // Input validation
    if (!name || !email || !agencyId) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and agency ID are required fields'
      });
    }
    
    // Validate ObjectId for agencyId
    if (!mongoose.Types.ObjectId.isValid(agencyId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid agency ID format'
      });
    }
    
    // Check if agency exists and is active
    const agency = await Agency.findOne({ _id: agencyId, isActive: true });
    if (!agency) {
      return res.status(400).json({
        success: false,
        message: 'Specified agency not found or is inactive'
      });
    }
    
    // Email format validation
    const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address'
      });
    }
    
    // Check if email already exists
    const existingAgent = await Agent.findOne({ email: email.toLowerCase() });
    if (existingAgent) {
      return res.status(400).json({
        success: false,
        message: 'Email already in use by another agent'
      });
    }

    // Generate a temporary password if none provided
    const generatedPassword = password || crypto.randomBytes(8).toString('hex');

    // Create new agent with provided data
    const newAgent = new Agent({
      name,
      email: email.toLowerCase(),
      password: generatedPassword,
      agencyId,
      position,
      department,
      phone,
      specializations: specializations ? JSON.parse(specializations) : [],
      resetPasswordToken: crypto.randomBytes(20).toString('hex'),
      resetPasswordExpire: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
    });
    
    // Add profile image if uploaded
    if (req.file) {
      newAgent.profileImage = req.file.path;
    }
    
    await newAgent.save({ session });

    // Create password setup URL
    const baseUrl = process.env.FRONTEND_URL || `${req.protocol}://${req.get('host')}`;
    const passwordSetupUrl = `${baseUrl}/agent-setup/${newAgent.resetPasswordToken}`;
    
    // Prepare welcome email with password setup link
    const message = `
      <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px;">
        <h2 style="color: #2a9d8f;">Welcome to SAYIT Citizen Engagement Platform</h2>
        <p>Hello ${name},</p>
        <p>You have been added as an agent for <strong>${agency.name}</strong> on the SAYIT platform.</p>
        <p>To set up your account, please click the button below to create your password:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${passwordSetupUrl}" style="background-color: #2a9d8f; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Set Up My Account</a>
        </div>
        <p>This link will expire in 24 hours for security purposes.</p>
        <p>If you did not expect this invitation, please ignore this email or contact the administrator.</p>
        <hr style="border: 1px solid #eee; margin-top: 20px;">
        <p style="font-size: 12px; color: #777;">
          This is an automated message from the SAYIT platform. Please do not reply to this email.
        </p>
      </div>
    `;
    
    try {
      // Send welcome email
      await sendEmail({
        email: newAgent.email,
        subject: 'Welcome to SAYIT - Agent Account Setup',
        message
      });
      
      // Commit transaction only after email is sent successfully
      await session.commitTransaction();
      session.endSession();
    } catch (error) {
      console.warn('Email sending failed:', error);
      // Commit anyway as we still want to create the account even if email fails
      await session.commitTransaction();
      session.endSession();
    }

    // Return the created agent without sensitive information
    const agentToReturn = newAgent.toObject();
    delete agentToReturn.password;
    delete agentToReturn.resetPasswordToken;
    delete agentToReturn.resetPasswordExpire;
    
    res.status(201).json({
      success: true,
      message: 'Agent created successfully and invitation email sent.',
      data: agentToReturn,
    });
  } catch (error) {
    // Roll back transaction on error
    await session.abortTransaction();
    session.endSession();
    
    console.error('Error creating agent:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create agent.',
      error: error.message,
    });
  }
});

/**
 * @route   PUT /api/admin/agents/:id
 * @desc    Update an agent
 * @access  Admin only
 */
router.put('/agents/:id', authMiddleware, adminOnly, agentProfileImageUpload.single('profileImage'), handleUploadError, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, agencyId, position, department, phone, specializations, isActive } = req.body;
    
    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid agent ID format'
      });
    }

    // Find agent
    const agent = await Agent.findById(id);
    if (!agent) {
      return res.status(404).json({ 
        success: false,
        message: 'Agent not found' 
      });
    }

    let wasEmailChanged = false;
    let oldEmail = agent.email;
    
    // Check if email is being changed and if it's already in use
    if (email && email.toLowerCase() !== agent.email) {
      const existingAgent = await Agent.findOne({ 
        email: email.toLowerCase(),
        _id: { $ne: id } // Exclude current agent
      });
      
      if (existingAgent) {
        return res.status(400).json({
          success: false,
          message: 'Email already in use by another agent'
        });
      }
      wasEmailChanged = true;
      agent.email = email.toLowerCase();
    }

    // If changing agency, validate new agency
    if (agencyId && agencyId !== agent.agencyId.toString()) {
      if (!mongoose.Types.ObjectId.isValid(agencyId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid agency ID format'
        });
      }
      
      const newAgency = await Agency.findOne({ _id: agencyId, isActive: true });
      if (!newAgency) {
        return res.status(400).json({
          success: false,
          message: 'Specified agency not found or is inactive'
        });
      }
      
      agent.agencyId = agencyId;
    }

    // Update basic fields if provided
    if (name) agent.name = name;
    if (position !== undefined) agent.position = position;
    if (department !== undefined) agent.department = department;
    if (phone !== undefined) agent.phone = phone;
    if (isActive !== undefined) agent.isActive = isActive === true || isActive === 'true';
    
    // Update specializations if provided
    if (specializations) {
      try {
        const parsedSpecializations = JSON.parse(specializations);
        // Validate that all specialization IDs are valid ObjectIds
        const validSpecializations = parsedSpecializations.filter(id => 
          mongoose.Types.ObjectId.isValid(id)
        );
        agent.specializations = validSpecializations;
      } catch (error) {
        console.warn('Error parsing specializations:', error);
        // Continue without updating specializations
      }
    }

    // Update profile image if uploaded
    if (req.file) {
      agent.profileImage = req.file.path;
    }

    await agent.save();

    // Return updated agent without sensitive information
    const updatedAgent = await Agent.findById(id)
      .select('-password -resetPasswordToken -resetPasswordExpire')
      .populate('agencyId', 'name shortName')
      .lean();

    // Send email notification if email was changed - run in background
    if (wasEmailChanged) {
      setImmediate(async () => {
        try {
          // Notify old email address
          const messageToOldEmail = `
            <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px;">
              <h2 style="color: #2a9d8f;">Email Address Changed</h2>
              <p>Hello ${agent.name},</p>
              <p>This is to notify you that the email address associated with your SAYIT agent account has been changed.</p>
              <p>Your account email has been updated from <strong>${oldEmail}</strong> to <strong>${agent.email}</strong>.</p>
              <p>If you did not request this change, please contact the administrator immediately.</p>
              <hr style="border: 1px solid #eee; margin-top: 20px;">
              <p style="font-size: 12px; color: #777;">
                This is an automated message from the SAYIT platform. Please do not reply to this email.
              </p>
            </div>
          `;
          
          await sendEmail({
            email: oldEmail,
            subject: 'SAYIT - Your Account Email Has Been Changed',
            message: messageToOldEmail
          });
          
          // Notify new email address
          const messageToNewEmail = `
            <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px;">
              <h2 style="color: #2a9d8f;">Email Address Confirmation</h2>
              <p>Hello ${agent.name},</p>
              <p>This email confirms that your SAYIT agent account email has been updated to this address.</p>
              <p>If you did not request this change, please contact the administrator immediately.</p>
              <hr style="border: 1px solid #eee; margin-top: 20px;">
              <p style="font-size: 12px; color: #777;">
                This is an automated message from the SAYIT platform. Please do not reply to this email.
              </p>
            </div>
          `;
          
          await sendEmail({
            email: agent.email,
            subject: 'SAYIT - Your Account Email Has Been Changed',
            message: messageToNewEmail
          });
        } catch (error) {
          console.warn('Failed to send email change notifications:', error);
        }
      });
    }

    res.status(200).json({
      success: true,
      message: 'Agent updated successfully.',
      data: updatedAgent,
    });
  } catch (error) {
    console.error('Error updating agent:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update agent.',
      error: error.message,
    });
  }
});

/**
 * @route   DELETE /api/admin/agents/:id
 * @desc    Soft delete an agent by setting isActive to false
 * @access  Admin only
 */
router.delete('/agents/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid agent ID format'
      });
    }
    
    // Find agent before update to get email
    const agent = await Agent.findById(id);
    if (!agent) {
      return res.status(404).json({ 
        success: false,
        message: 'Agent not found.' 
      });
    }
    
    // For best practices, use soft delete instead of hard delete
    const updatedAgent = await Agent.findByIdAndUpdate(
      id, 
      { isActive: false },
      { new: true }
    );

    // Send notification email in background
    setImmediate(async () => {
      try {
        const message = `
          <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px;">
            <h2 style="color: #2a9d8f;">Account Deactivation Notice</h2>
            <p>Hello ${agent.name},</p>
            <p>This is to inform you that your SAYIT agent account has been deactivated.</p>
            <p>If you believe this is an error, please contact the administrator.</p>
            <hr style="border: 1px solid #eee; margin-top: 20px;">
            <p style="font-size: 12px; color: #777;">
              This is an automated message from the SAYIT platform. Please do not reply to this email.
            </p>
          </div>
        `;
        
        await sendEmail({
          email: agent.email,
          subject: 'SAYIT - Account Deactivation Notice',
          message
        });
      } catch (error) {
        console.warn('Failed to send deactivation email:', error);
      }
    });

    res.status(200).json({ 
      success: true,
      message: 'Agent deactivated successfully.',
      data: { id: updatedAgent._id }
    });
  } catch (error) {
    console.error('Error deactivating agent:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to deactivate agent.',
      error: error.message,
    });
  }
});

/**
 * @route   POST /api/admin/agents/reset-password/:id
 * @desc    Reset agent password (admin initiated)
 * @access  Admin only
 */
router.post('/agents/reset-password/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid agent ID format'
      });
    }
    
    // Find agent
    const agent = await Agent.findById(id);
    if (!agent) {
      return res.status(404).json({ 
        success: false,
        message: 'Agent not found.' 
      });
    }
    
    // Generate unique temporary access code
    // Format: "SAY" + 9-digit random number
    let tempAccessCode;
    let isUnique = false;
    
    while (!isUnique) {
      // Generate random 9-digit number with leading zeros if needed
      const randomNum = String(Math.floor(Math.random() * 1000000000)).padStart(9, '0');
      tempAccessCode = `SAY${randomNum}`;
      
      // Check if this code is already in use
      const existingAgent = await Agent.findOne({ resetPasswordToken: tempAccessCode });
      if (!existingAgent) {
        isUnique = true;
      }
    }
    
    // Update agent record
    agent.resetPasswordToken = tempAccessCode;
    agent.resetPasswordExpire = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
    
    await agent.save();
    
    // Prepare email with the temporary access code
    const message = `
      <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px;">
        <h2 style="color: #2a9d8f;">Password Reset Request</h2>
        <p>Hello ${agent.name},</p>
        <p>A password reset has been initiated for your SAYIT agent account by an administrator.</p>
        <p>Please use the following temporary access code to reset your password:</p>
        <div style="text-align: center; margin: 30px 0;">
          <div style="background-color: #f0f0f0; padding: 15px; border-radius: 6px; font-size: 24px; font-weight: bold; letter-spacing: 2px;">
            ${tempAccessCode}
          </div>
        </div>
        <p>This code will expire in 24 hours for security purposes.</p>
        <p>If you did not expect this password reset, please contact the administrator immediately.</p>
        <hr style="border: 1px solid #eee; margin-top: 20px;">
        <p style="font-size: 12px; color: #777;">
          This is an automated message from the SAYIT platform. Please do not reply to this email.
        </p>
      </div>
    `;
    
    // Send email in the background to not block response
    setImmediate(async () => {
      try {
        await sendEmail({
          email: agent.email,
          subject: 'SAYIT - Password Reset Code',
          message
        });
      } catch (error) {
        console.error('Failed to send password reset email:', error);
        // Don't reset the token if email fails - the admin can try again
      }
    });
    
    res.status(200).json({
      success: true,
      message: 'Temporary access code generated and sent to agent.',
    });
  } catch (error) {
    console.error('Error resetting agent password:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process password reset.',
      error: error.message,
    });
  }
});

/**
 * =============================================
 * STANDARD USER MANAGEMENT ROUTES
 * =============================================
 */

/**
 * @route   GET /api/admin/users
 * @desc    Get all standard users with filtering and pagination
 * @access  Admin only
 */
router.get('/users', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { page = 1, limit = 20, sortBy = 'name', sortOrder = 'asc', search, isActive, isVerified } = req.query;
    const filter = {};
    
    // Apply status filter if provided
    if (isActive !== undefined) {
      filter.isActive = isActive === 'true';
    }
    
    // Apply verification status filter if provided
    if (isVerified !== undefined) {
      filter.isVerified = isVerified === 'true';
    }
    
    // Add name, email, or phone search if provided
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Parse pagination params
    const pageNum = parseInt(page);
    const limitNum = Math.min(parseInt(limit), 100); // Cap at 100 records
    const skip = (pageNum - 1) * limitNum;
    
    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;
    
    // Use promise.all for parallel processing - better performance
    const [users, total] = await Promise.all([
      StandardUser.find(filter)
        .select('-password -resetPasswordToken -resetPasswordExpire')
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .lean(), // Use lean() for better MongoDB performance
      StandardUser.countDocuments(filter)
    ]);
    
    res.status(200).json({
      success: true,
      message: 'Users fetched successfully.',
      count: users.length,
      total: total,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum)
      },
      data: users
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users.',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/admin/users/:id
 * @desc    Get a single standard user by ID
 * @access  Admin only
 */
router.get('/users/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    // Validate ObjectId before query
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID format'
      });
    }
    
    const user = await StandardUser.findById(req.params.id)
      .select('-password -resetPasswordToken -resetPasswordExpire')
      .lean();
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'User fetched successfully.',
      data: user
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user.',
      error: error.message
    });
  }
});

/**
 * @route   PUT /api/admin/users/:id
 * @desc    Update a standard user's details (admin support)
 * @access  Admin only
 */
router.put('/users/:id', authMiddleware, adminOnly, userProfileImageUpload.single('profileImage'), handleUploadError, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, isVerified, isActive } = req.body;
    
    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID format'
      });
    }

    // Find user
    const user = await StandardUser.findById(id);
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    // Update basic fields if provided
    if (name) user.name = name;
    if (phone !== undefined) user.phone = phone;
    
    // Only admins can change verification or active status
    if (isVerified !== undefined) user.isVerified = isVerified === true || isVerified === 'true';
    if (isActive !== undefined) user.isActive = isActive === true || isActive === 'true';
    
    // Update profile image if uploaded
    if (req.file) {
      user.profileImage = req.file.path;
    }

    await user.save();

    // Return updated user without sensitive information
    const updatedUser = await StandardUser.findById(id)
      .select('-password -resetPasswordToken -resetPasswordExpire');

    res.status(200).json({
      success: true,
      message: 'User updated successfully.',
      data: updatedUser
    });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update user.',
      error: error.message    });
  }
});

/**
 * @route   POST /api/admin/generate-access-code/:userType/:id
 * @desc    Admin generates temporary access code for a user
 * @access  Private (Admin only)
 */
router.post('/generate-access-code/:userType/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { userType, id } = req.params;
    
    let user = null;
    let UserModel = null;
    let modelName = '';
    
    // Find the user based on userType
    switch (userType.toLowerCase()) {
      case 'agent':
        UserModel = Agent;
        modelName = 'Agent';
        user = await Agent.findById(id);
        break;
      case 'staff':
        UserModel = Staff;
        modelName = 'Staff';
        user = await Staff.findById(id);
        break;
      case 'user':
      case 'citizen':
      case 'standarduser':
        UserModel = StandardUser;
        modelName = 'StandardUser';
        user = await StandardUser.findById(id);
        break;
      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid user type. Must be agent, staff, or user'
        });
    }
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Generate temporary access code using the new centralized model
    const tempAccess = await TemporaryAccess.createAccessCode(user, modelName);
    
    // Send email with the access code
    const mailOptions = {
      from: `"${process.env.BREVO_FROM_NAME || 'SAYIT Platform'}" <${process.env.BREVO_FROM_EMAIL || process.env.BREVO_SMTP_USER}>`,
      to: user.email,
      subject: 'Password Reset Access Code',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #4a5568;">Password Reset Request</h2>
          <p>An administrator has generated a password reset code for your SAYIT account.</p>
          <p>Your temporary access code is: <strong style="font-size: 18px; background-color: #f7fafc; padding: 5px 10px; border-radius: 4px;">${tempAccess.accessCode}</strong></p>
          <p>This code will expire in 24 hours.</p>
          <p>If you didn't expect this password reset, please contact our support team.</p>
          <p>Thank you,<br>The SAYIT Team</p>
        </div>
      `
    };
    
    await sendEmail(mailOptions);
    
    // Log this action for security auditing
    console.log(`Admin ${req.user.id} generated access code for ${userType} ${id}`);
    
    res.status(200).json({
      success: true,
      message: `Access code generated and sent to ${user.email}`,
      // Only show the access code in the response for manual sharing if needed
      accessCode: tempAccess.accessCode
    });
    
  } catch (error) {
    console.error('Error generating access code:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/admin/verify-access-code
 * @desc    Verify temporary access code (admin-initiated password reset flow)
 * @access  Public (part of admin-initiated password reset flow)
 */
router.post('/verify-access-code', async (req, res) => {
  try {
    const { email, accessCode } = req.body;

    if (!email || !accessCode) {
      return res.status(400).json({
        success: false,
        message: 'Email and access code are required'
      });
    }

    // Use the TemporaryAccess model to verify the access code
    const tempAccess = await TemporaryAccess.verifyAccessCode(email, accessCode);

    if (!tempAccess) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired access code'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Access code verified successfully',
      data: {
        userId: tempAccess.userId,
        userType: tempAccess.userModel.toLowerCase(),
        role: tempAccess.role
      }
    });
  } catch (error) {
    console.error('Error verifying access code:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify access code',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/admin/reset-password-with-code
 * @desc    Reset password using verified access code (admin-initiated password reset flow)
 * @access  Public (part of admin-initiated password reset flow)
 */
router.post('/reset-password-with-code', async (req, res) => {
  try {
    const { email, accessCode, newPassword } = req.body;
    
    if (!email || !accessCode || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Email, access code and new password are all required'
      });
    }
    
    // Validate password strength
    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long'
      });
    }
    
    // Use the TemporaryAccess model to verify the access code
    const tempAccess = await TemporaryAccess.verifyAccessCode(email, accessCode);
    
    if (!tempAccess) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired access code'
      });
    }
    
    // Get the appropriate user model based on the stored userModel value
    let UserModel;
    switch (tempAccess.userModel) {
      case 'Agent':
        UserModel = Agent;
        break;
      case 'Staff':
        UserModel = Staff;
        break;
      case 'StandardUser':
      default:
        UserModel = StandardUser;
        break;
    }
    
    // Find the user
    const user = await UserModel.findById(tempAccess.userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Update password
    user.password = newPassword;
    await user.save();
    
    // Delete the temporary access code since it's been used
    await TemporaryAccess.deleteOne({ _id: tempAccess._id });
    
    // Send confirmation email
    const message = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4a5568;">Password Reset Successful</h2>
        <p>Your password for your SAYIT account has been successfully reset.</p>
        <p>If you did not make this change, please contact support immediately.</p>
        <p>Thank you,<br>The SAYIT Team</p>
      </div>
    `;
    
    await sendEmail({
      email: user.email,
      subject: 'SAYIT - Your Password Has Been Reset',
      message
    });
    
    res.status(200).json({
      success: true,
      message: 'Password has been reset successfully'
    });
    
  } catch (error) {
    console.error('Error resetting password:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/admin/request-access-code
 * @desc    Request a new access code (admin-controlled self-service password reset)
 * @access  Public (part of admin-initiated password reset flow)
 */
router.post('/request-access-code', async (req, res) => {
  try {
    const { email, userType } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }
    
    // Normalize email
    const normalizedEmail = email.toLowerCase().trim();
    
    // Try to find user in appropriate model based on userType if provided
    let user = null;
    let userModel = '';
    
    if (userType) {
      // If userType is provided, only check that specific model
      switch(userType.toLowerCase()) {
        case 'agent':
          user = await Agent.findOne({ email: normalizedEmail, isActive: true });
          userModel = 'Agent';
          break;
        case 'staff':
          user = await Staff.findOne({ email: normalizedEmail, isActive: true });
          userModel = 'Staff';
          break;
        case 'user':
        case 'citizen':
        case 'standarduser':
          user = await StandardUser.findOne({ email: normalizedEmail, isActive: true });
          userModel = 'StandardUser';
          break;
      }
    } else {
      // If userType is not provided, check all models
      // Try StandardUser first (most common)
      user = await StandardUser.findOne({ email: normalizedEmail, isActive: true });
      if (user) {
        userModel = 'StandardUser';
      } else {
        // Try Agent
        user = await Agent.findOne({ email: normalizedEmail, isActive: true });
        if (user) {
          userModel = 'Agent';
        } else {
          // Try Staff
          user = await Staff.findOne({ email: normalizedEmail, isActive: true });
          if (user) {
            userModel = 'Staff';
          }
        }
      }
    }
    
    // For security, always return the same message whether user exists or not
    if (!user) {
      return res.status(200).json({
        success: true,
        message: 'If your email is registered, you will receive an access code shortly'
      });
    }
    
    // Generate access code for the found user
    const tempAccess = await TemporaryAccess.createAccessCode(user, userModel);
    
    // Send email with the access code
    const message = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4a5568;">Password Reset Request</h2>
        <p>You requested to reset your password for your SAYIT account.</p>
        <p>Your temporary access code is: <strong style="font-size: 18px; background-color: #f7fafc; padding: 5px 10px; border-radius: 4px;">${tempAccess.accessCode}</strong></p>
        <p>This code will expire in 24 hours.</p>
        <p>If you didn't request this password reset, please ignore this email or contact support.</p>
        <p>Thank you,<br>The SAYIT Team</p>
      </div>
    `;
    
    await sendEmail({
      email: user.email,
      subject: 'SAYIT - Password Reset Access Code',
      message
    });
    
    res.status(200).json({
      success: true,
      message: 'If your email is registered, you will receive an access code shortly'
    });
    
  } catch (error) {
    console.error('Error requesting access code:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/admin/cleanup-expired-codes
 * @desc    Manually clean up expired temporary access codes
 * @access  Admin only
 */
router.get('/cleanup-expired-codes', authMiddleware, adminOnly, async (req, res) => {
  try {
    // MongoDB TTL index should handle this automatically, but this is a manual trigger
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    // Find and delete expired access codes
    const result = await TemporaryAccess.deleteMany({
      createdAt: { $lt: twentyFourHoursAgo }
    });
    
    res.status(200).json({
      success: true,
      message: `Cleaned up ${result.deletedCount} expired access codes`
    });
    
  } catch (error) {
    console.error('Error cleaning up expired codes:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clean up expired codes',
      error: error.message
    });
  }
});

module.exports = router;