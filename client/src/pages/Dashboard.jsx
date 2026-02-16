import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { fileAPI, folderAPI, userAPI } from '../api'
import Header from '../components/Header'
import FileExplorer from '../components/FileExplorer'
import UploadZone from '../components/UploadZone'
import StorageBar from '../components/StorageBar'
import { useTranslation } from 'react-i18next'

export default function Dashboard() {
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const { t } = useTranslation()
  const [files, setFiles] = useState([])
  const [folders, setFolders] = useState([])
  const [currentFolder, setCurrentFolder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [storageStats, setStorageStats] = useState(null)

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
    if (!confirm(t('fileExplorer.deleteFileConfirm'))) return

    try {
      await fileAPI.delete(fileId)
      loadData()
      loadStorageStats()
    } catch (error) {
      alert(t('fileExplorer.deleteError'))
    }
  }

  const handleFolderCreate = async (name) => {
    try {
      await folderAPI.create({ name, parent_id: currentFolder })
      loadData()
    } catch (error) {
      alert(t('fileExplorer.createFolderError'))
    }
  }

  const handleFolderDelete = async (folderId) => {
    if (!confirm(t('fileExplorer.deleteFolderConfirm'))) return

    try {
      await folderAPI.delete(folderId)
      loadData()
    } catch (error) {
      alert(t('fileExplorer.deleteError'))
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
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
            onFolderClick={setCurrentFolder}
            onFolderCreate={handleFolderCreate}
            onFolderDelete={handleFolderDelete}
            onFileDelete={handleFileDelete}
            onRefresh={loadData}
          />
        </div>
      </main>
    </div>
  )
}
