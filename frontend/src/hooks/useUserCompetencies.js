/**
 * Custom Hook for User Competencies
 */

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';

/**
 * @param {string} userId
 * @param {object} params - Optional query parameters (competency_id, page, limit)
 * @returns {{competencies: any[], loading: boolean, error: string|null, refetch: function, pagination: object|null}}
 */
export function useUserCompetencies(userId, params = {}) {
  const [competencies, setCompetencies] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchCompetencies = async () => {
      try {
        setLoading(true);
        const response = await api.getUserCompetencies(userId, params);

        if (response.success) {
          setCompetencies(response.data || []);
          setPagination(response.pagination || null);
          setError(null);
        } else {
          setError(response.error || 'Failed to load competencies');
          setCompetencies([]);
        }
      } catch (err) {
        const status = err?.response?.status;
        if (status === 404) {
          // Treat 404 as "no competencies" rather than a hard error
          setCompetencies([]);
          setPagination(null);
          setError(null);
        } else {
          setError(err.message || 'Failed to load competencies');
          setCompetencies([]);
        }
      } finally {
        setLoading(false);
      }
    };

    if (userId) {
      fetchCompetencies();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, params.competency_id, params.page, params.limit]);

  const refetch = async () => {
    if (userId) {
      try {
        setLoading(true);
        const response = await api.getUserCompetencies(userId, params);

        if (response.success) {
          setCompetencies(response.data || []);
          setPagination(response.pagination || null);
          setError(null);
        } else {
          setError(response.error || 'Failed to reload competencies');
        }
      } catch (err) {
        const status = err?.response?.status;
        if (status === 404) {
          setCompetencies([]);
          setPagination(null);
          setError(null);
        } else {
          setError(err.message || 'Failed to reload competencies');
        }
      } finally {
        setLoading(false);
      }
    }
  };

  return { competencies, loading, error, refetch, pagination };
}
