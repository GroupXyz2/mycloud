import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { userAPI } from '../api'
import Header from '../components/Header'
import { UserPlus, Trash2, Edit, HardDrive } from 'lucide-react'

export default function AdminPanel() {
  const navigate = useNavigate()
  const [users, setUsers] = useState([])
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newUser, setNewUser] = useState({
    username: '',
    email: '',
    password: '',
    storageQuota: 10737418240 // 10GB
  })

  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    try {
      const response = await userAPI.getAll()
      setUsers(response.data)
    } catch (error) {
      console.error('Error loading users:', error)
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
      alert(error.response?.data?.error || 'Fehler beim Erstellen des Benutzers')
    }
  }

  const handleDeleteUser = async (id) => {
    if (!confirm('Möchten Sie diesen Benutzer wirklich löschen?')) return

    try {
      await userAPI.delete(id)
      loadUsers()
    } catch (error) {
      alert(error.response?.data?.error || 'Fehler beim Löschen des Benutzers')
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
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Admin Panel</h1>
            <p className="text-gray-600 mt-1">Benutzerverwaltung</p>
          </div>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="btn btn-primary flex items-center gap-2"
          >
            <UserPlus className="w-5 h-5" />
            Benutzer erstellen
          </button>
        </div>

        {showCreateForm && (
          <div className="card mb-6">
            <h2 className="text-xl font-semibold mb-4">Neuen Benutzer erstellen</h2>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Benutzername
                  </label>
                  <input
                    type="text"
                    className="input"
                    value={newUser.username}
                    onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    E-Mail
                  </label>
                  <input
                    type="email"
                    className="input"
                    value={newUser.email}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Passwort
                  </label>
                  <input
                    type="password"
                    className="input"
                    value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Speicherplatz (GB)
                  </label>
                  <input
                    type="number"
                    className="input"
                    value={newUser.storageQuota / 1073741824}
                    onChange={(e) => setNewUser({ ...newUser, storageQuota: e.target.value * 1073741824 })}
                    min="1"
                    required
                  />
                </div>
              </div>
              <div className="flex gap-3">
                <button type="submit" className="btn btn-primary">
                  Benutzer erstellen
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="btn btn-secondary"
                >
                  Abbrechen
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="card">
          <h2 className="text-xl font-semibold mb-4">Benutzer ({users.length})</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Benutzername</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">E-Mail</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Rolle</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Speicher</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Erstellt</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700">Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 font-medium">{user.username}</td>
                    <td className="py-3 px-4 text-gray-600">{user.email}</td>
                    <td className="py-3 px-4">
                      {user.is_admin ? (
                        <span className="px-2 py-1 bg-primary-100 text-primary-700 rounded-full text-xs font-medium">
                          Admin
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">
                          Benutzer
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-gray-600">
                      <div className="flex items-center gap-2">
                        <HardDrive className="w-4 h-4" />
                        {formatBytes(user.storage_used)} / {formatBytes(user.storage_quota)}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-gray-600">
                      {new Date(user.created_at).toLocaleDateString('de-DE')}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex justify-end gap-2">
                        {!user.is_admin && (
                          <button
                            onClick={() => handleDeleteUser(user.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Löschen"
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
