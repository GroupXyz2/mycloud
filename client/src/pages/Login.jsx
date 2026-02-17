import { useState, useEffect } from 'react'
import { useAuthStore } from '../store/authStore'
import { Cloud, Lock, User, Settings } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useThemeStore } from '../store/themeStore'
import { Capacitor } from '@capacitor/core'
import ServerSettings from '../components/ServerSettings'

export default function Login() {
  const [credentials, setCredentials] = useState({ username: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const login = useAuthStore((state) => state.login)
  const { t } = useTranslation()
  const { theme } = useThemeStore()
  const isMobile = Capacitor.isNativePlatform()

  useEffect(() => {
    if (isMobile && !localStorage.getItem('serverUrl')) {
      setShowSettings(true)
    }
  }, [isMobile])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await login(credentials)
    } catch (err) {
      setError(err.response?.data?.error || t('login.error'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={`min-h-screen flex items-center justify-center ${theme.bg} p-4`}>
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className={`inline-flex items-center justify-center w-20 h-20 ${theme.card} rounded-full shadow-lg mb-4`}>
            <Cloud className="w-12 h-12 text-primary-600" />
          </div>
          <h1 className={`text-4xl font-bold ${theme.text} mb-2`}>{t('common.myCloud')}</h1>
          <p className={theme.textSecondary}>{t('login.subtitle')}</p>
        </div>

        <div className={`${theme.card} rounded-2xl shadow-2xl p-8 border ${theme.border} relative`}>
          {isMobile && (
            <button
              onClick={() => setShowSettings(true)}
              className="absolute top-4 right-4 p-2 rounded-lg transition-colors"
              style={{ color: theme.text }}
              title="Server Settings"
            >
              <Settings size={20} />
            </button>
          )}
          
          <h2 className={`text-2xl font-bold ${theme.text} mb-6`}>{t('login.title')}</h2>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className={`block text-sm font-medium ${theme.text} mb-2`}>
                {t('login.username')}
              </label>
              <div className="relative">
                <User className={`absolute left-3 top-1/2 transform -translate-y-1/2 ${theme.textSecondary} w-5 h-5`} />
                <input
                  type="text"
                  className={`w-full px-4 py-3 pl-10 ${theme.card} border ${theme.border} rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${theme.text}`}
                  value={credentials.username}
                  onChange={(e) => setCredentials({ ...credentials, username: e.target.value })}
                  placeholder="admin"
                  required
                  autoFocus
                />
              </div>
            </div>

            <div>
              <label className={`block text-sm font-medium ${theme.text} mb-2`}>
                {t('login.password')}
              </label>
              <div className="relative">
                <Lock className={`absolute left-3 top-1/2 transform -translate-y-1/2 ${theme.textSecondary} w-5 h-5`} />
                <input
                  type="password"
                  className={`w-full px-4 py-3 pl-10 ${theme.card} border ${theme.border} rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${theme.text}`}
                  value={credentials.password}
                  onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full btn btn-primary py-3 text-lg"
              disabled={loading}
            >
              {loading ? t('login.loggingIn') : t('login.loginButton')}
            </button>
          </form>

          <div className={`mt-6 pt-6 border-t ${theme.border} text-center text-sm ${theme.textSecondary}`}>
            <p>{t('login.adminNote')}</p>
          </div>
        </div>

        <div className={`mt-6 text-center ${theme.textSecondary} text-sm`}>
          <p>{t('login.defaultAccess')}</p>
        </div>
      </div>

      {showSettings && <ServerSettings onClose={() => setShowSettings(false)} />}
    </div>
  )
}
