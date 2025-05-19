const mongoose = require('mongoose');

const AnonymousUserNotificationSchema = new mongoose.Schema({
  anonymousUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AnonymousUser',
    required: true,
    index: true 
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  message: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['system', 'complaint_update', 'response_received', 'status_change'],
    required: true,
    index: true // Added index for filtering by type
  },
  read: {
    type: Boolean,
    default: false,
    index: true // Added index for filtering unread notifications
  },
  relatedId: {
    type: mongoose.Schema.Types.ObjectId,
    // Can reference different models based on type
    refPath: 'onModel'
  },
  onModel: {
    type: String,
    enum: ['Complaint', 'Response']
  },
  priority: {
    type: String,
    enum: ['low', 'normal', 'high'],
    default: 'normal'
  },
  expiresAt: {
    type: Date,
    index: true, // Added index for TTL functionality
    default: () => new Date(+new Date() + 30 * 24 * 60 * 60 * 1000) // Default 30 days
  },
  actions: [{
    label: String,
    url: String
  }]
}, {
  timestamps: true
});

// Method to mark notification as read
AnonymousUserNotificationSchema.methods.markAsRead = async function() {
  this.read = true;
  return this.save();
};

// Static method to create notification for new complaint
AnonymousUserNotificationSchema.statics.createComplaintSubmissionNotification = async function(anonymousUserId, complaintId, complaintTitle, trackingId) {
  return this.create({
    anonymousUser: anonymousUserId,
    title: 'Complaint Submitted Successfully',
    message: `Your complaint "${complaintTitle}" has been received and is being processed. Tracking ID: ${trackingId}`,
    type: 'system',
    relatedId: complaintId,
    onModel: 'Complaint',
    priority: 'normal',
    actions: [
      {
        label: 'View Complaint',
        url: `/anonymous/complaints/${complaintId}`
      },
      {
        label: 'Track Status',
        url: `/anonymous/track/${trackingId}`
      }
    ],
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days expiry
  });
};

// Static method to create notification for complaint status change
AnonymousUserNotificationSchema.statics.createStatusChangeNotification = async function(anonymousUserId, complaintId, complaintTitle, oldStatus, newStatus) {
  let title, message, priority = 'normal';
  
  switch(newStatus) {
    case 'under_review':
      title = 'Complaint Under Review';
      message = `Your complaint "${complaintTitle}" is now being reviewed by our team.`;
      break;
    case 'assigned':
      title = 'Complaint Assigned';
      message = `Your complaint "${complaintTitle}" has been assigned to a staff member for resolution.`;
      break;
    case 'in_progress':
      title = 'Complaint In Progress';
      message = `Work has begun on your complaint "${complaintTitle}".`;
      break;
    case 'resolved':
      title = 'Complaint Resolved';
      message = `Your complaint "${complaintTitle}" has been marked as resolved. Please provide feedback if needed.`;
      priority = 'high';
      break;
    case 'closed':
      title = 'Complaint Closed';
      message = `Your complaint "${complaintTitle}" has been closed. Thank you for using our service.`;
      break;
    case 'rejected':
      title = 'Complaint Rejected';
      message = `Unfortunately, your complaint "${complaintTitle}" could not be processed. Please check the responses for more information.`;
      priority = 'high';
      break;
    default:
      title = 'Complaint Status Updated';
      message = `The status of your complaint "${complaintTitle}" has changed from ${oldStatus} to ${newStatus}.`;
  }
  
  return this.create({
    anonymousUser: anonymousUserId,
    title,
    message,
    type: 'status_change',
    relatedId: complaintId,
    onModel: 'Complaint',
    priority,
    actions: [{
      label: 'View Complaint',
      url: `/anonymous/complaints/${complaintId}`
    }],
    expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000) // 60 days expiry for status changes
  });
};

// Static method to create notification for new response
AnonymousUserNotificationSchema.statics.createResponseReceivedNotification = async function(anonymousUserId, complaintId, complaintTitle, responderType) {
  let responderName;
  switch(responderType) {
    case 'agent':
      responderName = 'an agency representative';
      break;
    case 'staff':
      responderName = 'a staff member';
      break;
    default:
      responderName = 'someone';
  }
  
  return this.create({
    anonymousUser: anonymousUserId,
    title: 'New Response to Your Complaint',
    message: `${responderName} has responded to your complaint "${complaintTitle}".`,
    type: 'response_received',
    relatedId: complaintId,
    onModel: 'Complaint',
    priority: 'high',
    actions: [{
      label: 'View Response',
      url: `/anonymous/complaints/${complaintId}#responses`
    }],
    expiresAt: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000) // 45 days expiry
  });
};

// Static method to create notification for user's response
AnonymousUserNotificationSchema.statics.createUserResponseNotification = async function(anonymousUserId, complaintId, complaintTitle) {
  return this.create({
    anonymousUser: anonymousUserId,
    title: 'Response Added to Complaint',
    message: `Your response to complaint "${complaintTitle}" has been recorded.`,
    type: 'system',
    relatedId: complaintId,
    onModel: 'Complaint',
    priority: 'low',
    expiresAt: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000) // 15 days expiry
  });
};

// Static method to create system notification
AnonymousUserNotificationSchema.statics.createSystemNotification = async function(anonymousUserId, title, message, priority = 'normal', actions = [], expiryDays = 30) {
  return this.create({
    anonymousUser: anonymousUserId,
    title,
    message,
    type: 'system',
    priority,
    actions,
    expiresAt: new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000)
  });
};

// Add compound indices for common query patterns to improve database performance
AnonymousUserNotificationSchema.index({ anonymousUser: 1, read: 1 });
AnonymousUserNotificationSchema.index({ anonymousUser: 1, createdAt: -1 });
AnonymousUserNotificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index

// Pre-save hook to enforce TTL constraints
AnonymousUserNotificationSchema.pre('save', function(next) {
  // Ensure expiresAt is never more than 90 days in the future
  const maxExpiryDate = new Date(+new Date() + 90 * 24 * 60 * 60 * 1000);
  if (this.expiresAt > maxExpiryDate) {
    this.expiresAt = maxExpiryDate;
  }
  next();
});

// Static method to find unread notifications
AnonymousUserNotificationSchema.statics.findUnreadByUser = function(anonymousUserId) {
  return this.find({
    anonymousUser: anonymousUserId,
    read: false,
    expiresAt: { $gt: new Date() }
  }).sort({ createdAt: -1 });
};

// Static method to clear old read notifications
AnonymousUserNotificationSchema.statics.clearOldReadNotifications = function(anonymousUserId, daysOld = 30) {
  const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
  return this.deleteMany({
    anonymousUser: anonymousUserId,
    read: true,
    createdAt: { $lt: cutoffDate }
  });
};

module.exports = mongoose.model('AnonymousUserNotification', AnonymousUserNotificationSchema);