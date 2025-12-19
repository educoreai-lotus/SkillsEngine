/**
 * Customize Career Path Page (HR Only)
 *
 * Allows HR to customize career paths for users by selecting competencies/topics
 * from a hierarchical tree structure.
 *
 * Domain Rules:
 * - company_id = company ID (company performing the edit) - used for authorization only
 * - learnerId = learner (whose career path is edited) - used for all API operations
 * - All career path APIs operate on the learner (learnerId), never the company
 * - Authorization: The learner's company_id must match the company_id parameter
 *
 * URL Parameters:
 * - company_id: The company ID (from Directory redirect)
 * - learnerId: The learner user ID (from Directory redirect)
 *
 * Example URL: /career-path?company_id=<company-id>&learnerId=<learner-id>
 */

import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useUserProfile } from '@/hooks/useUserProfile';
import CareerPathHierarchyBrowser from '@/components/CareerPathHierarchyBrowser';

const DEFAULT_USER_ID = '550e8400-e29b-41d4-a716-446655440000';

export default function CareerPathPage() {
  const [companyId, setCompanyId] = useState(null);
  const [learnerId, setLearnerId] = useState(null);
  const [loading, setLoading] = useState(true);

  // Extract companyId and learnerId from window.location.search
  // Domain rule: company_id = company ID (company performing the edit)
  // Domain rule: learnerId = learner (whose career path is edited)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const searchParams = new URLSearchParams(window.location.search);
    const extractedCompanyId = searchParams.get('company_id');
    const extractedLearnerId = searchParams.get('learnerId');

    // Validate that learnerId exists
    if (!extractedLearnerId) {
      console.error('learnerId is required in URL parameters');
      setLoading(false);
      return;
    }

    // Store both values in local state
    setCompanyId(extractedCompanyId);
    setLearnerId(extractedLearnerId);
    setLoading(false);
  }, []);

  // Get learner user (learnerId) - used for all API operations
  // Domain rule: All career path APIs operate on the learner (learnerId), never the company
  const currentUserId = learnerId || DEFAULT_USER_ID;
  const { profile, loading: profileLoading } = useUserProfile(currentUserId);
  const user = profile?.user || profile;
  const targetRole = user?.path_career || user?.career_path_goal;
  const userName = user?.user_name || user?.userName;

  // Authorization: Verify learner belongs to the company
  // Domain rule: The learner's company_id must match the company_id parameter
  const learnerCompanyId = user?.company_id;
  const isAuthorized = !companyId || !learnerCompanyId || learnerCompanyId === companyId;

  // Career path state
  const [careerPaths, setCareerPaths] = useState([]);
  const [careerPathsLoading, setCareerPathsLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  // Fetch career paths for the learner
  // Domain rule: All career path APIs operate on the learner (learnerId), never the company
  // Uses ONLY learnerId - does NOT use companyId in the request
  // Renders the career path editor using the learner data returned from the API
  const fetchCareerPaths = useCallback(async () => {
    if (!learnerId) return;

    setCareerPathsLoading(true);
    try {
      // Call GET /api/user-career-path/{learnerId}/all to get all competencies in the learner's current career path
      // Uses ONLY learnerId - does NOT use companyId in this request
      const response = await api.getAllCareerPaths(learnerId);
      // Handle response - API returns { success: true, data: careerPaths[] } or { success: false, error: ... }
      if (response && response.data) {
        // API returns an array of career path objects (all competencies in the learner's career path)
        setCareerPaths(Array.isArray(response.data) ? response.data : []);
      } else {
        setCareerPaths([]);
      }
    } catch (error) {
      console.error('Error fetching career paths:', error);
      setCareerPaths([]);
    } finally {
      setCareerPathsLoading(false);
    }
  }, [learnerId]);

  useEffect(() => {
    if (learnerId) {
      fetchCareerPaths();
    }
  }, [learnerId, fetchCareerPaths]);

  // Add competency from hierarchy browser
  // Domain rule: All career path APIs operate on the learner (learnerId), never the company
  const handleAddCompetency = async (competency) => {
    try {
      await api.addCareerPath(learnerId, competency.competency_id);
      fetchCareerPaths(); // Refresh the list
    } catch (error) {
      console.error('Error adding competency:', error);
      alert('Failed to add competency. It may already exist.');
    }
  };

  // Calculate gap and send to Learner AI, then redirect
  // Domain rule: All career path APIs operate on the learner (learnerId), never the company
  const handleCalculateGapAndSend = async () => {
    if (careerPaths.length === 0) {
      alert('Please add at least one competency to your career path first.');
      return;
    }

    try {
      setAnalyzing(true);
      await api.calculateGapAndSend(learnerId);
      // Redirect to external Directory MS page
      window.location.href = `https://directory-psi-mocha.vercel.app/company/${companyId}`;
    } catch (error) {
      console.error('Error calculating gap and sending to Learner AI:', error);
      alert('Failed to calculate gap and send to Learner AI.');
      setAnalyzing(false);
    }
  };

  // Remove competency from learner's career path
  // Domain rule: All career path APIs operate on the learner (learnerId), never the company
  const handleRemoveCompetency = async (competencyId) => {
    if (!confirm('Remove this competency from the user\'s career path?')) return;

    try {
      await api.deleteCareerPath(learnerId, competencyId);
      fetchCareerPaths();
    } catch (error) {
      console.error('Error removing competency:', error);
      alert('Failed to remove competency.');
    }
  };

  // Get list of added competency IDs for the hierarchy browser
  const addedCompetencyIds = careerPaths.map(path => path.competency_id);

  if (loading || !learnerId || profileLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  // Company authorization check
  // Domain rule: The learner's company_id must match the company_id parameter
  if (!isAuthorized) {
    return (
      <>
        <Head>
          <title>Access Denied - Skills Engine</title>
        </Head>
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center">
          <div className="max-w-md mx-auto px-4 text-center">
            <div className="glass rounded-xl p-8">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-red-500 mx-auto mb-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">
                Access Denied
              </h1>
              <p className="text-slate-600 dark:text-slate-400 mb-6">
                You do not have permission to edit this user's career path. The user must belong to your company.
              </p>
              <Link href="/" className="inline-block px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors">
                Back to Dashboard
              </Link>
            </div>
          </div>
        </div>
      </>
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
              Customize Career Path
            </h1>
            {userName && (
              <p className="text-slate-600 dark:text-slate-400 mt-2">
                Editing career path for <span className="font-semibold text-slate-800 dark:text-slate-100">{userName}</span>
                {targetRole && <span className="ml-2">({targetRole})</span>}
              </p>
            )}
            <p className="text-slate-600 dark:text-slate-400 mt-2">
              Select competencies and topics for the learner to learn.
            </p>
          </div>

          {/* Hierarchy Browser */}
          <div className="mb-8">
            <CareerPathHierarchyBrowser
              userId={learnerId}
              targetRole={targetRole}
              userName={userName}
              onAddCompetency={handleAddCompetency}
              onRemoveCompetency={handleRemoveCompetency}
              addedCompetencyIds={addedCompetencyIds}
            />
          </div>

          {/* Career Paths List */}
          <div className="glass rounded-xl p-6">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4">
              Topics in User Career Path
              {careerPaths.length > 0 && (
                <span className="ml-2 text-sm font-normal text-slate-500">
                  ({careerPaths.length} {careerPaths.length === 1 ? 'topic' : 'topics'})
                </span>
              )}
            </h2>

            {careerPathsLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
              </div>
            ) : careerPaths.length === 0 ? (
              <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                <p>No topics assigned yet.</p>
                <p className="text-sm mt-2">Select competencies from the hierarchy above to add topics for the user to learn.</p>
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
                      <p className="text-xs text-slate-400 mt-2">
                        Assigned: {new Date(path.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      onClick={() => handleRemoveCompetency(path.competency_id)}
                      className="ml-4 p-2 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      title="Remove competency"
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
