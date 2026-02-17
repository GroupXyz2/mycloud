import { useTranslation } from 'react-i18next'
import { useThemeStore } from '../store/themeStore'

export default function StorageBar({ used, total }) {
  const { t } = useTranslation()
  const { theme } = useThemeStore()
  const percentage = Math.round((used / total) * 100)

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  return (
    <div className={`${theme.card} rounded-lg p-4 border ${theme.border}`}>
      <div className="flex justify-between items-center mb-2">
        <span className={`text-sm font-medium ${theme.text}`}>{t('admin.storage')}</span>
        <span className={`text-sm ${theme.textSecondary}`}>
          {t('storage.used', { used: formatBytes(used), total: formatBytes(total) })} ({percentage}%)
        </span>
      </div>
      <div className={`w-full ${theme.border} bg-opacity-30 rounded-full h-3 overflow-hidden`}>
        <div
          className={`h-3 rounded-full transition-all ${
            percentage > 90 ? 'bg-red-500' : percentage > 75 ? 'bg-yellow-500' : 'bg-primary-600'
          }`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
    </div>
  )
}
