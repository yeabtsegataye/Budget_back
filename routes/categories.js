const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const Category = require('../models/Category');

// Apply auth middleware to all routes
router.use(verifyToken);

// GET /api/categories/:uid - Get user categories
router.get('/:uid', async (req, res) => {
  try {
    const { uid } = req.params;

    if (req.user.uid !== uid) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const categories = await Category.find({ uid }).sort({ type: 1, name: 1 });
    res.json(categories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/categories - Create new category
router.post('/', async (req, res) => {
  try {
    const { uid, name, icon, color, type, budgetLimit } = req.body;

    if (req.user.uid !== uid) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const category = new Category({
      uid,
      name,
      icon,
      color,
      type,
      isDefault: false,
      budgetLimit: budgetLimit !== undefined ? parseFloat(budgetLimit) : null
    });

    await category.save();
    res.status(201).json(category);
  } catch (error) {
    console.error('Error creating category:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/categories/:id - Edit category
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, icon, color } = req.body;

    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    if (category.uid !== req.user.uid) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (category.isDefault) {
      return res.status(400).json({ error: 'Cannot edit default categories' });
    }

    category.name = name;
    category.icon = icon;
    category.color = color;
    if (req.body.budgetLimit !== undefined) category.budgetLimit = req.body.budgetLimit !== null ? parseFloat(req.body.budgetLimit) : null;

    await category.save();
    res.json(category);
  } catch (error) {
    console.error('Error updating category:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/categories/:id - Delete category
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    if (category.uid !== req.user.uid) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (category.isDefault) {
      return res.status(400).json({ error: 'Cannot delete default categories' });
    }

    await Category.findByIdAndDelete(id);
    res.json({ message: 'Category deleted' });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;