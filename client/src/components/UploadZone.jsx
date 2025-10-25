import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { fileAPI } from '../api'
import { Upload, X, CheckCircle, AlertCircle } from 'lucide-react'

export default function UploadZone({ currentFolder, onUploadComplete }) {
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState({})
  const [uploadedFiles, setUploadedFiles] = useState([])
  const [errors, setErrors] = useState([])

  const onDrop = useCallback(async (acceptedFiles) => {
    setUploading(true)
    setUploadedFiles([])
    setErrors([])

    for (const file of acceptedFiles) {
      const formData = new FormData()
      formData.append('file', file)
      if (currentFolder) {
        formData.append('folder_id', currentFolder)
      }

      try {
        await fileAPI.upload(formData, (progressEvent) => {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total)
          setUploadProgress((prev) => ({ ...prev, [file.name]: progress }))
        })
        
        setUploadedFiles((prev) => [...prev, file.name])
        setUploadProgress((prev) => ({ ...prev, [file.name]: 100 }))
      } catch (error) {
        setErrors((prev) => [...prev, { 
          file: file.name, 
          error: error.response?.data?.error || 'Upload fehlgeschlagen' 
        }])
      }
    }

    setUploading(false)
    setTimeout(() => {
      setUploadProgress({})
      setUploadedFiles([])
      setErrors([])
      onUploadComplete()
    }, 3000)
  }, [currentFolder, onUploadComplete])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop })

  return (
    <div className="card">
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all ${
          isDragActive
            ? 'border-primary-500 bg-primary-50'
            : 'border-gray-300 hover:border-primary-400 hover:bg-gray-50'
        }`}
      >
        <input {...getInputProps()} />
        <Upload className={`w-16 h-16 mx-auto mb-4 ${isDragActive ? 'text-primary-600' : 'text-gray-400'}`} />
        {isDragActive ? (
          <p className="text-lg font-medium text-primary-600">Dateien hier ablegen...</p>
        ) : (
          <>
            <p className="text-lg font-medium text-gray-700 mb-2">
              Dateien hochladen
            </p>
            <p className="text-sm text-gray-500">
              Klicken Sie hier oder ziehen Sie Dateien per Drag & Drop
            </p>
          </>
        )}
      </div>

      {(uploading || uploadedFiles.length > 0 || errors.length > 0) && (
        <div className="mt-4 space-y-2">
          {Object.entries(uploadProgress).map(([filename, progress]) => (
            <div key={filename} className="bg-gray-50 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">{filename}</span>
                {progress === 100 && uploadedFiles.includes(filename) && (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                )}
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-primary-600 h-2 rounded-full transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          ))}

          {errors.map((error, index) => (
            <div key={index} className="bg-red-50 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-800">{error.file}</p>
                <p className="text-xs text-red-600">{error.error}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
