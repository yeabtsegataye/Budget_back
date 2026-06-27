const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const BankAccount = require('../models/BankAccount');
const Transaction = require('../models/Transaction');

router.use(verifyToken);

// GET /api/banks/:uid - Get all bank accounts with computed balances
router.get('/:uid', async (req, res) => {
  try {
    const { uid } = req.params;
    if (req.user.uid !== uid) return res.status(403).json({ error: 'Forbidden' });

    const banks = await BankAccount.find({ uid }).sort({ createdAt: 1 });

    // Compute balance for each bank from transactions
    const bankIds = banks.map(b => b._id.toString());
    const txStats = await Transaction.aggregate([
      { $match: { uid, bankId: { $in: bankIds } } },
      {
        $group: {
          _id: { bankId: '$bankId', type: '$type' },
          total: { $sum: '$amount' }
        }
      }
    ]);

    const txMap = {};
    txStats.forEach(s => {
      const key = s._id.bankId;
      if (!txMap[key]) txMap[key] = { income: 0, expense: 0 };
      txMap[key][s._id.type] = s.total;
    });

    const banksWithBalance = banks.map(b => {
      const id = b._id.toString();
      const { income = 0, expense = 0 } = txMap[id] || {};
      return {
        ...b.toObject(),
        currentBalance: b.initialBalance + income - expense
      };
    });

    res.json(banksWithBalance);
  } catch (error) {
    console.error('Error fetching bank accounts:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/banks - Create bank account
router.post('/', async (req, res) => {
  try {
    const { uid, name, icon, color, initialBalance } = req.body;
    if (req.user.uid !== uid) return res.status(403).json({ error: 'Forbidden' });

    const bank = new BankAccount({ uid, name, icon, color, initialBalance: parseFloat(initialBalance) || 0 });
    await bank.save();
    res.status(201).json({ ...bank.toObject(), currentBalance: bank.initialBalance });
  } catch (error) {
    console.error('Error creating bank account:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/banks/:id - Update bank account
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, icon, color, initialBalance } = req.body;

    const bank = await BankAccount.findById(id);
    if (!bank) return res.status(404).json({ error: 'Bank account not found' });
    if (bank.uid !== req.user.uid) return res.status(403).json({ error: 'Forbidden' });

    if (name !== undefined) bank.name = name;
    if (icon !== undefined) bank.icon = icon;
    if (color !== undefined) bank.color = color;
    if (initialBalance !== undefined) bank.initialBalance = parseFloat(initialBalance);

    await bank.save();
    res.json(bank);
  } catch (error) {
    console.error('Error updating bank account:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/banks/:id - Delete bank account
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const bank = await BankAccount.findById(id);
    if (!bank) return res.status(404).json({ error: 'Bank account not found' });
    if (bank.uid !== req.user.uid) return res.status(403).json({ error: 'Forbidden' });

    await BankAccount.findByIdAndDelete(id);
    // Clear bankId on transactions that referenced this bank
    await Transaction.updateMany({ uid: req.user.uid, bankId: id }, { $unset: { bankId: '' } });

    res.json({ message: 'Bank account deleted' });
  } catch (error) {
    console.error('Error deleting bank account:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
