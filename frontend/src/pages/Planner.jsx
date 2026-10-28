import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Calendar as CalendarIcon,
  RotateCw,
  CheckCircle,
  BookOpen,
  Sparkles,
} from 'lucide-react';
import api from '../api/client';

export const Planner = () => {
  const queryClient = useQueryClient();

  const { data: plannerData, isLoading } = useQuery({
    queryKey: ['planner'],
    queryFn: async () => {
      const res = await api.get('/planner');
      return res.data.data;
    },
  });

  const { data: chaptersData } = useQuery({
    queryKey: ['chapters'],
    queryFn: async () => {
      const res = await api.get('/chapters');
      return res.data.data;
    },
  });

  const chapters = chaptersData || [];
  const days = plannerData?.days || [];

  const regenerateMutation = useMutation({
    mutationFn: async (fromToday) => {
      const res = await api.post('/planner/generate', { fromToday });
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['planner'] });
    },
  });

  const savePlannerMutation = useMutation({
    mutationFn: async (updatedDays) => {
      const res = await api.put('/planner', { days: updatedDays });
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['planner'] });
    },
  });

  const toggleDayComplete = (dateStr) => {
    const updated = days.map((d) =>
      d.date === dateStr ? { ...d, completed: !d.completed } : d
    );
    savePlannerMutation.mutate(updated);
  };

  const handleDayChapterChange = (dateStr, chapterId) => {
    const updated = days.map((d) => {
      if (d.date === dateStr) {
        return {
          ...d,
          chapterIds: chapterId ? [chapterId] : [],
        };
      }
      return d;
    });
    savePlannerMutation.mutate(updated);
  };

  return (
    <div className="space-y-6 animate-fade-in text-slate-800">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            Strategic Study Planner
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 font-semibold border border-blue-200">
              Nov 15 – Dec 19
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Weakness-weighted syllabus distribution with a dedicated 5-day final revision window
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => regenerateMutation.mutate(true)}
            disabled={regenerateMutation.isPending}
            className="px-3.5 py-2 bg-white dark:bg-[#111827] hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2 transition-colors disabled:opacity-50 shadow-xs"
          >
            <RotateCw className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>{regenerateMutation.isPending ? 'Regenerating...' : 'Regenerate from Today'}</span>
          </button>
        </div>
      </div>

      {/* Strategy Summary Pills */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
        <div className="p-3 bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl flex items-center gap-3 shadow-xs">
          <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 flex items-center justify-center">
            <BookOpen className="w-4 h-4" />
          </div>
          <div>
            <span className="text-slate-500 dark:text-slate-400 block font-medium">Distribution Logic</span>
            <span className="font-bold text-slate-900 dark:text-white">Weight × Error Deficit Priority</span>
          </div>
        </div>

        <div className="p-3 bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl flex items-center gap-3 shadow-xs">
          <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-900/40 text-purple-600 dark:text-purple-300 flex items-center justify-center">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <span className="text-slate-500 dark:text-slate-400 block font-medium">General Aptitude Buffer</span>
            <span className="font-bold text-slate-900 dark:text-white">Part A paired every 3rd day</span>
          </div>
        </div>

        <div className="p-3 bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl flex items-center gap-3 shadow-xs">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-300 flex items-center justify-center">
            <CheckCircle className="w-4 h-4" />
          </div>
          <div>
            <span className="text-slate-500 dark:text-slate-400 block font-medium">Final Countdown</span>
            <span className="font-bold text-slate-900 dark:text-white">5-Day High-Yield Revision Window</span>
          </div>
        </div>
      </div>

      {/* Calendar Schedule Grid */}
      {isLoading ? (
        <div className="text-center py-12 text-slate-400">Loading schedule...</div>
      ) : days.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-[#111827] rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-400 shadow-xs">
          <CalendarIcon className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
          <p className="font-semibold text-slate-700 dark:text-slate-300">No schedule generated yet</p>
          <button
            onClick={() => regenerateMutation.mutate(false)}
            className="mt-3 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl"
          >
            Generate Initial Schedule
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {days.map((dayItem, idx) => {
            const isToday = dayItem.date === new Date().toISOString().split('T')[0];
            const ch = dayItem.chapterIds?.[0];

            return (
              <div
                key={dayItem.date}
                className={`p-4 rounded-xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                  dayItem.completed
                    ? 'bg-slate-100 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 opacity-60'
                    : isToday
                    ? 'bg-blue-50/70 dark:bg-blue-950/40 border-blue-300 dark:border-blue-800 shadow-sm'
                    : dayItem.isRevision
                    ? 'bg-purple-50/60 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800'
                    : 'bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 shadow-xs'
                }`}
              >
                <div className="flex items-center gap-3 min-w-[180px]">
                  <button
                    onClick={() => toggleDayComplete(dayItem.date)}
                    className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                      dayItem.completed
                        ? 'bg-emerald-600 border-emerald-600 text-white'
                        : 'border-slate-300 dark:border-slate-600 hover:border-slate-400 bg-white dark:bg-[#161f30]'
                    }`}
                  >
                    {dayItem.completed && <CheckCircle className="w-4 h-4" />}
                  </button>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold text-slate-900 dark:text-white">{dayItem.date}</span>
                      {isToday && (
                        <span className="text-[10px] bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-1.5 py-0.2 rounded font-bold uppercase">
                          Today
                        </span>
                      )}
                      {dayItem.isRevision && (
                        <span className="text-[10px] bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 px-1.5 py-0.2 rounded font-bold uppercase">
                          Revision
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Day {idx + 1}</span>
                  </div>
                </div>

                <div className="flex-1">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <select
                      value={ch?._id || ch || ''}
                      onChange={(e) => handleDayChapterChange(dayItem.date, e.target.value)}
                      className="px-2.5 py-1.5 bg-slate-50 dark:bg-[#161f30] border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-800 dark:text-slate-200 font-medium focus:outline-none focus:border-blue-500 max-w-sm truncate"
                    >
                      <option value="">-- Choose Focus Chapter --</option>
                      {chapters.map((c) => (
                        <option key={c._id} value={c._id}>
                          {c.isPartA ? c.name : `Ch ${c.no}: ${c.name}`}
                        </option>
                      ))}
                    </select>

                    <span className="text-xs text-slate-500 dark:text-slate-400 italic truncate">{dayItem.notes}</span>
                  </div>
                </div>

                <div className="text-right text-xs text-slate-500 dark:text-slate-400 font-mono">
                  Target: <strong className="text-slate-800 dark:text-slate-200">{dayItem.targetQuestions || 100} Qs</strong>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
