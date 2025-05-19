const mongoose = require('mongoose');

const CategorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add a category name'],
    unique: true,
    trim: true,
    maxlength: [50, 'Category name cannot be more than 50 characters'],
    index: true // Add index for name lookups
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot be more than 500 characters']
  },
  defaultAgency: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Agency',
    index: true // Add index for agency lookups
  },
  icon: {
    type: String,
    default: 'feedback' // Default material icon name
  },
  color: {
    type: String,
    default: '#3498db' // Default color as hex
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true // Add index for active status filtering
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
  timestamps: true
});

// Add compound index for common query patterns
CategorySchema.index({ isActive: 1, name: 1 });

// Static method to find active categories
CategorySchema.statics.findActiveCategories = function() {
  return this.find({ isActive: true }).sort('name');
};

// Static method to find active categories with agency details
CategorySchema.statics.findActiveCategoriesWithAgency = function() {
  return this.find({ isActive: true })
    .populate('defaultAgency', 'name shortName')
    .sort('name');
};

// Static method to find by ID with agency details
CategorySchema.statics.findByIdWithAgency = function(id) {
  return this.findById(id)
    .populate('defaultAgency', 'name shortName')
    .exec();
};

// Method to safely update category attributes
CategorySchema.methods.updateDetails = async function(updates) {
  const allowedUpdates = ['name', 'description', 'defaultAgency', 'icon', 'color', 'isActive'];
  
  Object.keys(updates).forEach(update => {
    if (allowedUpdates.includes(update)) {
      this[update] = updates[update];
    }
  });
  
  return this.save();
};

module.exports = mongoose.model('Category', CategorySchema);
