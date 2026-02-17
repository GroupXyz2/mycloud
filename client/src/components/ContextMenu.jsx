import { useEffect, useRef } from 'react'
import { useThemeStore } from '../store/themeStore'

export default function ContextMenu({ position, items, onClose }) {
  const menuRef = useRef(null)
  const { theme } = useThemeStore()

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose()
      }
    }

    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [onClose])

  if (!position) return null

  return (
    <div
      ref={menuRef}
      className={`fixed z-50 ${theme.card} rounded-lg shadow-lg border ${theme.border} py-1 min-w-[180px]`}
      style={{
        top: `${position.y}px`,
        left: `${position.x}px`,
      }}
    >
      {items.map((item, index) => (
        item.divider ? (
          <div key={index} className={`border-t ${theme.border} my-1`} />
        ) : (
          <button
            key={index}
            onClick={() => {
              item.onClick()
              onClose()
            }}
            disabled={item.disabled}
            className={`w-full px-4 py-2 text-left flex items-center gap-2 ${theme.hover} transition-colors ${
              item.danger ? 'text-red-600 hover:bg-red-50' : theme.text
            } ${item.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {item.icon && <item.icon className="w-4 h-4" />}
            <span className="text-sm">{item.label}</span>
            {item.shortcut && (
              <span className="ml-auto text-xs text-gray-400">{item.shortcut}</span>
            )}
          </button>
        )
      ))}
    </div>
  )
}
