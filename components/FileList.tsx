'use client';

import { useState, useEffect } from 'react';
import { FileData, deleteFile, shareFile, generateShareableLink, getUserFiles, verifyFilePassword } from '@/services/fileService';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';
import ExpirationChecker from '@/components/ExpirationChecker';

interface FileListProps {
  files: FileData[];
  onFilesChange: (files: FileData[]) => void;
  isOwner: boolean;
}

export default function FileList({ files, onFilesChange, isOwner }: FileListProps) {
  const { user } = useAuth();
  const [sharingFile, setSharingFile] = useState<string | null>(null);
  const [shareEmail, setShareEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [currentFile, setCurrentFile] = useState<FileData | null>(null);
  const [expirationHours, setExpirationHours] = useState<number | ''>('');
  const [passwordProtect, setPasswordProtect] = useState(false);
  const [password, setPassword] = useState('');
  
  // Password modal state for downloads
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [fileToDownload, setFileToDownload] = useState<FileData | null>(null);
  const [downloadPassword, setDownloadPassword] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const refreshFiles = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const userFiles = await getUserFiles(user.uid);
      onFilesChange(userFiles);
    } catch (error) {
      console.error('Error fetching files:', error);
      toast.error('Failed to load files');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyToClipboard = async (file: FileData) => {
    try {
      // Generate proper shareable link
      const shareUrl = `${window.location.origin}/files/${file.id}`;
      
      await navigator.clipboard.writeText(shareUrl);
      toast.success('Link copied to clipboard!');
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      toast.error('Failed to copy link');
    }
  };

  useEffect(() => {
    if (user) {
      refreshFiles();
    }
  }, [user]);

  const handleDelete = async (fileId: string) => {
    try {
      setDeleting(fileId);
      await deleteFile(fileId, user!.uid);
      onFilesChange(files.filter(f => f.id !== fileId));
      toast.success('File deleted successfully');
    } catch (error) {
      console.error('Error deleting file:', error);
      toast.error('Failed to delete file');
    } finally {
      setDeleting(null);
    }
  };

  const handleShare = async (fileId: string) => {
    try {
      if (!shareEmail) {
        toast.error('Please enter an email address');
        return;
      }
      await shareFile(fileId, user!.uid, shareEmail);
      setSharingFile(null);
      setShareEmail('');
      toast.success('File shared successfully');
    } catch (error) {
      console.error('Share error:', error);
      toast.error('Failed to share file');
    }
  };

  const handleGenerateLink = async (fileId: string) => {
    try {
      const link = await generateShareableLink(fileId, user!.uid);
      await navigator.clipboard.writeText(link);
      toast.success('Shareable link copied to clipboard');
    } catch (error) {
      console.error('Generate link error:', error);
      toast.error('Failed to generate shareable link');
    }
  };

  const openShareModal = (file: FileData) => {
    setCurrentFile(file);
    setShareModalOpen(true);
    
    // If the file already has an expiration, show it in the input
    if (file.expiresAt) {
      // Calculate how many hours are left from now until expiration
      const now = new Date();
      const expiry = new Date(file.expiresAt);
      const hoursLeft = Math.max(0, Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60)));
      setExpirationHours(hoursLeft);
    } else {
      setExpirationHours('');
    }
    
    // Check if file is password protected
    setPasswordProtect(!!file.isPasswordProtected);
    setPassword('');
  };

  const closeShareModal = () => {
    setShareModalOpen(false);
    setCurrentFile(null);
  };

  const handleShareFile = async () => {
    if (!currentFile || !user) return;
    
    try {
      const options: {
        expiresIn?: number;
        password?: string;
      } = {};
      
      // Add expiration if specified
      if (expirationHours && !isNaN(Number(expirationHours))) {
        options.expiresIn = Number(expirationHours);
      } else if (currentFile.expiresAt) {
        // If the user removed the expiration, indicate that with a null value
        // The server will handle this as removing the expiration
        options.expiresIn = null as any;
      }
      
      // Add password protection if enabled and not already protected
      if (passwordProtect && !currentFile.isPasswordProtected && password.trim()) {
        options.password = password.trim();
      }
      
      const link = await generateShareableLink(currentFile.id!, user.uid, options);
      handleCopyToClipboard(currentFile);
      closeShareModal();
      refreshFiles();
    } catch (error) {
      console.error('Error generating shareable link:', error);
      toast.error('Failed to generate link');
    }
  };

  const handleDownloadFile = (file: FileData) => {
    // If file is password protected and user is not the owner, show password prompt
    if (file.isPasswordProtected && (!isOwner || file.userId !== user?.uid)) {
      setFileToDownload(file);
      setPasswordModalOpen(true);
      setDownloadPassword('');
      setPasswordError(null);
    } else {
      // Otherwise download directly using the secure URL
      window.open(file.secureUrl, '_blank');
      toast.success('Download started!');
    }
  };
  
  const handleVerifyDownloadPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!fileToDownload || !downloadPassword.trim()) {
      setPasswordError('Please enter a password');
      return;
    }
    
    try {
      setVerifying(true);
      setPasswordError(null);
      
      const isValid = await verifyFilePassword(fileToDownload.id!, downloadPassword);
      
      if (isValid) {
        setPasswordModalOpen(false);
        // Use the secure URL
        window.open(fileToDownload.secureUrl, '_blank');
        toast.success('Download started!');
      } else {
        setPasswordError('Invalid password. Please try again.');
      }
    } catch (error) {
      console.error('Error verifying password:', error);
      setPasswordError('An error occurred while verifying the password');
    } finally {
      setVerifying(false);
    }
  };

  if (files.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">No files found</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {files.map((file) => (
        <div
          key={file.id}
          className="bg-white p-4 rounded-lg shadow border border-gray-200 flex items-center justify-between"
        >
          <div className="flex items-center space-x-4">
            <div className="text-2xl">
              {file.type.startsWith('image/') ? '🖼️' : '📄'}
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900">{file.name}</h3>
              <p className="text-sm text-gray-500">
                Size: {(file.size / 1024 / 1024).toFixed(2)} MB • Type: {file.type}
                {file.isPasswordProtected && <span className="ml-2 text-blue-600 font-medium">• 🔒 Password protected</span>}
                {file.expiresAt && (
                  <span className="ml-2 text-yellow-600 font-medium">
                    • Expires: {new Date(file.expiresAt).toLocaleDateString()} {new Date(file.expiresAt).toLocaleTimeString()}
                  </span>
                )}
              </p>
              {file.expiresAt && (
                <ExpirationChecker 
                  expirationDate={new Date(file.expiresAt)} 
                  onExpired={() => refreshFiles()}
                />
              )}
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {isOwner && (
              <>
                <button
                  onClick={() => openShareModal(file)}
                  className="px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded"
                >
                  Share
                </button>

                <button
                  onClick={() => handleDelete(file.id!)}
                  className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded"
                >
                  Delete
                </button>
              </>
            )}

            <button
              onClick={() => handleDownloadFile(file)}
              className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Download
            </button>
          </div>
        </div>
      ))}

      {/* Share Modal */}
      {shareModalOpen && currentFile && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Share File</h3>
            <p className="text-sm text-gray-600 mb-4">
              You are about to share: <span className="font-medium">{currentFile.name}</span>
            </p>
            
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Expiration
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
                  {currentFile.expiresAt ? (
                    <>
                      Current expiration: {new Date(currentFile.expiresAt).toLocaleString()}
                      <br />
                      Enter a new value to update or leave empty to remove expiration
                    </>
                  ) : (
                    'Leave empty for no expiration'
                  )}
                </p>
              </div>
              
              <div>
                <div className="flex items-center">
                  <input
                    id="passwordProtect"
                    type="checkbox"
                    checked={passwordProtect}
                    onChange={(e) => setPasswordProtect(e.target.checked)}
                    disabled={currentFile.isPasswordProtected}
                    className={`h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 ${currentFile.isPasswordProtected ? 'opacity-60 cursor-not-allowed' : ''}`}
                  />
                  <label htmlFor="passwordProtect" className="ml-2 block text-sm font-medium text-gray-700">
                    Password protect this file
                    {currentFile.isPasswordProtected && (
                      <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                        Already protected
                      </span>
                    )}
                  </label>
                </div>
                
                {passwordProtect && !currentFile.isPasswordProtected && (
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
                
                {currentFile.isPasswordProtected && (
                  <p className="text-xs text-gray-500 mt-1">
                    This file is already password protected. You cannot change the password.
                  </p>
                )}
              </div>
            </div>
            
            <div className="flex justify-end space-x-3">
              <button
                onClick={closeShareModal}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleShareFile}
                className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700"
              >
                Generate & Copy Link
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Password Modal for Downloads */}
      {passwordModalOpen && fileToDownload && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Password Required</h3>
            <p className="text-sm text-gray-600 mb-4">
              This file is password protected. Please enter the password to download:
              <span className="block font-medium mt-1">{fileToDownload.name}</span>
            </p>
            
            {passwordError && (
              <div className="bg-red-50 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                {passwordError}
              </div>
            )}
            
            <form onSubmit={handleVerifyDownloadPassword} className="space-y-4">
              <div>
                <label htmlFor="download-password" className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <input
                  id="download-password"
                  type="password"
                  value={downloadPassword}
                  onChange={(e) => setDownloadPassword(e.target.value)}
                  placeholder="Enter password"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setPasswordModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 ${verifying ? 'opacity-50 cursor-not-allowed' : ''}`}
                  disabled={verifying}
                >
                  {verifying ? 'Verifying...' : 'Download'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
} 