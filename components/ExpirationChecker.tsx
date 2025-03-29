'use client';

import { useState, useEffect } from 'react';

interface ExpirationCheckerProps {
  expirationDate: Date;
  onExpired: () => void;
}

export default function ExpirationChecker({ expirationDate, onExpired }: ExpirationCheckerProps) {
  const [timeLeft, setTimeLeft] = useState<{days: number, hours: number, minutes: number} | null>(null);
  
  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date();
      const expiry = new Date(expirationDate);
      const diff = expiry.getTime() - now.getTime();
      
      if (diff <= 0) {
        // File has expired
        onExpired();
        return null;
      }
      
      // Calculate remaining time
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      
      return { days, hours, minutes };
    };
    
    // Initial calculation
    setTimeLeft(calculateTimeLeft());
    
    // Set up interval to update countdown
    const timer = setInterval(() => {
      const remaining = calculateTimeLeft();
      setTimeLeft(remaining);
      
      if (!remaining) {
        clearInterval(timer);
      }
    }, 60000); // Update every minute
    
    return () => clearInterval(timer);
  }, [expirationDate, onExpired]);
  
  if (!timeLeft) return null;
  
  return (
    <div className="mt-2 text-yellow-600 text-sm">
      <span className="font-medium">Time remaining: </span>
      {timeLeft.days > 0 && `${timeLeft.days} day${timeLeft.days !== 1 ? 's' : ''} `}
      {timeLeft.hours > 0 && `${timeLeft.hours} hour${timeLeft.hours !== 1 ? 's' : ''} `}
      {timeLeft.minutes > 0 && `${timeLeft.minutes} minute${timeLeft.minutes !== 1 ? 's' : ''}`}
    </div>
  );
} 