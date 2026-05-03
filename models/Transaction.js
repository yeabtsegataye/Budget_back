const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  uid: { type: String, required: true },
  type: { type: String, enum: ['income', 'expense'], required: true },
  amount: { type: Number, required: true, min: 0 },
  category: { type: String, required: true },
  date: { type: Date, required: true },
  note: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

// Indexes for performance
transactionSchema.index({ uid: 1, date: -1 });
transactionSchema.index({ uid: 1, type: 1, category: 1 });

module.exports = mongoose.model('Transaction', transactionSchema);