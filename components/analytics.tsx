// This file is used to safely load Vercel Analytics
// It will only load in production environments on Vercel

'use client';

import { useEffect, useState } from 'react';

export function VercelAnalytics() {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // Only load analytics in production and on the client side
    if (
      typeof window !== 'undefined' && 
      process.env.NODE_ENV === 'production' && 
      process.env.VERCEL
    ) {
      import('@vercel/analytics/react')
        .then(({ Analytics }) => {
          setLoaded(true);
          // We've successfully loaded the analytics module
        })
        .catch(err => {
          console.error('Failed to load Vercel Analytics:', err);
        });
    }
  }, []);

  // This component doesn't render anything visible
  return null;
}
