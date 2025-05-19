const mongoose = require('mongoose');

const TemporaryAccessSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'Email is required'],
    trim: true,
    lowercase: true,
    match: [
      /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
      'Please provide a valid email address'
    ],
    index: true // Index for quick lookup during verification
  },
  accessCode: {
    type: String,
    required: [true, 'Access code is required'],
    index: true // Index for quick lookup
  },
  role: {
    type: String,
    enum: ['agent', 'citizen', 'admin', 'supervisor', 'moderator', 'analyst'],
    required: [true, 'User role is required'],
    index: true // Index for role-based operations
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: [true, 'User ID is required'],
    index: true // Index for user lookups
  },
  userModel: {
    type: String,
    enum: ['Agent', 'StandardUser', 'Staff'],
    required: [true, 'User model type is required']
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 86400 // Auto-delete after 24 hours (TTL index)
  }
});

// Method to generate a random access code
TemporaryAccessSchema.statics.generateAccessCode = function() {
  // Generate a random 9-digit number
  const randomNum = Math.floor(Math.random() * 1000000000).toString().padStart(9, '0');
  return `SAY${randomNum}`;
};

// Static method to create a new temporary access code
TemporaryAccessSchema.statics.createAccessCode = async function(user, userModel) {
  // Delete any existing access codes for this user
  await this.deleteMany({ email: user.email });
  
  // Create new access code
  const accessCode = this.generateAccessCode();
  
  // Determine role from the user
  const role = user.role || (userModel === 'Agent' ? 'agent' : 'citizen');
  
  // Create and return the new temporary access code document
  return await this.create({
    email: user.email,
    accessCode,
    role,
    userId: user._id,
    userModel
  });
};

// Static method to verify an access code
TemporaryAccessSchema.statics.verifyAccessCode = async function(email, accessCode) {
  return await this.findOne({
    email: email.toLowerCase(),
    accessCode
  });
};

// Create compound indexes for common query patterns
TemporaryAccessSchema.index({ email: 1, accessCode: 1 });
TemporaryAccessSchema.index({ userId: 1, userModel: 1 });

module.exports = mongoose.model('TemporaryAccess', TemporaryAccessSchema);