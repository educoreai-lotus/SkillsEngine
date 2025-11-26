/**
 * Home Page - Dashboard
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Dashboard from '@/components/Dashboard';

const DEFAULT_USER_ID = '550e8400-e29b-41d4-a716-446655440000';

export default function Home() {
  const router = useRouter();
  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get userId from query params or use the default
    // Note: We always use DEFAULT_USER_ID unless explicitly overridden via query param
    let id = router.query.userId || DEFAULT_USER_ID;

    setUserId(id);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('userId', id);
    }
    setLoading(false);
  }, [router.query.userId]);

  if (loading || !userId) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return <Dashboard userId={userId} />;
}

