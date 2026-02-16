const express = require('express');
const bcrypt = require('bcryptjs');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { runQuery, getQuery, allQuery } = require('../database/init');
const { execSync } = require('child_process');
const os = require('os');

const router = express.Router();

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
    const quota = storageQuota || 10737418240; // 10GB

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

router.get('/system/disk-space', authenticateToken, requireAdmin, async (req, res) => {
  try {
    let diskSpace = { total: 0, used: 0, available: 0 };
    
    if (os.platform() === 'win32') {
      // Windows
      try {
        const uploadPath = process.env.UPLOAD_PATH || './uploads';
        const driveLetter = uploadPath.match(/^([A-Za-z]:)/) ? uploadPath.match(/^([A-Za-z]:)/)[1] : 'C:';
        const output = execSync(`wmic logicaldisk where "DeviceID='${driveLetter}'" get Size,FreeSpace /format:csv`, { encoding: 'utf-8' });
        const lines = output.trim().split('\n').filter(line => line.trim() && !line.includes('Node'));
        if (lines.length > 0) {
          const parts = lines[lines.length - 1].split(',');
          const free = parseInt(parts[1]) || 0;
          const total = parseInt(parts[2]) || 0;
          diskSpace = {
            total,
            used: total - free,
            available: free
          };
        }
      } catch (error) {
        console.error('Windows disk space error:', error.message);
      }
    } else {
      // Linux/Unix
      try {
        const uploadPath = process.env.UPLOAD_PATH || './uploads';
        const output = execSync(`df -k ${uploadPath}`, { encoding: 'utf-8' });
        const lines = output.trim().split('\n');
        if (lines.length > 1) {
          const parts = lines[1].split(/\s+/);
          const total = parseInt(parts[1]) * 1024; // Convert KB to bytes
          const used = parseInt(parts[2]) * 1024;
          const available = parseInt(parts[3]) * 1024;
          diskSpace = { total, used, available };
        }
      } catch (error) {
        console.error('Linux disk space error:', error.message);
      }
    }
    
    res.json(diskSpace);
  } catch (error) {
    console.error('Get disk space error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
