import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Calendar,
  Filter,
  Download,
  Trash2,
  Clock,
  ChevronDown,
  ChevronUp,
  FileText,
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

  // Fetch chapters for filter dropdown
  const { data: chaptersData } = useQuery({
    queryKey: ['chapters'],
    queryFn: async () => {
      const res = await api.get('/chapters');
      return res.data.data;
    },
  });

  // Fetch sessions with filters
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

  // Delete session mutation
  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      await api.delete(`/sessions/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      queryClient.invalidateQueries({ queryKey: ['quick-kpis'] });
    },
  });

  // Export CSV
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

  // Filtered list by topic search
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
    <div className="space-y-6 animate-fade-in">
      {/* Header & Export */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white">Session History</h2>
          <p className="text-xs text-gray-400">
            View, audit, search, and export past data logs across all days
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          className="px-4 py-2 bg-[#161f30] hover:bg-[#1f293d] border border-[#1f293d] rounded-xl text-xs font-semibold text-gray-200 flex items-center gap-2 self-start sm:self-auto transition-colors"
        >
          <Download className="w-4 h-4 text-blue-400" />
          <span>Export All to CSV</span>
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-[#161f30] border border-[#1f293d] rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
        <div>
          <label className="block text-gray-400 mb-1 font-medium">Search Topic / Keyword</label>
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-gray-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="e.g. Replication, Ch 3..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-2 bg-[#0b0f19] border border-[#1f293d] rounded-xl text-white focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-gray-400 mb-1 font-medium">Filter by Chapter</label>
          <select
            value={chapterFilter}
            onChange={(e) => setChapterFilter(e.target.value)}
            className="w-full px-3 py-2 bg-[#0b0f19] border border-[#1f293d] rounded-xl text-white focus:outline-none focus:border-blue-500"
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
          <label className="block text-gray-400 mb-1 font-medium">Session Kind</label>
          <select
            value={kindFilter}
            onChange={(e) => setKindFilter(e.target.value)}
            className="w-full px-3 py-2 bg-[#0b0f19] border border-[#1f293d] rounded-xl text-white focus:outline-none focus:border-blue-500"
          >
            <option value="">All (Practice & Mocks)</option>
            <option value="practice">Morning Practice only</option>
            <option value="mock">Night Mock only</option>
          </select>
        </div>

        <div>
          <label className="block text-gray-400 mb-1 font-medium">From Date</label>
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="w-full px-3 py-2 bg-[#0b0f19] border border-[#1f293d] rounded-xl text-white focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* Sessions Calendar-style List */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Loading history records...</div>
      ) : filteredSessions.length === 0 ? (
        <div className="text-center py-16 bg-[#161f30] rounded-2xl border border-[#1f293d] text-gray-400">
          <Calendar className="w-10 h-10 mx-auto text-gray-600 mb-3" />
          <p className="font-semibold text-gray-300">No sessions match your filters</p>
          <p className="text-xs text-gray-500 mt-1">Try resetting the filters or log questions on the Data Log page.</p>
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
                className="bg-[#161f30] border border-[#1f293d] rounded-xl overflow-hidden transition-all shadow-md hover:border-gray-700"
              >
                {/* Header Row */}
                <div
                  onClick={() => setExpandedSessionId(isExpanded ? null : session._id)}
                  className="p-4 flex flex-wrap items-center justify-between gap-3 cursor-pointer select-none"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs ${
                        isMock
                          ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30'
                          : 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                      }`}
                    >
                      {isMock ? 'MOCK' : 'PRAC'}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-gray-400">{session.date}</span>
                        <span className="text-xs text-gray-500">•</span>
                        <span className="font-semibold text-sm text-white">
                          {session.chapterId?.isPartA
                            ? session.chapterId?.name
                            : `Ch ${session.chapterId?.no}: ${session.chapterId?.name}`}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400">
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
                            ? 'text-emerald-400'
                            : accuracy >= 50
                            ? 'text-amber-400'
                            : 'text-red-400'
                        }`}
                      >
                        {accuracy}%
                      </span>
                      <p className="text-[10px] text-gray-400">Accuracy</p>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm('Are you sure you want to delete this session?')) {
                          deleteMutation.mutate(session._id);
                        }
                      }}
                      className="p-1.5 text-gray-500 hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-colors"
                      title="Delete Session"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="border-t border-[#1f293d] bg-[#0b0f19]/60 p-4 space-y-3 text-xs">
                    {/* Topics table */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="text-gray-400 border-b border-[#1f293d] text-[10px] uppercase">
                            <th className="py-1 px-2">Topic</th>
                            <th className="py-1 px-2 text-center">Total</th>
                            <th className="py-1 px-2 text-center">Right</th>
                            <th className="py-1 px-2 text-center">Wrong</th>
                            <th className="py-1 px-2 text-center">Acc</th>
                            <th className="py-1 px-2">Mistakes / Tags</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800">
                          {session.entries.map((e, idx) => {
                            const eAcc = e.total > 0 ? Math.round((e.right / e.total) * 100) : 0;
                            return (
                              <tr key={idx}>
                                <td className="py-2 px-2">
                                  <span className="font-mono text-blue-400 font-semibold mr-1.5">
                                    {e.topicCode}
                                  </span>
                                  <span className="text-gray-200">{e.topicName}</span>
                                </td>
                                <td className="py-2 px-2 text-center font-mono">{e.total}</td>
                                <td className="py-2 px-2 text-center font-mono text-emerald-400">{e.right}</td>
                                <td className="py-2 px-2 text-center font-mono text-red-400">{e.wrong}</td>
                                <td className="py-2 px-2 text-center font-mono font-semibold">{eAcc}%</td>
                                <td className="py-2 px-2">
                                  {(e.mistakeTags || []).length > 0 ? (
                                    <div className="flex flex-wrap gap-1">
                                      {e.mistakeTags.map((t) => (
                                        <span
                                          key={t}
                                          className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20"
                                        >
                                          {t}
                                        </span>
                                      ))}
                                    </div>
                                  ) : (
                                    <span className="text-gray-600">—</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {session.notes && (
                      <div className="p-3 bg-[#111827] rounded-xl border border-[#1f293d] text-gray-300">
                        <span className="font-semibold text-gray-400 block mb-1">Notes:</span>
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
