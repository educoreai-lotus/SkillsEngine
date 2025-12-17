/**
 * Career Path Management Page
 *
 * Allows users to view, add, and remove career paths.
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useUserProfile } from '@/hooks/useUserProfile';

const DEFAULT_USER_ID = '550e8400-e29b-41d4-a716-446655440000';

export default function CareerPathPage() {
  const router = useRouter();
  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(true);

  // User profile
  const { profile } = useUserProfile(userId);
  const user = profile?.user || profile;
  const targetRole = user?.path_career || user?.career_path_goal || `User ${DEFAULT_USER_ID.substring(0, 8)}`;

  // Career path state
  const [careerPaths, setCareerPaths] = useState([]);
  const [careerPathsLoading, setCareerPathsLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);

  // Initialize userId
  useEffect(() => {
    const id = router.query.userId || DEFAULT_USER_ID;
    setUserId(id);
    setLoading(false);
  }, [router.query.userId]);

  // Fetch career paths
  const fetchCareerPaths = useCallback(async () => {
    if (!userId) return;

    setCareerPathsLoading(true);
    try {
      const response = await api.getAllCareerPaths(userId);
      setCareerPaths(response.data || []);
    } catch (error) {
      console.error('Error fetching career paths:', error);
      setCareerPaths([]);
    } finally {
      setCareerPathsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) {
      fetchCareerPaths();
    }
  }, [userId, fetchCareerPaths]);

  // Debounced search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const response = await api.searchCompetencies(searchQuery, { limit: 10 });
        setSearchResults(response.data || []);
        setShowResults(true);
      } catch (error) {
        console.error('Error searching competencies:', error);
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Add career path
  const handleAddCareerPath = async (competency) => {
    try {
      await api.addCareerPath(userId, competency.competency_id);
      setSearchQuery('');
      setShowResults(false);
      fetchCareerPaths();
    } catch (error) {
      console.error('Error adding career path:', error);
      alert('Failed to add career path. It may already exist.');
    }
  };

  // Calculate gap and send to Learner AI, then redirect
  const handleCalculateGapAndSend = async () => {
    if (careerPaths.length === 0) {
      alert('Please add at least one competency to your career path first.');
      return;
    }

    try {
      setAnalyzing(true);
      await api.calculateGapAndSend(userId);
      // Redirect to directory page (home/dashboard)
      router.push(`/?userId=${userId}`);
    } catch (error) {
      console.error('Error calculating gap and sending to Learner AI:', error);
      alert('Failed to calculate gap and send to Learner AI.');
      setAnalyzing(false);
    }
  };

  // Remove career path
  const handleRemoveCareerPath = async (competencyId) => {
    if (!confirm('Are you sure you want to remove this career path?')) return;

    try {
      await api.deleteCareerPath(userId, competencyId);
      fetchCareerPaths();
    } catch (error) {
      console.error('Error removing career path:', error);
      alert('Failed to remove career path.');
    }
  };

  if (loading || !userId) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Career Path - Skills Engine</title>
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
        <div className="max-w-4xl mx-auto px-4 py-8">
          {/* Header */}
          <div className="mb-8">
            <Link href="/" className="text-emerald-600 hover:text-emerald-700 text-sm mb-4 inline-block">
              &larr; Back to Dashboard
            </Link>
            <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100">
              Career Path Management
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mt-2">
              Add competencies to track your career development goals.
            </p>
          </div>

          {/* Search Section */}
          <div className="mb-8">
            <div className="glass rounded-xl p-6">
              <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-2">
                Customize Career Path
              </h2>
              <div className="mb-4">
                <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1 rounded-lg inline-block">
                  Target Role: {targetRole}
                </span>
              </div>
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => searchResults.length > 0 && setShowResults(true)}
                  onBlur={() => setTimeout(() => setShowResults(false), 200)}
                  placeholder="Search for a competency..."
                  className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                />
                {searchLoading && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-emerald-500"></div>
                  </div>
                )}
              </div>
            </div>

            {/* Search Results Dropdown - Outside the glass container */}
            {showResults && searchResults.length > 0 && (
              <div className="relative z-50 w-full mt-2 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 max-h-64 overflow-y-auto">
                {searchResults.map((competency) => (
                  <button
                    key={competency.competency_id}
                    onClick={() => handleAddCareerPath(competency)}
                    className="w-full px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-700 border-b border-slate-100 dark:border-slate-700 last:border-b-0 transition-colors"
                  >
                    <div className="font-medium text-slate-800 dark:text-slate-100">
                      {competency.competency_name}
                    </div>
                    {competency.description && (
                      <div className="text-sm text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                        {competency.description}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}

            {showResults && searchQuery && searchResults.length === 0 && !searchLoading && (
              <div className="relative z-50 w-full mt-2 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 p-4 text-center text-slate-500">
                No competencies found
              </div>
            )}
          </div>

          {/* Career Paths List */}
          <div className="glass rounded-xl p-6">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4">
              Your Career Paths
              {careerPaths.length > 0 && (
                <span className="ml-2 text-sm font-normal text-slate-500">
                  ({careerPaths.length} {careerPaths.length === 1 ? 'path' : 'paths'})
                </span>
              )}
            </h2>

            {careerPathsLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
              </div>
            ) : careerPaths.length === 0 ? (
              <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                <p>No career paths added yet.</p>
                <p className="text-sm mt-2">Search for a competency above to add your first career path.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {careerPaths.map((path) => (
                  <div
                    key={path.competency_id}
                    className="flex items-center justify-between p-4 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 hover:shadow-md transition-shadow"
                  >
                    <div className="flex-1">
                      <h3 className="font-medium text-slate-800 dark:text-slate-100">
                        {path.competency_name || 'Unknown Competency'}
                      </h3>
                      {path.competency_description && (
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                          {path.competency_description}
                        </p>
                      )}
                      <p className="text-xs text-slate-400 mt-2">
                        Added: {new Date(path.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      onClick={() => handleRemoveCareerPath(path.competency_id)}
                      className="ml-4 p-2 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      title="Remove career path"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Calculate Gap Button - Always visible */}
            {!careerPathsLoading && (
              <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700">
                <button
                  onClick={handleCalculateGapAndSend}
                  disabled={analyzing || careerPaths.length === 0}
                  className="w-full px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center gap-2"
                >
                  {analyzing ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      <span>Calculating Gap & Sending to Learner AI...</span>
                    </>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span>Calculate Gap & Send to Learner AI</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
