import React from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  PenTool,
  BarChart3,
  History,
  Calendar,
  Settings,
  Flame,
  Sun,
  Moon,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useQuery } from '@tanstack/react-query';
import api from '../api/client';

export const Layout = () => {
  const { user } = useAuth();
  const { theme, toggleTheme, isDark } = useTheme();
  const location = useLocation();

  const { data: kpiData } = useQuery({
    queryKey: ['quick-kpis'],
    queryFn: async () => {
      const res = await api.get('/analytics/overview');
      return res.data.data;
    },
    staleTime: 30000,
  });

  const daysToExam = kpiData?.countdown?.daysToExam ?? '--';
  const todayQs = kpiData?.volume?.todayQuestions ?? 0;
  const targetQs = user?.dailyTarget ?? 100;
  const streak = kpiData?.volume?.currentStreak ?? 0;

  const navLinks = [
    { to: '/', label: 'Data Log', icon: PenTool },
    { to: '/analytics', label: 'Analytics', icon: BarChart3 },
    { to: '/history', label: 'History', icon: History },
    { to: '/planner', label: 'Planner', icon: Calendar },
    { to: '/settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0b0f19] text-slate-800 dark:text-slate-100 flex flex-col md:flex-row pb-16 md:pb-0 transition-colors">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] sticky top-0 h-screen p-4 justify-between z-20 shadow-xs">
        <div>
          {/* Logo / Title & Theme Toggle */}
          <div className="flex items-center justify-between px-2 py-3 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center font-bold text-white shadow-md shadow-blue-500/20">
                NET
              </div>
              <div>
                <h1 className="font-bold text-base tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5">
                  NET Tracker
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-semibold border border-blue-200 dark:border-blue-800">
                    Dec '26
                  </span>
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">CSIR Life Sciences</p>
              </div>
            </div>

            {/* Quick Dark / Light Toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              title={isDark ? 'Switch to Light mode' : 'Switch to Dark mode'}
              className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
            </button>
          </div>

          {/* Quick Stats Pill */}
          <div className="p-3 mb-6 rounded-xl bg-slate-50 dark:bg-[#161f30] border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
            <div className="flex justify-between items-center text-slate-600 dark:text-slate-300">
              <span className="flex items-center gap-1.5 font-medium">
                <Flame className="w-4 h-4 text-orange-500 fill-orange-500" /> Streak
              </span>
              <span className="font-bold text-slate-900 dark:text-white">{streak} days</span>
            </div>
            <div className="flex justify-between items-center text-slate-600 dark:text-slate-300 font-medium">
              <span>Exam countdown</span>
              <span className="font-bold text-blue-600 dark:text-blue-400">{daysToExam} days</span>
            </div>
            {/* Daily Target Progress */}
            <div>
              <div className="flex justify-between text-[11px] mb-1 font-medium">
                <span className="text-slate-500 dark:text-slate-400">Today: {todayQs}/{targetQs} Qs</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  {Math.round((todayQs / targetQs) * 100)}%
                </span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, (todayQs / targetQs) * 100)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Nav links */}
          <nav className="space-y-1">
            {navLinks.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.to;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-sm transition-all duration-150 ${
                    isActive
                      ? 'bg-blue-50 dark:bg-blue-600/20 text-blue-700 dark:text-blue-300 font-bold border border-blue-200 dark:border-blue-800'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* User bar & Theme toggle */}
        <div className="border-t border-slate-200 dark:border-slate-800 pt-3 flex items-center justify-between px-2 text-xs text-slate-500 dark:text-slate-400">
          <div>
            <p className="font-semibold text-slate-900 dark:text-white">{user?.name || 'CSIR Aspirant'}</p>
            <p className="text-[11px] text-slate-400">Preparation Mode Active</p>
          </div>

          <button
            type="button"
            onClick={toggleTheme}
            className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-[11px] font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            {isDark ? <Sun className="w-3 h-3 text-amber-400" /> : <Moon className="w-3 h-3 text-slate-500" />}
            <span>{isDark ? 'Light' : 'Dark'}</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 max-w-full overflow-y-auto">
        {/* Mobile Top Header */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 bg-white dark:bg-[#111827] border-b border-slate-200 dark:border-slate-800 sticky top-0 z-20 shadow-xs">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white text-xs shadow-xs">
              NET
            </div>
            <span className="font-bold text-sm tracking-tight text-slate-900 dark:text-white">NET Tracker</span>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <button
              type="button"
              onClick={toggleTheme}
              className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
            >
              {isDark ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5" />}
            </button>
            <span className="flex items-center gap-1 text-orange-600 dark:text-orange-400 font-semibold">
              <Flame className="w-3.5 h-3.5 fill-orange-500 text-orange-500" /> {streak}d
            </span>
            <span className="bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 px-2 py-0.5 rounded-md font-mono text-[11px] font-semibold">
              {daysToExam}d left
            </span>
          </div>
        </header>

        {/* Page View with dynamic 100% width */}
        <div className="p-4 md:p-6 w-full">
          <Outlet />
        </div>
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-[#111827]/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 flex justify-around items-center px-1 py-2 z-30 shadow-lg">
        {navLinks.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.to;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={`flex flex-col items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                isActive
                  ? 'text-blue-600 dark:text-blue-400 font-bold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px]">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
};
