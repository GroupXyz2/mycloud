import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { Cloud, LogOut, Settings, Home, Languages } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export default function Header() {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const { t, i18n } = useTranslation()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const toggleLanguage = () => {
    const newLang = i18n.language === 'de' ? 'en' : 'de'
    i18n.changeLanguage(newLang)
    localStorage.setItem('language', newLang)
  }

  return (
    <header className="bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center gap-3">
            <Cloud className="w-8 h-8 text-primary-600" />
            <h1 className="text-2xl font-bold text-gray-900">{t('common.myCloud')}</h1>
          </div>

          <nav className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:text-primary-600 transition-colors"
            >
              <Home className="w-5 h-5" />
              <span className="hidden sm:inline">{t('nav.myFiles')}</span>
            </button>

            {user?.isAdmin && (
              <button
                onClick={() => navigate('/admin')}
                className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:text-primary-600 transition-colors"
              >
                <Settings className="w-5 h-5" />
                <span className="hidden sm:inline">{t('nav.admin')}</span>
              </button>
            )}

            <button
              onClick={toggleLanguage}
              className="flex items-center gap-2 px-3 py-2 text-gray-700 hover:text-primary-600 transition-colors rounded-lg hover:bg-gray-100"
              title={i18n.language === 'de' ? 'Switch to English' : 'Zu Deutsch wechseln'}
            >
              <Languages className="w-5 h-5" />
              <span className="text-sm font-medium">{i18n.language.toUpperCase()}</span>
            </button>

            <div className="h-8 w-px bg-gray-300" />

            <div className="flex items-center gap-3">
              <div className="hidden sm:block text-right">
                <div className="text-sm font-medium text-gray-900">{user?.username}</div>
                <div className="text-xs text-gray-500">{user?.email}</div>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <LogOut className="w-5 h-5" />
                <span className="hidden sm:inline">{t('nav.logout')}</span>
              </button>
            </div>
          </nav>
        </div>
      </div>
    </header>
  )
}
