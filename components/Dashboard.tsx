import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useAuth } from '@/contexts/AuthContext';
import { uploadFile, formatFileSize, getFileTypeIcon } from '@/utils/fileOperations';
import toast from 'react-hot-toast';

export default function Dashboard() {
  const { user } = useAuth();
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});
  const [isUploading, setIsUploading] = useState(false);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    setIsUploading(true);
    const uploadPromises = acceptedFiles.map(async (file) => {
      try {
        await uploadFile(file, `users/${user?.uid}/files`, (progress) => {
          setUploadProgress((prev) => ({
            ...prev,
            [file.name]: progress,
          }));
        });
        toast.success(`Successfully uploaded ${file.name}`);
      } catch (error) {
        console.error('Upload error:', error);
        toast.error(`Failed to upload ${file.name}`);
      }
    });

    await Promise.all(uploadPromises);
    setIsUploading(false);
    setUploadProgress({});
  }, [user]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: true,
  });

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {/* Upload Area */}
        <div
          {...getRootProps()}
          className={`p-10 border-2 border-dashed rounded-lg text-center ${
            isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
          }`}
        >
          <input {...getInputProps()} />
          <div className="space-y-2">
            <div className="text-4xl">📁</div>
            {isDragActive ? (
              <p className="text-lg">Drop the files here...</p>
            ) : (
              <>
                <p className="text-lg">
                  Drag and drop files here, or click to select files
                </p>
                <p className="text-sm text-gray-500">
                  Upload multiple files at once
                </p>
              </>
            )}
          </div>
        </div>

        {/* Upload Progress */}
        {Object.keys(uploadProgress).length > 0 && (
          <div className="mt-6 space-y-4">
            <h2 className="text-lg font-semibold">Uploading Files</h2>
            {Object.entries(uploadProgress).map(([fileName, progress]) => (
              <div key={fileName} className="bg-white p-4 rounded-lg shadow">
                <div className="flex items-center space-x-4">
                  <div className="text-2xl">
                    {getFileTypeIcon(fileName.split('.').pop()?.toLowerCase() || '')}
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between">
                      <span className="font-medium">{fileName}</span>
                      <span>{Math.round(progress)}%</span>
                    </div>
                    <div className="mt-2 h-2 bg-gray-200 rounded-full">
                      <div
                        className="h-2 bg-blue-500 rounded-full transition-all duration-300"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* File List will be added here */}
      </main>
    </div>
  );
} 