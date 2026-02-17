const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { runQuery, getQuery, allQuery } = require('../database/init');

const router = express.Router();

router.get('/', authenticateToken, async (req, res) => {
  try {
    const { parent_id } = req.query;
    
    let query = 'SELECT * FROM folders WHERE user_id = ?';
    const params = [req.user.id];
    
    if (parent_id) {
      query += ' AND parent_id = ?';
      params.push(parent_id);
    } else {
      query += ' AND parent_id IS NULL';
    }
    
    query += ' ORDER BY name ASC';
    
    const folders = await allQuery(query, params);
    res.json(folders);
  } catch (error) {
    console.error('Get folders error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', authenticateToken, async (req, res) => {
  try {
    const { name, parent_id } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Folder name required' });
    }

    let path = '/' + name;
    if (parent_id) {
      const parent = await getQuery(
        'SELECT path FROM folders WHERE id = ? AND user_id = ?',
        [parent_id, req.user.id]
      );
      
      if (!parent) {
        return res.status(404).json({ error: 'Parent folder not found' });
      }
      
      path = parent.path + '/' + name;
    }

    const existing = await getQuery(
      'SELECT id FROM folders WHERE user_id = ? AND path = ?',
      [req.user.id, path]
    );

    if (existing) {
      return res.status(400).json({ error: 'Folder already exists' });
    }

    const result = await runQuery(
      'INSERT INTO folders (name, parent_id, user_id, path) VALUES (?, ?, ?, ?)',
      [name, parent_id || null, req.user.id, path]
    );

    res.status(201).json({
      id: result.lastID,
      name,
      parent_id: parent_id || null,
      path,
      user_id: req.user.id
    });
  } catch (error) {
    console.error('Create folder error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Folder name required' });
    }

    const folder = await getQuery(
      'SELECT * FROM folders WHERE id = ? AND user_id = ?',
      [id, req.user.id]
    );

    if (!folder) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    const oldPath = folder.path;
    const pathParts = oldPath.split('/');
    pathParts[pathParts.length - 1] = name;
    const newPath = pathParts.join('/');

    await runQuery(
      'UPDATE folders SET name = ?, path = ? WHERE id = ?',
      [name, newPath, id]
    );

    await runQuery(
      `UPDATE folders SET path = REPLACE(path, ?, ?) WHERE path LIKE ? AND user_id = ?`,
      [oldPath, newPath, oldPath + '/%', req.user.id]
    );

    res.json({ message: 'Folder renamed successfully' });
  } catch (error) {
    console.error('Rename folder error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const folder = await getQuery(
      'SELECT * FROM folders WHERE id = ? AND user_id = ?',
      [id, req.user.id]
    );

    if (!folder) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    await runQuery('DELETE FROM folders WHERE id = ?', [id]);

    res.json({ message: 'Folder deleted successfully' });
  } catch (error) {
    console.error('Delete folder error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/tree', authenticateToken, async (req, res) => {
  try {
    const folders = await allQuery(
      'SELECT * FROM folders WHERE user_id = ? ORDER BY path ASC',
      [req.user.id]
    );

    const tree = [];
    const folderMap = {};

    folders.forEach(folder => {
      folderMap[folder.id] = { ...folder, children: [] };
    });

    folders.forEach(folder => {
      if (folder.parent_id) {
        if (folderMap[folder.parent_id]) {
          folderMap[folder.parent_id].children.push(folderMap[folder.id]);
        }
      } else {
        tree.push(folderMap[folder.id]);
      }
    });

    res.json(tree);
  } catch (error) {
    console.error('Get folder tree error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id/move', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { parent_id } = req.body;

    const folder = await getQuery(
      'SELECT * FROM folders WHERE id = ? AND user_id = ?',
      [id, req.user.id]
    );

    if (!folder) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    if (parent_id) {
      const parentFolder = await getQuery(
        'SELECT * FROM folders WHERE id = ? AND user_id = ?',
        [parent_id, req.user.id]
      );
      
      if (!parentFolder) {
        return res.status(404).json({ error: 'Parent folder not found' });
      }

      if (parentFolder.path.startsWith(folder.path + '/')) {
        return res.status(400).json({ error: 'Cannot move folder to its own subfolder' });
      }
    }

    const oldPath = folder.path;
    const newPath = parent_id 
      ? (await getQuery('SELECT path FROM folders WHERE id = ?', [parent_id])).path + '/' + folder.name
      : '/' + folder.name;

    await runQuery(
      'UPDATE folders SET parent_id = ?, path = ? WHERE id = ?',
      [parent_id || null, newPath, id]
    );

    await runQuery(
      `UPDATE folders SET path = REPLACE(path, ?, ?) WHERE path LIKE ? AND user_id = ?`,
      [oldPath, newPath, oldPath + '/%', req.user.id]
    );

    res.json({ message: 'Folder moved successfully' });
  } catch (error) {
    console.error('Move folder error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
