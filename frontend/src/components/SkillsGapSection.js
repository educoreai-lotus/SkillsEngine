/**
 * Skills Gap Section Component
 * Transformed from fixed sidebar to responsive inline section
 */

import { AlertCircle, AlertTriangle, CheckCircle2, Target, Zap } from 'lucide-react';

// Mock profile fallback for demo/preview when no live profile is available
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
 * Skills gap section currently uses mock data only (no live profile wiring).
 */
export default function SkillsGapSection() {
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

  // Prioritize skills (for demo - in real app this would be backend logic)
  const prioritizedSkills = allMissingMGS.map((skill, index) => ({
    ...skill,
    priority: index < 3 ? 'high' : index < 6 ? 'medium' : 'low',
  }));

  const getPriorityStyle = (priority) => {
    switch (priority) {
      case 'high':
        return {
          bg: 'bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950/30 dark:to-rose-950/30',
          border: 'border-red-200 dark:border-red-800',
          badge: 'bg-gradient-to-r from-red-500 to-rose-500',
          icon: 'text-red-600 dark:text-red-400',
        };
      case 'medium':
        return {
          bg: 'bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30',
          border: 'border-amber-200 dark:border-amber-800',
          badge: 'bg-gradient-to-r from-amber-500 to-orange-500',
          icon: 'text-amber-600 dark:text-amber-400',
        };
      default:
        return {
          bg: 'bg-gradient-to-br from-slate-50 to-gray-50 dark:from-slate-900/30 dark:to-gray-900/30',
          border: 'border-slate-200 dark:border-slate-700',
          badge: 'bg-gradient-to-r from-slate-500 to-gray-500',
          icon: 'text-slate-600 dark:text-slate-400',
        };
    }
  };

  if (!hasProfile) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-8 text-center animate-fade-in">
        <AlertCircle className="w-16 h-16 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-50 mb-2">
          No Gap Data Available
        </h3>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Connect a user profile to see skills gaps and recommendations.
        </p>
      </div>
    );
  }

  if (allMissingMGS.length === 0) {
    return (
      <div className="bg-gradient-to-br from-primary-50 to-accent-50 dark:from-primary-950/30 dark:to-accent-950/30 rounded-2xl border border-primary-200 dark:border-primary-800 p-8 text-center animate-scale-in">
        <CheckCircle2 className="w-20 h-20 text-primary-500 dark:text-primary-400 mx-auto mb-4 animate-bounce-subtle" />
        <h3 className="text-2xl font-extrabold text-primary-600 dark:text-primary-400 mb-2">
          Outstanding Progress!
        </h3>
        <p className="text-slate-700 dark:text-slate-300 text-lg">
          All skills mastered. Keep up the great work!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500 to-rose-500 flex items-center justify-center shadow-lg">
            <Target className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-50">
              Skills Gap Analysis
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {allMissingMGS.length} skills to master
            </p>
          </div>
        </div>
      </div>

      {/* Overall gap score card */}
      {relevanceScore !== null && (
        <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 to-slate-800 dark:from-slate-800 dark:to-slate-900 rounded-2xl p-6 shadow-xl border border-slate-700">
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-amber-500/20 to-transparent rounded-full blur-3xl" />

          <div className="relative z-10">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
                  Overall Gap Score
                </p>
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-extrabold text-amber-400">
                    {Math.round(relevanceScore)}%
                  </span>
                  <span className="text-sm text-slate-400">gap detected</span>
                </div>
              </div>
              <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-amber-400" />
              </div>
            </div>

            {/* Progress bar */}
            <div className="relative h-3 bg-slate-700/50 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-400 via-orange-500 to-red-500 relative"
                style={{ width: `${Math.min(Math.max(100 - relevanceScore, 0), 100)}%` }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
              </div>
            </div>

            <p className="text-xs text-slate-400 mt-3">
              Focus on high-priority skills to improve your competency coverage
            </p>
          </div>
        </div>
      )}

      {/* Priority skills grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {prioritizedSkills.map((skill, index) => {
          const styles = getPriorityStyle(skill.priority);
          return (
            <div
              key={`${skill.skill_id}-${index}`}
              className={`group relative ${styles.bg} ${styles.border} border rounded-xl p-4 hover:shadow-lg transition-all duration-300 hover:-translate-y-1 animate-slide-up`}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              {/* Priority badge */}
              <div className="absolute -top-2 -right-2">
                <div className={`${styles.badge} text-white text-[10px] font-bold uppercase px-2 py-1 rounded-full shadow-md`}>
                  {skill.priority}
                </div>
              </div>

              <div className="flex gap-3">
                {/* Number badge */}
                <div className={`w-10 h-10 rounded-lg ${styles.badge} flex items-center justify-center text-white font-bold text-sm flex-shrink-0 shadow-md group-hover:scale-110 transition-transform`}>
                  {index + 1}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-sm text-slate-900 dark:text-slate-50 mb-1 line-clamp-2 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                    {skill.skill_name}
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mb-2 line-clamp-1">
                    {skill.competencyName}
                  </p>

                  {/* Progress indicator */}
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div className="h-full w-0 bg-gradient-to-r from-primary-500 to-accent-500" />
                    </div>
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      0%
                    </span>
                  </div>
                </div>
              </div>

              {/* Hover action hint */}
              <div className="absolute inset-0 bg-gradient-to-br from-primary-500/5 to-accent-500/5 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
            </div>
          );
        })}
      </div>

      {/* Call to action */}
      <div className="bg-gradient-to-r from-primary-500 to-accent-500 rounded-2xl p-6 text-white shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center flex-shrink-0">
            <Zap className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-lg mb-1">
              Ready to Close the Gap?
            </h3>
            <p className="text-sm text-white/90">
              Start with high-priority skills to maximize your impact
            </p>
          </div>
          <button className="px-6 py-3 bg-white text-primary-600 font-bold rounded-xl hover:bg-white/90 hover:scale-105 transition-all shadow-lg">
            Get Started
          </button>
        </div>
      </div>
    </div>
  );
}
