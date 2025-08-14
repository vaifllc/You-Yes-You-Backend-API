import mongoose from 'mongoose';

const adminSettingsSchema = new mongoose.Schema({
  category: {
    type: String,
    required: true,
    enum: [
      'general',
      'invite',
      'domain',
      'categories',
      'tabs',
      'analytics',
      'gamification',
      'appearance',
      'discovery',
      'links',
      'moderation',
      'about',
    ],
  },
  settings: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
}, {
  timestamps: true,
});

// Indexes
adminSettingsSchema.index({ category: 1 });

// Static method to get settings by category
adminSettingsSchema.statics.getByCategory = function(category) {
  return this.findOne({ category });
};

// Static method to update settings
adminSettingsSchema.statics.updateSettings = function(category, settings, updatedBy) {
  return this.findOneAndUpdate(
    { category },
    { settings, updatedBy },
    { new: true, upsert: true }
  );
};

const AdminSettings = mongoose.model('AdminSettings', adminSettingsSchema);

export default AdminSettings;