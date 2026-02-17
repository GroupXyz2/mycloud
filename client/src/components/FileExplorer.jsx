import { useState } from 'react'
import { 
  File, Folder, Download, Trash2, Share2, FolderPlus, 
  RefreshCw, ChevronLeft, Link as LinkIcon, Eye, Image as ImageIcon, Video,
  Star, Copy, Edit3, Archive, CheckSquare, Square, Home
} from 'lucide-react'
import { fileAPI } from '../api'
import { useThemeStore } from '../store/themeStore'
import MediaViewer from './MediaViewer'
import ContextMenu from './ContextMenu'
import { useTranslation } from 'react-i18next'

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
  const { t } = useTranslation()
  const { theme } = useThemeStore()
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [shareUrl, setShareUrl] = useState(null)
  const [viewingMedia, setViewingMedia] = useState(null)
  const [mediaFiles, setMediaFiles] = useState([])
  const [contextMenu, setContextMenu] = useState(null)
  const [selectedFiles, setSelectedFiles] = useState(new Set())
  const [renameDialog, setRenameDialog] = useState(null)
  const [dragOver, setDragOver] = useState(null)

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
      const backendUrl = response.data.shareUrl
      const fullUrl = `${window.location.origin}${BASE_PATH}${backendUrl}`
      setShareUrl(fullUrl)
      navigator.clipboard.writeText(fullUrl)
      setTimeout(() => setShareUrl(null), 3000)
    } catch (error) {
      alert(t('fileExplorer.shareError'))
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
      alert(t('fileExplorer.downloadError'))
    }
  }

  const handleCopy = async (fileId) => {
    try {
      await fileAPI.copy(fileId, currentFolder)
      onRefresh()
      alert('File copied successfully')
    } catch (error) {
      alert('Failed to copy file')
    }
  }

  const handleRename = async (fileId, newName) => {
    try {
      await fileAPI.rename(fileId, newName)
      onRefresh()
      setRenameDialog(null)
    } catch (error) {
      alert('Failed to rename file')
    }
  }

  const handleUnzip = async (fileId) => {
    try {
      await fileAPI.unzip(fileId, currentFolder)
      onRefresh()
      alert('Files extracted successfully')
    } catch (error) {
      alert('Failed to extract archive')
    }
  }

  const handleToggleFavorite = async (fileId, isFavorite) => {
    try {
      await fileAPI.toggleFavorite(fileId, !isFavorite)
      onRefresh()
    } catch (error) {
      alert('Failed to update favorite')
    }
  }

  const handleMoveToTrash = async (fileId) => {
    try {
      await fileAPI.moveToTrash(fileId)
      onRefresh()
    } catch (error) {
      alert('Failed to move to trash')
    }
  }

  const handleBulkDelete = async () => {
    if (selectedFiles.size === 0) return
    if (!confirm(`Delete ${selectedFiles.size} files?`)) return
    
    try {
      await fileAPI.bulkDelete(Array.from(selectedFiles))
      setSelectedFiles(new Set())
      onRefresh()
    } catch (error) {
      alert('Failed to delete files')
    }
  }

  const handleBulkDownload = async () => {
    if (selectedFiles.size === 0) return
    
    try {
      const response = await fileAPI.bulkDownload(Array.from(selectedFiles))
      const url = window.URL.createObjectURL(response.data)
      const a = document.createElement('a')
      a.href = url
      a.download = `files-${Date.now()}.zip`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      alert('Failed to download files')
    }
  }

  const handleToggleSelection = (fileId) => {
    const newSelection = new Set(selectedFiles)
    if (newSelection.has(fileId)) {
      newSelection.delete(fileId)
    } else {
      newSelection.add(fileId)
    }
    setSelectedFiles(newSelection)
  }

  const handleSelectAll = () => {
    if (selectedFiles.size === files.length) {
      setSelectedFiles(new Set())
    } else {
      setSelectedFiles(new Set(files.map(f => f.id)))
    }
  }

  const handleDragStart = (e, file) => {
    e.dataTransfer.setData('fileId', file.id)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e, folderId) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOver(folderId)
  }

  const handleDragLeave = () => {
    setDragOver(null)
  }

  const handleDrop = async (e, folderId) => {
    e.preventDefault()
    setDragOver(null)
    
    const fileId = e.dataTransfer.getData('fileId')
    if (!fileId) return

    try {
      await fileAPI.move(fileId, folderId)
      onRefresh()
    } catch (error) {
      alert('Failed to move file')
    }
  }

  const handleContextMenu = (e, file) => {
    e.preventDefault()
    const isZip = file.mime_type?.includes('zip') || file.original_name?.endsWith('.zip')
    
    setContextMenu({
      position: { x: e.clientX, y: e.clientY },
      items: [
        {
          label: 'Download',
          icon: Download,
          onClick: () => handleDownload(file.id, file.original_name)
        },
        {
          label: file.is_favorite ? 'Remove from favorites' : 'Add to favorites',
          icon: Star,
          onClick: () => handleToggleFavorite(file.id, file.is_favorite)
        },
        { divider: true },
        {
          label: 'Copy',
          icon: Copy,
          onClick: () => handleCopy(file.id)
        },
        {
          label: 'Rename',
          icon: Edit3,
          onClick: () => setRenameDialog({ id: file.id, name: file.original_name })
        },
        {
          label: 'Share',
          icon: Share2,
          onClick: () => handleShare(file.id)
        },
        { divider: true },
        {
          label: 'Extract',
          icon: Archive,
          onClick: () => handleUnzip(file.id),
          disabled: !isZip
        },
        { divider: true },
        {
          label: 'Move to trash',
          icon: Trash2,
          onClick: () => handleMoveToTrash(file.id),
          danger: true
        }
      ]
    })
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
    <div className={`${theme.card} rounded-lg shadow-sm border ${theme.border} p-6`}>
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-2">
          {currentFolder && (
            <button
              onClick={() => onFolderClick(null)}
              className={`p-2 ${theme.hover} rounded-lg transition-colors`}
              title={t('common.back')}
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          <h2 className={`text-xl font-semibold ${theme.text}`}>
            {currentFolder ? t('dashboard.folder') : t('dashboard.allFiles')}
          </h2>
        </div>

        <div className="flex items-center gap-2">
          {selectedFiles.size > 0 && (
            <>
              <span className="text-sm text-gray-600">{selectedFiles.size} selected</span>
              <button
                onClick={handleBulkDownload}
                className="btn btn-secondary flex items-center gap-2"
                title="Download selected"
              >
                <Download className="w-4 h-4" />
              </button>
              <button
                onClick={handleBulkDelete}
                className="btn bg-red-600 hover:bg-red-700 text-white flex items-center gap-2"
                title="Delete selected"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
          <button
            onClick={onRefresh}
            className="btn btn-secondary flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            {t('common.refresh')}
          </button>
          <button
            onClick={() => setShowNewFolder(true)}
            className="btn btn-primary flex items-center gap-2"
          >
            <FolderPlus className="w-4 h-4" />
            {t('fileExplorer.newFolder')}
          </button>
        </div>
      </div>

      {showNewFolder && (
        <form onSubmit={handleCreateFolder} className="mb-4 flex gap-2">
          <input
            type="text"
            className="input flex-1"
            placeholder={t('fileExplorer.folderName')}
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            autoFocus
          />
          <button type="submit" className="btn btn-primary">
            {t('common.create')}
          </button>
          <button
            type="button"
            onClick={() => {
              setShowNewFolder(false)
              setNewFolderName('')
            }}
            className="btn btn-secondary"
          >
            {t('common.cancel')}
          </button>
        </form>
      )}

      {shareUrl && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
          <LinkIcon className="w-5 h-5 text-green-600" />
          <span className="text-sm text-green-800">{t('fileExplorer.linkCopied')}</span>
        </div>
      )}

      {renameDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Rename File</h3>
            <input
              type="text"
              className="input w-full mb-4"
              defaultValue={renameDialog.name}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleRename(renameDialog.id, e.target.value)
                }
              }}
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setRenameDialog(null)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={(e) => {
                  const input = e.target.closest('.bg-white').querySelector('input')
                  handleRename(renameDialog.id, input.value)
                }}
                className="btn btn-primary"
              >
                Rename
              </button>
            </div>
          </div>
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

      {contextMenu && (
        <ContextMenu
          position={contextMenu.position}
          items={contextMenu.items}
          onClose={() => setContextMenu(null)}
        />
      )}

      {loading ? (
        <div className="text-center py-12">
          <RefreshCw className="w-8 h-8 text-gray-400 animate-spin mx-auto mb-3" />
          <p className={theme.textSecondary}>{t('common.loading')}</p>
        </div>
      ) : (
        <>
          {currentFolder && (
            <div
              className={`mb-4 p-4 rounded-lg border-2 border-dashed ${dragOver === 'root' ? 'border-primary-500 bg-primary-50' : theme.border} transition-all ${theme.hover} cursor-pointer`}
              onDragOver={(e) => handleDragOver(e, 'root')}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, null)}
              onClick={() => onFolderClick(null)}
            >
              <div className="flex items-center justify-center gap-2">
                <Home className="w-5 h-5 text-gray-500" />
                <span className={`text-sm ${theme.textSecondary}`}>Move files here to return to root folder</span>
              </div>
            </div>
          )}
          {files.length > 0 && (
            <div className="mb-4 flex items-center gap-2">
              <button
                onClick={handleSelectAll}
                className={`p-2 ${theme.hover} rounded-lg transition-colors`}
                title={selectedFiles.size === files.length ? 'Deselect all' : 'Select all'}
              >
                {selectedFiles.size === files.length ? (
                  <CheckSquare className="w-5 h-5 text-primary-600" />
                ) : (
                  <Square className="w-5 h-5" />
                )}
              </button>
              <span className={`text-sm ${theme.textSecondary}`}>
                {selectedFiles.size === files.length ? 'All files selected' : 'Select all'}
              </span>
            </div>
          )}

          <div className="space-y-2">
            {/* Folders */}
            {folders.map((folder) => (
              <div
                key={`folder-${folder.id}`}
                className={`flex items-center gap-4 p-4 ${theme.hover} rounded-lg border ${theme.border} transition-colors group ${
                  dragOver === folder.id ? 'bg-primary-50 border-primary-300' : ''
                }`}
                onDragOver={(e) => handleDragOver(e, folder.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, folder.id)}
              >
                <Folder className="w-10 h-10 text-primary-600 flex-shrink-0" />
                <div
                  className="flex-1 cursor-pointer"
                  onClick={() => onFolderClick(folder.id)}
                >
                  <h3 className={`font-medium ${theme.text}`}>{folder.name}</h3>
                  <p className={`text-sm ${theme.textSecondary}`}>{formatDate(folder.created_at)}</p>
                </div>
                <button
                  onClick={() => onFolderDelete(folder.id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                  title={t('common.delete')}
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            ))}

            {/* Files */}
            {files.map((file) => {
              const FileIcon = getFileIcon(file.mime_type)
              const isSelected = selectedFiles.has(file.id)
              return (
                <div
                  key={`file-${file.id}`}
                  className={`flex items-center gap-4 p-4 ${theme.hover} rounded-lg border transition-colors group ${
                    isSelected ? 'border-primary-500 bg-primary-50' : theme.border
                  }`}
                  draggable
                  onDragStart={(e) => handleDragStart(e, file)}
                  onContextMenu={(e) => handleContextMenu(e, file)}
                >
                  <button
                    onClick={() => handleToggleSelection(file.id)}
                    className={`p-2 ${theme.hover} rounded transition-colors`}
                  >
                    {isSelected ? (
                      <CheckSquare className="w-5 h-5 text-primary-600" />
                    ) : (
                      <Square className="w-5 h-5 text-gray-400" />
                    )}
                  </button>
                  <FileIcon className="w-10 h-10 text-gray-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className={`font-medium ${theme.text} truncate`}>{file.original_name}</h3>
                      {file.is_favorite && <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />}
                    </div>
                    <p className={`text-sm ${theme.textSecondary}`}>
                      {formatBytes(file.size)} • {formatDate(file.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    {isMediaFile(file.mime_type) && (
                      <button
                        onClick={() => handleViewMedia(file)}
                        className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
                        title={t('common.view') || 'View'}
                      >
                        <Eye className="w-5 h-5" />
                      </button>
                    )}
                    <button
                      onClick={() => handleToggleFavorite(file.id, file.is_favorite)}
                      className="p-2 text-yellow-600 hover:bg-yellow-50 rounded-lg"
                      title="Toggle favorite"
                    >
                      <Star className={`w-5 h-5 ${file.is_favorite ? 'fill-yellow-500' : ''}`} />
                    </button>
                    <button
                      onClick={() => handleDownload(file.id, file.original_name)}
                      className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg"
                      title={t('common.download') || 'Download'}
                    >
                      <Download className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleShare(file.id)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                      title={t('common.share') || 'Share'}
                    >
                      <Share2 className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleMoveToTrash(file.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                      title={t('common.delete')}
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
                <p className={theme.textSecondary}>{t('fileExplorer.noFiles')}</p>
                <p className={`text-sm ${theme.textSecondary} mt-1`}>
                  {t('fileExplorer.uploadSome')}
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
