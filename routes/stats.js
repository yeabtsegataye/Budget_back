const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const Transaction = require('../models/Transaction');

// Apply auth middleware to all routes
router.use(verifyToken);

// GET /api/stats/:uid - Get aggregated stats for charts
router.get('/:uid', async (req, res) => {
  try {
    const { uid } = req.params;
    const { range = 'monthly' } = req.query;

    if (req.user.uid !== uid) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const now = new Date();
    const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentYear = new Date(now.getFullYear(), 0, 1);

    let rangeStart = new Date(0);
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

    const rangeMatch = range === 'all' ? { uid } : { uid, date: { $gte: rangeStart } };
    const last6Months = new Date(now.getFullYear(), now.getMonth() - 6, 1);
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Selected range income and expenses
    const rangeStats = await Transaction.aggregate([
      { $match: rangeMatch },
      {
        $group: {
          _id: '$type',
          total: { $sum: '$amount' }
        }
      }
    ]);

    const income = rangeStats.find(s => s._id === 'income')?.total || 0;
    const expenses = rangeStats.find(s => s._id === 'expense')?.total || 0;

    // Total balance (all time)
    const totalStats = await Transaction.aggregate([
      { $match: { uid } },
      {
        $group: {
          _id: '$type',
          total: { $sum: '$amount' }
        }
      }
    ]);

    const totalIncome = totalStats.find(s => s._id === 'income')?.total || 0;
    const totalExpenses = totalStats.find(s => s._id === 'expense')?.total || 0;
    const totalBalance = totalIncome - totalExpenses;

    // Last month comparison
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthStats = await Transaction.aggregate([
      { $match: { uid, date: { $gte: lastMonth, $lt: currentMonth } } },
      {
        $group: {
          _id: '$type',
          total: { $sum: '$amount' }
        }
      }
    ]);

    const lastMonthIncome = lastMonthStats.find(s => s._id === 'income')?.total || 0;
    const lastMonthExpenses = lastMonthStats.find(s => s._id === 'expense')?.total || 0;

    // Savings rate
    const savingsRate = income > 0 ? ((income - expenses) / income) * 100 : 0;

    // Expense breakdown by category
    const expenseByCategory = await Transaction.aggregate([
      { $match: { ...rangeMatch, type: 'expense' } },
      {
        $group: {
          _id: '$category',
          total: { $sum: '$amount' }
        }
      },
      { $sort: { total: -1 } }
    ]);

    // Income breakdown by category
    const incomeByCategory = await Transaction.aggregate([
      { $match: { ...rangeMatch, type: 'income' } },
      {
        $group: {
          _id: '$category',
          total: { $sum: '$amount' }
        }
      },
      { $sort: { total: -1 } }
    ]);

    // Spending trend for selected range
    const spendingTrend = await Transaction.aggregate([
      { $match: { ...rangeMatch, type: 'expense' } },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$date' }
          },
          total: { $sum: '$amount' }
        }
      },
      { $sort: { '_id': 1 } }
    ]);

    // Daily spending for selected range
    const dailySpending = await Transaction.aggregate([
      { $match: { ...rangeMatch, type: 'expense' } },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$date' }
          },
          total: { $sum: '$amount' }
        }
      },
      { $sort: { '_id': 1 } }
    ]);

    // Income vs expenses over the selected range
    const monthlyComparison = await Transaction.aggregate([
      { $match: rangeMatch },
      {
        $group: {
          _id: {
            year: { $year: '$date' },
            month: { $month: '$date' },
            type: '$type'
          },
          total: { $sum: '$amount' }
        }
      },
      {
        $group: {
          _id: { year: '$_id.year', month: '$_id.month' },
          income: {
            $sum: {
              $cond: [{ $eq: ['$_id.type', 'income'] }, '$total', 0]
            }
          },
          expenses: {
            $sum: {
              $cond: [{ $eq: ['$_id.type', 'expense'] }, '$total', 0]
            }
          }
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

    // Top spending categories for selected range
    const topCategories = await Transaction.aggregate([
      { $match: { ...rangeMatch, type: 'expense' } },
      {
        $group: {
          _id: '$category',
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      { $sort: { total: -1 } },
      { $limit: 5 }
    ]);

    // Weekly spending pattern for selected range
    const weeklyPattern = await Transaction.aggregate([
      { $match: { ...rangeMatch, type: 'expense' } },
      {
        $group: {
          _id: { $dayOfWeek: '$date' },
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id': 1 } }
    ]);

    res.json({
      balance: income - expenses,
      totalBalance,
      income,
      expenses,
      lastMonthIncome,
      lastMonthExpenses,
      savingsRate,
      expenseByCategory,
      incomeByCategory,
      spendingTrend,
      dailySpending,
      monthlyComparison,
      topCategories,
      weeklyPattern
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;