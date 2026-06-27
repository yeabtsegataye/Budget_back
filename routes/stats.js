const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const Transaction = require('../models/Transaction');
const BankAccount = require('../models/BankAccount');

router.use(verifyToken);

// GET /api/stats/:uid - Get aggregated stats for charts
router.get('/:uid', async (req, res) => {
  try {
    const { uid } = req.params;
    const { range = 'monthly', startDate, endDate } = req.query;

    if (req.user.uid !== uid) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const now = new Date();
    const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentYear = new Date(now.getFullYear(), 0, 1);

    let rangeStart = new Date(0);
    let rangeEnd = now;

    // Custom date range overrides preset range
    if (startDate && endDate) {
      rangeStart = new Date(startDate);
      rangeEnd = new Date(endDate);
      rangeEnd.setHours(23, 59, 59, 999);
    } else {
      switch (range) {
        case 'daily':
          rangeStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case 'weekly':
          rangeStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'monthly':
          rangeStart = currentMonth;
          break;
        case 'yearly':
          rangeStart = currentYear;
          break;
        case 'all':
        default:
          rangeStart = new Date(0);
          break;
      }
    }

    const isAll = !startDate && !endDate && range === 'all';
    const rangeMatch = isAll
      ? { uid }
      : { uid, date: { $gte: rangeStart, $lte: rangeEnd } };

    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    // Selected range income and expenses (exclude transfers)
    const rangeStats = await Transaction.aggregate([
      { $match: { ...rangeMatch, type: { $ne: 'transfer' } } },
      { $group: { _id: '$type', total: { $sum: '$amount' } } }
    ]);

    const income = rangeStats.find(s => s._id === 'income')?.total || 0;
    const expenses = rangeStats.find(s => s._id === 'expense')?.total || 0;

    // Previous period computation
    const periodLen = isAll ? 0 : rangeEnd - rangeStart;
    const prevStart = isAll ? new Date(0) : new Date(rangeStart.getTime() - periodLen);
    const prevEnd = isAll ? new Date(0) : new Date(rangeStart.getTime() - 1);
    const prevStats = isAll ? [] : await Transaction.aggregate([
      { $match: { uid, type: { $ne: 'transfer' }, date: { $gte: prevStart, $lte: prevEnd } } },
      { $group: { _id: '$type', total: { $sum: '$amount' } } }
    ]);
    const prevIncome = prevStats.find(s => s._id === 'income')?.total || 0;
    const prevExpenses = prevStats.find(s => s._id === 'expense')?.total || 0;

    // Total balance (all time, exclude transfers)
    const totalStats = await Transaction.aggregate([
      { $match: { uid, type: { $ne: 'transfer' } } },
      { $group: { _id: '$type', total: { $sum: '$amount' } } }
    ]);

    const totalIncome = totalStats.find(s => s._id === 'income')?.total || 0;
    const totalExpenses = totalStats.find(s => s._id === 'expense')?.total || 0;
    const totalBalance = totalIncome - totalExpenses;

    // Last month comparison (exclude transfers)
    const lastMonthStats = await Transaction.aggregate([
      { $match: { uid, type: { $ne: 'transfer' }, date: { $gte: lastMonth, $lt: currentMonth } } },
      { $group: { _id: '$type', total: { $sum: '$amount' } } }
    ]);

    const lastMonthIncome = lastMonthStats.find(s => s._id === 'income')?.total || 0;
    const lastMonthExpenses = lastMonthStats.find(s => s._id === 'expense')?.total || 0;

    const savingsRate = income > 0 ? ((income - expenses) / income) * 100 : 0;

    // Expense breakdown by category
    const expenseByCategory = await Transaction.aggregate([
      { $match: { ...rangeMatch, type: 'expense' } },
      { $group: { _id: '$category', total: { $sum: '$amount' } } },
      { $sort: { total: -1 } }
    ]);

    // Income breakdown by category
    const incomeByCategory = await Transaction.aggregate([
      { $match: { ...rangeMatch, type: 'income' } },
      { $group: { _id: '$category', total: { $sum: '$amount' } } },
      { $sort: { total: -1 } }
    ]);

    // Spending trend
    const spendingTrend = await Transaction.aggregate([
      { $match: { ...rangeMatch, type: 'expense' } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
          total: { $sum: '$amount' }
        }
      },
      { $sort: { '_id': 1 } }
    ]);

    // Daily spending
    const dailySpending = await Transaction.aggregate([
      { $match: { ...rangeMatch, type: 'expense' } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
          total: { $sum: '$amount' }
        }
      },
      { $sort: { '_id': 1 } }
    ]);

    // Monthly comparison
    const monthlyComparison = await Transaction.aggregate([
      { $match: { ...rangeMatch, type: { $ne: 'transfer' } } },
      {
        $group: {
          _id: { year: { $year: '$date' }, month: { $month: '$date' }, type: '$type' },
          total: { $sum: '$amount' }
        }
      },
      {
        $group: {
          _id: { year: '$_id.year', month: '$_id.month' },
          income: { $sum: { $cond: [{ $eq: ['$_id.type', 'income'] }, '$total', 0] } },
          expenses: { $sum: { $cond: [{ $eq: ['$_id.type', 'expense'] }, '$total', 0] } }
        }
      },
      {
        $project: {
          _id: 0,
          month: { $concat: [{ $toString: '$_id.year' }, '-', { $toString: '$_id.month' }] },
          income: 1,
          expenses: 1
        }
      },
      { $sort: { month: 1 } }
    ]);

    // Top spending categories
    const topCategories = await Transaction.aggregate([
      { $match: { ...rangeMatch, type: 'expense' } },
      { $group: { _id: '$category', total: { $sum: '$amount' }, count: { $sum: 1 } } },
      { $sort: { total: -1 } },
      { $limit: 5 }
    ]);

    // Weekly pattern
    const weeklyPattern = await Transaction.aggregate([
      { $match: { ...rangeMatch, type: 'expense' } },
      { $group: { _id: { $dayOfWeek: '$date' }, total: { $sum: '$amount' }, count: { $sum: 1 } } },
      { $sort: { '_id': 1 } }
    ]);

    // Bank account balances (including transfers)
    const banks = await BankAccount.find({ uid }).sort({ createdAt: 1 });
    const bankIds = banks.map(b => b._id.toString());
    const allBankTx = await Transaction.find({
      uid,
      $or: [
        { bankId: { $in: bankIds } },
        { transferToBankId: { $in: bankIds } }
      ]
    });

    const bankBalMap = {};
    bankIds.forEach(id => { bankBalMap[id] = 0; });
    allBankTx.forEach(tx => {
      if (tx.type === 'income' && bankBalMap[tx.bankId] !== undefined) {
        bankBalMap[tx.bankId] += tx.amount;
      } else if (tx.type === 'expense' && bankBalMap[tx.bankId] !== undefined) {
        bankBalMap[tx.bankId] -= tx.amount;
      } else if (tx.type === 'transfer') {
        if (tx.bankId && bankBalMap[tx.bankId] !== undefined) {
          bankBalMap[tx.bankId] -= tx.amount;
        }
        if (tx.transferToBankId && bankBalMap[tx.transferToBankId] !== undefined) {
          bankBalMap[tx.transferToBankId] += tx.amount;
        }
      }
    });

    const bankBalances = banks.map(b => {
      const id = b._id.toString();
      return {
        _id: id,
        name: b.name,
        icon: b.icon,
        color: b.color,
        currentBalance: b.initialBalance + bankBalMap[id]
      };
    });

    res.json({
      balance: income - expenses,
      totalBalance,
      income,
      expenses,
      prevIncome,
      prevExpenses,
      lastMonthIncome,
      lastMonthExpenses,
      savingsRate,
      expenseByCategory,
      incomeByCategory,
      spendingTrend,
      dailySpending,
      monthlyComparison,
      topCategories,
      weeklyPattern,
      bankBalances
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
