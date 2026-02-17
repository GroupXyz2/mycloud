import { X, AlertCircle, CheckCircle, Info } from 'lucide-react'
import { useThemeStore } from '../store/themeStore'

export default function Popup({ 
  message, 
  type = 'info', // 'info', 'success', 'error', 'confirm'
  onClose,
  onConfirm,
  confirmText = 'Confirm',
  cancelText = 'Cancel'
}) {
  const { theme } = useThemeStore()

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-6 h-6 text-green-500" />
      case 'error':
        return <AlertCircle className="w-6 h-6 text-red-500" />
      case 'confirm':
        return <AlertCircle className="w-6 h-6 text-yellow-500" />
      default:
        return <Info className="w-6 h-6 text-blue-500" />
    }
  }

  const handleConfirm = () => {
    onClose() 
    if (onConfirm) {
      onConfirm() 
    }
  }

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div 
        className={`
          ${theme.card} ${theme.text}
          rounded-lg shadow-2xl max-w-md w-full p-6 relative border ${theme.border}
          transform transition-all duration-200 scale-100
        `}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className={`
            absolute top-4 right-4 p-1 rounded-lg transition-colors
            ${theme.hover} ${theme.textSecondary}
          `}
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-start gap-4">
          {getIcon()}
          <div className="flex-1 pt-0.5">
            <p className="text-base leading-relaxed">{message}</p>
          </div>
        </div>

        {type === 'confirm' ? (
          <div className="flex gap-3 mt-6">
            <button
              onClick={onClose}
              className={`
                flex-1 px-4 py-2 rounded-lg font-medium transition-colors
                ${theme.card === 'bg-white' 
                  ? 'bg-gray-200 hover:bg-gray-300 text-gray-900' 
                  : 'bg-gray-700 hover:bg-gray-600 text-white'}
              `}
            >
              {cancelText}
            </button>
            <button
              onClick={handleConfirm}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              {confirmText}
            </button>
          </div>
        ) : (
          <div className="flex justify-end mt-6">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              OK
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
