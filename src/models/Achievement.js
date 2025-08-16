import mongoose from 'mongoose';

const achievementSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxLength: 100 },
  description: { type: String, trim: true, maxLength: 500 },
  points: { type: Number, default: 0, min: 0 },
  icon: { type: String, default: '🏅' },
  category: {
    type: String,
    enum: ['Engagement', 'Learning', 'Community', 'Achievement', 'Streak', 'Special'],
    default: 'Achievement'
  },
  isActive: { type: Boolean, default: true },
  criteria: { type: mongoose.Schema.Types.Mixed },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

achievementSchema.index({ name: 1 });

const Achievement = mongoose.model('Achievement', achievementSchema);

export default Achievement;


