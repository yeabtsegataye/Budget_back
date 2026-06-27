const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const Transaction = require('../models/Transaction');

// Apply auth middleware to all routes
router.use(verifyToken);

// GET /api/transactions/:uid - Get transactions with filters
router.get('/:uid', async (req, res) => {
  try {
    const { uid } = req.params;
    const { type, startDate, endDate, page = 1, limit = 10, category, search } = req.query;

    if (req.user.uid !== uid) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    let query = { uid };

    if (type) query.type = type;
    if (category) query.category = category;
    if (search) query.note = { $regex: search, $options: 'i' };
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    const skip = (page - 1) * limit;
    const transactions = await Transaction.find(query)
      .sort({ date: -1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Transaction.countDocuments(query);

    res.json({
      transactions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/transactions - Add new transaction
router.post('/', async (req, res) => {
  try {
    const { uid, type, amount, category, date, note, bankId, isRecurring, recurringFrequency, transferToBankId } = req.body;

    if (req.user.uid !== uid) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const transaction = new Transaction({
      uid,
      type,
      amount: parseFloat(amount),
      category: category || (type === 'transfer' ? 'Transfer' : category),
      date: new Date(date),
      note: note || '',
      bankId: bankId || null,
      isRecurring: isRecurring || false,
      recurringFrequency: recurringFrequency || null,
      transferToBankId: transferToBankId || null
    });

    await transaction.save();
    res.status(201).json(transaction);
  } catch (error) {
    console.error('Error creating transaction:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/transactions/:id - Edit transaction
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { type, amount, category, date, note, bankId, isRecurring, recurringFrequency, transferToBankId } = req.body;

    const transaction = await Transaction.findById(id);
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    if (transaction.uid !== req.user.uid) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    transaction.type = type;
    transaction.amount = parseFloat(amount);
    transaction.category = category || (type === 'transfer' ? 'Transfer' : category);
    transaction.date = new Date(date);
    transaction.note = note || '';
    transaction.bankId = bankId || null;
    transaction.isRecurring = isRecurring || false;
    transaction.recurringFrequency = recurringFrequency || null;
    transaction.transferToBankId = transferToBankId || null;

    await transaction.save();
    res.json(transaction);
  } catch (error) {
    console.error('Error updating transaction:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/transactions/:id - Delete transaction
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const transaction = await Transaction.findById(id);
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    if (transaction.uid !== req.user.uid) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await Transaction.findByIdAndDelete(id);
    res.json({ message: 'Transaction deleted' });
  } catch (error) {
    console.error('Error deleting transaction:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/transactions/:uid/all - Delete all user transactions
router.delete('/:uid/all', async (req, res) => {
  try {
    const { uid } = req.params;

    if (req.user.uid !== uid) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await Transaction.deleteMany({ uid });
    res.json({ message: 'All transactions deleted' });
  } catch (error) {
    console.error('Error deleting all transactions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;