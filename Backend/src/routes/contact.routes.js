const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');

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
  socketTimeout: 30000, // 30 seconds timeout for better reliability on slower connections
});

/**
 * Send an email using Brevo with retry mechanism
 * @param {Object} options - Email options
 * @param {string} options.email - Recipient email address(es)
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
  let lastError;
  
  while (retries > 0) {
    try {
      return await transporter.sendMail(mailOptions);
    } catch (error) {
      lastError = error;
      retries--;
      if (retries === 0) break;
      
      // Exponential backoff with jitter for optimal retry distribution
      const baseDelay = 300; // 300ms base delay
      const maxJitter = 200; // 200ms maximum jitter
      const exponentialDelay = baseDelay * Math.pow(2, 3 - retries);
      const jitter = Math.floor(Math.random() * maxJitter);
      const delay = exponentialDelay + jitter;
      
      console.warn(`Email sending failed, retrying in ${delay}ms. ${retries} retries left.`, error.message);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  // If all retries failed, throw the last error
  throw lastError;
};

// Rate limiting middleware to prevent abuse
// Limits to 5 requests per IP address per 15 minutes
const contactFormLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: {
    success: false,
    message: 'Too many contact requests. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip rate limiting in test environments
  skip: () => process.env.NODE_ENV === 'test'
});

// Validation middleware for contact form
const validateContactForm = [
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required')
    .isLength({ max: 100 }).withMessage('Name cannot exceed 100 characters')
    .escape(), // Sanitize input to prevent XSS
    
  body('email')
    .isEmail().withMessage('Valid email is required')
    .normalizeEmail()
    .isLength({ max: 100 }).withMessage('Email cannot exceed 100 characters'),
    
  body('phone')
    .notEmpty().withMessage('Phone number is required')
    .matches(/^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,10}[-\s.]?[0-9]{1,10}$/)
    .withMessage('Invalid phone number format')
    .escape(),
    
  body('subject')
    .trim()
    .notEmpty().withMessage('Subject is required')
    .isLength({ max: 150 }).withMessage('Subject cannot exceed 150 characters')
    .escape(),
    
  body('message')
    .trim()
    .notEmpty().withMessage('Message is required')
    .isLength({ min: 10, max: 2000 }).withMessage('Message must be between 10 and 2000 characters')
    .escape(),
    
  body('category')
    .optional()
    .isIn([
      'general_inquiry', 
      'technical_support', 
      'feedback', 
      'complaint',
      'partnership'
    ]).withMessage('Invalid category')
];

/**
 * @route   POST /api/contact
 * @desc    Handle contact form submissions
 * @access  Public
 */
router.post('/', contactFormLimiter, validateContactForm, async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        errors: errors.array() 
      });
    }

    const { name, email, phone, subject, message, category = 'general_inquiry' } = req.body;
    
    // Format category for display
    const formattedCategory = category
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
    
    // Get recipient emails based on category
    let recipientEmails;
    switch(category) {
      case 'technical_support':
        recipientEmails = process.env.TECH_SUPPORT_EMAILS || process.env.DEFAULT_CONTACT_EMAILS;
        break;
      case 'complaint':
        recipientEmails = process.env.COMPLAINTS_EMAILS || process.env.DEFAULT_CONTACT_EMAILS;
        break;
      case 'partnership':
        recipientEmails = process.env.PARTNERSHIP_EMAILS || process.env.DEFAULT_CONTACT_EMAILS;
        break;
      default:
        recipientEmails = process.env.DEFAULT_CONTACT_EMAILS;
    }
    
    // Ensure there are recipients
    if (!recipientEmails) {
      console.error("No recipient emails configured");
      return res.status(500).json({
        success: false,
        message: "Service configuration error. Please try again later."
      });
    }
    
    // Convert comma-separated emails to array
    const emailsArray = recipientEmails.split(',').map(email => email.trim());

    // Generate a unique reference ID
    const referenceId = `REF-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 5)}`.toUpperCase();

    // Email content for notification to SAYIT team
    const teamNotification = `
      <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px;">
        <h2 style="color: #2a9d8f;">New Contact Form Submission</h2>
        <p>Hello SAYIT Team,</p>
        <p>You have received a new contact form submission with the following details:</p>
        <p><strong>Reference ID:</strong> ${referenceId}</p>
        <p><strong>Date:</strong> ${new Date().toLocaleString()}</p>
        <p><strong>Category:</strong> ${formattedCategory}</p>
        <hr style="border: 1px solid #eee;">
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Phone:</strong> ${phone}</p>
        <h3>Subject:</h3>
        <p>${subject}</p>
        <h3>Message:</h3>
        <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px;">
          <p>${message.replace(/\n/g, '<br>')}</p>
        </div>
        <hr style="border: 1px solid #eee; margin-top: 20px;">
        <p style="font-size: 12px; color: #777;">
          This is an automated notification from the SAYIT platform contact form.
        </p>
      </div>
    `;

    // Track start time for performance monitoring
    const emailStartTime = Date.now();

    // Send team notification email
    try {
      await sendEmail({
        email: emailsArray.join(','),
        subject: `SAYIT Contact: ${subject} (${referenceId})`,
        message: teamNotification
      });
      
      // Log success with performance metrics
      console.info(`Team notification email sent in ${Date.now() - emailStartTime}ms`);
    } catch (emailError) {
      console.error('Failed to send team notification email:', emailError);
      
      // Return error to client but don't expose internal error details
      return res.status(500).json({ 
        success: false, 
        message: 'We encountered an issue sending your message. Please try again later.',
        reference: referenceId
      });
    }
    
    // Email content for auto-reply to the sender
    const autoReplyMessage = `
      <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px;">
        <h2 style="color: #2a9d8f;">Thank You for Contacting Us</h2>
        <p>Dear ${name},</p>
        <p>Thank you for reaching out to the SAYIT citizen engagement platform. We have received your message regarding "${subject}" and will get back to you soon.</p>
        <p><strong>Reference ID:</strong> ${referenceId} (Please keep this for future correspondence)</p>
        <p>Here's a summary of the information you provided:</p>
        <ul>
          <li><strong>Name:</strong> ${name}</li>
          <li><strong>Email:</strong> ${email}</li>
          <li><strong>Phone:</strong> ${phone}</li>
          <li><strong>Category:</strong> ${formattedCategory}</li>
        </ul>
        <p>We typically respond within 1-2 business days. If your matter is urgent, please call our support line at ${process.env.SUPPORT_PHONE || '+1 800 123 4567'}.</p>
        <p>Best regards,<br>The SAYIT Team</p>
        <hr style="border: 1px solid #eee; margin-top: 20px;">
        <p style="font-size: 12px; color: #777;">
          This is an automated response. Please do not reply to this email.
        </p>
      </div>
    `;

    // Send auto-reply in non-blocking way using Promise
    Promise.resolve().then(async () => {
      try {
        await sendEmail({
          email: email,
          subject: `SAYIT - Thank you for your message (${referenceId})`,
          message: autoReplyMessage
        });
      } catch (error) {
        // Log but don't fail the request if auto-reply fails
        console.warn('Failed to send auto-reply:', error);
      }
    });

    // Store contact form data in memory cache for temporary persistence
    // This helps recover if a DB write fails but email was sent
    try {
      // You could implement a simple in-memory cache or connection to your DB here
      // For now, we'll just log it
      console.log(`Contact form submission ${referenceId} processed successfully`);
    } catch (cacheError) {
      console.warn('Failed to cache contact form data:', cacheError);
      // Non-critical error, continue
    }

    // Send success response with reference ID
    res.status(200).json({ 
      success: true, 
      message: 'Your message has been sent successfully! We will get back to you soon.',
      reference: referenceId
    });

  } catch (error) {
    console.error('Contact form submission error:', error);
    
    // Send appropriate error response based on error type
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      // Email service connection issues
      return res.status(503).json({ 
        success: false, 
        message: 'Our messaging service is temporarily unavailable. Please try again later.'
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: 'Failed to send message. Please try again later.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route   GET /api/contact/health
 * @desc    Health check endpoint
 * @access  Public
 */
router.get('/health', (req, res) => {
  // Check if email service is configured
  const isEmailConfigured = !!(
    process.env.BREVO_SMTP_HOST && 
    process.env.BREVO_SMTP_USER && 
    process.env.BREVO_SMTP_KEY
  );
  
  res.status(200).json({
    status: 'ok',
    emailServiceConfigured: isEmailConfigured,
    timestamp: new Date().toISOString()
  });
});

module.exports = router;