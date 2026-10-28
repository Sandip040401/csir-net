import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Calendar,
  Download,
  Trash2,
  ChevronDown,
  ChevronUp,
  Search,
} from 'lucide-react';
import api from '../api/client';

export const History = () => {
  const queryClient = useQueryClient();

  const [dateFilter, setDateFilter] = useState('');
  const [kindFilter, setKindFilter] = useState('');
  const [chapterFilter, setChapterFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSessionId, setExpandedSessionId] = useState(null);

  const { data: chaptersData } = useQuery({
    queryKey: ['chapters'],
    queryFn: async () => {
      const res = await api.get('/chapters');
      return res.data.data;
    },
  });

  const { data: sessionsData, isLoading } = useQuery({
    queryKey: ['sessions', dateFilter, kindFilter, chapterFilter],
    queryFn: async () => {
      const params = {};
      if (dateFilter) params.from = dateFilter;
      if (kindFilter) params.kind = kindFilter;
      if (chapterFilter) params.chapterId = chapterFilter;
      const res = await api.get('/sessions', { params });
      return res.data.data;
    },
  });

  const sessions = sessionsData || [];

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      await api.delete(`/sessions/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      queryClient.invalidateQueries({ queryKey: ['quick-kpis'] });
    },
  });

  const handleExportCSV = async () => {
    try {
      const response = await api.get('/export?format=csv', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `csir_net_tracker_sessions_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (e) {
      alert('Failed to export CSV');
    }
  };

  const filteredSessions = sessions.filter((s) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const chName = (s.chapterId?.name || '').toLowerCase();
    const hasTopic = (s.entries || []).some(
      (e) =>
        (e.topicName || '').toLowerCase().includes(q) ||
        (e.topicCode || '').toLowerCase().includes(q)
    );
    return chName.includes(q) || hasTopic;
  });

  return (
    <div className="space-y-6 animate-fade-in text-slate-800">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Session History</h2>
          <p className="text-xs text-slate-500">
            View, audit, search, and export past data logs across all days
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          className="px-4 py-2 bg-white dark:bg-[#111827] hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2 self-start sm:self-auto transition-colors shadow-xs"
        >
          <Download className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <span>Export All to CSV</span>
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs shadow-xs">
        <div>
          <label className="block text-slate-500 dark:text-slate-400 mb-1 font-semibold">Search Topic / Keyword</label>
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="e.g. Replication, Ch 3..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-2 bg-slate-50 dark:bg-[#161f30] border border-slate-200 dark:border-slate-800 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-slate-500 dark:text-slate-400 mb-1 font-semibold">Filter by Chapter</label>
          <select
            value={chapterFilter}
            onChange={(e) => setChapterFilter(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 dark:bg-[#161f30] border border-slate-200 dark:border-slate-800 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
          >
            <option value="">All Chapters</option>
            {(chaptersData || []).map((ch) => (
              <option key={ch._id} value={ch._id}>
                {ch.isPartA ? ch.name : `Ch ${ch.no}: ${ch.name}`}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-slate-500 dark:text-slate-400 mb-1 font-semibold">Session Kind</label>
          <select
            value={kindFilter}
            onChange={(e) => setKindFilter(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 dark:bg-[#161f30] border border-slate-200 dark:border-slate-800 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
          >
            <option value="">All (Practice & Mocks)</option>
            <option value="practice">Morning Practice only</option>
            <option value="mock">Night Mock only</option>
          </select>
        </div>

        <div>
          <label className="block text-slate-500 dark:text-slate-400 mb-1 font-semibold">From Date</label>
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 dark:bg-[#161f30] border border-slate-200 dark:border-slate-800 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* Sessions List */}
      {isLoading ? (
        <div className="text-center py-12 text-slate-400">Loading history records...</div>
      ) : filteredSessions.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-[#111827] rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-400 shadow-xs">
          <Calendar className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
          <p className="font-semibold text-slate-700 dark:text-slate-300">No sessions match your filters</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Try resetting the filters or log questions on the Data Log page.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredSessions.map((session) => {
            const isExpanded = expandedSessionId === session._id;
            const totalQs = session.entries.reduce((s, e) => s + e.total, 0);
            const totalRight = session.entries.reduce((s, e) => s + e.right, 0);
            const accuracy = totalQs > 0 ? Math.round((totalRight / totalQs) * 100) : 0;
            const isMock = session.kind === 'mock';

            return (
              <div
                key={session._id}
                className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden transition-all shadow-xs hover:border-slate-300 dark:hover:border-slate-700"
              >
                <div
                  onClick={() => setExpandedSessionId(isExpanded ? null : session._id)}
                  className="p-4 flex flex-wrap items-center justify-between gap-3 cursor-pointer select-none"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs ${
                        isMock
                          ? 'bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
                          : 'bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                      }`}
                    >
                      {isMock ? 'MOCK' : 'PRAC'}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-slate-500 dark:text-slate-400">{session.date}</span>
                        <span className="text-xs text-slate-300 dark:text-slate-700">•</span>
                        <span className="font-semibold text-sm text-slate-900 dark:text-white">
                          {session.chapterId?.isPartA
                            ? session.chapterId?.name
                            : `Ch ${session.chapterId?.no}: ${session.chapterId?.name}`}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {session.entries.length} topics • {totalQs} questions solved
                        {session.timeTakenMin ? ` • ${session.timeTakenMin} mins` : ''}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <span
                        className={`text-sm font-bold font-mono ${
                          accuracy >= 75
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : accuracy >= 50
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}
                      >
                        {accuracy}%
                      </span>
                      <p className="text-[10px] text-slate-400">Accuracy</p>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm('Delete this session?')) {
                          deleteMutation.mutate(session._id);
                        }
                      }}
                      className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                      title="Delete Session"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-[#161f30] p-4 space-y-3 text-xs">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700 text-[10px] font-bold uppercase">
                            <th className="py-1 px-2">Topic</th>
                            <th className="py-1 px-2 text-center">Total</th>
                            <th className="py-1 px-2 text-center">Right</th>
                            <th className="py-1 px-2 text-center">Wrong</th>
                            <th className="py-1 px-2 text-center">Acc</th>
                            <th className="py-1 px-2">Mistakes / Tags</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200/60 dark:divide-slate-700/60">
                          {session.entries.map((e, idx) => {
                            const eAcc = e.total > 0 ? Math.round((e.right / e.total) * 100) : 0;
                            return (
                              <tr key={idx}>
                                <td className="py-2 px-2">
                                  <span className="font-mono text-blue-600 dark:text-blue-400 font-bold mr-1.5">
                                    {e.topicCode}
                                  </span>
                                  <span className="text-slate-800 dark:text-slate-200 font-medium">{e.topicName}</span>
                                </td>
                                <td className="py-2 px-2 text-center font-mono font-medium text-slate-800 dark:text-slate-200">{e.total}</td>
                                <td className="py-2 px-2 text-center font-mono text-emerald-600 dark:text-emerald-400 font-bold">{e.right}</td>
                                <td className="py-2 px-2 text-center font-mono text-red-600 dark:text-red-400 font-bold">{e.wrong}</td>
                                <td className="py-2 px-2 text-center font-mono font-bold text-slate-800 dark:text-slate-200">{eAcc}%</td>
                                <td className="py-2 px-2">
                                  {(e.mistakeTags || []).length > 0 ? (
                                    <div className="flex flex-wrap gap-1">
                                      {e.mistakeTags.map((t) => (
                                        <span
                                          key={t}
                                          className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 font-semibold"
                                        >
                                          {t}
                                        </span>
                                      ))}
                                    </div>
                                  ) : (
                                    <span className="text-slate-400">—</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {session.notes && (
                      <div className="p-3 bg-white dark:bg-[#111827] rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300">
                        <span className="font-semibold text-slate-500 dark:text-slate-400 block mb-1">Notes:</span>
                        <p>{session.notes}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
