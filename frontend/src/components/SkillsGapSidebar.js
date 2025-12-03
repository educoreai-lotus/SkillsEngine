/**
 * Skills Gap Sidebar Component
 * Modern redesign with sticky positioning on the right side
 */

import { AlertCircle, AlertTriangle, CheckCircle2, Target, ArrowRight } from 'lucide-react';

// Mock profile fallback for demo/preview until real gap analysis is wired
const MOCK_PROFILE = {
  user_id: '550e8400-e29b-41d4-a716-446655440000',
  user_name: 'John Doe',
  company_id: 'company_456',
  relevance_score: 75.5,
  gap_analysis: {
    full_stack_development: {
      missing_mgs: {
        'Full Stack Development': [
          { skill_id: 'skill_2', skill_name: 'React' },
          { skill_id: 'skill_3', skill_name: 'Node.js' },
        ],
      },
    },
    database_management: {
      missing_mgs: {
        'Database Management': [
          { skill_id: 'skill_5', skill_name: 'PostgreSQL' },
          { skill_id: 'skill_6', skill_name: 'Index optimization' },
        ],
      },
    },
  },
};

/**
 * Currently uses only mock gap data (no live backend wiring yet).
 */
export default function SkillsGapSidebar() {
  const effectiveProfile = MOCK_PROFILE;
  const hasProfile = !!effectiveProfile;
  const gapAnalysis = effectiveProfile?.gap_analysis || {};
  const allMissingMGS = [];
  const relevanceScore = typeof effectiveProfile?.relevance_score === 'number'
    ? effectiveProfile.relevance_score
    : null;

  // Collect all missing MGS from all competencies
  Object.values(gapAnalysis).forEach((gap) => {
    if (gap.missing_mgs) {
      Object.entries(gap.missing_mgs).forEach(([competencyName, skills]) => {
        skills.forEach((skill) => {
          allMissingMGS.push({
            ...skill,
            competencyName,
          });
        });
      });
    }
  });

  // Get priority style
  const getPriorityBadge = (index) => {
    if (index < 3) return { bg: 'bg-red-500', label: 'High' };
    if (index < 6) return { bg: 'bg-amber-500', label: 'Medium' };
    return { bg: 'bg-slate-500', label: 'Low' };
  };

  if (!hasProfile) {
    return (
      <div className="lg:sticky lg:top-24 space-y-4">
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 text-center">
          <AlertCircle className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
            No gap data available yet
          </p>
        </div>
      </div>
    );
  }

  if (allMissingMGS.length === 0) {
    return (
      <div className="lg:sticky lg:top-24 space-y-4">
        <div className="bg-gradient-to-br from-primary-50 to-accent-50 dark:from-primary-950/30 dark:to-accent-950/30 rounded-2xl border border-primary-200 dark:border-primary-800 p-6 text-center">
          <CheckCircle2 className="w-16 h-16 text-primary-500 dark:text-primary-400 mx-auto mb-3 animate-bounce-subtle" />
          <h3 className="text-lg font-bold text-primary-600 dark:text-primary-400 mb-1">
            All Skills Mastered!
          </h3>
          <p className="text-sm text-slate-700 dark:text-slate-300">
            Outstanding progress!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="lg:sticky lg:top-24 space-y-4">
      {/* Header Card */}
      <div className="bg-gradient-to-br from-red-500 to-rose-500 rounded-2xl p-6 text-white shadow-xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
            <Target className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Skills Gap</h2>
            <p className="text-sm text-white/90">
              {allMissingMGS.length} skills to master
            </p>
          </div>
        </div>
      </div>

      {/* Overall Gap Score Card */}
      {relevanceScore !== null && (
        <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 to-slate-800 dark:from-slate-800 dark:to-slate-900 rounded-2xl p-6 shadow-xl border border-slate-700">
          {/* Decorative element */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-amber-500/20 to-transparent rounded-full blur-2xl" />

          <div className="relative z-10">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">
                  Overall Gap Score
                </p>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-extrabold text-amber-400">
                    {Math.round(100 - relevanceScore)}%
                  </span>
                </div>
              </div>
              <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
              </div>
            </div>

            {/* Progress bar */}
            <div className="relative h-2 bg-slate-700/50 rounded-full overflow-hidden mb-2">
              <div
                className="h-full bg-gradient-to-r from-amber-400 via-orange-500 to-red-500"
                style={{ width: `${Math.min(Math.max(100 - relevanceScore, 0), 100)}%` }}
              />
            </div>

            <p className="text-xs text-slate-400">
              Focus on priority skills
            </p>
          </div>
        </div>
      )}

      {/* Skills List */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
          <h3 className="font-bold text-slate-900 dark:text-slate-50">
            Missing Skills
          </h3>
        </div>
        <div className="divide-y divide-slate-200 dark:divide-slate-700 max-h-[600px] overflow-y-auto">
          {allMissingMGS.slice(0, 15).map((skill, index) => {
            const priority = getPriorityBadge(index);
            return (
              <div
                key={`${skill.skill_id}-${index}`}
                className="p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors group cursor-pointer"
              >
                <div className="flex gap-3">
                  {/* Number Badge */}
                  <div className={`w-8 h-8 rounded-lg ${priority.bg} flex items-center justify-center text-white font-bold text-sm flex-shrink-0 shadow-md`}>
                    {index + 1}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h4 className="font-semibold text-sm text-slate-900 dark:text-slate-50 line-clamp-2 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                        {skill.skill_name}
                      </h4>
                      <span className={`${priority.bg} text-white text-[10px] font-bold uppercase px-2 py-0.5 rounded-full flex-shrink-0`}>
                        {priority.label}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-1 mb-2">
                      {skill.competencyName}
                    </p>

                    {/* Progress bar */}
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div className="h-full w-0 bg-gradient-to-r from-primary-500 to-accent-500" />
                      </div>
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                        0%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {allMissingMGS.length > 15 && (
          <div className="p-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700">
            <button className="w-full text-sm font-semibold text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 flex items-center justify-center gap-1 transition-colors">
              <span>View all {allMissingMGS.length} skills</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
