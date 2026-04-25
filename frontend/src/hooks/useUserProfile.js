/**
 * Custom Hook for User Profile
 */

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';

/**
 * @param {string} userId
 * @returns {{profile: any, loading: boolean, error: string|null, refetch: function}}
 */
export function useUserProfile(userId) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!userId) {
      setProfile(null);
      setError(null);
      setLoading(false);
      return;
    }

    const fetchProfile = async () => {
      try {
        setLoading(true);
        const profileData = await api.getUserProfile(userId);
        setProfile(profileData);
        setError(null);
      } catch (err) {
        const status = err?.response?.status;
        if (status === 404) {
          // Treat 404 as "no profile" rather than a hard error
          setProfile(null);
          setError(null);
        } else {
          setError(err.message || 'Failed to load profile');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [userId]);

  const refetch = async () => {
    if (userId) {
      try {
        setLoading(true);
        const profileData = await api.getUserProfile(userId);
        setProfile(profileData);
      } catch (err) {
        const status = err?.response?.status;
        if (status === 404) {
          setProfile(null);
          setError(null);
        } else {
          setError(err.message || 'Failed to reload profile');
        }
      } finally {
        setLoading(false);
      }
    }
  };

  return { profile, loading, error, refetch };
}

