const ssh2 = require('ssh2');
const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const mime = require('mime-types');
const { runQuery, getQuery, allQuery } = require('./database/init');

const SFTP_PORT = parseInt(process.env.SFTP_PORT) || 22;
const UPLOAD_PATH = process.env.UPLOAD_PATH || './data/uploads';
const HOST_KEY_PATH = path.resolve('./data/ssh_host_key');
const STATUS_CODE = ssh2.utils.sftp.STATUS_CODE;
const OPEN_MODE = ssh2.utils.sftp.OPEN_MODE;

function ensureHostKey() {
  const dataDir = path.dirname(HOST_KEY_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  if (!fs.existsSync(HOST_KEY_PATH)) {
    const { privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
      publicKeyEncoding: { type: 'pkcs1', format: 'pem' }
    });
    fs.writeFileSync(HOST_KEY_PATH, privateKey, { mode: 0o600 });
    console.log('SSH host key generated at', HOST_KEY_PATH);
  }
  return fs.readFileSync(HOST_KEY_PATH);
}

async function resolveFolderByPath(userId, virtualPath) {
  const normalized = '/' + virtualPath.split('/').filter(Boolean).join('/');
  if (normalized === '/') return null;
  return await getQuery(
    'SELECT * FROM folders WHERE user_id = ? AND path = ?',
    [userId, normalized]
  );
}

async function resolveParentAndName(userId, virtualPath) {
  const parts = virtualPath.split('/').filter(Boolean);
  if (parts.length === 0) return null;
  const name = parts.pop();
  const parentPath = '/' + parts.join('/');

  let parentFolderId = null;
  if (parts.length > 0) {
    const parentFolder = await getQuery(
      'SELECT id FROM folders WHERE user_id = ? AND path = ?',
      [userId, parentPath]
    );
    if (!parentFolder) return null;
    parentFolderId = parentFolder.id;
  }
  return { parentFolderId, name };
}

async function resolveFileByPath(userId, virtualPath) {
  const resolved = await resolveParentAndName(userId, virtualPath);
  if (!resolved) return undefined;
  const { parentFolderId, name } = resolved;

  const query = parentFolderId
    ? 'SELECT * FROM files WHERE user_id = ? AND original_name = ? AND folder_id = ? AND (is_trashed = 0 OR is_trashed IS NULL)'
    : 'SELECT * FROM files WHERE user_id = ? AND original_name = ? AND folder_id IS NULL AND (is_trashed = 0 OR is_trashed IS NULL)';
  const params = parentFolderId
    ? [userId, name, parentFolderId]
    : [userId, name];

  return await getQuery(query, params);
}

function buildFileAttrs(fileRow) {
  const mtime = Math.floor(new Date(fileRow.updated_at || fileRow.created_at).getTime() / 1000);
  return { mode: 0o100644, uid: 0, gid: 0, size: fileRow.size, atime: mtime, mtime };
}

function buildDirAttrs(folderRow) {
  const mtime = folderRow
    ? Math.floor(new Date(folderRow.created_at).getTime() / 1000)
    : Math.floor(Date.now() / 1000);
  return { mode: 0o40755, uid: 0, gid: 0, size: 0, atime: mtime, mtime };
}

function formatLongname(name, attrs) {
  const isDir = (attrs.mode & 0o40000) !== 0;
  const perms = isDir ? 'drwxr-xr-x' : '-rw-r--r--';
  const d = new Date((attrs.mtime || 0) * 1000);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const dateStr = `${months[d.getMonth()]} ${String(d.getDate()).padStart(2)} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  const size = String(attrs.size).padStart(13);
  return `${perms}    1 user     user     ${size} ${dateStr} ${name}`;
}

async function deduplicateName(userId, originalName, folderId) {
  const ext = path.extname(originalName);
  const base = path.basename(originalName, ext);
  let candidate = originalName;
  let counter = 1;

  while (true) {
    const folderCondition = folderId ? 'folder_id = ?' : 'folder_id IS NULL';
    const params = folderId ? [userId, candidate, folderId] : [userId, candidate];
    const existing = await getQuery(
      `SELECT id FROM files WHERE user_id = ? AND original_name = ? AND ${folderCondition} AND (is_trashed = 0 OR is_trashed IS NULL)`,
      params
    );
    if (!existing) return candidate;
    candidate = `${base} (${counter})${ext}`;
    counter++;
  }
}

function startSFTPServer() {
  const hostKey = ensureHostKey();

  const server = new ssh2.Server({ hostKeys: [hostKey] }, (client) => {
    let authenticatedUser = null;

    client.on('authentication', (ctx) => {
      if (ctx.method === 'password') {
        getQuery('SELECT * FROM users WHERE username = ?', [ctx.username])
          .then(async (user) => {
            if (user && await bcrypt.compare(ctx.password, user.password)) {
              authenticatedUser = user;
              ctx.accept();
            } else {
              ctx.reject(['password']);
            }
          })
          .catch(() => ctx.reject(['password']));
      } else {
        ctx.reject(['password']);
      }
    });

    client.on('ready', () => {
      console.log(`SFTP: User "${authenticatedUser.username}" connected`);

      client.on('session', (accept) => {
        const session = accept();

        session.on('sftp', (accept) => {
          const sftp = accept();
          const userId = authenticatedUser.id;

          const openHandles = new Map();
          let handleCounter = 0;

          function allocHandle(info) {
            const handle = Buffer.alloc(4);
            handle.writeUInt32BE(handleCounter++, 0);
            openHandles.set(handle.toString('hex'), info);
            return handle;
          }

          function getHandle(buf) {
            return openHandles.get(buf.toString('hex'));
          }

          function closeHandle(buf) {
            const key = buf.toString('hex');
            const info = openHandles.get(key);
            openHandles.delete(key);
            return info;
          }

          sftp.on('REALPATH', (reqid, reqPath) => {
            const resolved = path.posix.resolve('/', reqPath);
            const attrs = buildDirAttrs(null);
            sftp.name(reqid, [{ filename: resolved, longname: formatLongname(resolved, attrs), attrs }]);
          });

          sftp.on('STAT', async (reqid, reqPath) => {
            try {
              const normalized = '/' + reqPath.split('/').filter(Boolean).join('/');
              if (normalized === '/') {
                return sftp.attrs(reqid, buildDirAttrs(null));
              }
              const folder = await resolveFolderByPath(userId, normalized);
              if (folder) {
                return sftp.attrs(reqid, buildDirAttrs(folder));
              }
              const file = await resolveFileByPath(userId, normalized);
              if (file) {
                return sftp.attrs(reqid, buildFileAttrs(file));
              }
              sftp.status(reqid, STATUS_CODE.NO_SUCH_FILE);
            } catch (err) {
              console.error('SFTP STAT error:', err);
              sftp.status(reqid, STATUS_CODE.FAILURE);
            }
          });

          sftp.on('LSTAT', async (reqid, reqPath) => {
            try {
              const normalized = '/' + reqPath.split('/').filter(Boolean).join('/');
              if (normalized === '/') {
                return sftp.attrs(reqid, buildDirAttrs(null));
              }
              const folder = await resolveFolderByPath(userId, normalized);
              if (folder) {
                return sftp.attrs(reqid, buildDirAttrs(folder));
              }
              const file = await resolveFileByPath(userId, normalized);
              if (file) {
                return sftp.attrs(reqid, buildFileAttrs(file));
              }
              sftp.status(reqid, STATUS_CODE.NO_SUCH_FILE);
            } catch (err) {
              console.error('SFTP LSTAT error:', err);
              sftp.status(reqid, STATUS_CODE.FAILURE);
            }
          });

          sftp.on('FSTAT', (reqid, handleBuf) => {
            const h = getHandle(handleBuf);
            if (!h) return sftp.status(reqid, STATUS_CODE.FAILURE);
            if (h.type === 'dir') {
              sftp.attrs(reqid, buildDirAttrs(null));
            } else if (h.fileRow) {
              sftp.attrs(reqid, buildFileAttrs(h.fileRow));
            } else {
              sftp.status(reqid, STATUS_CODE.FAILURE);
            }
          });

          sftp.on('OPENDIR', async (reqid, reqPath) => {
            try {
              const normalized = '/' + reqPath.split('/').filter(Boolean).join('/');
              let folderId = null;

              if (normalized !== '/') {
                const folder = await resolveFolderByPath(userId, normalized);
                if (!folder) return sftp.status(reqid, STATUS_CODE.NO_SUCH_FILE);
                folderId = folder.id;
              }

              const folderQuery = folderId
                ? 'SELECT * FROM folders WHERE user_id = ? AND parent_id = ? ORDER BY name ASC'
                : 'SELECT * FROM folders WHERE user_id = ? AND parent_id IS NULL ORDER BY name ASC';
              const folderParams = folderId ? [userId, folderId] : [userId];
              const subfolders = await allQuery(folderQuery, folderParams);

              const fileQuery = folderId
                ? 'SELECT * FROM files WHERE user_id = ? AND folder_id = ? AND (is_trashed = 0 OR is_trashed IS NULL) ORDER BY original_name ASC'
                : 'SELECT * FROM files WHERE user_id = ? AND folder_id IS NULL AND (is_trashed = 0 OR is_trashed IS NULL) ORDER BY original_name ASC';
              const fileParams = folderId ? [userId, folderId] : [userId];
              const files = await allQuery(fileQuery, fileParams);

              const entries = [];
              const dotAttrs = buildDirAttrs(null);
              entries.push({ filename: '.', longname: formatLongname('.', dotAttrs), attrs: dotAttrs });
              entries.push({ filename: '..', longname: formatLongname('..', dotAttrs), attrs: dotAttrs });

              for (const f of subfolders) {
                const attrs = buildDirAttrs(f);
                entries.push({ filename: f.name, longname: formatLongname(f.name, attrs), attrs });
              }

              for (const f of files) {
                const attrs = buildFileAttrs(f);
                entries.push({ filename: f.original_name, longname: formatLongname(f.original_name, attrs), attrs });
              }

              const handle = allocHandle({ type: 'dir', entries, sent: false });
              sftp.handle(reqid, handle);
            } catch (err) {
              console.error('SFTP OPENDIR error:', err);
              sftp.status(reqid, STATUS_CODE.FAILURE);
            }
          });

          sftp.on('READDIR', (reqid, handleBuf) => {
            const h = getHandle(handleBuf);
            if (!h || h.type !== 'dir') return sftp.status(reqid, STATUS_CODE.FAILURE);
            if (h.sent) return sftp.status(reqid, STATUS_CODE.EOF);
            h.sent = true;
            sftp.name(reqid, h.entries);
          });

          sftp.on('OPEN', async (reqid, reqPath, flags, attrs) => {
            try {
              const normalized = '/' + reqPath.split('/').filter(Boolean).join('/');
              const isRead = (flags & OPEN_MODE.READ) !== 0;
              const isWrite = (flags & OPEN_MODE.WRITE) !== 0;
              const isCreate = (flags & OPEN_MODE.CREAT) !== 0;
              const isTrunc = (flags & OPEN_MODE.TRUNC) !== 0;

              if (isWrite || isCreate) {
                const resolved = await resolveParentAndName(userId, normalized);
                if (!resolved) return sftp.status(reqid, STATUS_CODE.NO_SUCH_FILE);
                const { parentFolderId, name } = resolved;

                const user = await getQuery('SELECT storage_quota, storage_used FROM users WHERE id = ?', [userId]);

                if (isTrunc) {
                  const existing = await resolveFileByPath(userId, normalized);
                  if (existing) {
                    await fsPromises.unlink(existing.path).catch(() => {});
                    await runQuery('DELETE FROM files WHERE id = ?', [existing.id]);
                    await runQuery('UPDATE users SET storage_used = storage_used - ? WHERE id = ?', [existing.size, userId]);
                  }
                }

                const userDir = path.join(UPLOAD_PATH, userId.toString());
                await fsPromises.mkdir(userDir, { recursive: true });
                const uniqueName = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${path.extname(name)}`;
                const diskPath = path.join(userDir, uniqueName);
                const fd = fs.openSync(diskPath, 'w');

                const handle = allocHandle({
                  type: 'file',
                  fd,
                  filePath: diskPath,
                  fileRow: null,
                  flags,
                  isUpload: true,
                  uploadDiskName: uniqueName,
                  uploadOriginalName: name,
                  uploadFolderId: parentFolderId,
                  userQuota: user.storage_quota,
                  userUsed: user.storage_used
                });
                return sftp.handle(reqid, handle);
              }

              if (isRead) {
                const file = await resolveFileByPath(userId, normalized);
                if (!file) return sftp.status(reqid, STATUS_CODE.NO_SUCH_FILE);

                let fd;
                try {
                  fd = fs.openSync(file.path, 'r');
                } catch (e) {
                  return sftp.status(reqid, STATUS_CODE.NO_SUCH_FILE);
                }

                const handle = allocHandle({
                  type: 'file',
                  fd,
                  filePath: file.path,
                  fileRow: file,
                  flags,
                  isUpload: false
                });
                return sftp.handle(reqid, handle);
              }

              sftp.status(reqid, STATUS_CODE.OP_UNSUPPORTED);
            } catch (err) {
              console.error('SFTP OPEN error:', err);
              sftp.status(reqid, STATUS_CODE.FAILURE);
            }
          });

          sftp.on('READ', (reqid, handleBuf, offset, length) => {
            const h = getHandle(handleBuf);
            if (!h || h.type !== 'file') return sftp.status(reqid, STATUS_CODE.FAILURE);
            const buf = Buffer.alloc(length);
            let bytesRead;
            try {
              bytesRead = fs.readSync(h.fd, buf, 0, length, offset);
            } catch (e) {
              return sftp.status(reqid, STATUS_CODE.FAILURE);
            }
            if (bytesRead === 0) return sftp.status(reqid, STATUS_CODE.EOF);
            sftp.data(reqid, buf.slice(0, bytesRead));
          });

          sftp.on('WRITE', (reqid, handleBuf, offset, data) => {
            const h = getHandle(handleBuf);
            if (!h || h.type !== 'file' || !h.isUpload) return sftp.status(reqid, STATUS_CODE.FAILURE);
            try {
              fs.writeSync(h.fd, data, 0, data.length, offset);
              sftp.status(reqid, STATUS_CODE.OK);
            } catch (e) {
              sftp.status(reqid, STATUS_CODE.FAILURE);
            }
          });

          sftp.on('CLOSE', async (reqid, handleBuf) => {
            const h = closeHandle(handleBuf);
            if (!h) return sftp.status(reqid, STATUS_CODE.FAILURE);

            if (h.type === 'dir') {
              return sftp.status(reqid, STATUS_CODE.OK);
            }

            try {
              fs.closeSync(h.fd);
            } catch (e) { /* ignore */ }

            if (h.isUpload) {
              try {
                let fileSize;
                try {
                  const stat = fs.statSync(h.filePath);
                  fileSize = stat.size;
                } catch (e) {
                  return sftp.status(reqid, STATUS_CODE.FAILURE);
                }

                const user = await getQuery('SELECT storage_quota, storage_used FROM users WHERE id = ?', [userId]);
                if (user.storage_used + fileSize > user.storage_quota) {
                  await fsPromises.unlink(h.filePath).catch(() => {});
                  return sftp.status(reqid, STATUS_CODE.FAILURE);
                }

                const finalName = await deduplicateName(userId, h.uploadOriginalName, h.uploadFolderId);
                const mimeType = mime.lookup(finalName) || 'application/octet-stream';

                await runQuery(
                  'INSERT INTO files (name, original_name, path, size, mime_type, folder_id, user_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
                  [h.uploadDiskName, finalName, h.filePath, fileSize, mimeType, h.uploadFolderId, userId]
                );

                await runQuery(
                  'UPDATE users SET storage_used = storage_used + ? WHERE id = ?',
                  [fileSize, userId]
                );

                sftp.status(reqid, STATUS_CODE.OK);
              } catch (err) {
                console.error('SFTP CLOSE upload error:', err);
                await fsPromises.unlink(h.filePath).catch(() => {});
                sftp.status(reqid, STATUS_CODE.FAILURE);
              }
            } else {
              sftp.status(reqid, STATUS_CODE.OK);
            }
          });

          sftp.on('MKDIR', async (reqid, reqPath) => {
            try {
              const normalized = '/' + reqPath.split('/').filter(Boolean).join('/');
              const parts = normalized.split('/').filter(Boolean);
              if (parts.length === 0) return sftp.status(reqid, STATUS_CODE.FAILURE);

              const name = parts[parts.length - 1];
              let parentFolderId = null;

              if (parts.length > 1) {
                const parentPath = '/' + parts.slice(0, -1).join('/');
                const parentFolder = await getQuery(
                  'SELECT id FROM folders WHERE user_id = ? AND path = ?',
                  [userId, parentPath]
                );
                if (!parentFolder) return sftp.status(reqid, STATUS_CODE.NO_SUCH_FILE);
                parentFolderId = parentFolder.id;
              }

              const existing = await getQuery(
                'SELECT id FROM folders WHERE user_id = ? AND path = ?',
                [userId, normalized]
              );
              if (existing) return sftp.status(reqid, STATUS_CODE.FAILURE);

              await runQuery(
                'INSERT INTO folders (name, parent_id, user_id, path) VALUES (?, ?, ?, ?)',
                [name, parentFolderId, userId, normalized]
              );

              sftp.status(reqid, STATUS_CODE.OK);
            } catch (err) {
              console.error('SFTP MKDIR error:', err);
              sftp.status(reqid, STATUS_CODE.FAILURE);
            }
          });

          sftp.on('REMOVE', async (reqid, reqPath) => {
            try {
              const normalized = '/' + reqPath.split('/').filter(Boolean).join('/');
              const file = await resolveFileByPath(userId, normalized);
              if (!file) return sftp.status(reqid, STATUS_CODE.NO_SUCH_FILE);

              await fsPromises.unlink(file.path).catch(() => {});
              await runQuery('DELETE FROM files WHERE id = ?', [file.id]);
              await runQuery('UPDATE users SET storage_used = storage_used - ? WHERE id = ?', [file.size, userId]);

              sftp.status(reqid, STATUS_CODE.OK);
            } catch (err) {
              console.error('SFTP REMOVE error:', err);
              sftp.status(reqid, STATUS_CODE.FAILURE);
            }
          });

          sftp.on('RMDIR', async (reqid, reqPath) => {
            try {
              const normalized = '/' + reqPath.split('/').filter(Boolean).join('/');
              const folder = await resolveFolderByPath(userId, normalized);
              if (!folder) return sftp.status(reqid, STATUS_CODE.NO_SUCH_FILE);

              const childFolders = await getQuery(
                'SELECT COUNT(*) as count FROM folders WHERE user_id = ? AND parent_id = ?',
                [userId, folder.id]
              );
              const childFiles = await getQuery(
                'SELECT COUNT(*) as count FROM files WHERE user_id = ? AND folder_id = ? AND (is_trashed = 0 OR is_trashed IS NULL)',
                [userId, folder.id]
              );

              if ((childFolders && childFolders.count > 0) || (childFiles && childFiles.count > 0)) {
                return sftp.status(reqid, STATUS_CODE.FAILURE);
              }

              await runQuery('DELETE FROM folders WHERE id = ?', [folder.id]);
              sftp.status(reqid, STATUS_CODE.OK);
            } catch (err) {
              console.error('SFTP RMDIR error:', err);
              sftp.status(reqid, STATUS_CODE.FAILURE);
            }
          });

          sftp.on('RENAME', async (reqid, oldPath, newPath) => {
            try {
              const oldNorm = '/' + oldPath.split('/').filter(Boolean).join('/');
              const newNorm = '/' + newPath.split('/').filter(Boolean).join('/');

              const folder = await resolveFolderByPath(userId, oldNorm);
              if (folder) {
                const newParts = newNorm.split('/').filter(Boolean);
                const newName = newParts[newParts.length - 1];
                let newParentFolderId = null;

                if (newParts.length > 1) {
                  const newParentPath = '/' + newParts.slice(0, -1).join('/');
                  const newParent = await getQuery(
                    'SELECT id FROM folders WHERE user_id = ? AND path = ?',
                    [userId, newParentPath]
                  );
                  if (!newParent) return sftp.status(reqid, STATUS_CODE.NO_SUCH_FILE);
                  newParentFolderId = newParent.id;
                }

                await runQuery(
                  'UPDATE folders SET name = ?, parent_id = ?, path = ? WHERE id = ?',
                  [newName, newParentFolderId, newNorm, folder.id]
                );

                await runQuery(
                  'UPDATE folders SET path = REPLACE(path, ?, ?) WHERE path LIKE ? AND user_id = ?',
                  [oldNorm, newNorm, oldNorm + '/%', userId]
                );

                return sftp.status(reqid, STATUS_CODE.OK);
              }

              const file = await resolveFileByPath(userId, oldNorm);
              if (file) {
                const newResolved = await resolveParentAndName(userId, newNorm);
                if (!newResolved) return sftp.status(reqid, STATUS_CODE.NO_SUCH_FILE);

                const mimeType = mime.lookup(newResolved.name) || 'application/octet-stream';
                await runQuery(
                  'UPDATE files SET original_name = ?, folder_id = ?, mime_type = ? WHERE id = ?',
                  [newResolved.name, newResolved.parentFolderId, mimeType, file.id]
                );

                return sftp.status(reqid, STATUS_CODE.OK);
              }

              sftp.status(reqid, STATUS_CODE.NO_SUCH_FILE);
            } catch (err) {
              console.error('SFTP RENAME error:', err);
              sftp.status(reqid, STATUS_CODE.FAILURE);
            }
          });

          sftp.on('SETSTAT', (reqid) => sftp.status(reqid, STATUS_CODE.OK));
          sftp.on('FSETSTAT', (reqid) => sftp.status(reqid, STATUS_CODE.OK));
        });
      });
    });

    client.on('error', (err) => {
      if (err.message !== 'read ECONNRESET') {
        console.error('SFTP client error:', err.message);
      }
    });

    client.on('end', () => {
      if (authenticatedUser) {
        console.log(`SFTP: User "${authenticatedUser.username}" disconnected`);
      }
    });
  });

  server.listen(SFTP_PORT, '0.0.0.0', () => {
    console.log(`SFTP server listening on port ${SFTP_PORT}`);
  });

  server.on('error', (err) => {
    if (err.code === 'EACCES') {
      console.error(`SFTP: Cannot bind to port ${SFTP_PORT} (permission denied). Try a port > 1024 or set SFTP_PORT in .env`);
    } else if (err.code === 'EADDRINUSE') {
      console.error(`SFTP: Port ${SFTP_PORT} is already in use. Set a different SFTP_PORT in .env`);
    } else {
      console.error('SFTP server error:', err);
    }
  });
}

module.exports = { startSFTPServer };
