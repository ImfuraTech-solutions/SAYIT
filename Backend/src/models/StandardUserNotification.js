const mongoose = require('mongoose');

const StandardUserNotificationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'StandardUser',
    required: true,
    index: true // General index for query optimization
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
    enum: ['complaint_update', 'response_received', 'system', 'agency_update'],
    required: true,
    index: true // Index for filtering by type
  },
  read: {
    type: Boolean,
    default: false,
    index: true // Index for filtering unread notifications
  },
  relatedId: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'onModel'
  },
  onModel: {
    type: String,
    enum: ['Complaint', 'Response', 'Agency']
  },
  priority: {
    type: String,
    enum: ['low', 'normal', 'high'],
    default: 'normal'
  },
  expiresAt: {
    type: Date,
    default: () => new Date(+new Date() + 60 * 24 * 60 * 60 * 1000), // 60 days default
    index: true // Index for TTL functionality
  },
  actions: [{
    label: String,
    url: String
  }]
}, {
  timestamps: true
});

// Mark notification as read
StandardUserNotificationSchema.methods.markAsRead = async function() {
  this.read = true;
  return this.save();
};

// Static method to create complaint submission notification
StandardUserNotificationSchema.statics.createComplaintSubmissionNotification = async function(userId, complaintId, complaintTitle, trackingId) {
  return this.create({
    user: userId,
    title: 'Complaint Submitted Successfully',
    message: `Your complaint "${complaintTitle}" has been received and is being processed. Tracking ID: ${trackingId}`,
    type: 'system',
    relatedId: complaintId,
    onModel: 'Complaint',
    priority: 'normal',
    actions: [
      {
        label: 'View Complaint',
        url: `/dashboard/complaints/${complaintId}`
      },
      {
        label: 'Track Status',
        url: `/dashboard/track/${trackingId}`
      }
    ]
  });
};

// Static method to create notification for complaint status change
StandardUserNotificationSchema.statics.createStatusChangeNotification = async function(userId, complaintId, complaintTitle, oldStatus, newStatus) {
  let title, message, priority = 'normal';
  
  switch(newStatus) {
    case 'under_review':
      title = 'Complaint Under Review';
      message = `Your complaint "${complaintTitle}" is now being reviewed by our team.`;
      break;
    case 'assigned':
      title = 'Complaint Assigned';
      message = `Your complaint "${complaintTitle}" has been assigned to an agent for resolution.`;
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
    user: userId,
    title,
    message,
    type: 'complaint_update',
    relatedId: complaintId,
    onModel: 'Complaint',
    priority,
    actions: [{
      label: 'View Complaint',
      url: `/dashboard/complaints/${complaintId}`
    }]
  });
};

// Static method to create notification for new response
StandardUserNotificationSchema.statics.createResponseReceivedNotification = async function(userId, complaintId, complaintTitle, responseId, responderType) {
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
    user: userId,
    title: 'New Response to Your Complaint',
    message: `${responderName} has responded to your complaint "${complaintTitle}".`,
    type: 'response_received',
    relatedId: responseId,
    onModel: 'Response',
    priority: 'high',
    actions: [{
      label: 'View Response',
      url: `/dashboard/complaints/${complaintId}#responses`
    }]
  });
};

// Static method to create system notification
StandardUserNotificationSchema.statics.createSystemNotification = async function(userId, title, message, priority = 'normal', actions = [], expiryDays = 30) {
  return this.create({
    user: userId,
    title,
    message,
    type: 'system',
    priority,
    actions,
    expiresAt: new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000)
  });
};

// Add compound indices for common query patterns - works with any MongoDB provider
StandardUserNotificationSchema.index({ user: 1, read: 1 });
StandardUserNotificationSchema.index({ user: 1, createdAt: -1 });
StandardUserNotificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index

// Add new static methods for common notification operations

// Find unread notifications for a user
StandardUserNotificationSchema.statics.findUnreadByUser = function(userId) {
  return this.find({
    user: userId,
    read: false,
    expiresAt: { $gt: new Date() }
  })
  .sort({ priority: -1, createdAt: -1 })
  .limit(50); // Limit for performance
};

// Find recent notifications for a user
StandardUserNotificationSchema.statics.findRecentByUser = function(userId, limit = 20) {
  return this.find({
    user: userId,
    expiresAt: { $gt: new Date() }
  })
  .sort({ createdAt: -1 })
  .limit(limit);
};

// Count unread notifications for a user
StandardUserNotificationSchema.statics.countUnreadByUser = function(userId) {
  return this.countDocuments({
    user: userId,
    read: false,
    expiresAt: { $gt: new Date() }
  });
};

// Mark all notifications as read for a user
StandardUserNotificationSchema.statics.markAllReadForUser = function(userId) {
  return this.updateMany(
    { user: userId, read: false },
    { $set: { read: true } }
  );
};

// Clean up old read notifications (useful for periodic maintenance)
StandardUserNotificationSchema.statics.cleanupOldReadNotifications = function(days = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  
  return this.deleteMany({
    read: true,
    createdAt: { $lt: cutoffDate }
  });
};

// Pre-save hook to ensure expiresAt is never null
StandardUserNotificationSchema.pre('save', function(next) {
  if (!this.expiresAt) {
    this.expiresAt = new Date(+new Date() + 60 * 24 * 60 * 60 * 1000); // 60 days default
  }
  next();
});

module.exports = mongoose.model('StandardUserNotification', StandardUserNotificationSchema);