import React, { useState } from 'react';
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
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useQuery } from '@tanstack/react-query';
import api from '../api/client';
import { SidebarCalendar } from './SidebarCalendar';

export const Layout = () => {
  const { user } = useAuth();
  const { toggleTheme, isDark } = useTheme();
  const location = useLocation();

  // Collapsible sidebar state with localStorage persistence
  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem('sidebar_collapsed') === 'true';
  });

  const toggleSidebar = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('sidebar_collapsed', String(next));
      return next;
    });
  };

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
      {/* Desktop Collapsible Sidebar */}
      <aside
        className={`hidden md:flex flex-col border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] sticky top-0 h-screen justify-between z-20 shadow-xs transition-all duration-200 ${
          collapsed ? 'w-16 p-2' : 'w-60 p-4'
        }`}
      >
        <div className="overflow-y-auto pr-0.5 custom-scrollbar flex-1">
          {/* Header & Logo with Collapse Button */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-9 h-9 shrink-0 rounded-xl bg-blue-600 flex items-center justify-center font-bold text-white shadow-md shadow-blue-500/20 text-xs">
                NET
              </div>
              {!collapsed && (
                <div className="truncate">
                  <h1 className="font-bold text-sm tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5">
                    NET Tracker
                    <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-semibold border border-blue-200 dark:border-blue-800">
                      Dec '26
                    </span>
                  </h1>
                  <p className="text-[11px] text-slate-400 font-medium truncate">CSIR Life Sciences</p>
                </div>
              )}
            </div>

            {/* Collapse / Expand toggle button */}
            <button
              type="button"
              onClick={toggleSidebar}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          </div>

          {/* Quick Stats (Hidden if collapsed) */}
          {!collapsed && (
            <div className="p-3 mb-5 rounded-xl bg-slate-50 dark:bg-[#161f30] border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between items-center text-slate-600 dark:text-slate-300">
                <span className="flex items-center gap-1 font-medium">
                  <Flame className="w-3.5 h-3.5 text-orange-500 fill-orange-500" /> Streak
                </span>
                <span className="font-bold text-slate-900 dark:text-white">{streak} days</span>
              </div>
              <div className="flex justify-between items-center text-slate-600 dark:text-slate-300 font-medium">
                <span>Countdown</span>
                <span className="font-bold text-blue-600 dark:text-blue-400">{daysToExam} days</span>
              </div>
              <div>
                <div className="flex justify-between text-[10px] mb-1 font-medium">
                  <span className="text-slate-400">Today: {todayQs}/{targetQs}</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                    {Math.round((todayQs / targetQs) * 100)}%
                  </span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1 overflow-hidden">
                  <div
                    className="bg-emerald-500 h-1 rounded-full transition-all"
                    style={{ width: `${Math.min(100, (todayQs / targetQs) * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Nav links */}
          <nav className="space-y-1">
            {navLinks.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.to;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  title={collapsed ? item.label : undefined}
                  className={`flex items-center rounded-xl font-medium text-xs transition-all ${
                    collapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2'
                  } ${
                    isActive
                      ? 'bg-blue-50 dark:bg-blue-600/20 text-blue-700 dark:text-blue-300 font-bold border border-blue-200 dark:border-blue-800'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {!collapsed && <span>{item.label}</span>}
                </NavLink>
              );
            })}
          </nav>

          {/* Interactive Activity Calendar with Morning/Night Diagonal Status */}
          <SidebarCalendar collapsed={collapsed} />
        </div>

        {/* User bar & Theme toggle */}
        <div
          className={`border-t border-slate-200 dark:border-slate-800 pt-3 flex items-center ${
            collapsed ? 'flex-col gap-2 justify-center' : 'justify-between px-1'
          }`}
        >
          {!collapsed && (
            <div className="truncate text-xs">
              <p className="font-bold text-slate-900 dark:text-white truncate">{user?.name || 'CSIR Aspirant'}</p>
              <p className="text-[10px] text-slate-400">Active</p>
            </div>
          )}

          <button
            type="button"
            onClick={toggleTheme}
            title={isDark ? 'Switch to Light mode' : 'Switch to Dark mode'}
            className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 max-w-full overflow-y-auto">
        {/* Mobile Top Header */}
        <header className="md:hidden flex items-center justify-between px-4 py-2.5 bg-white dark:bg-[#111827] border-b border-slate-200 dark:border-slate-800 sticky top-0 z-20 shadow-xs">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white text-xs">
              NET
            </div>
            <span className="font-bold text-sm text-slate-900 dark:text-white">NET Tracker</span>
          </div>

          <div className="flex items-center gap-2.5 text-xs">
            <button
              type="button"
              onClick={toggleTheme}
              className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
            >
              {isDark ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5" />}
            </button>
            <span className="flex items-center gap-1 text-orange-600 dark:text-orange-400 font-semibold text-[11px]">
              <Flame className="w-3.5 h-3.5 fill-orange-500 text-orange-500" /> {streak}d
            </span>
            <span className="bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 px-2 py-0.5 rounded text-[11px] font-semibold">
              {daysToExam}d left
            </span>
          </div>
        </header>

        {/* Dynamic Page Container */}
        <div className="p-3 md:p-5 w-full">
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
                  : 'text-slate-500 dark:text-slate-400'
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
