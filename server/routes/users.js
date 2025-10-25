const express = require('express');
const bcrypt = require('bcryptjs');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { runQuery, getQuery, allQuery } = require('../database/init');

const router = express.Router();

// Get all users (Admin only)
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const users = await allQuery(`
      SELECT id, username, email, is_admin, storage_quota, storage_used, created_at
      FROM users
      ORDER BY created_at DESC
    `);
    res.json(users);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create user (Admin only)
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { username, email, password, storageQuota } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email and password required' });
    }

    const existingUser = await getQuery(
      'SELECT id FROM users WHERE username = ? OR email = ?',
      [username, email]
    );

    if (existingUser) {
      return res.status(400).json({ error: 'Username or email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const quota = storageQuota || 10737418240; // 10GB default

    const result = await runQuery(
      'INSERT INTO users (username, email, password, storage_quota) VALUES (?, ?, ?, ?)',
      [username, email, hashedPassword, quota]
    );

    res.status(201).json({
      id: result.lastID,
      username,
      email,
      storageQuota: quota
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user (Admin only)
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { email, password, storageQuota } = req.body;

    const user = await getQuery('SELECT id FROM users WHERE id = ?', [id]);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const updates = [];
    const params = [];

    if (email) {
      updates.push('email = ?');
      params.push(email);
    }

    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      updates.push('password = ?');
      params.push(hashedPassword);
    }

    if (storageQuota !== undefined) {
      updates.push('storage_quota = ?');
      params.push(storageQuota);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);

    await runQuery(
      `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    res.json({ message: 'User updated successfully' });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete user (Admin only)
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    if (parseInt(id) === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    const user = await getQuery('SELECT id FROM users WHERE id = ?', [id]);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    await runQuery('DELETE FROM users WHERE id = ?', [id]);
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get current user storage stats
router.get('/me/storage', authenticateToken, async (req, res) => {
  try {
    const user = await getQuery(
      'SELECT storage_quota, storage_used FROM users WHERE id = ?',
      [req.user.id]
    );
    res.json(user);
  } catch (error) {
    console.error('Get storage error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
