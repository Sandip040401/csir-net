import React from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  PenTool,
  BarChart3,
  History,
  Calendar,
  Settings,
  LogOut,
  Flame,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useQuery } from '@tanstack/react-query';
import api from '../api/client';

export const Layout = () => {
  const { user, logout } = useAuth();
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
    <div className="min-h-screen bg-[#0b0f19] text-[#f3f4f6] flex flex-col md:flex-row pb-16 md:pb-0">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 border-r border-[#1f293d] bg-[#111827] sticky top-0 h-screen p-4 justify-between z-20">
        <div>
          {/* Logo / Title */}
          <div className="flex items-center gap-3 px-2 py-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center font-bold text-white shadow-lg shadow-blue-500/20">
              NET
            </div>
            <div>
              <h1 className="font-bold text-base tracking-tight text-white flex items-center gap-1.5">
                NET Tracker
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 font-mono">
                  Dec '26
                </span>
              </h1>
              <p className="text-xs text-gray-400">CSIR Life Sciences</p>
            </div>
          </div>

          {/* Quick Stats Pill */}
          <div className="p-3 mb-6 rounded-xl bg-[#161f30] border border-[#1f293d] space-y-2 text-xs">
            <div className="flex justify-between items-center text-gray-300">
              <span className="flex items-center gap-1.5">
                <Flame className="w-4 h-4 text-orange-500 fill-orange-500/30" /> Streak
              </span>
              <span className="font-bold text-white">{streak} days</span>
            </div>
            <div className="flex justify-between items-center text-gray-300">
              <span>Exam countdown</span>
              <span className="font-bold text-blue-400">{daysToExam} days</span>
            </div>
            {/* Daily Target Progress */}
            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-gray-400">Today: {todayQs}/{targetQs} Qs</span>
                <span className="font-semibold text-emerald-400">
                  {Math.round((todayQs / targetQs) * 100)}%
                </span>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden">
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
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 font-semibold'
                      : 'text-gray-400 hover:text-gray-100 hover:bg-[#161f30]'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* User bar & Logout */}
        <div className="border-t border-[#1f293d] pt-3 flex items-center justify-between px-2">
          <div className="truncate max-w-[140px]">
            <p className="text-xs font-medium text-white truncate">{user?.name || 'Aspirant'}</p>
            <p className="text-[11px] text-gray-400 truncate">{user?.email}</p>
          </div>
          <button
            onClick={logout}
            title="Log Out"
            className="p-2 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 max-w-full overflow-y-auto">
        {/* Mobile Top Header */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 bg-[#111827] border-b border-[#1f293d] sticky top-0 z-20">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white text-xs">
              NET
            </div>
            <span className="font-bold text-sm tracking-tight text-white">NET Tracker</span>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1 text-orange-400 font-medium">
              <Flame className="w-3.5 h-3.5 fill-orange-400/20" /> {streak}d
            </span>
            <span className="bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded font-mono text-[11px]">
              {daysToExam}d left
            </span>
          </div>
        </header>

        {/* Page View */}
        <div className="p-4 md:p-8 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[#111827]/95 backdrop-blur-md border-t border-[#1f293d] flex justify-around items-center px-1 py-2 z-30">
        {navLinks.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.to;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={`flex flex-col items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                isActive ? 'text-blue-400' : 'text-gray-400 hover:text-gray-200'
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
