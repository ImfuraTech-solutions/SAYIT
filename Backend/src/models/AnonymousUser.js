const mongoose = require('mongoose');
const crypto = require('crypto');

const AnonymousUserSchema = new mongoose.Schema({
  accessCode: {
    type: String,
    required: [true, 'Access code is required'],
    unique: true,
    index: true
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true // Add index for active filtering
  },
  expiresAt: {
    type: Date,
    default: () => new Date(+new Date() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
    index: true // Add index for TTL processing
  },
  lastLogin: {
    type: Date
  },
  usageCount: {
    type: Number,
    default: 0
  },
  notes: {
    type: String
  },
  deviceInfo: {
    type: String,
    select: false // Not included in queries by default
  }
}, {
  timestamps: true
});

// Create compound indexes for common query patterns
// Optimization for Azure Cosmos DB and standard MongoDB
AnonymousUserSchema.index({ accessCode: 1, isActive: 1 });
AnonymousUserSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index

// Static method to generate a random access code
AnonymousUserSchema.statics.generateAccessCode = function() {
  // Use crypto for more secure random generation
  const randomBytes = crypto.randomBytes(6);
  const randomNumber = parseInt(randomBytes.toString('hex'), 16) % 1000000000;
  return `SAY${randomNumber.toString().padStart(9, '0')}`;
};

// Static method to find by access code
AnonymousUserSchema.statics.findByAccessCode = function(accessCode) {
  return this.findOne({ 
    accessCode, 
    isActive: true,
    expiresAt: { $gt: new Date() } 
  });
};

// Method to check if the code has expired
AnonymousUserSchema.methods.isExpired = function() {
  return this.expiresAt < new Date();
};

// Method to increment usage count
AnonymousUserSchema.methods.incrementUsage = function() {
  this.usageCount += 1;
  this.lastLogin = new Date();
  return this.save();
};

// Method to extend expiration date
AnonymousUserSchema.methods.extendExpiration = function(days = 30) {
  this.expiresAt = new Date(+new Date() + days * 24 * 60 * 60 * 1000);
  return this.save();
};

// Method to invalidate access code
AnonymousUserSchema.methods.invalidate = function() {
  this.isActive = false;
  return this.save();
};

// Pre-save hook to enforce TTL constraints
AnonymousUserSchema.pre('save', function(next) {
  // Ensure expiresAt is never more than 90 days in the future (Azure Cosmos DB TTL limit is 2 years)
  const maxExpiryDate = new Date(+new Date() + 90 * 24 * 60 * 60 * 1000);
  if (this.expiresAt > maxExpiryDate) {
    this.expiresAt = maxExpiryDate;
  }
  next();
});

module.exports = mongoose.model('AnonymousUser', AnonymousUserSchema);