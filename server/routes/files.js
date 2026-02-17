const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const crypto = require('crypto');
const archiver = require('archiver');
const AdmZip = require('adm-zip');
const { authenticateToken } = require('../middleware/auth');
const { runQuery, getQuery, allQuery } = require('../database/init');

const router = express.Router();
const UPLOAD_PATH = process.env.UPLOAD_PATH || './data/uploads';
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE) || 524288000; // 500MB

const extractingFiles = new Set();

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
    
    let query = 'SELECT * FROM files WHERE user_id = ? AND (is_trashed = 0 OR is_trashed IS NULL)';
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

router.post('/:id/copy', authenticateToken, async (req, res) => {
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

    const user = await getQuery(
      'SELECT storage_quota, storage_used FROM users WHERE id = ?',
      [req.user.id]
    );

    if (user.storage_used + file.size > user.storage_quota) {
      return res.status(400).json({ error: 'Storage quota exceeded' });
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

    const ext = path.extname(file.name);
    const baseName = path.basename(file.name, ext);
    const newFileName = `${baseName}-copy-${Date.now()}${ext}`;
    const newPath = path.join(path.dirname(file.path), newFileName);

    await fs.copyFile(file.path, newPath);

    const result = await runQuery(
      `INSERT INTO files (name, original_name, path, size, mime_type, folder_id, user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        newFileName,
        `Copy of ${file.original_name}`,
        newPath,
        file.size,
        file.mime_type,
        folder_id || file.folder_id,
        req.user.id
      ]
    );

    await runQuery(
      'UPDATE users SET storage_used = storage_used + ? WHERE id = ?',
      [file.size, req.user.id]
    );

    res.status(201).json({
      id: result.lastID,
      message: 'File copied successfully'
    });
  } catch (error) {
    console.error('Copy file error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id/rename', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'File name required' });
    }

    const file = await getQuery(
      'SELECT * FROM files WHERE id = ? AND user_id = ?',
      [id, req.user.id]
    );

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    const mimeType = require('mime-types').lookup(name) || 'application/octet-stream';

    await runQuery(
      'UPDATE files SET original_name = ?, mime_type = ? WHERE id = ?',
      [name, mimeType, id]
    );

    res.json({ message: 'File renamed successfully' });
  } catch (error) {
    console.error('Rename file error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/unzip', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const requestId = Date.now();
  
  try {
    const { folder_id } = req.body;

    console.log(`[Unzip] [${requestId}] Starting extraction for file ID: ${id}`);

    if (extractingFiles.has(id)) {
      console.log(`[Unzip] [${requestId}] File ${id} is already being extracted, rejecting duplicate request`);
      return res.status(409).json({ error: 'This file is already being extracted. Please wait.' });
    }

    extractingFiles.add(id);
    console.log(`[Unzip] [${requestId}] Added file ${id} to extraction queue. Queue size: ${extractingFiles.size}`);

    const file = await getQuery(
      'SELECT * FROM files WHERE id = ? AND user_id = ?',
      [id, req.user.id]
    );

    if (!file) {
      console.log(`[Unzip] [${requestId}] File not found: ${id}`);
      extractingFiles.delete(id);
      return res.status(404).json({ error: 'File not found' });
    }

    if (!file.mime_type?.includes('zip') && !file.original_name.endsWith('.zip')) {
      console.log(`[Unzip] [${requestId}] File is not a zip: ${file.original_name}`);
      extractingFiles.delete(id);
      return res.status(400).json({ error: 'File is not a zip archive' });
    }

    if (!fsSync.existsSync(file.path)) {
      console.log(`[Unzip] [${requestId}] File path does not exist: ${file.path}`);
      extractingFiles.delete(id);
      return res.status(404).json({ error: 'File not found on disk' });
    }

    console.log(`[Unzip] [${requestId}] Reading zip file: ${file.path}`);
    const zip = new AdmZip(file.path);
    const zipEntries = zip.getEntries();
    
    console.log(`[Unzip] [${requestId}] Found ${zipEntries.length} entries in archive`);

    let totalSize = 0;
    zipEntries.forEach(entry => {
      if (!entry.isDirectory) {
        totalSize += entry.header.size;
      }
    });

    console.log(`[Unzip] [${requestId}] Total extracted size will be: ${totalSize} bytes`);

    const user = await getQuery(
      'SELECT storage_quota, storage_used FROM users WHERE id = ?',
      [req.user.id]
    );

    if (user.storage_used + totalSize > user.storage_quota) {
      console.log(`[Unzip] [${requestId}] Storage quota exceeded. Used: ${user.storage_used}, Need: ${totalSize}, Quota: ${user.storage_quota}`);
      extractingFiles.delete(id);
      return res.status(400).json({ error: 'Storage quota exceeded' });
    }

    const folderName = file.original_name.replace(/\.zip$/i, '');
    console.log(`[Unzip] [${requestId}] Creating folder: ${folderName}`);

    let folderPath = folderName;
    const targetFolderId = folder_id || file.folder_id;

    if (targetFolderId) {
      const parentFolder = await getQuery(
        'SELECT path FROM folders WHERE id = ? AND user_id = ?',
        [targetFolderId, req.user.id]
      );
      if (parentFolder) {
        folderPath = parentFolder.path + '/' + folderName;
      }
    }

    const existingFolder = await getQuery(
      'SELECT id FROM folders WHERE user_id = ? AND path = ?',
      [req.user.id, folderPath]
    );

    if (existingFolder) {
      const timestamp = Date.now();
      folderPath = targetFolderId ? 
        (await getQuery('SELECT path FROM folders WHERE id = ?', [targetFolderId])).path + `/${folderName}_${timestamp}` :
        `${folderName}_${timestamp}`;
      console.log(`[Unzip] [${requestId}] Folder exists, using: ${folderPath}`);
    }

    const folderResult = await runQuery(
      'INSERT INTO folders (name, parent_id, user_id, path) VALUES (?, ?, ?, ?)',
      [folderPath.split('/').pop(), targetFolderId || null, req.user.id, folderPath]
    );

    const newFolderId = folderResult.lastID;
    console.log(`[Unzip] [${requestId}] Created folder with ID: ${newFolderId}`);

    const extractPath = path.join(UPLOAD_PATH, req.user.id.toString());
    const filesAdded = [];
    const folderCache = new Map(); 
    folderCache.set(folderPath, newFolderId);

    const getOrCreateFolder = async (entryPath, baseFolderId, baseFolderPath) => {
      if (!entryPath || entryPath === '.') return baseFolderId;

      const fullPath = `${baseFolderPath}/${entryPath}`;
      
      if (folderCache.has(fullPath)) {
        return folderCache.get(fullPath);
      }

      const parts = entryPath.split('/').filter(p => p);
      let currentParentId = baseFolderId;
      let currentPath = baseFolderPath;

      for (const part of parts) {
        currentPath = `${currentPath}/${part}`;
        
        if (folderCache.has(currentPath)) {
          currentParentId = folderCache.get(currentPath);
          continue;
        }

        const existingFolder = await getQuery(
          'SELECT id FROM folders WHERE user_id = ? AND path = ?',
          [req.user.id, currentPath]
        );

        if (existingFolder) {
          await runQuery(
            'UPDATE folders SET parent_id = ? WHERE id = ?',
            [currentParentId, existingFolder.id]
          );
          currentParentId = existingFolder.id;
          folderCache.set(currentPath, existingFolder.id);
        } else {
          const result = await runQuery(
            'INSERT INTO folders (name, parent_id, user_id, path) VALUES (?, ?, ?, ?)',
            [part, currentParentId, req.user.id, currentPath]
          );
          const newFolderId = result.lastID;
          currentParentId = newFolderId;
          folderCache.set(currentPath, newFolderId);
        }
      }

      return currentParentId;
    };

    console.log(`[Unzip] [${requestId}] Starting file extraction for ${zipEntries.filter(e => !e.isDirectory).length} files...`);
    let extractedCount = 0;
    let totalExtractedSize = 0;

    await runQuery('BEGIN TRANSACTION');

    for (const entry of zipEntries) {
      if (!entry.isDirectory) {
        const entryName = entry.entryName.replace(/\\/g, '/'); 
        
        const lastSlashIndex = entryName.lastIndexOf('/');
        const dirPath = lastSlashIndex > 0 ? entryName.substring(0, lastSlashIndex) : '';
        const fileName = lastSlashIndex > 0 ? entryName.substring(lastSlashIndex + 1) : entryName;
        
        const parentFolderId = await getOrCreateFolder(
          dirPath,
          newFolderId,
          folderPath
        );

        const uniqueName = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${path.extname(fileName)}`;
        const filePath = path.join(extractPath, uniqueName);
        
        zip.extractEntryTo(entry, extractPath, false, true, false, uniqueName);
        
        const stats = await fs.stat(filePath);
        const mimeType = require('mime-types').lookup(fileName) || 'application/octet-stream';

        const result = await runQuery(
          `INSERT INTO files (name, original_name, path, size, mime_type, folder_id, user_id)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            uniqueName,
            fileName,
            filePath,
            stats.size,
            mimeType,
            parentFolderId,
            req.user.id
          ]
        );

        filesAdded.push({
          id: result.lastID,
          name: fileName,
          size: stats.size
        });

        totalExtractedSize += stats.size;
        
        extractedCount++;
        if (extractedCount % 100 === 0) {
          console.log(`[Unzip] [${requestId}] Progress: ${extractedCount}/${zipEntries.filter(e => !e.isDirectory).length} files extracted`);
        }
      }
    }

    await runQuery('COMMIT');

    await runQuery(
      'UPDATE users SET storage_used = storage_used + ? WHERE id = ?',
      [totalExtractedSize, req.user.id]
    );

    console.log(`[Unzip] [${requestId}] Successfully extracted ${filesAdded.length} files into folder ${newFolderId}`);

    extractingFiles.delete(id);
    console.log(`[Unzip] [${requestId}] Removed file ${id} from extraction queue. Queue size: ${extractingFiles.size}`);

    res.json({
      message: 'Files extracted successfully',
      files: filesAdded,
      folderId: newFolderId,
      folderName: folderPath.split('/').pop()
    });
  } catch (error) {
    console.error(`[Unzip] [${requestId}] Error:`, error);
    
    try {
      await runQuery('ROLLBACK');
    } catch (rollbackError) {
      console.error(`[Unzip] [${requestId}] Rollback error:`, rollbackError);
    }
    
    extractingFiles.delete(id);
    console.log(`[Unzip] [${requestId}] Removed file ${id} from extraction queue (error). Queue size: ${extractingFiles.size}`);
    res.status(500).json({ error: 'Failed to extract archive', details: error.message });
  }
});

router.post('/bulk/delete', authenticateToken, async (req, res) => {
  try {
    const { file_ids } = req.body;

    if (!Array.isArray(file_ids) || file_ids.length === 0) {
      return res.status(400).json({ error: 'Invalid file IDs' });
    }

    const placeholders = file_ids.map(() => '?').join(',');
    const files = await allQuery(
      `SELECT * FROM files WHERE id IN (${placeholders}) AND user_id = ?`,
      [...file_ids, req.user.id]
    );

    let totalSize = 0;
    for (const file of files) {
      await fs.unlink(file.path).catch(() => {});
      totalSize += file.size;
    }

    await runQuery(
      `DELETE FROM files WHERE id IN (${placeholders}) AND user_id = ?`,
      [...file_ids, req.user.id]
    );

    await runQuery(
      'UPDATE users SET storage_used = storage_used - ? WHERE id = ?',
      [totalSize, req.user.id]
    );

    res.json({ message: `${files.length} files deleted successfully` });
  } catch (error) {
    console.error('Bulk delete error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/bulk/move', authenticateToken, async (req, res) => {
  try {
    const { file_ids, folder_id } = req.body;

    if (!Array.isArray(file_ids) || file_ids.length === 0) {
      return res.status(400).json({ error: 'Invalid file IDs' });
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

    const placeholders = file_ids.map(() => '?').join(',');
    await runQuery(
      `UPDATE files SET folder_id = ? WHERE id IN (${placeholders}) AND user_id = ?`,
      [folder_id || null, ...file_ids, req.user.id]
    );

    res.json({ message: `${file_ids.length} files moved successfully` });
  } catch (error) {
    console.error('Bulk move error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/bulk/download', authenticateToken, async (req, res) => {
  try {
    const { file_ids } = req.body;

    if (!Array.isArray(file_ids) || file_ids.length === 0) {
      return res.status(400).json({ error: 'Invalid file IDs' });
    }

    const placeholders = file_ids.map(() => '?').join(',');
    const files = await allQuery(
      `SELECT * FROM files WHERE id IN (${placeholders}) AND user_id = ?`,
      [...file_ids, req.user.id]
    );

    if (files.length === 0) {
      return res.status(404).json({ error: 'No files found' });
    }

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="files-${Date.now()}.zip"`);

    const archive = archiver('zip', {
      zlib: { level: 9 }
    });

    archive.on('error', (err) => {
      throw err;
    });

    archive.pipe(res);

    for (const file of files) {
      if (fsSync.existsSync(file.path)) {
        archive.file(file.path, { name: file.original_name });
      }
    }

    await archive.finalize();
  } catch (error) {
    console.error('Bulk download error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/search', authenticateToken, async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.trim().length === 0) {
      return res.json([]);
    }

    const files = await allQuery(
      `SELECT * FROM files 
       WHERE user_id = ? AND original_name LIKE ? 
       ORDER BY created_at DESC 
       LIMIT 50`,
      [req.user.id, `%${q}%`]
    );

    res.json(files);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id/favorite', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { is_favorite } = req.body;

    const file = await getQuery(
      'SELECT * FROM files WHERE id = ? AND user_id = ?',
      [id, req.user.id]
    );

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    await runQuery(
      'UPDATE files SET is_favorite = ? WHERE id = ?',
      [is_favorite ? 1 : 0, id]
    );

    res.json({ message: 'Favorite status updated' });
  } catch (error) {
    console.error('Favorite error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/favorites', authenticateToken, async (req, res) => {
  try {
    const files = await allQuery(
      'SELECT * FROM files WHERE user_id = ? AND is_favorite = 1 ORDER BY created_at DESC',
      [req.user.id]
    );

    res.json(files);
  } catch (error) {
    console.error('Get favorites error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id/trash', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const file = await getQuery(
      'SELECT * FROM files WHERE id = ? AND user_id = ?',
      [id, req.user.id]
    );

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    await runQuery(
      'UPDATE files SET is_trashed = 1, trashed_at = CURRENT_TIMESTAMP WHERE id = ?',
      [id]
    );

    res.json({ message: 'File moved to trash' });
  } catch (error) {
    console.error('Trash error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id/restore', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const file = await getQuery(
      'SELECT * FROM files WHERE id = ? AND user_id = ?',
      [id, req.user.id]
    );

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    await runQuery(
      'UPDATE files SET is_trashed = 0, trashed_at = NULL WHERE id = ?',
      [id]
    );

    res.json({ message: 'File restored from trash' });
  } catch (error) {
    console.error('Restore error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/trash', authenticateToken, async (req, res) => {
  try {
    const files = await allQuery(
      'SELECT * FROM files WHERE user_id = ? AND is_trashed = 1 ORDER BY trashed_at DESC',
      [req.user.id]
    );

    res.json(files);
  } catch (error) {
    console.error('Get trash error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/trash/empty', authenticateToken, async (req, res) => {
  try {
    const files = await allQuery(
      'SELECT * FROM files WHERE user_id = ? AND is_trashed = 1',
      [req.user.id]
    );

    let totalSize = 0;
    for (const file of files) {
      await fs.unlink(file.path).catch(() => {});
      totalSize += file.size;
    }

    await runQuery(
      'DELETE FROM files WHERE user_id = ? AND is_trashed = 1',
      [req.user.id]
    );

    await runQuery(
      'UPDATE users SET storage_used = storage_used - ? WHERE id = ?',
      [totalSize, req.user.id]
    );

    res.json({ message: 'Trash emptied successfully' });
  } catch (error) {
    console.error('Empty trash error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
