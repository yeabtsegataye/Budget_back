const mongoose = require('mongoose');

const bankAccountSchema = new mongoose.Schema({
  uid: { type: String, required: true },
  name: { type: String, required: true, trim: true },
  icon: { type: String, default: '🏦' },
  color: { type: String, default: '#4A90E2' },
  initialBalance: { type: Number, default: 0 },
  currency: { type: String, default: 'ETB' },
  createdAt: { type: Date, default: Date.now }
});

bankAccountSchema.index({ uid: 1 });

module.exports = mongoose.model('BankAccount', bankAccountSchema);
