const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const StandardUser = require('../models/StandardUser');
const Staff = require('../models/Staff');
const Agent = require('../models/Agent');
const AnonymousUser = require('../models/AnonymousUser');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from .env file with the correct path
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const mongoose = require('mongoose');

const router = express.Router();

// Rate limiting for login attempts - compatible with any platform
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 8, // 8 attempts per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many login attempts. Please try again after 15 minutes.'
  },
});

// JWT Configuration with stronger settings
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRE = process.env.JWT_EXPIRE || '1d';
const JWT_REFRESH_EXPIRE = process.env.JWT_REFRESH_EXPIRE || '7d';

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is not set');
}

// Token blacklist implementation
// For scalable production, use MongoDB for token blacklisting
// This in-memory implementation works for development or single instances
const blacklistedTokens = new Set();

// Cleanup expired tokens from blacklist periodically
// In production, MongoDB TTL indexes would handle this automatically
setInterval(() => {
  // This is simplified - in production, use MongoDB TTL index
  console.log('Token blacklist cleanup would run here in production');
}, 1000 * 60 * 60); // Every hour

// Validation schemas with clear error messages
const loginValidation = [
  body('email')
    .isEmail().withMessage('Please enter a valid email address')
    .normalizeEmail() // Normalize email for consistent format
    .trim(),
  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
];

const staffLoginValidation = [
  body('email')
    .isEmail().withMessage('Please enter a valid email address')
    .normalizeEmail()
    .trim(),
  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('role')
    .isIn(['admin', 'staff', 'agent']).withMessage('Invalid role for staff login')
    .trim()
];

const anonymousLoginValidation = [
  body('anonymousCode')
    .isLength({ min: 6 }).withMessage('Invalid access code format')
    .trim()
];

// Base authentication middleware
const authenticateToken = (req, res, next) => {
  try {
    // Allow OPTIONS requests to pass through for CORS
    if (req.method === 'OPTIONS') {
      return next();
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        success: false, 
        message: 'Authentication required',
        error: 'no_token',
        redirectTo: '/login'
      });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid token format',
        error: 'invalid_token_format',
        redirectTo: '/login'
      });
    }

    // Check blacklist - O(1) lookup with Set (in-memory)
    if (blacklistedTokens.has(token)) {
      return res.status(401).json({ 
        success: false, 
        message: 'Token has been invalidated',
        error: 'revoked_token',
        redirectTo: '/login'
      });
    }

    // Verify token with comprehensive error handling
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      
      // Add decoded info to request
      req.user = decoded;
      
      // Token expiration check
      const currentTimestamp = Math.floor(Date.now() / 1000);
      if (decoded.exp && decoded.exp < currentTimestamp) {
        return res.status(401).json({
          success: false,
          message: 'Token expired',
          error: 'token_expired',
          redirectTo: '/login'
        });
      }
      
      next();
    } catch (jwtError) {
      // Handle specific JWT errors
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Authentication expired',
          error: 'token_expired',
          redirectTo: '/login'
        });
      } else if (jwtError.name === 'JsonWebTokenError') {
        return res.status(401).json({
          success: false,
          message: 'Invalid token',
          error: 'invalid_token',
          redirectTo: '/login'
        });
      } else {
        throw jwtError;
      }
    }
  } catch (error) {
    console.error('Authentication middleware error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Authentication failed',
      error: 'auth_error',
      redirectTo: '/login'
    });
  }
};

// Role-based middlewares with detailed error messaging
const requireStandardUser = (req, res, next) => {
  if (req.user.userType !== 'standard_user') {
    return res.status(403).json({
      success: false,
      message: 'Access denied: Standard user access required',
      redirectTo: '/login'
    });
  }
  next();
};

const requireStaff = (req, res, next) => {
  if (req.user.userType !== 'staff') {
    return res.status(403).json({
      success: false,
      message: 'Access denied: Staff access required',
      redirectTo: '/staff-login'
    });
  }
  next();
};

const requireAgent = (req, res, next) => {
  if (req.user.userType !== 'agent') {
    return res.status(403).json({
      success: false,
      message: 'Access denied: Agent access required',
      redirectTo: '/agent-login'
    });
  }
  next();
};

const requireAdmin = (req, res, next) => {
  if (req.user.userType !== 'staff' || req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied: Admin access required',
      redirectTo: '/staff-login'
    });
  }
  next();
};

/**
 * Helper function to update last login time
 * @param {Object} user - The user document
 * @returns {Promise} - Resolves when update is complete
 */
const updateLastLogin = async (user) => {
  try {
    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });
  } catch (error) {
    // Log but don't fail the login if this fails
    console.warn('Failed to update last login timestamp:', error);
  }
};

/**
 * @route   GET /api/auth/verify-auth
 * @desc    Verify authentication status and user information
 * @access  Private
 */
router.get('/verify-auth', authenticateToken, async (req, res) => {
  try {
    // For anonymous users
    if (req.user.userType === 'anonymous_user') {
      // Validate ObjectId before query
      if (!mongoose.Types.ObjectId.isValid(req.user.id)) {
        return res.status(401).json({
          success: false,
          message: 'Invalid user identifier',
          error: 'invalid_id',
          redirectTo: '/anonymous-login'
        });
      }
      
      // Find anonymous user and check if still active - use lean() for better performance
      const anonymousUser = await AnonymousUser.findById(req.user.id).lean();

      if (!anonymousUser || !anonymousUser.isActive || new Date(anonymousUser.expiresAt) < new Date()) {
        return res.status(401).json({
          success: false,
          message: 'Anonymous session expired or invalid',
          error: 'expired_session',
          redirectTo: '/anonymous-login'
        });
      }

      return res.json({
        success: true,
        data: {
          user: {
            id: anonymousUser._id,
            userType: 'anonymous_user',
            isAnonymous: true
          },
          redirectTo: '/anonymous/dashboard'
        }
      });
    }

    // For standard users
    if (req.user.userType === 'standard_user') {
      // Validate ObjectId before query
      if (!mongoose.Types.ObjectId.isValid(req.user.id)) {
        return res.status(401).json({
          success: false,
          message: 'Invalid user identifier',
          error: 'invalid_id',
          redirectTo: '/login'
        });
      }
      
      // Find user and exclude password - use projection for efficiency
      const user = await StandardUser.findById(req.user.id)
        .select('-password -resetPasswordToken -resetPasswordExpire')
        .lean();
      
      if (!user || !user.isActive) {
        return res.status(401).json({
          success: false,
          message: 'User account inactive or not found',
          redirectTo: '/login'
        });
      }

      // For lean query, manually create a public profile
      const publicProfile = {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        profileImage: user.profileImage,
        preferences: user.preferences
      };

      return res.json({
        success: true,
        data: {
          user: publicProfile,
          userType: 'standard_user',
          redirectTo: '/dashboard'
        }
      });
    }

    // For staff members
    if (req.user.userType === 'staff') {
      // Validate ObjectId before query
      if (!mongoose.Types.ObjectId.isValid(req.user.id)) {
        return res.status(401).json({
          success: false,
          message: 'Invalid staff identifier',
          error: 'invalid_id',
          redirectTo: '/staff-login'
        });
      }
      
      const staff = await Staff.findById(req.user.id)
        .select('-password -resetPasswordToken -resetPasswordExpire')
        .lean();
      
      if (!staff || !staff.isActive) {
        return res.status(401).json({
          success: false,
          message: 'Staff account inactive or not found',
          redirectTo: '/staff-login'
        });
      }

      // Determine redirect path based on role
      let redirectPath;
      switch (staff.role) {
        case 'admin':
          redirectPath = '/admin/dashboard';
          break;
        case 'supervisor':
          redirectPath = '/supervisor/dashboard';
          break;
        case 'moderator':
          redirectPath = '/moderator/dashboard';
          break;
        case 'analyst':
          redirectPath = '/analyst/dashboard';
          break;
        default:
          redirectPath = '/staff/dashboard';
      }

      return res.json({
        success: true,
        data: {
          user: {
            id: staff._id,
            name: staff.name,
            email: staff.email,
            role: staff.role,
            userType: 'staff'
          },
          redirectTo: redirectPath
        }
      });
    }
    
    // For agency agents
    if (req.user.userType === 'agent') {
      // Validate ObjectId before query
      if (!mongoose.Types.ObjectId.isValid(req.user.id)) {
        return res.status(401).json({
          success: false,
          message: 'Invalid agent identifier',
          error: 'invalid_id',
          redirectTo: '/agent-login'
        });
      }
      
      const agent = await Agent.findById(req.user.id)
        .select('-password -resetPasswordToken -resetPasswordExpire')
        .populate('agency', 'name shortName')
        .lean();
      
      if (!agent || !agent.isActive) {
        return res.status(401).json({
          success: false,
          message: 'Agent account inactive or not found',
          redirectTo: '/agent-login'
        });
      }

      return res.json({
        success: true,
        data: {
          user: {
            id: agent._id,
            name: agent.name,
            email: agent.email,
            agency: agent.agency,
            userType: 'agent'
          },
          redirectTo: '/agent/dashboard'
        }
      });
    }

    // If user type is unknown
    return res.status(401).json({
      success: false,
      message: 'Unknown user type',
      redirectTo: '/login'
    });
  } catch (error) {
    console.error('Auth verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Verification failed',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Server error',
      redirectTo: '/login'
    });
  }
});

/**
 * @route   POST /api/auth/standard-login
 * @desc    Login for standard users
 * @access  Public
 */
router.post('/standard-login', loginLimiter, loginValidation, async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        message: 'Validation failed',
        errors: errors.array() 
      });
    }

    const { email, password } = req.body;

    // Find user by email
    const user = await StandardUser.findOne({ email: email.toLowerCase() }).select('+password');
    
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid credentials',
        error: 'invalid_credentials'
      });
    }

    // Check if account is active
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account is inactive',
        error: 'account_inactive'
      });
    }

    // Verify password
    const isValid = await user.matchPassword(password);
    if (!isValid) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid credentials',
        error: 'invalid_credentials'
      });
    }

    // Update last login time - non-blocking
    updateLastLogin(user);

    // Generate token with better security
    const token = jwt.sign(
      { 
        id: user._id,
        userType: 'standard_user',
        email: user.email,
        iat: Math.floor(Date.now() / 1000)
      },
      JWT_SECRET,
      { 
        expiresIn: JWT_EXPIRE,
        audience: 'sayit-platform',
        issuer: 'sayit-auth-service'
      }
    );

    // Get public profile
    const userProfile = user.getPublicProfile ? 
      user.getPublicProfile() : 
      {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      };

    // Send response
    res.json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        user: userProfile,
        userType: 'standard_user',
        redirectTo: '/dashboard'
      }
    });
  } catch (error) {
    console.error('Standard login error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Authentication failed',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Server error'
    });
  }
});

/**
 * @route   POST /api/auth/staff-login
 * @desc    Staff login for admin and staff roles
 * @access  Public
 */
router.post('/staff-login', loginLimiter, staffLoginValidation, async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        message: 'Validation failed',
        errors: errors.array() 
      });
    }

    const { email, password, role } = req.body;

    // Find staff by email and role
    const staff = await Staff.findOne({ 
      email: email.toLowerCase(),
      role
    }).select('+password');
    
    if (!staff) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid credentials or role',
        error: 'invalid_credentials'
      });
    }

    // Check if account is active
    if (!staff.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account is inactive',
        error: 'account_inactive'
      });
    }

    // Verify password
    const isValid = await staff.matchPassword(password);
    if (!isValid) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid credentials',
        error: 'invalid_credentials'
      });
    }

    // Update last login time - non-blocking
    updateLastLogin(staff);

    // Determine token expiry based on role (shorter for admins)
    const expiresIn = staff.role === 'admin' ? '8h' : '12h';

    // Generate token with enhanced security
    const token = jwt.sign(
      { 
        id: staff._id,
        userType: 'staff',
        role: staff.role,
        email: staff.email,
        iat: Math.floor(Date.now() / 1000)
      },
      JWT_SECRET,
      { 
        expiresIn,
        audience: 'sayit-platform-staff',
        issuer: 'sayit-auth-service'
      }
    );

    // Determine redirect path based on role
    let redirectPath;
    switch (staff.role) {
      case 'admin':
        redirectPath = '/admin/dashboard';
        break;
      case 'supervisor':
        redirectPath = '/supervisor/dashboard';
        break;
      case 'moderator':
        redirectPath = '/moderator/dashboard';
        break;
      case 'analyst':
        redirectPath = '/analyst/dashboard';
        break;
      default:
        redirectPath = '/staff/dashboard';
    }

    // Log the successful staff login for audit purposes
    console.info(`Staff login: ${staff.email} (${staff.role}) at ${new Date().toISOString()}`);

    // Send response
    res.json({
      success: true,
      message: 'Staff login successful',
      data: {
        token,
        user: {
          id: staff._id,
          name: staff.name,
          email: staff.email,
          role: staff.role,
          userType: 'staff'
        },
        redirectTo: redirectPath
      }
    });
  } catch (error) {
    console.error('Staff login error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Authentication failed',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Server error'
    });
  }
});

/**
 * @route   POST /api/auth/agent-login
 * @desc    Login for agency representatives
 * @access  Public
 */
router.post('/agent-login', loginLimiter, loginValidation, async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        message: 'Validation failed',
        errors: errors.array() 
      });
    }

    const { email, password } = req.body;

    // Find agent by email with selective population
    const agent = await Agent.findOne({ email: email.toLowerCase() })
      .select('+password')
      .populate('agency', 'name shortName');
    
    if (!agent) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid credentials',
        error: 'invalid_credentials'
      });
    }

    // Check if account is active
    if (!agent.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account is inactive',
        error: 'account_inactive'
      });
    }

    // Verify password
    const isValid = await agent.matchPassword(password);
    if (!isValid) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid credentials',
        error: 'invalid_credentials'
      });
    }

    // Update last login time - non-blocking
    updateLastLogin(agent);

    // Generate token
    const token = jwt.sign(
      { 
        id: agent._id,
        userType: 'agent',
        agencyId: agent.agency._id,
        email: agent.email,
        iat: Math.floor(Date.now() / 1000)
      },
      JWT_SECRET,
      { 
        expiresIn: '12h',
        audience: 'sayit-platform-agency',
        issuer: 'sayit-auth-service'
      }
    );

    // Send response
    res.json({
      success: true,
      message: 'Agent login successful',
      data: {
        token,
        user: {
          id: agent._id,
          name: agent.name,
          email: agent.email,
          agency: agent.agency,
          userType: 'agent'
        },
        redirectTo: '/agent/dashboard'
      }
    });
  } catch (error) {
    console.error('Agent login error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Authentication failed',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Server error'
    });
  }
});

/**
 * @route   POST /api/auth/anonymous-login
 * @desc    Login using anonymous access code
 * @access  Public
 */
router.post('/anonymous-login', loginLimiter, anonymousLoginValidation, async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        message: 'Validation failed',
        errors: errors.array() 
      });
    }

    const { anonymousCode } = req.body;

    // Find anonymous user by access code
    const anonymousUser = await AnonymousUser.findOne({ 
      accessCode: anonymousCode,
      isActive: true
    });
    
    if (!anonymousUser) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid access code',
        error: 'invalid_code'
      });
    }

    // Check if code has expired
    if (new Date(anonymousUser.expiresAt) < new Date()) {
      return res.status(401).json({ 
        success: false, 
        message: 'This access code has expired',
        error: 'expired_code'
      });
    }

    // Update usage statistics with error handling
    try {
      anonymousUser.usageCount = (anonymousUser.usageCount || 0) + 1;
      anonymousUser.lastUsed = new Date();
      await anonymousUser.save({ validateBeforeSave: false });
    } catch (updateError) {
      // Log but don't fail the login
      console.warn('Failed to update anonymous user usage statistics:', updateError);
    }

    // Generate token with limited scope
    const token = jwt.sign(
      { 
        id: anonymousUser._id, 
        userType: 'anonymous_user',
        iat: Math.floor(Date.now() / 1000)
      },
      JWT_SECRET,
      { 
        expiresIn: '24h',
        audience: 'sayit-platform-anonymous',
        issuer: 'sayit-auth-service'
      }
    );

    // Send response
    res.json({
      success: true,
      message: 'Anonymous login successful',
      data: {
        token,
        isAnonymous: true,
        userType: 'anonymous_user',
        redirectTo: '/anonymous/dashboard',
        expiresAt: anonymousUser.expiresAt
      }
    });
  } catch (error) {
    console.error('Anonymous login error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Authentication failed',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Server error'
    });
  }
});

/**
 * @route   POST /api/auth/generate-anonymous-code
 * @desc    Generate new anonymous access code
 * @access  Private (Staff/Admin Only)
 */
router.post('/generate-anonymous-code', authenticateToken, requireStaff, async (req, res) => {
  try {
    // Create a new anonymous user with a generated code
    const accessCode = crypto.randomBytes(3).toString('hex').toUpperCase();
    
    const anonymousUser = new AnonymousUser({
      accessCode,
      notes: req.body.notes || `Generated by ${req.user.email || 'staff member'}`,
      createdBy: req.user.id,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days by default
    });
    
    await anonymousUser.save();
    
    // Log the code generation for audit purposes
    console.info(`Anonymous code generated by ${req.user.email} (${req.user.id}) at ${new Date().toISOString()}`);
    
    res.json({
      success: true,
      message: 'Anonymous access code generated successfully',
      data: {
        accessCode: anonymousUser.accessCode,
        expiresAt: anonymousUser.expiresAt,
        id: anonymousUser._id
      }
    });
  } catch (error) {
    console.error('Code generation error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to generate anonymous access code',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Server error'
    });
  }
});

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user by invalidating token
 * @access  Private
 */
router.post('/logout', authenticateToken, (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (token) {
      // Add token to blacklist
      blacklistedTokens.add(token);
      
      // In production with MongoDB, we would store the token in a collection
      // with a TTL index to automatically remove expired tokens
    }
    
    // Determine redirect based on user type
    let redirectPath = '/';
    if (req.user.userType === 'anonymous_user') {
      redirectPath = '/anonymous-login';
    } else if (req.user.userType === 'staff') {
      redirectPath = '/staff-login';
    } else if (req.user.userType === 'agent') {
      redirectPath = '/agent-login';
    } else {
      redirectPath = '/login';
    }
    
    res.json({
      success: true,
      message: 'Logged out successfully',
      redirectTo: redirectPath
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Logout failed',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Server error',
      redirectTo: '/'
    });
  }
});

/**
 * @route   POST /api/auth/request-password-reset
 * @desc    Request password reset email
 * @access  Public
 */
router.post('/request-password-reset', loginLimiter, async (req, res) => {
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

    let user;
    // Find user based on user type
    switch (userType) {
      case 'standard_user':
        user = await StandardUser.findOne({ email: normalizedEmail });
        break;
      case 'staff':
        user = await Staff.findOne({ email: normalizedEmail });
        break;
      case 'agent':
        user = await Agent.findOne({ email: normalizedEmail });
        break;
      default:
        // Default to standard user
        user = await StandardUser.findOne({ email: normalizedEmail });
    }
    
    // Always return success to prevent email enumeration
    // But only generate token if user exists
    if (!user) {
      return res.json({
        success: true,
        message: 'If an account exists with this email, a password reset link will be sent.'
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(20).toString('hex');
    
    // Hash token and save to user
    const resetTokenHash = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');
    
    user.resetPasswordToken = resetTokenHash;
    user.resetPasswordExpire = Date.now() + 10 * 60 * 1000; // 10 minutes
    
    await user.save({ validateBeforeSave: false });

    // Create reset URL
    const resetUrl = `${process.env.FRONTEND_URL || 'https://sayit.com'}/reset-password/${resetToken}?type=${userType}`;

    // In a real implementation, we'd send an email here
    // For now, we'll just log it
    console.info(`Password reset requested for ${email} (${userType}). Reset URL: ${resetUrl}`);

    res.json({
      success: true,
      message: 'If an account exists with this email, a password reset link will be sent.',
      dev: process.env.NODE_ENV === 'development' ? { resetToken, resetUrl } : undefined
    });
  } catch (error) {
    console.error('Password reset request error:', error);
    res.status(500).json({
      success: false,
      message: 'Password reset request failed',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Server error'
    });
  }
});

/**
 * @route   POST /api/auth/reset-password/:token
 * @desc    Reset password with token
 * @access  Public
 */
router.post('/reset-password/:token', async (req, res) => {
  try {
    const { password, userType } = req.body;
    const { token } = req.params;
    
    // Validate inputs
    if (!password || !token) {
      return res.status(400).json({
        success: false,
        message: 'Password and token are required'
      });
    }
    
    // Validate password strength
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long'
      });
    }

    // Hash the token from params to compare with stored hash
    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    let user;
    // Find user with unexpired token based on user type
    switch (userType) {
      case 'standard_user':
        user = await StandardUser.findOne({
          resetPasswordToken: hashedToken,
          resetPasswordExpire: { $gt: Date.now() }
        });
        break;
      case 'staff':
        user = await Staff.findOne({
          resetPasswordToken: hashedToken,
          resetPasswordExpire: { $gt: Date.now() }
        });
        break;
      case 'agent':
        user = await Agent.findOne({
          resetPasswordToken: hashedToken,
          resetPasswordExpire: { $gt: Date.now() }
        });
        break;
      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid user type'
        });
    }

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token'
      });
    }

    // Update password and clear reset fields
    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    
    await user.save();

    // For enhanced security, invalidate all existing sessions
    // With MongoDB, you could:
    // 1. Add a "passwordChangedAt" field to user documents
    // 2. Create a middleware that checks token iat against this timestamp

    res.json({
      success: true,
      message: 'Password has been reset successfully',
      redirectTo: userType === 'staff' ? '/staff-login' : 
                 userType === 'agent' ? '/agent-login' : '/login'
    });
  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({
      success: false,
      message: 'Password reset failed',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Server error'
    });
  }
});

/**
 * @route   GET /api/auth/health
 * @desc    Health check endpoint
 * @access  Public
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    authServiceReady: true
  });
});

module.exports = router;