const mongoose = require('mongoose');

const AgencySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add an agency name'],
    unique: true,
    trim: true,
    maxlength: [100, 'Agency name cannot be more than 100 characters'],
    index: true // Add index for name lookups
  },
  shortName: {
    type: String,
    trim: true,
    maxlength: [10, 'Short name cannot be more than 10 characters'],
    index: true // Add index for quick lookups
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot be more than 500 characters']
  },
  contactEmail: {
    type: String,
    match: [
      /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
      'Please add a valid email'
    ]
  },
  contactPhone: {
    type: String,
    trim: true
  },
  address: {
    type: String,
    trim: true
  },
  website: {
    type: String,
    trim: true
  },
  logo: {
    type: String,
    default: null
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true // Add index for filtering active agencies
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for agency staff
AgencySchema.virtual('staff', {
  ref: 'User',
  localField: '_id',
  foreignField: 'agencyId',
  justOne: false
});

// Create compound index for common query patterns
AgencySchema.index({ name: 1, isActive: 1 });

// Define methods for the model
AgencySchema.methods.toPublicJSON = function() {
  const agencyObject = this.toObject();
  // Remove sensitive information if any
  return agencyObject;
};

// Static methods for frequently used queries
AgencySchema.statics.findActiveAgencies = function() {
  return this.find({ isActive: true }).sort('name');
};

AgencySchema.statics.findByShortName = function(shortName) {
  return this.findOne({ shortName, isActive: true });
};

module.exports = mongoose.model('Agency', AgencySchema);
