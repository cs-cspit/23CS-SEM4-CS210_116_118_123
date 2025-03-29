'use client';

import { useState } from 'react';
import { verifyFilePassword } from '@/services/fileService';
import Link from 'next/link';

interface PasswordProtectedFileProps {
  fileId: string;
  onAuthenticated: () => void;
}

export default function PasswordProtectedFile({ fileId, onAuthenticated }: PasswordProtectedFileProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!password.trim()) {
      setError('Please enter a password');
      return;
    }
    
    try {
      setVerifying(true);
      setError(null);
      
      const isValid = await verifyFilePassword(fileId, password);
      
      if (isValid) {
        onAuthenticated();
      } else {
        setError('Invalid password. Please try again.');
      }
    } catch (error) {
      console.error('Error verifying password:', error);
      setError('An error occurred while verifying the password');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center py-12 px-4">
      <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full">
        <h2 className="text-2xl font-bold text-center mb-6">Password Protected File</h2>
        
        <p className="text-gray-600 mb-6 text-center">
          This file is password protected. Please enter the password to access it.
        </p>
        
        {error && (
          <div className="bg-red-50 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter file password"
              required
            />
          </div>
          
          <button
            type="submit"
            disabled={verifying}
            className={`w-full bg-blue-600 text-white font-medium py-2 px-4 rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
              verifying ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {verifying ? 'Verifying...' : 'Access File'}
          </button>
        </form>
        
        <div className="mt-6 text-center">
          <Link 
            href="/dashboard" 
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
} 