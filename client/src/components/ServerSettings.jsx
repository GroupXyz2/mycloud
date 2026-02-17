import { useState, useEffect } from 'react'
import { Capacitor } from '@capacitor/core'
import { useTranslation } from 'react-i18next'
import { X, Server } from 'lucide-react'
import { useThemeStore } from '../store/themeStore'

export default function ServerSettings({ onClose }) {
  const { t } = useTranslation()
  const theme = useThemeStore((state) => state.theme)
  const [serverUrl, setServerUrl] = useState('')
  const [isMobile] = useState(Capacitor.isNativePlatform())

  useEffect(() => {
    const saved = localStorage.getItem('serverUrl')
    if (saved) {
      setServerUrl(saved)
    }
  }, [])

  const handleSave = () => {
    if (serverUrl) {
      localStorage.setItem('serverUrl', serverUrl.replace(/\/$/, ''))
      onClose()
      window.location.reload()
    }
  }

  if (!isMobile) {
    return null
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="w-full max-w-md rounded-lg" style={{ backgroundColor: theme.card }}>
        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: theme.border }}>
          <div className="flex items-center gap-2">
            <Server size={20} style={{ color: theme.text }} />
            <h2 className="text-lg font-semibold" style={{ color: theme.text }}>
              {t('settings.serverConfiguration')}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded transition-colors"
            style={{ color: theme.text }}
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: theme.text }}>
              {t('settings.serverUrl')}
            </label>
            <input
              type="text"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              placeholder="http://192.168.1.100:6868"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              style={{ 
                backgroundColor: theme.bg,
                borderColor: theme.border,
                color: theme.text
              }}
            />
            <p className="text-xs mt-1 opacity-70" style={{ color: theme.text }}>
              {t('settings.serverUrlHint')}
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleSave}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              {t('settings.save')}
            </button>
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded-lg border transition-colors font-medium"
              style={{ 
                borderColor: theme.border,
                color: theme.text,
                backgroundColor: theme.bg
              }}
            >
              {t('settings.cancel')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
