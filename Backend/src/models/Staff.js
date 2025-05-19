const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const StaffSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [100, 'Name cannot be more than 100 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    trim: true,
    lowercase: true,
    match: [
      /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
      'Please provide a valid email address'
    ],
    index: true // Add index for email lookups
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters'],
    select: false
  },
  role: {
    type: String,
    enum: ['admin', 'supervisor', 'moderator', 'analyst'],
    default: 'moderator',
    index: true // Add index for role-based filtering
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true // Add index for active status filtering
  },
  lastLogin: {
    type: Date
  },
  profileImage: {
    type: String,
    default: null
  },
 
}, {
  timestamps: true
});

// Encrypt password using bcrypt
StaffSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    return next();
  }
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Sign JWT and return
StaffSchema.methods.getSignedJwtToken = function() {
  return jwt.sign(
    { 
      id: this._id, 
      role: this.role
    },
    process.env.JWT_SECRET,
    { 
      expiresIn: process.env.JWT_EXPIRE || '1d',
      audience: process.env.JWT_AUDIENCE || 'sayit-api',
      issuer: process.env.JWT_ISSUER || 'sayit-auth'
    }
  );
};

// Match password
StaffSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Removed getResetPasswordToken method since password reset will be handled by TemporaryAccess model

// Update last login timestamp
StaffSchema.methods.updateLoginTimestamp = function() {
  this.lastLogin = new Date();
  return this.save({ validateBeforeSave: false });
};

// Method to get basic profile info (for public display)
StaffSchema.methods.getPublicProfile = function() {
  return {
    id: this._id,
    name: this.name,
    role: this.role,
    profileImage: this.profileImage
  };
};

// Create indexes for better query performance
StaffSchema.index({ email: 1 }, { unique: true }); // Ensure email uniqueness at DB level
StaffSchema.index({ role: 1, isActive: 1 }); // Common query pattern: active staff by role
// Removed resetPasswordToken index since the field no longer exists

// Static method to find active staff by role
StaffSchema.statics.findActiveByRole = function(role) {
  return this.find({ 
    role, 
    isActive: true 
  }).select('-password');
};

// Static method to find all active staff
StaffSchema.statics.findAllActive = function() {
  return this.find({ isActive: true })
    .select('-password')
    .sort('name');
};

// Static method to check if an admin exists (for initial setup)
StaffSchema.statics.hasAdmins = async function() {
  const adminCount = await this.countDocuments({ 
    role: 'admin',
    isActive: true 
  });
  return adminCount > 0;
};

module.exports = mongoose.model('Staff', StaffSchema);