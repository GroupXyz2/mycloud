import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useThemeStore } from '../store/themeStore'
import { fileAPI, folderAPI, userAPI } from '../api'
import Header from '../components/Header'
import FileExplorer from '../components/FileExplorer'
import UploadZone from '../components/UploadZone'
import StorageBar from '../components/StorageBar'
import Popup from '../components/Popup'
import { useTranslation } from 'react-i18next'

export default function Dashboard() {
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const { theme } = useThemeStore()
  const { t } = useTranslation()
  const [files, setFiles] = useState([])
  const [folders, setFolders] = useState([])
  const [currentFolder, setCurrentFolder] = useState(null)
  const [folderHistory, setFolderHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [storageStats, setStorageStats] = useState(null)
  const [popup, setPopup] = useState(null)

  useEffect(() => {
    loadData()
    loadStorageStats()
  }, [currentFolder])

  const loadData = async () => {
    try {
      setLoading(true)
      const [filesRes, foldersRes] = await Promise.all([
        fileAPI.getFiles(currentFolder),
        folderAPI.getFolders(currentFolder)
      ])
      setFiles(filesRes.data)
      setFolders(foldersRes.data)
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadStorageStats = async () => {
    try {
      const response = await userAPI.getStorageStats()
      setStorageStats(response.data)
    } catch (error) {
      console.error('Error loading storage stats:', error)
    }
  }

  const handleUploadComplete = () => {
    loadData()
    loadStorageStats()
  }

  const handleFileDelete = async (fileId) => {
    setPopup({
      message: t('fileExplorer.deleteFileConfirm') || 'Delete this file?',
      type: 'confirm',
      onConfirm: async () => {
        try {
          await fileAPI.delete(fileId)
          loadData()
          loadStorageStats()
        } catch (error) {
          setPopup({ message: t('fileExplorer.deleteError'), type: 'error' })
        }
      }
    })
  }

  const handleFolderNavigate = (folderId) => {
    if (folderId !== currentFolder) {
      setFolderHistory(prev => [...prev, currentFolder])
    }
    setCurrentFolder(folderId)
  }

  const handleFolderBack = () => {
    if (folderHistory.length > 0) {
      const previousFolder = folderHistory[folderHistory.length - 1]
      setFolderHistory(prev => prev.slice(0, -1))
      setCurrentFolder(previousFolder)
    } else {
      setCurrentFolder(null)
    }
  }

  const handleFolderCreate = async (name) => {
    try {
      await folderAPI.create({ name, parent_id: currentFolder })
      loadData()
    } catch (error) {
      setPopup({ message: t('fileExplorer.createFolderError'), type: 'error' })
    }
  }

  const handleFolderDelete = async (folderId) => {
    setPopup({
      message: t('fileExplorer.deleteFolderConfirm') || 'Delete this folder?',
      type: 'confirm',
      onConfirm: async () => {
        try {
          await folderAPI.delete(folderId)
          loadData()
        } catch (error) {
          setPopup({ message: t('fileExplorer.deleteError'), type: 'error' })
        }
      }
    })
  }

  return (
    <div className={`min-h-screen ${theme.bg}`}>
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className={`text-3xl font-bold ${theme.text} mb-2`}>
            {t('dashboard.welcome', { username: user?.username })}
          </h1>
          {storageStats && (
            <StorageBar 
              used={storageStats.storage_used} 
              total={storageStats.storage_quota} 
            />
          )}
        </div>

        <div className="grid grid-cols-1 gap-6">
          <UploadZone 
            currentFolder={currentFolder}
            onUploadComplete={handleUploadComplete}
          />

          <FileExplorer
            files={files}
            folders={folders}
            currentFolder={currentFolder}
            loading={loading}
            onFolderClick={handleFolderNavigate}
            onFolderBack={handleFolderBack}
            onFolderCreate={handleFolderCreate}
            onFolderDelete={handleFolderDelete}
            onFileDelete={handleFileDelete}
            onRefresh={loadData}
          />
        </div>
      </main>

      {popup && (
        <Popup
          message={popup.message}
          type={popup.type}
          onClose={() => setPopup(null)}
          onConfirm={popup.onConfirm}
          confirmText={popup.confirmText}
          cancelText={popup.cancelText}
        />
      )}
    </div>
  )
}
