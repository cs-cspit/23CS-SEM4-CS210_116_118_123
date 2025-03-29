'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { uploadFile } from '@/services/fileService';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';

interface FileUploadProps {
  onUploadComplete?: (fileData: any) => void;
}

export default function FileUpload({ onUploadComplete }: FileUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [expirationHours, setExpirationHours] = useState<number | ''>('');
  const [passwordProtect, setPasswordProtect] = useState(false);
  const [password, setPassword] = useState('');
  const { user } = useAuth();

  const handleFilesSelected = useCallback((files: File[]) => {
    if (!user) {
      toast.error('Please log in to upload files');
      return;
    }

    setSelectedFiles(files);
    setShowOptionsModal(true);
  }, [user]);

  const handleUpload = async () => {
    if (!selectedFiles.length || !user) return;

    try {
      setUploading(true);
      
      // Prepare upload options
      const options: {
        expiresIn?: number;
        password?: string;
      } = {};
      
      // Add expiration if specified
      if (expirationHours && !isNaN(Number(expirationHours))) {
        options.expiresIn = Number(expirationHours);
      }
      
      // Add password protection if enabled
      if (passwordProtect && password.trim()) {
        options.password = password.trim();
      }

      const uploadPromises = selectedFiles.map(file => 
        uploadFile(file, user.uid, options)
          .then(fileData => {
            if (fileData && (fileData.url || fileData.secureUrl)) {
              toast.success(`${file.name} uploaded successfully!`);
              return fileData;
            } else {
              toast.error(`Failed to upload ${file.name}`);
              console.error('Upload error: Missing URL in response');
              return null;
            }
          })
          .catch(error => {
            // More robust check for successful uploads despite errors
            if (error && typeof error === 'object') {
              // Check all possible ways the response might contain URL information
              const hasUrl = 
                error.url || 
                error.secure_url || 
                error.secureUrl ||
                (error.response && (error.response.url || error.response.secure_url)) ||
                'public_id' in error;
              
              if (hasUrl) {
                // File was actually uploaded successfully
                toast.success(`${file.name} uploaded successfully!`);
                
                // Return a properly structured file data object for the UI
                return {
                  name: file.name,
                  url: error.url || error.secure_url || error.secureUrl ||
                       (error.response && (error.response.url || error.response.secure_url)) || 
                       '',
                  size: file.size,
                  type: file.type,
                  uploadedAt: new Date().toISOString(),
                  id: error.public_id || `${Date.now()}_${file.name}`
                };
              }
            }
            
            // Check for partial success messages
            if (error?.message && (
                error.message.includes('existing') || 
                error.message.includes('success') ||
                error.message.includes('uploaded')
              )) {
              toast.success(`${file.name} uploaded successfully!`);
              return {
                name: file.name,
                size: file.size,
                type: file.type,
                uploadedAt: new Date().toISOString(),
                id: `${Date.now()}_${file.name}`
              };
            }
            
            // Genuine failure
            toast.error(`Failed to upload ${file.name}`);
            console.error('Upload error:', error);
            return null;
          })
      );

      const results = await Promise.all(uploadPromises);
      const successfulUploads = results.filter(result => result !== null);
      
      if (onUploadComplete) {
        onUploadComplete(successfulUploads);
      }
      
      // Reset form
      resetForm();
      
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload files');
    } finally {
      setUploading(false);
    }
  };
  
  const resetForm = () => {
    setSelectedFiles([]);
    setShowOptionsModal(false);
    setExpirationHours('');
    setPasswordProtect(false);
    setPassword('');
  };
  
  const cancelUpload = () => {
    resetForm();
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: handleFilesSelected,
    disabled: uploading || showOptionsModal
  });

  return (
    <>
      <div
        {...getRootProps()}
        className={`p-8 border-2 border-dashed rounded-lg text-center cursor-pointer transition-colors
          ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-500'}
          ${(uploading || showOptionsModal) ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <input {...getInputProps()} />
        <div className="space-y-4">
          <div className="text-4xl">📁</div>
          {isDragActive ? (
            <p className="text-blue-500">Drop the files here...</p>
          ) : (
            <div>
              <p className="text-gray-600">
                Drag & drop files here, or click to select files
              </p>
              <p className="text-sm text-gray-500 mt-2">
                All file types supported • Max size: 100MB per file
              </p>
            </div>
          )}
          {uploading && (
            <div className="mt-4">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
              <p className="text-sm text-gray-500 mt-2">Uploading...</p>
            </div>
          )}
        </div>
      </div>
      
      {/* Upload Options Modal */}
      {showOptionsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">File Upload Options</h3>
            
            {selectedFiles.length > 0 && (
              <div className="mb-4">
                <p className="text-sm font-medium text-gray-700 mb-2">
                  Selected Files: {selectedFiles.length}
                </p>
                <ul className="max-h-40 overflow-y-auto text-sm text-gray-600 border rounded-md p-2">
                  {selectedFiles.map((file, index) => (
                    <li key={index} className="truncate py-1">
                      {file.name} ({Math.round(file.size / 1024)} KB)
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Expiration Time
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    min="1"
                    value={expirationHours}
                    onChange={(e) => setExpirationHours(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="Enter hours"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                  <span className="text-sm text-gray-500">hours</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Leave empty for no expiration
                </p>
              </div>
              
              <div>
                <div className="flex items-center">
                  <input
                    id="passwordProtect"
                    type="checkbox"
                    checked={passwordProtect}
                    onChange={(e) => setPasswordProtect(e.target.checked)}
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="passwordProtect" className="ml-2 block text-sm font-medium text-gray-700">
                    Password protect these files
                  </label>
                </div>
                
                {passwordProtect && (
                  <div className="mt-2">
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter password"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex justify-end space-x-3">
              <button
                onClick={cancelUpload}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleUpload}
                className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:bg-blue-300"
                disabled={passwordProtect && !password.trim()}
              >
                Upload Files
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
} 