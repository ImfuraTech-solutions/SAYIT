const mongoose = require('mongoose');

// Define status and priority enums
const ComplaintStatus = {
  PENDING: 'pending',
  UNDER_REVIEW: 'under_review',
  ASSIGNED: 'assigned',
  IN_PROGRESS: 'in_progress',
  RESOLVED: 'resolved',
  CLOSED: 'closed',
  REJECTED: 'rejected'
};

const ComplaintPriority = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
};

const ComplaintSubmissionType = {
  ANONYMOUS: 'anonymous',
  STANDARD: 'standard',
  EXTERNAL: 'external'
};

const ComplaintSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Please add a complaint title'],
    trim: true,
    maxlength: [100, 'Title cannot be more than 100 characters']
  },
  description: {
    type: String,
    required: [true, 'Please provide a description'],
    trim: true,
    maxlength: [2000, 'Description cannot be more than 2000 characters']
  },
  // User identification - either standard or anonymous
  submissionType: {
    type: String,
    enum: Object.values(ComplaintSubmissionType),
    required: [true, 'Submission type is required'],
    index: true // Add index for filtering by submission type
  },  
  // For standard users
  standardUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'StandardUser',
    required: function() { 
      return this.submissionType === ComplaintSubmissionType.STANDARD;
    },
    index: true // Add index for user queries
  },
  // For anonymous users
  anonymousUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AnonymousUser',
    required: function() { 
      return this.submissionType === ComplaintSubmissionType.ANONYMOUS;
    },
    index: true // Add index for anonymous user queries
  },
  // For contact information of anonymous users
  contactInfo: {
    email: String,
    phone: String,
    preferredMethod: {
      type: String,
      enum: ['email', 'phone', 'none'],
      default: 'none'
    }
  },
  location: {
    address: String,
    district: String,
    sector: String,
    cell: String,
    coordinates: {
      type: [Number], // [longitude, latitude]
      index: '2dsphere' // Geospatial index for location-based queries
    }
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: [true, 'Please specify a category'],
    index: true // Add index for category filtering
  },
  agency: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Agency',
    index: true // Add index for agency filtering
  },
  status: {
    type: String,
    enum: Object.values(ComplaintStatus),
    default: ComplaintStatus.PENDING,
    index: true // Add index for status filtering
  },
  priority: {
    type: String,
    enum: Object.values(ComplaintPriority),
    default: ComplaintPriority.MEDIUM,
    index: true // Add index for priority filtering
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Agent',
    index: true // Add index for assigned agent queries
  },
  trackingId: {
    type: String,
    unique: true,
    index: true // Add index for tracking ID lookups
  },
  // Attachments directly in the model
  attachments: [{
    url: {
      type: String,
      required: true
    },
    publicId: String,
    originalName: String,
    fileType: String,
    fileSize: Number,
    format: String,
    resourceType: {
      type: String,
      enum: ['image', 'video', 'audio', 'raw'],
      default: 'image'
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  tags: [String],
  isPublic: {
    type: Boolean,
    default: true,
    index: true // Add index for public/private filtering
  },
  resolvedAt: Date,
  closedAt: Date,
  lastReminderSent: Date
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Create tracking ID before saving
ComplaintSchema.pre('save', async function(next) {
  if (!this.trackingId) {
    // Generate a unique tracking ID (e.g., SAY-2023-XXXXX)
    const date = new Date();
    const year = date.getFullYear();
    const random = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
    this.trackingId = `SAY-${year}-${random}`;
    
    // Verify tracking ID is unique - standard MongoDB approach
    try {
      const existingComplaint = await mongoose.model('Complaint').findOne({ trackingId: this.trackingId });
      if (existingComplaint) {
        // If tracking ID already exists, generate a new one by recursively calling pre-save
        return next(new Error('Tracking ID collision detected. Please try saving again.'));
      }
    } catch (err) {
      return next(err);
    }
  }
  next();
});

// Virtual for responses/comments
ComplaintSchema.virtual('responses', {
  ref: 'Response',
  localField: '_id',
  foreignField: 'complaint',
  justOne: false
});

// Index for searching - standard MongoDB text index
ComplaintSchema.index({ title: 'text', description: 'text', tags: 'text' });

// Add compound indexes for common query patterns
ComplaintSchema.index({ status: 1, createdAt: -1 }); // For sorting active complaints by date
ComplaintSchema.index({ agency: 1, status: 1 }); // For filtering by agency and status
ComplaintSchema.index({ submissionType: 1, createdAt: -1 }); // For filtering by submission type and date
ComplaintSchema.index({ standardUser: 1, createdAt: -1 }); // For user's complaints by date
ComplaintSchema.index({ anonymousUser: 1, createdAt: -1 }); // For anonymous user's complaints by date

// Static methods for common queries
ComplaintSchema.statics.findByTrackingId = function(trackingId) {
  return this.findOne({ trackingId });
};

ComplaintSchema.statics.findByUser = function(userId) {
  return this.find({ 
    standardUser: userId 
  }).sort({ createdAt: -1 });
};

ComplaintSchema.statics.findByAnonymousUser = function(anonymousUserId) {
  return this.find({ 
    anonymousUser: anonymousUserId 
  }).sort({ createdAt: -1 });
};

ComplaintSchema.statics.findByStatus = function(status) {
  return this.find({ status }).sort({ createdAt: -1 });
};

ComplaintSchema.statics.findActiveByAgency = function(agencyId) {
  return this.find({
    agency: agencyId,
    status: { $nin: [ComplaintStatus.CLOSED, ComplaintStatus.REJECTED] }
  }).sort({ priority: -1, createdAt: -1 });
};

// Methods for workflow transitions
ComplaintSchema.methods.markUnderReview = function() {
  this.status = ComplaintStatus.UNDER_REVIEW;
  return this.save();
};

ComplaintSchema.methods.assignToAgent = function(agentId) {
  this.assignedTo = agentId;
  this.status = ComplaintStatus.ASSIGNED;
  return this.save();
};

ComplaintSchema.methods.markInProgress = function() {
  this.status = ComplaintStatus.IN_PROGRESS;
  return this.save();
};

ComplaintSchema.methods.markResolved = function() {
  this.status = ComplaintStatus.RESOLVED;
  this.resolvedAt = new Date();
  return this.save();
};

ComplaintSchema.methods.markClosed = function() {
  this.status = ComplaintStatus.CLOSED;
  this.closedAt = new Date();
  return this.save();
};

ComplaintSchema.methods.markRejected = function(reason) {
  this.status = ComplaintStatus.REJECTED;
  // Optional: store rejection reason in a response
  return this.save();
};

module.exports = mongoose.model('Complaint', ComplaintSchema);
module.exports.ComplaintStatus = ComplaintStatus;
module.exports.ComplaintPriority = ComplaintPriority;
module.exports.ComplaintSubmissionType = ComplaintSubmissionType;