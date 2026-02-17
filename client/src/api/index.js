import axios from 'axios'

const BASE_PATH = import.meta.env.BASE_URL.endsWith('/') 
  ? import.meta.env.BASE_URL.slice(0, -1) 
  : import.meta.env.BASE_URL

const api = axios.create({
  baseURL: `${BASE_PATH}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 || error.response?.status === 403) {
      localStorage.removeItem('token')
      window.location.href = `${BASE_PATH}/login`
    }
    return Promise.reject(error)
  }
)

export const authAPI = {
  login: (credentials) => api.post('/auth/login', credentials),
  verify: () => api.get('/auth/verify'),
}

export const userAPI = {
  getAll: () => api.get('/users'),
  create: (data) => api.post('/users', data),
  update: (id, data) => api.put(`/users/${id}`, data),
  delete: (id) => api.delete(`/users/${id}`),
  getStorageStats: () => api.get('/users/me/storage'),
  getDiskSpace: () => api.get('/users/system/disk-space'),
}

export const fileAPI = {
  getFiles: (folderId = null) => api.get('/files', { params: { folder_id: folderId } }),
  upload: (formData, onProgress) => api.post('/files/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: onProgress,
  }),
  download: (id) => `${BASE_PATH}/api/files/${id}/download`,
  delete: (id) => api.delete(`/files/${id}`),
  share: (id, data) => api.post(`/files/${id}/share`, data),
  getShared: () => api.get('/files/shared/with-me'),
  move: (id, folderId) => api.put(`/files/${id}/move`, { folder_id: folderId }),
  copy: (id, folderId) => api.post(`/files/${id}/copy`, { folder_id: folderId }),
  rename: (id, name) => api.put(`/files/${id}/rename`, { name }),
  unzip: (id, folderId) => api.post(`/files/${id}/unzip`, { folder_id: folderId }),
  search: (query) => api.get('/files/search', { params: { q: query } }),
  toggleFavorite: (id, isFavorite) => api.put(`/files/${id}/favorite`, { is_favorite: isFavorite }),
  getFavorites: () => api.get('/files/favorites'),
  moveToTrash: (id) => api.put(`/files/${id}/trash`),
  restoreFromTrash: (id) => api.put(`/files/${id}/restore`),
  getTrash: () => api.get('/files/trash'),
  emptyTrash: () => api.delete('/files/trash/empty'),
  bulkDelete: (fileIds) => api.post('/files/bulk/delete', { file_ids: fileIds }),
  bulkMove: (fileIds, folderId) => api.post('/files/bulk/move', { file_ids: fileIds, folder_id: folderId }),
  bulkDownload: (fileIds) => api.post('/files/bulk/download', { file_ids: fileIds }, { responseType: 'blob' }),
}

export const folderAPI = {
  getFolders: (parentId = null) => api.get('/folders', { params: { parent_id: parentId } }),
  getTree: () => api.get('/folders/tree'),
  create: (data) => api.post('/folders', data),
  update: (id, data) => api.put(`/folders/${id}`, data),
  delete: (id) => api.delete(`/folders/${id}`),
  move: (id, parentId) => api.put(`/folders/${id}/move`, { parent_id: parentId }),
}

export default api
