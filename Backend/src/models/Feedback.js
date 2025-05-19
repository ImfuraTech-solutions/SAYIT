const mongoose = require('mongoose');

const FeedbackSchema = new mongoose.Schema({
  complaint: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Complaint',
    required: [true, 'Complaint reference is required'],
    index: true // Add index for complaint-based filtering
  },
  // User reference based on complaint submission type
  submissionType: {
    type: String,
    enum: ['anonymous', 'standard'],
    required: true,
    index: true
  },
  standardUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'StandardUser',
    required: function() { 
      return this.submissionType === 'standard';
    },
    index: true
  },
  anonymousUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AnonymousUser',
    required: function() { 
      return this.submissionType === 'anonymous';
    },
    index: true
  },
  satisfactionLevel: {
    type: Number,
    required: [true, 'Satisfaction level is required'],
    min: [1, 'Satisfaction level must be between 1-5'],
    max: [5, 'Satisfaction level must be between 1-5'],
    index: true // For analytics and reporting
  },
  comment: {
    type: String,
    trim: true,
    maxlength: [1000, 'Comment cannot be more than 1000 characters']
  },
  responseTimeRating: {
    type: Number,
    min: [1, 'Rating must be between 1-5'],
    max: [5, 'Rating must be between 1-5']
  },
  staffProfessionalismRating: {
    type: Number,
    min: [1, 'Rating must be between 1-5'],
    max: [5, 'Rating must be between 1-5']
  },
  resolutionSatisfactionRating: {
    type: Number,
    min: [1, 'Rating must be between 1-5'],
    max: [5, 'Rating must be between 1-5']
  },
  communicationRating: {
    type: Number,
    min: [1, 'Rating must be between 1-5'],
    max: [5, 'Rating must be between 1-5']
  },
  wouldRecommend: {
    type: Boolean,
    default: null
  },
  isPublic: {
    type: Boolean,
    default: false,
    index: true // For filtering public feedback that can be displayed
  },
  agencyResponse: {
    content: String,
    respondedAt: Date,
    respondedBy: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'agencyResponseUserType'
    },
    agencyResponseUserType: {
      type: String,
      enum: ['Agent', 'Staff']
    }
  },
  tags: [String]
}, {
  timestamps: true
});

// Validation to ensure proper user reference is provided
FeedbackSchema.pre('validate', function(next) {
  if (this.submissionType === 'standard' && !this.standardUser) {
    this.invalidate('standardUser', 'Standard user reference is required for standard submission type');
  } else if (this.submissionType === 'anonymous' && !this.anonymousUser) {
    this.invalidate('anonymousUser', 'Anonymous user reference is required for anonymous submission type');
  }
  next();
});

// Create indexes for better performance
FeedbackSchema.index({ complaint: 1, submissionType: 1 });
FeedbackSchema.index({ satisfactionLevel: 1, createdAt: -1 });
FeedbackSchema.index({ createdAt: -1 }); // For chronological listing

// Static method to find feedback by complaint ID
FeedbackSchema.statics.findByComplaint = function(complaintId) {
  return this.findOne({ complaint: complaintId })
    .populate([
      { path: 'standardUser', select: 'name' },
      { path: 'anonymousUser' },
      { 
        path: 'agencyResponse.respondedBy', 
        select: 'name position role', 
        model: doc => doc.agencyResponseUserType 
      }
    ]);
};

// Static method to find all feedback for an agency
FeedbackSchema.statics.findByAgency = function(agencyId) {
  return this.find()
    .populate({
      path: 'complaint',
      match: { agency: agencyId },
      select: 'title trackingId status'
    })
    .sort({ createdAt: -1 });
};

// Method to add agency response
FeedbackSchema.methods.addAgencyResponse = function(content, responderId, responderType) {
  this.agencyResponse = {
    content,
    respondedAt: new Date(),
    respondedBy: responderId,
    agencyResponseUserType: responderType === 'agent' ? 'Agent' : 'Staff'
  };
  
  return this.save();
};

// Method to calculate average rating
FeedbackSchema.methods.getAverageRating = function() {
  const ratings = [
    this.responseTimeRating,
    this.staffProfessionalismRating,
    this.resolutionSatisfactionRating,
    this.communicationRating
  ].filter(rating => rating != null);
  
  if (ratings.length === 0) return this.satisfactionLevel;
  
  const sum = ratings.reduce((total, rating) => total + rating, 0);
  return sum / ratings.length;
};

// Virtual for calculating average rating
FeedbackSchema.virtual('averageRating').get(function() {
  return this.getAverageRating();
});

module.exports = mongoose.model('Feedback', FeedbackSchema);