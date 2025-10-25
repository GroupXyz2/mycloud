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

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 || error.response?.status === 403) {
      localStorage.removeItem('token')
      window.location.href = '/login'
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
}

export const folderAPI = {
  getFolders: (parentId = null) => api.get('/folders', { params: { parent_id: parentId } }),
  getTree: () => api.get('/folders/tree'),
  create: (data) => api.post('/folders', data),
  update: (id, data) => api.put(`/folders/${id}`, data),
  delete: (id) => api.delete(`/folders/${id}`),
}

export default api
