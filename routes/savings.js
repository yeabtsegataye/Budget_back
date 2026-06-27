const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const SavingsGoal = require('../models/SavingsGoal');

router.use(verifyToken);

// GET /api/savings/:uid
router.get('/:uid', async (req, res) => {
  try {
    const { uid } = req.params;
    if (req.user.uid !== uid) return res.status(403).json({ error: 'Forbidden' });
    const goals = await SavingsGoal.find({ uid }).sort({ createdAt: 1 });
    res.json(goals);
  } catch (e) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/savings
router.post('/', async (req, res) => {
  try {
    const { uid, name, icon, color, targetAmount, savedAmount, deadline, notes } = req.body;
    if (req.user.uid !== uid) return res.status(403).json({ error: 'Forbidden' });
    if (!name || !targetAmount) return res.status(400).json({ error: 'name and targetAmount are required' });
    const goal = new SavingsGoal({
      uid, name, icon: icon || '🎯', color: color || '#6366f1',
      targetAmount: parseFloat(targetAmount),
      savedAmount: parseFloat(savedAmount) || 0,
      deadline: deadline ? new Date(deadline) : null,
      notes: notes || ''
    });
    await goal.save();
    res.status(201).json(goal);
  } catch (e) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/savings/:id
router.put('/:id', async (req, res) => {
  try {
    const goal = await SavingsGoal.findById(req.params.id);
    if (!goal) return res.status(404).json({ error: 'Not found' });
    if (goal.uid !== req.user.uid) return res.status(403).json({ error: 'Forbidden' });
    const { name, icon, color, targetAmount, savedAmount, deadline, notes } = req.body;
    if (name !== undefined) goal.name = name;
    if (icon !== undefined) goal.icon = icon;
    if (color !== undefined) goal.color = color;
    if (targetAmount !== undefined) goal.targetAmount = parseFloat(targetAmount);
    if (savedAmount !== undefined) goal.savedAmount = parseFloat(savedAmount);
    if (deadline !== undefined) goal.deadline = deadline ? new Date(deadline) : null;
    if (notes !== undefined) goal.notes = notes;
    await goal.save();
    res.json(goal);
  } catch (e) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/savings/:id
router.delete('/:id', async (req, res) => {
  try {
    const goal = await SavingsGoal.findById(req.params.id);
    if (!goal) return res.status(404).json({ error: 'Not found' });
    if (goal.uid !== req.user.uid) return res.status(403).json({ error: 'Forbidden' });
    await SavingsGoal.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deleted' });
  } catch (e) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
