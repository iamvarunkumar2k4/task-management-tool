const express = require('express');
const Task = require('../models/Task');
const router = express.Router();

const broadcastTaskUpdate = (req, action, payload) => {
  if (req.app.locals.io) {
    req.app.locals.io.emit('task:update', { action, payload });
  }
};

router.get('/', async (req, res) => {
  try {
    const { status, priority, sortBy = 'createdAt', order = 'desc' } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (priority) filter.priority = priority;

    const tasks = await Task.find(filter).sort({ [sortBy]: order === 'asc' ? 1 : -1 });
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch tasks', error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { title, description, status, priority, dueDate } = req.body;
    if (!title || title.trim().length < 3) {
      return res.status(400).json({ message: 'Title must be at least 3 characters long.' });
    }

    const task = new Task({ title, description, status, priority, dueDate });
    await task.save();
    broadcastTaskUpdate(req, 'created', task);
    res.status(201).json(task);
  } catch (error) {
    res.status(500).json({ message: 'Failed to create task', error: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { title, description, status, priority, dueDate } = req.body;
    if (!title || title.trim().length < 3) {
      return res.status(400).json({ message: 'Title must be at least 3 characters long.' });
    }

    const task = await Task.findByIdAndUpdate(
      req.params.id,
      { title, description, status, priority, dueDate },
      { new: true, runValidators: true }
    );

    if (!task) return res.status(404).json({ message: 'Task not found' });
    broadcastTaskUpdate(req, 'updated', task);
    res.json(task);
  } catch (error) {
    res.status(500).json({ message: 'Failed to update task', error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const task = await Task.findByIdAndDelete(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found' });
    broadcastTaskUpdate(req, 'deleted', { id: req.params.id });
    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete task', error: error.message });
  }
});

module.exports = router;
