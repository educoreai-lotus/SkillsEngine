/**
 * Header Component
 * Following EDUCORE AI Design System Specification
 */

import { Sun, Moon, Bell } from 'lucide-react';
import Image from 'next/image';

/**
 * @param {{isDarkMode: boolean, setIsDarkMode: function}} props
 */
export default function Header({ isDarkMode, setIsDarkMode }) {
  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md transition-all duration-300 ease-in-out"
      style={{
        height: '80px',
        minHeight: '80px',
        maxHeight: '80px',
        width: '100%',
        backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
        borderBottom: isDarkMode ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid #e2e8f0',
        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
        fontSize: '16px',
        lineHeight: '24px',
      }}
    >
      <div
        className="h-full flex items-center justify-between mx-auto"
        style={{
          maxWidth: '1280px',
          width: '100%',
          paddingLeft: '32px',
          paddingRight: '32px',
        }}
      >
        {/* Left: EduCore logo / brand */}
        <div className="flex items-center gap-3">
          {isDarkMode ? (
            <Image
              src="/EduCore_AI_Darkmood.jpeg"
              alt="EduCore AI Logo"
              width={92}
              height={56}
              className="object-contain"
            />
          ) : (
            <Image
              src="/EduCore_AI_LightMood.jpeg"
              alt="EduCore AI Logo"
              width={92}
              height={56}
              className="object-contain"
            />
          )}
          <span
            className="font-bold cursor-pointer"
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: '1.5rem',
              fontWeight: 700,
              background: 'linear-gradient(135deg, #065f46, #047857)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            EduCore
          </span>
        </div>

        {/* Right: Header Controls */}
        <div className="flex items-center gap-4">
          {/* Notifications Button */}
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
