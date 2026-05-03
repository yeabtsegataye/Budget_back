const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  uid: { type: String, required: true, unique: true, default: () => new mongoose.Types.ObjectId().toString() },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  displayName: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  reminderSettings: {
    enabled: { type: Boolean, default: false },
    time: { type: String, default: '09:00' },
    frequency: { type: String, enum: ['daily', 'weekly', 'monthly'], default: 'daily' },
    dayOfWeek: { type: Number, min: 0, max: 6 }, // 0 = Sunday
    dayOfMonth: { type: Number, min: 1, max: 31 },
    message: { type: String, default: 'Time to check your budget!' },
    soundEnabled: { type: Boolean, default: true }
  },
  currency: { type: String, default: 'USD' },
  theme: { type: String, enum: ['light', 'dark'], default: 'light' },
  resetPasswordToken: String,
  resetPasswordExpires: Date
});

module.exports = mongoose.model('User', userSchema);