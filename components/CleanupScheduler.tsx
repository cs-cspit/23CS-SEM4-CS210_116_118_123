'use client';

import { useEffect } from 'react';
import { initializeCleanupScheduler } from '@/utils/cleanupScheduler';

export default function CleanupScheduler() {
  useEffect(() => {
    // Initialize the cleanup scheduler
    const cleanup = initializeCleanupScheduler();
    
    // Cleanup when component unmounts
    return () => {
      cleanup();
    };
  }, []);
  
  // This component doesn't render anything
  return null;
} 