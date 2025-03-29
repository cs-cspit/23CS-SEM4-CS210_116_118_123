import { cleanupExpiredFiles } from '@/services/fileService';

// A simple function to call cleanup on a regular interval
export const initializeCleanupScheduler = () => {
  // Check for expired files every hour (3600000 ms)
  const CLEANUP_INTERVAL = 3600000;
  
  // Run initial cleanup
  runCleanup();
  
  // Set interval for regular cleanup
  const intervalId = setInterval(runCleanup, CLEANUP_INTERVAL);
  
  // Return function to clear interval if needed
  return () => clearInterval(intervalId);
};

async function runCleanup() {
  try {
    console.log('Running scheduled cleanup of expired files');
    const cleanedCount = await cleanupExpiredFiles();
    console.log(`Cleanup complete. Removed ${cleanedCount} expired files.`);
  } catch (error) {
    console.error('Error during scheduled cleanup:', error);
  }
} 