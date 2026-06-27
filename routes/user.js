const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const User = require('../models/User');

// Apply auth middleware to all routes
router.use(verifyToken);

// GET /api/user/:uid - Get user settings
router.get('/:uid', async (req, res) => {
  try {
    const { uid } = req.params;

    if (req.user.uid !== uid) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    let user = await User.findOne({ uid });
    if (!user) {
      // Create user if not exists
      user = new User({
        uid,
        email: req.user.email,
        displayName: req.user.name || req.user.email
      });
      await user.save();

      // Seed default categories
      const Category = require('../models/Category');
      const defaultCategories = [
        // Expenses
        { name: 'Food', icon: '🍽️', color: '#FF6B6B', type: 'expense', isDefault: true },
        { name: 'Shopping', icon: '🛍️', color: '#4ECDC4', type: 'expense', isDefault: true },
        { name: 'Transport', icon: '🚗', color: '#45B7D1', type: 'expense', isDefault: true },
        { name: 'Bills', icon: '💡', color: '#FFA07A', type: 'expense', isDefault: true },
        { name: 'Entertainment', icon: '🎬', color: '#98D8C8', type: 'expense', isDefault: true },
        { name: 'Healthcare', icon: '🏥', color: '#F7DC6F', type: 'expense', isDefault: true },
        { name: 'Education', icon: '📚', color: '#BB8FCE', type: 'expense', isDefault: true },
        { name: 'Other', icon: '📦', color: '#85C1E9', type: 'expense', isDefault: true },
        // Income
        { name: 'Salary', icon: '💼', color: '#82E0AA', type: 'income', isDefault: true },
        { name: 'Freelance', icon: '💻', color: '#F8C471', type: 'income', isDefault: true },
        { name: 'Investment', icon: '📈', color: '#85C1E9', type: 'income', isDefault: true },
        { name: 'Gift', icon: '🎁', color: '#F1948A', type: 'income', isDefault: true },
        { name: 'Other', icon: '💰', color: '#AED6F1', type: 'income', isDefault: true }
      ];

      for (const cat of defaultCategories) {
        await new Category({ ...cat, uid }).save();
      }
    }

    res.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/user/:uid - Update user settings
router.put('/:uid', async (req, res) => {
  try {
    const { uid } = req.params;
    const updates = req.body;

    if (req.user.uid !== uid) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Only allow updating specific fields
    const allowedFields = ['reminderSettings', 'currency', 'theme','displayName'];
    const filteredUpdates = {};
    Object.keys(updates).forEach(key => {
      if (allowedFields.includes(key)) {
        filteredUpdates[key] = updates[key];
      }
    });

    const user = await User.findOneAndUpdate(
      { uid },
      filteredUpdates,
      { new: true, upsert: true }
    );

    res.json(user);
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;