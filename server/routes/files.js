const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');
const { authenticateToken } = require('../middleware/auth');
const { runQuery, getQuery, allQuery } = require('../database/init');

const router = express.Router();
const UPLOAD_PATH = process.env.UPLOAD_PATH || './data/uploads';
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE) || 524288000; // 500MB

const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const userDir = path.join(UPLOAD_PATH, req.user.id.toString());
    await fs.mkdir(userDir, { recursive: true });
    cb(null, userDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    cb(null, true);
  }
});

router.get('/', authenticateToken, async (req, res) => {
  try {
    const { folder_id } = req.query;
    
    let query = 'SELECT * FROM files WHERE user_id = ?';
    const params = [req.user.id];
    
    if (folder_id) {
      query += ' AND folder_id = ?';
      params.push(folder_id);
    } else {
      query += ' AND folder_id IS NULL';
    }
    
    query += ' ORDER BY created_at DESC';
    
    const files = await allQuery(query, params);
    res.json(files);
  } catch (error) {
    console.error('Get files error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/upload', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { folder_id } = req.body;

    const user = await getQuery(
      'SELECT storage_quota, storage_used FROM users WHERE id = ?',
      [req.user.id]
    );

    if (user.storage_used + req.file.size > user.storage_quota) {
      await fs.unlink(req.file.path);
      return res.status(400).json({ error: 'Storage quota exceeded' });
    }

    if (folder_id) {
      const folder = await getQuery(
        'SELECT id FROM folders WHERE id = ? AND user_id = ?',
        [folder_id, req.user.id]
      );
      
      if (!folder) {
        await fs.unlink(req.file.path);
        return res.status(404).json({ error: 'Folder not found' });
      }
    }

    const result = await runQuery(
      `INSERT INTO files (name, original_name, path, size, mime_type, folder_id, user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        req.file.filename,
        req.file.originalname,
        req.file.path,
        req.file.size,
        req.file.mimetype,
        folder_id || null,
        req.user.id
      ]
    );

    await runQuery(
      'UPDATE users SET storage_used = storage_used + ? WHERE id = ?',
      [req.file.size, req.user.id]
    );

    res.status(201).json({
      id: result.lastID,
      name: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      mimeType: req.file.mimetype,
      folderId: folder_id || null
    });
  } catch (error) {
    console.error('Upload error:', error);
    if (req.file) {
      await fs.unlink(req.file.path).catch(() => {});
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id/view', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const file = await getQuery(
      `SELECT f.*, sf.permission 
       FROM files f
       LEFT JOIN shared_files sf ON f.id = sf.file_id AND sf.shared_with_user_id = ?
       WHERE f.id = ? AND (f.user_id = ? OR sf.shared_with_user_id = ?)`,
      [req.user.id, id, req.user.id, req.user.id]
    );

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.setHeader('Content-Type', file.mime_type || 'application/octet-stream');
    res.setHeader('Content-Length', file.size);
    res.setHeader('Accept-Ranges', 'bytes');

    res.sendFile(file.path);
  } catch (error) {
    console.error('View error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id/download', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const file = await getQuery(
      `SELECT f.*, sf.permission 
       FROM files f
       LEFT JOIN shared_files sf ON f.id = sf.file_id AND sf.shared_with_user_id = ?
       WHERE f.id = ? AND (f.user_id = ? OR sf.shared_with_user_id = ?)`,
      [req.user.id, id, req.user.id, req.user.id]
    );

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.download(file.path, file.original_name);
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
e
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const file = await getQuery(
      'SELECT * FROM files WHERE id = ? AND user_id = ?',
      [id, req.user.id]
    );

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }
    await fs.unlink(file.path).catch(() => {});

    await runQuery('DELETE FROM files WHERE id = ?', [id]);

    await runQuery(
      'UPDATE users SET storage_used = storage_used - ? WHERE id = ?',
      [file.size, req.user.id]
    );

    res.json({ message: 'File deleted successfully' });
  } catch (error) {
    console.error('Delete file error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/share', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { shareWithUserId, permission } = req.body;

    const file = await getQuery(
      'SELECT * FROM files WHERE id = ? AND user_id = ?',
      [id, req.user.id]
    );

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    if (shareWithUserId) {
      const targetUser = await getQuery('SELECT id FROM users WHERE id = ?', [shareWithUserId]);
      
      if (!targetUser) {
        return res.status(404).json({ error: 'Target user not found' });
      }

      await runQuery(
        'INSERT OR REPLACE INTO shared_files (file_id, shared_with_user_id, permission) VALUES (?, ?, ?)',
        [id, shareWithUserId, permission || 'read']
      );

      res.json({ message: 'File shared successfully' });
    } else {
      const shareToken = crypto.randomBytes(32).toString('hex');
      
      await runQuery(
        'UPDATE files SET is_public = 1, share_token = ? WHERE id = ?',
        [shareToken, id]
      );

      res.json({ shareToken, shareUrl: `/api/files/public/${shareToken}` });
    }
  } catch (error) {
    console.error('Share file error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/public/:token', async (req, res) => {
  try {
    const { token } = req.params;

    const file = await getQuery(
      'SELECT * FROM files WHERE share_token = ? AND is_public = 1',
      [token]
    );

    if (!file) {
      return res.status(404).json({ error: 'File not found or not shared publicly' });
    }

    res.download(file.path, file.original_name);
  } catch (error) {
    console.error('Public download error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/shared/with-me', authenticateToken, async (req, res) => {
  try {
    const files = await allQuery(
      `SELECT f.*, u.username as owner_username, sf.permission
       FROM files f
       INNER JOIN shared_files sf ON f.id = sf.file_id
       INNER JOIN users u ON f.user_id = u.id
       WHERE sf.shared_with_user_id = ?
       ORDER BY f.created_at DESC`,
      [req.user.id]
    );

    res.json(files);
  } catch (error) {
    console.error('Get shared files error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id/move', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { folder_id } = req.body;

    const file = await getQuery(
      'SELECT * FROM files WHERE id = ? AND user_id = ?',
      [id, req.user.id]
    );

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    if (folder_id) {
      const folder = await getQuery(
        'SELECT id FROM folders WHERE id = ? AND user_id = ?',
        [folder_id, req.user.id]
      );
      
      if (!folder) {
        return res.status(404).json({ error: 'Folder not found' });
      }
    }

    await runQuery(
      'UPDATE files SET folder_id = ? WHERE id = ?',
      [folder_id || null, id]
    );

    res.json({ message: 'File moved successfully' });
  } catch (error) {
    console.error('Move file error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
