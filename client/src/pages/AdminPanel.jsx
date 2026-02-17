import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { userAPI } from '../api'
import Header from '../components/Header'
import { UserPlus, Trash2, Edit, HardDrive, Server } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useThemeStore } from '../store/themeStore'

export default function AdminPanel() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { theme } = useThemeStore()
  const [users, setUsers] = useState([])
  const [diskSpace, setDiskSpace] = useState(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [newUser, setNewUser] = useState({
    username: '',
    email: '',
    password: '',
    storageQuota: 10737418240 // 10GB
  })

  useEffect(() => {
    loadUsers()
    loadDiskSpace()
  }, [])

  const loadUsers = async () => {
    try {
      const response = await userAPI.getAll()
      setUsers(response.data)
    } catch (error) {
      console.error('Error loading users:', error)
    }
  }

  const loadDiskSpace = async () => {
    try {
      const response = await userAPI.getDiskSpace()
      setDiskSpace(response.data)
    } catch (error) {
      console.error('Error loading disk space:', error)
    }
  }

  const handleCreateUser = async (e) => {
    e.preventDefault()
    try {
      await userAPI.create(newUser)
      setNewUser({ username: '', email: '', password: '', storageQuota: 10737418240 })
      setShowCreateForm(false)
      loadUsers()
    } catch (error) {
      alert(error.response?.data?.error || t('admin.createError'))
    }
  }

  const handleDeleteUser = async (id) => {
    if (!confirm(t('admin.deleteConfirm'))) return

    try {
      await userAPI.delete(id)
      loadUsers()
    } catch (error) {
      alert(error.response?.data?.error || t('admin.deleteError'))
    }
  }

  const handleEditUser = async (e) => {
    e.preventDefault()
    if (!editingUser) return

    try {
      await userAPI.update(editingUser.id, {
        storageQuota: editingUser.storageQuota
      })
      setEditingUser(null)
      loadUsers()
    } catch (error) {
      alert(error.response?.data?.error || t('admin.updateError'))
    }
  }

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  return (
    <div className={`min-h-screen ${theme.bg}`}>
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className={`text-3xl font-bold ${theme.text}`}>{t('admin.title')}</h1>
            <p className={`${theme.textSecondary} mt-1`}>{t('admin.subtitle')}</p>
          </div>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="btn btn-primary flex items-center gap-2"
          >
            <UserPlus className="w-5 h-5" />
            {t('admin.createUser')}
          </button>
        </div>

        {/* Disk Space Card */}
        {diskSpace && (
          <div className={`${theme.card} rounded-lg p-6 border ${theme.border} mb-6`}>
            <div className="flex items-center gap-3 mb-4">
              <Server className="w-6 h-6 text-primary-600" />
              <h2 className={`text-xl font-semibold ${theme.text}`}>{t('admin.systemDiskSpace')}</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">{t('admin.diskTotal')}</p>
                <p className="text-2xl font-bold text-blue-600">{formatBytes(diskSpace.total)}</p>
              </div>
              <div className="bg-orange-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">{t('admin.diskUsed')}</p>
                <p className="text-2xl font-bold text-orange-600">{formatBytes(diskSpace.used)}</p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">{t('admin.diskAvailable')}</p>
                <p className="text-2xl font-bold text-green-600">{formatBytes(diskSpace.available)}</p>
              </div>
            </div>
            <div className="mt-4">
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div 
                  className="bg-primary-600 h-3 rounded-full transition-all"
                  style={{ width: `${(diskSpace.used / diskSpace.total * 100).toFixed(1)}%` }}
                />
              </div>
              <p className="text-sm text-gray-600 mt-2 text-center">
                {((diskSpace.used / diskSpace.total) * 100).toFixed(1)}% {t('admin.diskUsed')}
              </p>
            </div>
          </div>
        )}

        {/* Edit User Modal */}
        {editingUser && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className={`${theme.card} rounded-lg p-6 max-w-md w-full mx-4 border ${theme.border}`}>
              <h2 className={`text-xl font-semibold ${theme.text} mb-4`}>{t('admin.editStorageQuota')}</h2>
              <form onSubmit={handleEditUser} className="space-y-4">
                <div>
                  <label className={`block text-sm font-medium ${theme.text} mb-2`}>
                    {t('admin.username')}
                  </label>
                  <input
                    type="text"
                    className={`w-full px-4 py-2 ${theme.card} border ${theme.border} rounded-lg ${theme.text} opacity-50`}
                    value={editingUser.username}
                    disabled
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium ${theme.text} mb-2`}>
                    {t('admin.newStorageQuota')}
                  </label>
                  <input
                    type="number"
                    className={`w-full px-4 py-2 ${theme.card} border ${theme.border} rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${theme.text}`}
                    value={editingUser.storageQuota / 1073741824}
                    onChange={(e) => setEditingUser({
                      ...editingUser,
                      storageQuota: e.target.value * 1073741824
                    })}
                    min="1"
                    required
                  />
                  <p className={`text-sm ${theme.textSecondary} mt-1`}>
                    {t('admin.diskUsed')}: {formatBytes(editingUser.storage_used)}
                  </p>
                </div>
                <div className="flex gap-3">
                  <button type="submit" className="btn btn-primary flex-1">
                    {t('common.save')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingUser(null)}
                    className="btn btn-secondary flex-1"
                  >
                    {t('common.cancel')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {showCreateForm && (
          <div className={`${theme.card} rounded-lg p-6 border ${theme.border} mb-6`}>
            <h2 className={`text-xl font-semibold ${theme.text} mb-4`}>{t('admin.newUser')}</h2>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium ${theme.text} mb-2`}>
                    {t('admin.username')}
                  </label>
                  <input
                    type="text"
                    className={`w-full px-4 py-2 ${theme.card} border ${theme.border} rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${theme.text}`}
                    value={newUser.username}
                    onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium ${theme.text} mb-2`}>
                    {t('admin.email')}
                  </label>
                  <input
                    type="email"
                    className={`w-full px-4 py-2 ${theme.card} border ${theme.border} rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${theme.text}`}
                    value={newUser.email}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium ${theme.text} mb-2`}>
                    {t('admin.password')}
                  </label>
                  <input
                    type="password"
                    className={`w-full px-4 py-2 ${theme.card} border ${theme.border} rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${theme.text}`}
                    value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium ${theme.text} mb-2`}>
                    {t('admin.storageQuota')}
                  </label>
                  <input
                    type="number"
                    className={`w-full px-4 py-2 ${theme.card} border ${theme.border} rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${theme.text}`}
                    value={newUser.storageQuota / 1073741824}
                    onChange={(e) => setNewUser({ ...newUser, storageQuota: e.target.value * 1073741824 })}
                    min="1"
                    required
                  />
                </div>
              </div>
              <div className="flex gap-3">
                <button type="submit" className="btn btn-primary">
                  {t('admin.createUser')}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="btn btn-secondary"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </form>
          </div>
        )}

        <div className={`${theme.card} rounded-lg p-6 border ${theme.border}`}>
          <h2 className={`text-xl font-semibold ${theme.text} mb-4`}>{t('admin.users')} ({users.length})</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className={`border-b ${theme.border}`}>
                  <th className={`text-left py-3 px-4 font-semibold ${theme.text}`}>{t('admin.username')}</th>
                  <th className={`text-left py-3 px-4 font-semibold ${theme.text}`}>{t('admin.email')}</th>
                  <th className={`text-left py-3 px-4 font-semibold ${theme.text}`}>{t('admin.role') || 'Role'}</th>
                  <th className={`text-left py-3 px-4 font-semibold ${theme.text}`}>{t('admin.storage')}</th>
                  <th className={`text-left py-3 px-4 font-semibold ${theme.text}`}>{t('admin.created') || 'Created'}</th>
                  <th className={`text-right py-3 px-4 font-semibold ${theme.text}`}>{t('fileExplorer.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className={`border-b ${theme.border} ${theme.hover}`}>
                    <td className={`py-3 px-4 font-medium ${theme.text}`}>{user.username}</td>
                    <td className={`py-3 px-4 ${theme.textSecondary}`}>{user.email}</td>
                    <td className="py-3 px-4">
                      {user.is_admin ? (
                        <span className="px-2 py-1 bg-primary-100 text-primary-700 rounded-full text-xs font-medium">
                          {t('admin.isAdmin')}
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">
                          {t('admin.user') || 'User'}
                        </span>
                      )}
                    </td>
                    <td className={`py-3 px-4 ${theme.textSecondary}`}>
                      <div className="flex items-center gap-2">
                        <HardDrive className="w-4 h-4" />
                        {formatBytes(user.storage_used)} / {formatBytes(user.storage_quota)}
                      </div>
                    </td>
                    <td className={`py-3 px-4 ${theme.textSecondary}`}>
                      {new Date(user.created_at).toLocaleDateString('de-DE')}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setEditingUser({
                            id: user.id,
                            username: user.username,
                            storageQuota: user.storage_quota,
                            storage_used: user.storage_used
                          })}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title={t('common.edit')}
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        {!user.is_admin && (
                          <button
                            onClick={() => handleDeleteUser(user.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title={t('common.delete')}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  )
}
