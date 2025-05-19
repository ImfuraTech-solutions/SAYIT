const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Complaint = require('../models/Complaint');
const Category = require('../models/Category');
const Agency = require('../models/Agency');
const { createUploadMiddleware } = require('../multerConfig');
const nodemailer = require('nodemailer');
const { ComplaintSubmissionType } = require('../models/Complaint');

// Create upload middleware for external complaint attachments
const complaintAttachmentsUpload = createUploadMiddleware('external_complaint_attachments', 5);

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

// Helper function to send email with retry logic for better reliability
const sendEmail = async (options) => {
  const mailOptions = {
    from: `"${process.env.EMAIL_FROM_NAME || 'SAYIT Platform'}" <${process.env.EMAIL_FROM || process.env.BREVO_SMTP_USER}>`,
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
      
      // Exponential backoff with jitter for optimal retry distribution
      const baseDelay = 300;
      const maxJitter = 200;
      const exponentialDelay = baseDelay * Math.pow(2, 3 - retries);
      const jitter = Math.floor(Math.random() * maxJitter);
      const delay = exponentialDelay + jitter;
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

// Function to send tracking confirmation email
const sendTrackingConfirmation = async (email, complaintData) => {
  const subject = `Your Complaint Has Been Received - Tracking ID: ${complaintData.trackingId}`;
  
  // Get agency name if available
  let agencyInfo = '';
  if (complaintData.agency) {
    try {
      const agency = await Agency.findById(complaintData.agency);
      if (agency) {
        agencyInfo = `
          <p><strong>Agency:</strong> ${agency.name}</p>
        `;
      }
    } catch (err) {
      console.error('Error getting agency info for email:', err);
    }
  }

  // Create HTML email template with tracking information
  const message = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #0056b3; color: white; padding: 20px; text-align: center;">
        <h1 style="margin: 0;">Complaint Submitted Successfully</h1>
      </div>
      
      <div style="padding: 20px; border: 1px solid #ddd; background-color: #f9f9f9;">
        <p>Thank you for submitting your complaint to the SAYIT platform. Your complaint has been received and will be reviewed by our team.</p>
        
        <div style="background-color: #fff; border-left: 4px solid #0056b3; padding: 15px; margin: 20px 0;">
          <h2 style="color: #0056b3; margin-top: 0;">Your Tracking Information</h2>
          <p><strong>Tracking ID:</strong> ${complaintData.trackingId}</p>
          <p><strong>Complaint Title:</strong> ${complaintData.title}</p>
          <p><strong>Date Submitted:</strong> ${new Date(complaintData.createdAt).toLocaleDateString()}</p>
          <p><strong>Status:</strong> ${complaintData.status}</p>
          ${agencyInfo}
        </div>
        
        <p>You can track the status of your complaint at any time by visiting our website and using your Tracking ID:</p>
        <div style="text-align: center; margin: 25px 0;">
          <a href="${process.env.FRONTEND_URL}/track-complaint" style="background-color: #0056b3; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; font-weight: bold;">Track Your Complaint</a>
        </div>
        
        <p>If you have any questions, please don't hesitate to contact us.</p>
      </div>
      
      <div style="text-align: center; padding: 20px; color: #666; font-size: 14px;">
        <p>© ${new Date().getFullYear()} SAYIT Platform - Rwanda Citizen Engagement System</p>
      </div>
    </div>
  `;
  
  try {
    await sendEmail({
      email,
      subject,
      message
    });
    return true;
  } catch (error) {
    console.error('Error sending tracking confirmation email:', error);
    return false;
  }
};

/**
 * @route   POST /api/external/complaints
 * @desc    Submit a new complaint without logging in
 * @access  Public
 */
router.post('/complaints', complaintAttachmentsUpload.array('attachments', 5), handleUploadError, async (req, res) => {
  try {    const {
      title,
      description,
      category,
      agency, // Added agency parameter
      contactInfo,
      location,
      tags = []
    } = req.body;
    
    // Validate required fields
    if (!title || !description || !category) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields',
        error: 'missing_required_fields'
      });
    }
    
    // Validate email format if provided
    let contactEmail = null;
    let parsedContactInfo = null;
    
    // Parse contact info if provided as string
    try {
      if (typeof contactInfo === 'string') {
        parsedContactInfo = JSON.parse(contactInfo);
      } else {
        parsedContactInfo = contactInfo;
      }
      
      if (parsedContactInfo && parsedContactInfo.email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(parsedContactInfo.email)) {
          return res.status(400).json({
            success: false,
            message: 'Invalid email format',
            error: 'invalid_email_format'
          });
        }
        contactEmail = parsedContactInfo.email;
      }
    } catch (err) {
      console.error('Error parsing contact info:', err);
      return res.status(400).json({
        success: false,
        message: 'Invalid contact information format',
        error: 'invalid_contact_info'
      });
    }
    
    // Validate and parse location if provided
    let parsedLocation = null;
    try {
      if (location) {
        if (typeof location === 'string') {
          parsedLocation = JSON.parse(location);
        } else {
          parsedLocation = location;
        }
      }
    } catch (err) {
      return res.status(400).json({
        success: false,
        message: 'Invalid location format',
        error: 'invalid_location'
      });
    }
    
    // Validate category ID
    if (!mongoose.Types.ObjectId.isValid(category)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid category',
        error: 'invalid_category'
      });
    }
    
    // Process uploaded files
    const attachments = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        attachments.push({
          url: file.path, // Adjust based on your storage solution
          originalName: file.originalname,
          fileType: file.mimetype,
          fileSize: file.size,
          format: file.originalname.split('.').pop().toLowerCase()
        });
      }
    }
      // Find category
    const categoryDoc = await Category.findById(category);
    
    if (!categoryDoc) {
      return res.status(404).json({
        success: false,
        message: 'Category not found',
        error: 'category_not_found'
      });
    }
    
    // Handle agency selection
    let selectedAgency = null;
    
    // If agency ID was provided, validate and use it
    if (agency && mongoose.Types.ObjectId.isValid(agency)) {
      selectedAgency = await Agency.findById(agency);
      
      // If agency doesn't exist or is not active, use the category's default agency
      if (!selectedAgency || !selectedAgency.isActive) {
        if (categoryDoc.defaultAgency) {
          const defaultAgency = await Agency.findById(categoryDoc.defaultAgency);
          if (defaultAgency && defaultAgency.isActive) {
            selectedAgency = defaultAgency;
          }
        }
      }
    } 
    // Otherwise, try to use category's default agency
    else if (categoryDoc.defaultAgency) {
      const defaultAgency = await Agency.findById(categoryDoc.defaultAgency);
      if (defaultAgency && defaultAgency.isActive) {
        selectedAgency = defaultAgency;
      }
    }
    
    // Create the external complaint with the EXTERNAL submission type
    const newComplaint = new Complaint({
      title,
      description,
      submissionType: ComplaintSubmissionType.EXTERNAL, // Use EXTERNAL type
      category: categoryDoc._id,
      agency: selectedAgency ? selectedAgency._id : null,
      attachments,
      tags: Array.isArray(tags) ? tags : tags.split(',').map(tag => tag.trim()),
      location: parsedLocation,
      contactInfo: parsedContactInfo,
      status: 'pending',
      isPublic: true
    });
    
    // Save the complaint
    await newComplaint.save();
    
    // If email provided, send tracking information
    if (contactEmail) {
      await sendTrackingConfirmation(contactEmail, newComplaint);
    }
      // Return success response
    res.status(201).json({
      success: true,
      message: 'Complaint submitted successfully',
      data: {
        trackingId: newComplaint.trackingId,
        title: newComplaint.title,
        category: categoryDoc.name,
        agency: selectedAgency ? selectedAgency.name : null,
        status: newComplaint.status,
        createdAt: newComplaint.createdAt
      }
    });
  } catch (error) {
    console.error('Error submitting external complaint:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit complaint',
      error: process.env.NODE_ENV === 'development' ? error.message : 'server_error'
    });
  }
});

/**
 * @route   GET /api/external/track/:trackingId
 * @desc    Track a complaint by tracking ID (no auth required)
 * @access  Public
 */
router.get('/track/:trackingId', async (req, res) => {
  try {
    const { trackingId } = req.params;
    
    if (!trackingId) {
      return res.status(400).json({
        success: false,
        message: 'Tracking ID is required',
        error: 'missing_tracking_id'
      });
    }
    
    // Find complaint by tracking ID
    const complaint = await Complaint.findOne({ trackingId })
      .populate('category', 'name description')
      .populate('agency', 'name shortName')
      .populate({
        path: 'responses',
        match: { isInternal: false },
        options: { sort: { createdAt: 1 } },
        select: '-isInternal'
      });
    
    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: 'Complaint not found',
        error: 'complaint_not_found'
      });
    }
    
    // Return complaint details
    res.status(200).json({
      success: true,
      data: {
        _id: complaint._id,
        title: complaint.title,
        description: complaint.description,
        trackingId: complaint.trackingId,
        status: complaint.status,
        priority: complaint.priority,
        category: complaint.category,
        agency: complaint.agency,
        location: complaint.location,
        createdAt: complaint.createdAt,
        updatedAt: complaint.updatedAt,
        resolvedAt: complaint.resolvedAt,
        closedAt: complaint.closedAt,
        responses: complaint.responses.map(response => ({
          _id: response._id,
          content: response.content,
          responseFrom: response.responseFrom || 'Agency Staff',
          createdAt: response.createdAt
        })),
        // Only include URLs for attachments, not internal metadata
        attachments: complaint.attachments.map(attachment => ({
          url: attachment.url,
          originalName: attachment.originalName,
          fileType: attachment.fileType
        }))
      }
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
 * @route   GET /api/external/agencies
 * @desc    Get list of all active agencies
 * @access  Public
 */
router.get('/agencies', async (req, res) => {
  try {
    const agencies = await Agency.findActiveAgencies();
    
    res.status(200).json({
      success: true,
      data: agencies.map(agency => ({
        _id: agency._id,
        name: agency.name,
        shortName: agency.shortName,
        description: agency.description,
        logo: agency.logo
      }))
    });
  } catch (error) {
    console.error('Error fetching agencies:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch agencies',
      error: process.env.NODE_ENV === 'development' ? error.message : 'server_error'
    });
  }
});

/**
 * @route   GET /api/external/health
 * @desc    Health check endpoint
 * @access  Public
 */
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'External complaints service is running',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
