const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  uid: { type: String, required: true },
  name: { type: String, required: true },
  icon: { type: String, required: true },
  color: { type: String, required: true },
  isDefault: { type: Boolean, default: false },
  type: { type: String, enum: ['income', 'expense'], required: true },
  budgetLimit: { type: Number, default: null }
});

// Indexes
categorySchema.index({ uid: 1, type: 1 });

module.exports = mongoose.model('Category', categorySchema);