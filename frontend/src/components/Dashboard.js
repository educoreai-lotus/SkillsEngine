/**
 * Main Dashboard Component
 * Right sidebar layout with Average Progress and Skills Gap
 */

import { useState, useMemo } from 'react';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useUserCompetencies } from '@/hooks/useUserCompetencies';
import { useCompetencyHierarchies } from '@/hooks/useCompetencyHierarchies';
import CompetencyCard from './CompetencyCard';
import SkillsGapSidebar from './SkillsGapSidebar';
import CompetencyModal from './CompetencyModal';
import CSVUploadModal from './CSVUploadModal';
import Header from './Header';
import StatsOverview from './StatsOverview';
import LoadingSkeleton from './LoadingSkeleton';
import { Upload } from 'lucide-react';

/**
 * @param {{userId: string}} props
 */
export default function Dashboard({ userId }) {
  const { profile, loading: profileLoading, error: profileError } = useUserProfile(userId);
  const { competencies, loading: competenciesLoading, error: competenciesError } = useUserCompetencies(userId);
  const [selectedCompetency, setSelectedCompetency] = useState(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);

  // Extract competency IDs for hierarchy loading
  const competencyIds = useMemo(() => {
    return competencies.map(comp => comp.competency_id);
  }, [competencies]);

  // Fetch hierarchies progressively for all competencies
  const { hierarchies, loading: hierarchyLoading } = useCompetencyHierarchies(competencyIds);

  const hasProfile = !!profile;
  // Handle different profile structures: profile.user or profile directly
  const user = hasProfile
    ? (profile.user || profile)
    : { user_name: 'Guest User', employee_type: 'regular' };
  // Case-insensitive check for trainer, also handle null/undefined
  const employeeType = user?.employee_type?.toLowerCase()?.trim();
  const isTrainer = employeeType === 'trainer';

  // Debug logging (remove in production)
  if (process.env.NODE_ENV === 'development') {
    console.log('[Dashboard] Profile check:', {
      hasProfile,
      profile: profile ? Object.keys(profile) : null,
      user: user ? { ...user, employee_type: user.employee_type } : null,
      employeeType,
      isTrainer
    });
  }

  const loading = profileLoading || competenciesLoading;
  const error = profileError || competenciesError;

  if (loading) {
    return <LoadingSkeleton />;
  }

  return (
    <div className={`min-h-screen ${isDarkMode ? 'dark bg-slate-900' : 'bg-slate-50'}`}>
      <Header
        isDarkMode={isDarkMode}
        setIsDarkMode={setIsDarkMode}
      />

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8" style={{ paddingTop: '96px' }}>
        {/* Error / empty states */}
        {error && (
          <div className="bg-red-50 dark:bg-red-950/30 border-2 border-red-200 dark:border-red-800 rounded-2xl px-6 py-4 text-red-700 dark:text-red-400 text-sm animate-slide-down">
            <strong>Unable to load live profile data.</strong> You can still browse the dashboard, but data may be incomplete.
          </div>
        )}

        {!error && !hasProfile && (
          <div className="bg-amber-50 dark:bg-amber-950/30 border-2 border-amber-200 dark:border-amber-800 rounded-2xl px-6 py-4 text-amber-700 dark:text-amber-400 text-sm animate-slide-down">
            <strong>No profile data found yet.</strong> Upload data or connect an account to get started.
          </div>
        )}

        {/* Main Content-Two Column Layout */}
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Left Column - Competencies */}
          <div className="flex-1 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-50">
                  Your Competencies
                </h2>
                <p className="text-sm md:text-base text-slate-600 dark:text-slate-400 mt-1">
                  Track your progress across {competencies.length} competencies
                </p>
              </div>

              {isTrainer && (
                <button
                  type="button"
                  onClick={() => setShowUploadModal(true)}
                  className="btn-primary inline-flex items-center gap-2"
                >
                  <Upload className="w-5 h-5" />
                  <span className="hidden sm:inline">Add Custom Skills</span>
                </button>
              )}
            </div>

            {/* Competency Cards Grid */}
            {competencies.length === 0 ? (
              <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700">
                <p className="text-slate-600 dark:text-slate-400 text-lg">
                  No competencies available yet for this profile.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {competencies.map((userComp) => (
                  <CompetencyCard
                    key={userComp.competency_id}
                    userCompetency={userComp}
                    onClick={() => setSelectedCompetency(userComp.competency_id)}
                    isLoadingHierarchy={hierarchyLoading[userComp.competency_id]}
                    hierarchyData={hierarchies[userComp.competency_id]}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Right Column - Relevance Score, Career Path & Skills Gap */}
          {hasProfile && (
            <div className="w-full lg:w-96 space-y-6">
              {/* Relevance Score Card */}
              <StatsOverview
                competencies={competencies}
                relevanceScore={profile?.relevance_score ?? user.relevance_score}
                pathCareer={user.path_career}
              />

              {/* Skills Gap Sidebar */}
              <SkillsGapSidebar profile={profile} />
            </div>
          )}
        </div>
      </main>

      {/* Competency Modal */}
      {selectedCompetency && (
        <CompetencyModal
          competencyId={selectedCompetency}
          onClose={() => setSelectedCompetency(null)}
          isDarkMode={isDarkMode}
          hierarchyData={hierarchies[selectedCompetency]}
        />
      )}

      {/* CSV Upload Modal (Trainer only) */}
      {isTrainer && showUploadModal && (
        <CSVUploadModal
          onClose={() => setShowUploadModal(false)}
          isDarkMode={isDarkMode}
        />
      )}
    </div>
  );
}
