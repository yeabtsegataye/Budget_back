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
    const bankIds = banks.map(b => b._id.toString());

    // Fetch all transactions affecting these banks (including transfers)
    const allTx = await Transaction.find({
      uid,
      $or: [
        { bankId: { $in: bankIds } },
        { transferToBankId: { $in: bankIds } }
      ]
    });

    // Compute balance per bank
    const balanceMap = {};
    bankIds.forEach(id => { balanceMap[id] = 0; });

    allTx.forEach(tx => {
      if (tx.type === 'income' && balanceMap[tx.bankId] !== undefined) {
        balanceMap[tx.bankId] += tx.amount;
      } else if (tx.type === 'expense' && balanceMap[tx.bankId] !== undefined) {
        balanceMap[tx.bankId] -= tx.amount;
      } else if (tx.type === 'transfer') {
        if (tx.bankId && balanceMap[tx.bankId] !== undefined) {
          balanceMap[tx.bankId] -= tx.amount; // outgoing
        }
        if (tx.transferToBankId && balanceMap[tx.transferToBankId] !== undefined) {
          balanceMap[tx.transferToBankId] += tx.amount; // incoming
        }
      }
    });

    const banksWithBalance = banks.map(b => ({
      ...b.toObject(),
      currentBalance: b.initialBalance + balanceMap[b._id.toString()]
    }));

    res.json(banksWithBalance);
  } catch (error) {
    console.error('Error fetching bank accounts:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/banks - Create bank account
router.post('/', async (req, res) => {
  try {
    const { uid, name, icon, color, initialBalance, currency } = req.body;
    if (req.user.uid !== uid) return res.status(403).json({ error: 'Forbidden' });

    const bank = new BankAccount({ uid, name, icon, color, initialBalance: parseFloat(initialBalance) || 0, currency: currency || 'ETB' });
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
    const { name, icon, color, initialBalance, currency } = req.body;

    const bank = await BankAccount.findById(id);
    if (!bank) return res.status(404).json({ error: 'Bank account not found' });
    if (bank.uid !== req.user.uid) return res.status(403).json({ error: 'Forbidden' });

    if (name !== undefined) bank.name = name;
    if (icon !== undefined) bank.icon = icon;
    if (color !== undefined) bank.color = color;
    if (initialBalance !== undefined) bank.initialBalance = parseFloat(initialBalance);
    if (currency !== undefined) bank.currency = currency;

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
