const mongoose = require('mongoose');

const UserType = {
  STANDARD_USER: 'standard_user',
  ANONYMOUS_USER: 'anonymous_user',
  AGENT: 'agent',
  STAFF: 'staff'
};

const ResponseSchema = new mongoose.Schema({
  complaint: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Complaint',
    required: true,
    index: true // Improves query performance when fetching responses for a complaint
  },
  // User reference based on type
  userType: {
    type: String,
    enum: Object.values(UserType),
    required: true,
    index: true // Add index for filtering by user type
  },
  // References to different user types
  standardUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'StandardUser',
    required: function() { 
      return this.userType === UserType.STANDARD_USER;
    },
    index: true // Add index for standard user lookups
  },
  anonymousUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AnonymousUser',
    required: function() { 
      return this.userType === UserType.ANONYMOUS_USER;
    },
    index: true // Add index for anonymous user lookups
  },
  agent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Agent',
    required: function() { 
      return this.userType === UserType.AGENT;
    },
    index: true // Add index for agent lookups
  },
  staff: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff',
    required: function() { 
      return this.userType === UserType.STAFF;
    },
    index: true // Add index for staff lookups
  },
  content: {
    type: String,
    required: true,
    trim: true,
    maxlength: [2000, 'Response cannot be more than 2000 characters']
  },
  // Flag to indicate if this is an internal note (visible only to agency staff and admins)
  isInternal: {
    type: Boolean,
    default: false,
    index: true // Add index for filtering internal/external responses
  },
  // For responses that change the status of a complaint
  statusChange: {
    oldStatus: String,
    newStatus: String,
    reason: String
  },
  attachments: [{
    url: String,
    publicId: String,
    originalName: String,
    fileType: String,
    fileSize: Number,
    resourceType: {
      type: String,
      enum: ['image', 'video', 'audio', 'raw'],
      default: 'image'
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  isEdited: {
    type: Boolean,
    default: false
  },
  editHistory: [{
    content: String,
    editedAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

// Validation to ensure proper user reference is provided
ResponseSchema.pre('validate', function(next) {
  // Check if the appropriate user field is provided based on userType
  switch(this.userType) {
    case UserType.STANDARD_USER:
      if (!this.standardUser) {
        this.invalidate('standardUser', 'Standard user reference is required');
      }
      break;
    case UserType.ANONYMOUS_USER:
      if (!this.anonymousUser) {
        this.invalidate('anonymousUser', 'Anonymous user reference is required');
      }
      break;
    case UserType.AGENT:
      if (!this.agent) {
        this.invalidate('agent', 'Agent reference is required');
      }
      break;
    case UserType.STAFF:
      if (!this.staff) {
        this.invalidate('staff', 'Staff reference is required');
      }
      break;
  }
  next();
});

// Create indexes for better performance
ResponseSchema.index({ complaint: 1, createdAt: -1 });
ResponseSchema.index({ userType: 1 });
ResponseSchema.index({ complaint: 1, isInternal: 1 }); // For filtering internal notes within a complaint

// Static method to find responses by complaint ID
ResponseSchema.statics.findByComplaint = function(complaintId) {
  return this.find({ complaint: complaintId })
    .sort({ createdAt: -1 })
    .populate([
      { path: 'standardUser', select: 'name' },
      { path: 'anonymousUser' },
      { path: 'agent', select: 'name position' },
      { path: 'staff', select: 'name role' }
    ]);
};

// Static method to find internal responses
ResponseSchema.statics.findInternalByComplaint = function(complaintId) {
  return this.find({ 
    complaint: complaintId,
    isInternal: true
  })
  .sort({ createdAt: -1 })
  .populate([
    { path: 'agent', select: 'name position' },
    { path: 'staff', select: 'name role' }
  ]);
};

// Static method to find external responses
ResponseSchema.statics.findExternalByComplaint = function(complaintId) {
  return this.find({ 
    complaint: complaintId,
    isInternal: false
  })
  .sort({ createdAt: -1 })
  .populate([
    { path: 'standardUser', select: 'name' },
    { path: 'anonymousUser' },
    { path: 'agent', select: 'name position' },
    { path: 'staff', select: 'name role' }
  ]);
};

// Method to edit a response and maintain history
ResponseSchema.methods.editContent = function(newContent) {
  // Store current content in edit history
  this.editHistory.push({
    content: this.content,
    editedAt: new Date()
  });
  
  // Update content and mark as edited
  this.content = newContent;
  this.isEdited = true;
  
  return this.save();
};

module.exports = mongoose.model('Response', ResponseSchema);
module.exports.UserType = UserType;
