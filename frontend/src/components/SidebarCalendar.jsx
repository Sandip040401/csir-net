import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import api from '../api/client';

const formatLocalDate = (y, m, d) => {
  const mm = String(m + 1).padStart(2, '0');
  const dd = String(d).padStart(2, '0');
  return `${y}-${mm}-${dd}`;
};

export const SidebarCalendar = ({ collapsed }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const currentDateParam = searchParams.get('date');

  const [currentMonthDate, setCurrentMonthDate] = useState(() => {
    if (currentDateParam) {
      const parts = currentDateParam.split('-').map(Number);
      if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        return new Date(parts[0], parts[1] - 1, 1);
      }
    }
    return new Date();
  });

  const year = currentMonthDate.getFullYear();
  const month = currentMonthDate.getMonth(); // 0-indexed

  // Auto-sync calendar month when currentDateParam changes
  React.useEffect(() => {
    if (currentDateParam) {
      const parts = currentDateParam.split('-').map(Number);
      if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        if (parts[0] !== year || parts[1] - 1 !== month) {
          setCurrentMonthDate(new Date(parts[0], parts[1] - 1, 1));
        }
      }
    }
  }, [currentDateParam]);

  // Format month range without UTC shift issues
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startOfMonth = formatLocalDate(year, month, 1);
  const endOfMonth = formatLocalDate(year, month, daysInMonth);

  // Fetch all sessions in the selected month
  const { data: monthSessionsData } = useQuery({
    queryKey: ['month-sessions', startOfMonth, endOfMonth],
    queryFn: async () => {
      const res = await api.get('/sessions', {
        params: { from: startOfMonth, to: endOfMonth },
      });
      return res.data.data;
    },
    staleTime: 5000,
  });

  const sessions = monthSessionsData || [];

  // Map each date to { morning: boolean, night: boolean }
  const dateStatusMap = {};
  sessions.forEach((s) => {
    if (!s.date) return;
    if (!dateStatusMap[s.date]) {
      dateStatusMap[s.date] = { morning: false, night: false };
    }
    // Has non-empty entries with questions
    const hasData = Array.isArray(s.entries) && s.entries.some((e) => Number(e.total || 0) > 0);
    if (hasData) {
      if (s.slot === 'morning') dateStatusMap[s.date].morning = true;
      if (s.slot === 'night') dateStatusMap[s.date].night = true;
    }
  });

  // Calculate calendar grid cells
  const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0 (Sun) to 6 (Sat)

  const prevMonth = (e) => {
    e.stopPropagation();
    setCurrentMonthDate(new Date(year, month - 1, 1));
  };

  const nextMonth = (e) => {
    e.stopPropagation();
    setCurrentMonthDate(new Date(year, month + 1, 1));
  };

  const monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];

  const handleDateClick = (day) => {
    const dateStr = formatLocalDate(year, month, day);
    navigate(`/?date=${dateStr}`);
  };

  const now = new Date();
  const todayStr = formatLocalDate(now.getFullYear(), now.getMonth(), now.getDate());

  // Check if a date has an unsaved draft in localStorage with questions
  const checkHasDraft = (dateStr) => {
    try {
      return Boolean(
        localStorage.getItem(`csir_draft_${dateStr}_morning`) ||
        localStorage.getItem(`csir_draft_${dateStr}_night`)
      );
    } catch (e) {
      return false;
    }
  };

  if (collapsed) {
    // Mini indicator when sidebar is collapsed
    const todayStatus = dateStatusMap[todayStr] || { morning: false, night: false };
    return (
      <div
        className="my-3 flex flex-col items-center justify-center cursor-pointer p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        title={`Today: Morning ${todayStatus.morning ? 'Uploaded' : 'Missing'} | Night ${todayStatus.night ? 'Uploaded' : 'Missing'}`}
        onClick={() => navigate(`/?date=${todayStr}`)}
      >
        <div className="w-8 h-8 rounded-lg overflow-hidden border border-slate-300 dark:border-slate-700 relative shadow-2xs">
          <svg className="w-full h-full" viewBox="0 0 32 32">
            {/* Top-left triangle: Morning */}
            <polygon
              points="0,0 32,0 0,32"
              fill={todayStatus.morning ? '#10b981' : '#ef4444'}
            />
            {/* Bottom-right triangle: Night */}
            <polygon
              points="32,0 32,32 0,32"
              fill={todayStatus.night ? '#10b981' : '#ef4444'}
            />
            {/* Thin dividing cut line */}
            <line x1="32" y1="0" x2="0" y2="32" stroke="rgba(255,255,255,0.7)" strokeWidth="1.2" />
          </svg>
        </div>
        <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 mt-1">
          {new Date().getDate()}
        </span>
      </div>
    );
  }

  return (
    <div className="p-2.5 my-3 rounded-xl bg-slate-50 dark:bg-[#161f30] border border-slate-200 dark:border-slate-800 text-xs shadow-2xs select-none">
      {/* Calendar Month Header */}
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="font-bold text-[11px] text-slate-800 dark:text-slate-200 tracking-tight">
          {monthNames[month]} {year}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={prevMonth}
            className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={nextMonth}
            className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-1 text-center text-[9px] font-bold text-slate-400 mb-1">
        <span>S</span>
        <span>M</span>
        <span>T</span>
        <span>W</span>
        <span>T</span>
        <span>F</span>
        <span>S</span>
      </div>

      {/* Days Grid */}
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: firstDayOfWeek }).map((_, i) => (
          <div key={`empty-${i}`} className="w-6 h-6" />
        ))}

        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const dateStr = formatLocalDate(year, month, day);
          const isSelected = dateStr === (currentDateParam || todayStr);
          const isToday = dateStr === todayStr;
          const isPastOrToday = dateStr <= todayStr;
          const hasDraft = checkHasDraft(dateStr);

          const status = dateStatusMap[dateStr];
          const morningGreen = status?.morning === true;
          const nightGreen = status?.night === true;

          // For all past days and today: show diagonal split with Green (uploaded) and Red (missing)!
          // For future days: show clean neutral text unless recorded in advance.
          const showColors = isPastOrToday || morningGreen || nightGreen;

          return (
            <button
              key={dateStr}
              type="button"
              onClick={() => handleDateClick(day)}
              title={`${dateStr}\nMorning Practice: ${morningGreen ? 'Uploaded (Green)' : isPastOrToday ? 'Missing (Red)' : 'Upcoming'}\nNight Mock: ${nightGreen ? 'Uploaded (Green)' : isPastOrToday ? 'Missing (Red)' : 'Upcoming'}${hasDraft ? '\n⚠️ Has unsaved local draft' : ''}`}
              className={`w-6 h-6 rounded-md relative overflow-hidden flex items-center justify-center text-[10px] font-bold transition-all ${
                isSelected
                  ? 'ring-2 ring-blue-500 ring-offset-1 dark:ring-offset-[#161f30] z-10 scale-105'
                  : 'hover:scale-105'
              } ${isToday ? 'font-extrabold underline decoration-blue-500' : ''}`}
            >
              {showColors ? (
                <>
                  {/* Diagonal Split SVG: Left/Top is Morning, Right/Bottom is Night */}
                  <svg className="absolute inset-0 w-full h-full" viewBox="0 0 24 24">
                    {/* Top-Left Half: Morning Practice */}
                    <polygon
                      points="0,0 24,0 0,24"
                      fill={morningGreen ? '#10b981' : '#ef4444'}
                    />
                    {/* Bottom-Right Half: Night Mock */}
                    <polygon
                      points="24,0 24,24 0,24"
                      fill={nightGreen ? '#10b981' : '#ef4444'}
                    />
                    {/* Diagonal cut line */}
                    <line
                      x1="24"
                      y1="0"
                      x2="0"
                      y2="24"
                      stroke="rgba(255,255,255,0.7)"
                      strokeWidth="1"
                    />
                  </svg>
                  {/* Text on top with shadow for high contrast */}
                  <span className="relative z-10 text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)] text-[9px]">
                    {day}
                  </span>
                </>
              ) : (
                <span className="text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400">
                  {day}
                </span>
              )}

              {/* Unsaved draft indicator dot */}
              {hasDraft && (
                <span
                  className="absolute top-0 right-0 w-2 h-2 rounded-full bg-amber-400 border border-white dark:border-slate-900 z-20 shadow-xs"
                  title="Unsaved local draft"
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-2.5 pt-2 border-t border-slate-200 dark:border-slate-800/80 flex items-center justify-between text-[8px] text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
          <span>Uploaded</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
          <span>Missing</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
          <span>Draft</span>
        </div>
        <span className="text-[7.5px] text-slate-400">◤M ◢N</span>
      </div>
    </div>
  );
};
