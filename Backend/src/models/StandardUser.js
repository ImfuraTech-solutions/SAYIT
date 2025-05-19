const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const StandardUserSchema = new mongoose.Schema({
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
    index: true // Index for email lookups - important for query performance
  },
  phone: {
    type: String,
    trim: true
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters'],
    select: false // Good security practice to exclude from queries
  },
  userType: {
    type: String,
    default: 'citizen',
    enum: ['citizen'],
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true // Index for filtering active/inactive users
  },
  lastLogin: {
    type: Date
  },
  isEmailVerified: {
    type: Boolean,
    default: false,
    index: true // Added index for verified user filtering
  },
  verificationToken: String,
  verificationExpire: Date,
  preferences: {
    language: {
      type: String,
      default: 'en'
    },
    notificationSettings: {
      email: {
        type: Boolean,
        default: true
      },
      sms: {
        type: Boolean,
        default: false
      },
      app: {
        type: Boolean,
        default: true
      }
    },
    communicationPreference: {
      type: String,
      enum: ['email', 'sms', 'both'],
      default: 'email'
    }
  },
  address: {
    street: String,
    city: String,
    state: String,
    postalCode: String,
    country: String,
    coordinates: {
      latitude: Number,
      longitude: Number
    }
  },
  profileImage: {
    type: String
  },
  demographicInfo: {
    age: Number,
    gender: String,
    occupation: String
  },
  complaintHistory: {
    totalComplaints: {
      type: Number,
      default: 0
    },
    resolvedComplaints: {
      type: Number,
      default: 0
    },
    lastComplaintDate: Date
  }
}, {
  timestamps: true
});

// Encrypt password using bcrypt
StandardUserSchema.pre('save', async function(next) {
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
StandardUserSchema.methods.getSignedJwtToken = function() {
  return jwt.sign(
    { 
      id: this._id,
      userType: this.userType,
      email: this.email 
    },
    process.env.JWT_SECRET,
    { 
      expiresIn: process.env.JWT_EXPIRE || '7d',
      audience: process.env.JWT_AUDIENCE || 'sayit-api',
      issuer: process.env.JWT_ISSUER || 'sayit-auth'
    }
  );
};

// Match user entered password to hashed password in database
StandardUserSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Update last login timestamp
StandardUserSchema.methods.updateLoginTimestamp = function() {
  this.lastLogin = new Date();
  return this.save({ validateBeforeSave: false });
};

// Generate email verification token
StandardUserSchema.methods.generateVerificationToken = function() {
  // Generate token
  const verificationToken = crypto.randomBytes(20).toString('hex');

  // Hash token and set to verificationToken field
  this.verificationToken = crypto
    .createHash('sha256')
    .update(verificationToken)
    .digest('hex');

  // Set expire
  this.verificationExpire = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

  return verificationToken;
};

// Update complaint statistics
StandardUserSchema.methods.updateComplaintStats = function(isResolved = false) {
  this.complaintHistory.totalComplaints += 1;
  if (isResolved) {
    this.complaintHistory.resolvedComplaints += 1;
  }
  this.complaintHistory.lastComplaintDate = new Date();
  return this.save({ validateBeforeSave: false });
};

// Get public profile (remove sensitive data)
StandardUserSchema.methods.getPublicProfile = function() {
  const userObject = this.toObject();
  delete userObject.password;
  delete userObject.verificationToken;
  delete userObject.verificationExpire;
  return userObject;
};

// Add efficient compound indexes for common query patterns
StandardUserSchema.index({ email: 1 }, { unique: true });
StandardUserSchema.index({ phone: 1 }, { sparse: true });
StandardUserSchema.index({ isActive: 1 });
StandardUserSchema.index({ verificationToken: 1 }, { sparse: true });
StandardUserSchema.index({ "address.city": 1, "address.state": 1 });

// Static method to find by email
StandardUserSchema.statics.findByEmail = function(email) {
  return this.findOne({ email, isActive: true });
};

// Static method to find by phone
StandardUserSchema.statics.findByPhone = function(phone) {
  return this.findOne({ phone, isActive: true });
};

// Static method to check if email is verified
StandardUserSchema.statics.findVerifiedByEmail = function(email) {
  return this.findOne({
    email,
    isActive: true,
    isEmailVerified: true
  });
};

// Static method to find active users who have submitted complaints
StandardUserSchema.statics.findActiveWithComplaints = function() {
  return this.find({
    isActive: true,
    "complaintHistory.totalComplaints": { $gt: 0 }
  }).select('-password');
};

module.exports = mongoose.model('StandardUser', StandardUserSchema);