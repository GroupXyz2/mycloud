import { useState } from 'react'
import { 
  File, Folder, Download, Trash2, Share2, FolderPlus, 
  RefreshCw, ChevronLeft, MoreVertical, Link as LinkIcon, Eye, Image as ImageIcon, Video 
} from 'lucide-react'
import { fileAPI } from '../api'
import MediaViewer from './MediaViewer'

const BASE_PATH = import.meta.env.BASE_URL.endsWith('/') 
  ? import.meta.env.BASE_URL.slice(0, -1) 
  : import.meta.env.BASE_URL

export default function FileExplorer({
  files,
  folders,
  currentFolder,
  loading,
  onFolderClick,
  onFolderCreate,
  onFolderDelete,
  onFileDelete,
  onRefresh,
}) {
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [shareUrl, setShareUrl] = useState(null)
  const [viewingMedia, setViewingMedia] = useState(null)
  const [mediaFiles, setMediaFiles] = useState([])

  const handleCreateFolder = (e) => {
    e.preventDefault()
    if (newFolderName.trim()) {
      onFolderCreate(newFolderName)
      setNewFolderName('')
      setShowNewFolder(false)
    }
  }

  const handleShare = async (fileId) => {
    try {
      const response = await fileAPI.share(fileId, {})
      // shareUrl kommt vom Backend als /api/files/public/token
      // Wir müssen den BASE_PATH hinzufügen
      const backendUrl = response.data.shareUrl
      const fullUrl = `${window.location.origin}${BASE_PATH}${backendUrl}`
      setShareUrl(fullUrl)
      navigator.clipboard.writeText(fullUrl)
      setTimeout(() => setShareUrl(null), 3000)
    } catch (error) {
      alert('Fehler beim Teilen der Datei')
    }
  }

  const handleDownload = async (fileId, fileName) => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${BASE_PATH}/api/files/${fileId}/download`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (!response.ok) {
        throw new Error('Download failed')
      }
      
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Download error:', error)
      alert('Fehler beim Herunterladen der Datei')
    }
  }

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('de-DE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getFileIcon = (mimeType) => {
    if (!mimeType) return File
    if (mimeType.startsWith('image/')) return ImageIcon
    if (mimeType.startsWith('video/')) return Video
    if (mimeType.startsWith('audio/')) return File
    if (mimeType.includes('pdf')) return File
    return File
  }

  const isMediaFile = (mimeType) => {
    return mimeType?.startsWith('image/') || mimeType?.startsWith('video/')
  }

  const handleViewMedia = (file) => {
    const mediaFilesList = files.filter(f => isMediaFile(f.mime_type))
    setMediaFiles(mediaFilesList)
    setViewingMedia(file)
  }

  const handleNextMedia = () => {
    const currentIndex = mediaFiles.findIndex(f => f.id === viewingMedia.id)
    if (currentIndex < mediaFiles.length - 1) {
      setViewingMedia(mediaFiles[currentIndex + 1])
    }
  }

  const handlePreviousMedia = () => {
    const currentIndex = mediaFiles.findIndex(f => f.id === viewingMedia.id)
    if (currentIndex > 0) {
      setViewingMedia(mediaFiles[currentIndex - 1])
    }
  }

  return (
    <div className="card">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-2">
          {currentFolder && (
            <button
              onClick={() => onFolderClick(null)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Zurück"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          <h2 className="text-xl font-semibold text-gray-900">
            {currentFolder ? 'Ordner' : 'Alle Dateien'}
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onRefresh}
            className="btn btn-secondary flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Aktualisieren
          </button>
          <button
            onClick={() => setShowNewFolder(true)}
            className="btn btn-primary flex items-center gap-2"
          >
            <FolderPlus className="w-4 h-4" />
            Neuer Ordner
          </button>
        </div>
      </div>

      {showNewFolder && (
        <form onSubmit={handleCreateFolder} className="mb-4 flex gap-2">
          <input
            type="text"
            className="input flex-1"
            placeholder="Ordnername..."
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            autoFocus
          />
          <button type="submit" className="btn btn-primary">
            Erstellen
          </button>
          <button
            type="button"
            onClick={() => {
              setShowNewFolder(false)
              setNewFolderName('')
            }}
            className="btn btn-secondary"
          >
            Abbrechen
          </button>
        </form>
      )}

      {shareUrl && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
          <LinkIcon className="w-5 h-5 text-green-600" />
          <span className="text-sm text-green-800">Link wurde in die Zwischenablage kopiert!</span>
        </div>
      )}

      {viewingMedia && (
        <MediaViewer
          file={viewingMedia}
          onClose={() => setViewingMedia(null)}
          onNext={handleNextMedia}
          onPrevious={handlePreviousMedia}
          hasNext={mediaFiles.findIndex(f => f.id === viewingMedia.id) < mediaFiles.length - 1}
          hasPrevious={mediaFiles.findIndex(f => f.id === viewingMedia.id) > 0}
        />
      )}

      {loading ? (
        <div className="text-center py-12">
          <RefreshCw className="w-8 h-8 text-gray-400 animate-spin mx-auto mb-3" />
          <p className="text-gray-500">Laden...</p>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Folders */}
          {folders.map((folder) => (
            <div
              key={`folder-${folder.id}`}
              className="flex items-center gap-4 p-4 hover:bg-gray-50 rounded-lg border border-gray-200 transition-colors group"
            >
              <Folder className="w-10 h-10 text-primary-500 flex-shrink-0" />
              <div
                className="flex-1 cursor-pointer"
                onClick={() => onFolderClick(folder.id)}
              >
                <h3 className="font-medium text-gray-900">{folder.name}</h3>
                <p className="text-sm text-gray-500">{formatDate(folder.created_at)}</p>
              </div>
              <button
                onClick={() => onFolderDelete(folder.id)}
                className="p-2 text-red-600 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                title="Löschen"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          ))}

          {/* Files */}
          {files.map((file) => {
            const FileIcon = getFileIcon(file.mime_type)
            return (
              <div
                key={`file-${file.id}`}
                className="flex items-center gap-4 p-4 hover:bg-gray-50 rounded-lg border border-gray-200 transition-colors group"
              >
                <FileIcon className="w-10 h-10 text-gray-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-gray-900 truncate">{file.original_name}</h3>
                  <p className="text-sm text-gray-500">
                    {formatBytes(file.size)} • {formatDate(file.created_at)}
                  </p>
                </div>
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  {isMediaFile(file.mime_type) && (
                    <button
                      onClick={() => handleViewMedia(file)}
                      className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
                      title="Ansehen"
                    >
                      <Eye className="w-5 h-5" />
                    </button>
                  )}
                  <button
                    onClick={() => handleDownload(file.id, file.original_name)}
                    className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg"
                    title="Herunterladen"
                  >
                    <Download className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleShare(file.id)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                    title="Teilen"
                  >
                    <Share2 className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => onFileDelete(file.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                    title="Löschen"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )
          })}

          {folders.length === 0 && files.length === 0 && (
            <div className="text-center py-12">
              <Folder className="w-16 h-16 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">Keine Dateien oder Ordner vorhanden</p>
              <p className="text-sm text-gray-400 mt-1">
                Laden Sie Dateien hoch oder erstellen Sie einen neuen Ordner
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
