import React, { useEffect, useState } from 'react'
import { X, Download, ChevronLeft, ChevronRight } from 'lucide-react'

const BASE_PATH = import.meta.env.BASE_URL.endsWith('/') 
  ? import.meta.env.BASE_URL.slice(0, -1) 
  : import.meta.env.BASE_URL

export default function MediaViewer({ file, onClose, onNext, onPrevious, hasNext, hasPrevious }) {
  const [mediaUrl, setMediaUrl] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!file) return

    const loadMedia = async () => {
      setLoading(true)
      try {
        const token = localStorage.getItem('token')
        const response = await fetch(`${BASE_PATH}/api/files/${file.id}/view`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
        
        if (!response.ok) {
          throw new Error('Failed to load media')
        }
        
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        setMediaUrl(url)
      } catch (error) {
        console.error('Error loading media:', error)
        alert('Fehler beim Laden der Mediendatei')
      } finally {
        setLoading(false)
      }
    }

    loadMedia()

    return () => {
      if (mediaUrl) {
        window.URL.revokeObjectURL(mediaUrl)
      }
    }
  }, [file])

  if (!file) return null

  const isImage = file.mime_type?.startsWith('image/')
  const isVideo = file.mime_type?.startsWith('video/')

  const handleDownload = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${BASE_PATH}/api/files/${file.id}/download`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (!response.ok) throw new Error('Download failed')
      
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = file.original_name
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      alert('Fehler beim Herunterladen')
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') onClose()
    if (e.key === 'ArrowLeft' && hasPrevious) onPrevious()
    if (e.key === 'ArrowRight' && hasNext) onNext()
  }

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [hasNext, hasPrevious])

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-95 flex items-center justify-center">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/80 to-transparent p-4 z-10">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex-1 min-w-0">
            <h2 className="text-white text-lg font-semibold truncate">{file.original_name}</h2>
            <p className="text-gray-300 text-sm">
              {(file.size / 1024 / 1024).toFixed(2)} MB • {file.mime_type}
            </p>
          </div>
          <div className="flex items-center gap-2 ml-4">
            <button
              onClick={handleDownload}
              className="p-2 text-white hover:bg-white/20 rounded-lg transition-colors"
              title="Herunterladen"
            >
              <Download className="w-5 h-5" />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-white hover:bg-white/20 rounded-lg transition-colors"
              title="Schließen (ESC)"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Buttons */}
      {hasPrevious && (
        <button
          onClick={onPrevious}
          className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-black/50 hover:bg-black/70 text-white rounded-full transition-colors z-10"
          title="Vorheriges (←)"
        >
          <ChevronLeft className="w-8 h-8" />
        </button>
      )}

      {hasNext && (
        <button
          onClick={onNext}
          className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-black/50 hover:bg-black/70 text-white rounded-full transition-colors z-10"
          title="Nächstes (→)"
        >
          <ChevronRight className="w-8 h-8" />
        </button>
      )}

      {/* Media Content */}
      <div className="w-full h-full flex items-center justify-center p-20" onClick={onClose}>
        {loading ? (
          <div className="text-white text-lg">Lädt...</div>
        ) : (
          <div onClick={(e) => e.stopPropagation()} className="max-w-full max-h-full">
            {isImage && mediaUrl && (
              <img
                src={mediaUrl}
                alt={file.original_name}
                className="max-w-full max-h-full object-contain"
              />
            )}
            {isVideo && mediaUrl && (
              <video
                src={mediaUrl}
                controls
                autoPlay
                className="max-w-full max-h-full"
                style={{ maxHeight: '80vh' }}
              >
                Ihr Browser unterstützt keine Videowiedergabe.
              </video>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
