const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const AgentSchema = new mongoose.Schema({
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
    index: true
  },
  phone: {
    type: String,
    trim: true
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters'],
    select: false
  },
  agency: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Agency',
    required: [true, 'Agency is required'],
    index: true
  },
  role: {
    type: String,
    enum: ['agent', 'supervisor', 'admin', 'moderator', 'analyst'],
    default: 'agent',
    index: true
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  profileImage: {
    type: String
  },
  lastLogin: {
    type: Date
  },
  position: {
    type: String,
    trim: true
  },
  department: {
    type: String,
    trim: true
  },
  employeeId: {
    type: String,
    trim: true
  },
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  verificationToken: String,
  verificationExpire: Date,
  assignedCategories: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category'
  }],
  expertise: [{
    type: String,
    trim: true
  }],
  availability: {
    status: {
      type: String,
      enum: ['available', 'busy', 'offline', 'vacation'],
      default: 'available'
    },
    returnDate: Date
  },
  performance: {
    responseTime: {
      type: Number,
      default: 0
    },
    resolutionRate: {
      type: Number,
      default: 0
    },
    citizenSatisfaction: {
      type: Number,
      default: 0
    },
    complaintVolume: {
      type: Number,
      default: 0
    }
  }
}, {
  timestamps: true
});

// Encrypt password using bcrypt
AgentSchema.pre('save', async function(next) {
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
AgentSchema.methods.getSignedJwtToken = function() {
  return jwt.sign(
    { 
      id: this._id,
      role: this.role,
      agency: this.agency,
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
AgentSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Update last login timestamp
AgentSchema.methods.updateLoginTimestamp = function() {
  this.lastLogin = new Date();
  return this.save({ validateBeforeSave: false });
};

// Generate email verification token
AgentSchema.methods.generateVerificationToken = function() {
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

// Get public profile (remove sensitive data)
AgentSchema.methods.getPublicProfile = function() {
  const agentObject = this.toObject();
  delete agentObject.password;
  delete agentObject.verificationToken;
  delete agentObject.verificationExpire;
  return agentObject;
};

// Add efficient compound indexes for common query patterns
AgentSchema.index({ email: 1 }, { unique: true });
AgentSchema.index({ role: 1, isActive: 1 });
AgentSchema.index({ agency: 1, isActive: 1 });
AgentSchema.index({ verificationToken: 1 }, { sparse: true });

// Static method to find by agency
AgentSchema.statics.findByAgency = function(agencyId) {
  return this.find({ 
    agency: agencyId,
    isActive: true
  }).select('-password');
};

// Static method to find by email
AgentSchema.statics.findByEmail = function(email) {
  return this.findOne({ email, isActive: true });
};

// Static method to find active agents by role
AgentSchema.statics.findActiveByRole = function(role) {
  return this.find({ 
    role, 
    isActive: true 
  }).select('-password');
};

// Static method to find verified agent by ID
AgentSchema.statics.findVerifiedById = function(id) {
  return this.findOne({
    _id: id,
    isActive: true,
    isEmailVerified: true
  });
};

module.exports = mongoose.model('Agent', AgentSchema);