/**
 * Header Component
 * Redesigned with modern gradient and improved styling
 */

import { Sun, Moon, Bell, Sparkles } from 'lucide-react';

/**
 * @param {{user: any, isDarkMode: boolean, setIsDarkMode: function}} props
 */
export default function Header({ user, isDarkMode, setIsDarkMode }) {
  return (
    <header className="sticky top-0 z-50 glass dark:glass-dark border-b border-slate-200/50 dark:border-slate-700/50 backdrop-blur-xl">
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-primary-50/50 via-accent-50/30 to-primary-50/50 dark:from-primary-950/30 dark:via-accent-950/20 dark:to-primary-950/30" />

      <div className="relative h-20 max-w-7xl mx-auto px-6 flex items-center justify-between">
        {/* Left: EduCore logo / brand */}
        <div className="flex items-center gap-3 group">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-primary-500 to-accent-500 rounded-xl blur-md opacity-50 group-hover:opacity-75 transition-opacity" />
            <div className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 text-white font-bold text-lg shadow-lg group-hover:scale-110 transition-transform">
              <Sparkles className="w-6 h-6" />
            </div>
          </div>
          <div className="flex flex-col leading-tight">
            <span className="font-bold text-xl bg-gradient-to-r from-primary-600 to-accent-600 dark:from-primary-400 dark:to-accent-400 bg-clip-text text-transparent">
              EduCore
            </span>
          </div>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-3">
          {/* Notifications */}
          <button
            type="button"
            className="relative group w-11 h-11 rounded-xl flex items-center justify-center bg-white/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 hover:border-primary-300 dark:hover:border-primary-700 hover:shadow-lg transition-all duration-300 hover:scale-105"
            aria-label="Notifications"
          >
            <Bell className="w-5 h-5 text-slate-700 dark:text-slate-200 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors" />
            <span className="absolute -top-1 -right-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-primary-500 to-accent-500 text-[10px] font-bold text-white shadow-lg ring-2 ring-white dark:ring-slate-900 animate-bounce-subtle">
              3
            </span>
          </button>

          {/* Theme Toggle */}
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="group relative w-11 h-11 rounded-xl flex items-center justify-center bg-white/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 hover:border-primary-300 dark:hover:border-primary-700 hover:shadow-lg transition-all duration-300 hover:scale-105 overflow-hidden"
            aria-label="Toggle theme"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-amber-400 to-orange-500 opacity-0 group-hover:opacity-10 transition-opacity" />
            {isDarkMode ? (
              <Sun className="w-5 h-5 text-amber-500 group-hover:rotate-90 transition-transform duration-500" />
            ) : (
              <Moon className="w-5 h-5 text-slate-700 group-hover:-rotate-12 transition-transform duration-500" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
