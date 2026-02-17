import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useThemeStore } from '../store/themeStore'
import { Cloud, LogOut, Settings, Home, Languages, Palette } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export default function Header() {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const { t, i18n } = useTranslation()
  const { theme, themeName, cycleTheme } = useThemeStore()

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
    <header className={`${theme.card} border-b ${theme.border} shadow-sm`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center gap-3">
            <Cloud className="w-8 h-8 text-primary-600" />
            <h1 className={`text-2xl font-bold ${theme.text}`}>{t('common.myCloud')}</h1>
          </div>

          <nav className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className={`flex items-center gap-2 px-4 py-2 ${theme.text} hover:text-primary-600 transition-colors`}
            >
              <Home className="w-5 h-5" />
              <span className="hidden sm:inline">{t('nav.myFiles')}</span>
            </button>

            {user?.isAdmin && (
              <button
                onClick={() => navigate('/admin')}
                className={`flex items-center gap-2 px-4 py-2 ${theme.text} hover:text-primary-600 transition-colors`}
              >
                <Settings className="w-5 h-5" />
                <span className="hidden sm:inline">{t('nav.admin')}</span>
              </button>
            )}

            <button
              onClick={cycleTheme}
              className={`flex items-center gap-2 px-3 py-2 ${theme.text} hover:text-primary-600 transition-colors rounded-lg ${theme.hover}`}
              title={`Current: ${themeName}`}
            >
              <Palette className="w-5 h-5" />
              <span className="text-sm font-medium hidden sm:inline">{themeName}</span>
            </button>

            <button
              onClick={toggleLanguage}
              className={`flex items-center gap-2 px-3 py-2 ${theme.text} hover:text-primary-600 transition-colors rounded-lg ${theme.hover}`}
              title={i18n.language === 'de' ? 'Switch to English' : 'Zu Deutsch wechseln'}
            >
              <Languages className="w-5 h-5" />
              <span className="text-sm font-medium">{i18n.language.toUpperCase()}</span>
            </button>

            <div className={`h-8 w-px ${theme.border}`} />

            <div className="flex items-center gap-3">
              <div className="hidden sm:block text-right">
                <div className={`text-sm font-medium ${theme.text}`}>{user?.username}</div>
                <div className={`text-xs ${theme.textSecondary}`}>{user?.email}</div>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors">
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
