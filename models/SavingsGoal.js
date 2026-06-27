const mongoose = require('mongoose');
const savingsGoalSchema = new mongoose.Schema({
  uid: { type: String, required: true },
  name: { type: String, required: true, trim: true },
  icon: { type: String, default: '🎯' },
  color: { type: String, default: '#6366f1' },
  targetAmount: { type: Number, required: true, min: 0 },
  savedAmount: { type: Number, default: 0 },
  deadline: { type: Date, default: null },
  notes: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});
savingsGoalSchema.index({ uid: 1 });
module.exports = mongoose.model('SavingsGoal', savingsGoalSchema);
