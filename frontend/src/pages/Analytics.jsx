import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  TrendingUp,
  Target,
  AlertTriangle,
  Award,
  Layers,
  Lightbulb,
  Clock,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  BookOpen,
  Search,
  Filter,
  Check,
  ChevronRight,
  BarChart3,
  Flame,
  HelpCircle,
  X,
  AlertCircle,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from 'recharts';
import api from '../api/client';

export const Analytics = () => {
  // Navigation View Tab: 'overview' | 'chapters' | 'topics'
  const [activeTab, setActiveTab] = useState('overview');

  // Filters
  const [dateRange, setDateRange] = useState('all');
  const [kindFilter, setKindFilter] = useState('both');
  const [selectedChapterId, setSelectedChapterId] = useState('');
  const [topicStatusFilter, setTopicStatusFilter] = useState('all'); // 'all' | 'weak' | 'needs-work' | 'good' | 'untested'
  const [topicSearchQuery, setTopicSearchQuery] = useState('');

  // AI Advice
  const [aiAdviceText, setAiAdviceText] = useState(null);
  const [loadingAi, setLoadingAi] = useState(false);

  const computeFromDate = () => {
    if (dateRange === 'all') return undefined;
    const days = dateRange === '7d' ? 7 : dateRange === '14d' ? 14 : 30;
    const d = new Date();
    d.setDate(d.getDate() - days);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const queryParams = {
    from: computeFromDate(),
    kind: kindFilter,
    chapterId: selectedChapterId || undefined,
  };

  // Queries
  const { data: chaptersList } = useQuery({
    queryKey: ['chapters'],
    queryFn: async () => {
      const res = await api.get('/chapters');
      return res.data.data;
    },
  });

  const { data: overviewData, isLoading: isOverviewLoading } = useQuery({
    queryKey: ['analytics-overview', dateRange, kindFilter, selectedChapterId],
    queryFn: async () => {
      const res = await api.get('/analytics/overview', { params: queryParams });
      return res.data.data;
    },
  });

  const { data: topicAnalyticsData, isLoading: isTopicsLoading } = useQuery({
    queryKey: ['analytics-topics', dateRange, kindFilter, selectedChapterId],
    queryFn: async () => {
      const res = await api.get('/analytics/topics', { params: queryParams });
      return res.data;
    },
  });

  const { data: chapterAnalyticsData, isLoading: isChaptersLoading } = useQuery({
    queryKey: ['analytics-chapters', dateRange, kindFilter],
    queryFn: async () => {
      const res = await api.get('/analytics/chapters', { params: { from: computeFromDate(), kind: kindFilter } });
      return res.data.data;
    },
  });

  const { data: trendsData } = useQuery({
    queryKey: ['analytics-trends', dateRange, kindFilter, selectedChapterId],
    queryFn: async () => {
      const res = await api.get('/analytics/trends', { params: queryParams });
      return res.data.data;
    },
  });

  const { data: recommendationsData } = useQuery({
    queryKey: ['analytics-recommendations'],
    queryFn: async () => {
      const res = await api.get('/analytics/recommendations');
      return res.data;
    },
  });

  const handleFetchAiAdvice = async () => {
    if (!overviewData) return;
    setLoadingAi(true);
    try {
      const summaryPayload = {
        totalSolved: overviewData.volume.totalQuestions,
        overallAccuracy: overviewData.accuracy.overall,
        projectedMarks: overviewData.projectedMarks.projectedTotal,
        topWeakTopics: (topicAnalyticsData?.top10ToFix || []).slice(0, 5).map((t) => ({
          code: t.code,
          name: t.name,
          accuracy: t.accuracy,
          attempts: t.attempts,
        })),
        daysRemaining: overviewData.countdown.daysToExam,
      };
      const res = await api.post('/analytics/ai-advice', { summary: summaryPayload });
      setAiAdviceText(res.data.advice);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to generate AI advice.');
    } finally {
      setLoadingAi(false);
    }
  };

  const kpis = overviewData || {};
  const chapters = chapterAnalyticsData || [];
  const allTopics = topicAnalyticsData?.data || [];
  const top10ToFix = topicAnalyticsData?.top10ToFix || [];
  const trends = trendsData || [];
  const recommendations = recommendationsData?.data || [];

  // Categorize chapters into Weak / Needs Work / Strong / Untested
  const chapterSummary = useMemo(() => {
    let weakCount = 0;
    let needsWorkCount = 0;
    let strongCount = 0;
    let untestedCount = 0;

    chapters.forEach((c) => {
      if (c.attempts === 0) {
        untestedCount++;
      } else if (c.accuracy < 50) {
        weakCount++;
      } else if (c.accuracy < 65) {
        needsWorkCount++;
      } else {
        strongCount++;
      }
    });

    return { weakCount, needsWorkCount, strongCount, untestedCount };
  }, [chapters]);

  // Filtered Topics for Explorer Tab
  const filteredTopics = useMemo(() => {
    return allTopics.filter((t) => {
      // Status filter
      if (topicStatusFilter === 'weak' && t.classification !== 'Weak') return false;
      if (topicStatusFilter === 'needs-work' && t.classification !== 'Needs work') return false;
      if (topicStatusFilter === 'good' && (t.classification !== 'Good' && t.classification !== 'Mastered')) return false;
      if (topicStatusFilter === 'untested' && t.classification !== 'Untested') return false;

      // Search filter
      if (topicSearchQuery.trim()) {
        const q = topicSearchQuery.toLowerCase();
        const codeMatch = (t.code || '').toLowerCase().includes(q);
        const nameMatch = (t.name || '').toLowerCase().includes(q);
        const chapterMatch = (t.chapterName || '').toLowerCase().includes(q);
        if (!codeMatch && !nameMatch && !chapterMatch) return false;
      }

      return true;
    });
  }, [allTopics, topicStatusFilter, topicSearchQuery]);

  // Aggregate mistake tags across all attempted topics
  const mistakeTotals = useMemo(() => {
    const totals = { 'concept gap': 0, 'silly mistake': 0, 'time': 0, 'guess': 0 };
    allTopics.forEach((t) => {
      if (t.mistakeTags) {
        totals['concept gap'] += t.mistakeTags['concept gap'] || 0;
        totals['silly mistake'] += t.mistakeTags['silly mistake'] || 0;
        totals['time'] += t.mistakeTags['time'] || 0;
        totals['guess'] += t.mistakeTags['guess'] || 0;
      }
    });
    return totals;
  }, [allTopics]);

  const radarData = useMemo(() => {
    return chapters.map((c) => ({
      chapter: c.isPartA ? 'Part A' : `Ch ${c.no}`,
      accuracy: c.accuracy,
    }));
  }, [chapters]);

  // Selected chapter object for detailed drilldown
  const activeChapterDetail = useMemo(() => {
    if (!selectedChapterId) return null;
    return chapters.find((c) => c.chapterId === selectedChapterId || c._id === selectedChapterId) || null;
  }, [chapters, selectedChapterId]);

  return (
    <div className="space-y-6 animate-fade-in text-slate-800 dark:text-slate-200">
      {/* Page Title & Global Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            Performance & Weakness Diagnostics
            <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-semibold border border-blue-200 dark:border-blue-800">
              Exam Dec 2026
            </span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Pinpoint exact weak chapters, topics, and Part B vs Part C bottlenecks
          </p>
        </div>

        {/* Global Filters: Date range & Mode */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Date range pills */}
          <div className="flex rounded-xl bg-slate-100 dark:bg-[#161f30] p-1 border border-slate-200 dark:border-slate-800">
            {['7d', '14d', '30d', 'all'].map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setDateRange(r)}
                className={`px-2.5 py-1 rounded-lg font-bold uppercase text-[10px] transition-all cursor-pointer ${
                  dateRange === r
                    ? 'bg-white dark:bg-[#1f293d] text-blue-700 dark:text-blue-300 shadow-xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {r === 'all' ? 'All Time' : r}
              </button>
            ))}
          </div>

          {/* Mode Selector */}
          <select
            value={kindFilter}
            onChange={(e) => setKindFilter(e.target.value)}
            className="px-3 py-1.5 bg-white dark:bg-[#161f30] border border-slate-200 dark:border-slate-800 rounded-xl text-slate-700 dark:text-slate-200 text-xs font-semibold focus:outline-none focus:border-blue-500 shadow-2xs"
          >
            <option value="both">Practice & Mocks</option>
            <option value="practice">Practice Only</option>
            <option value="mock">Mocks Only</option>
          </select>
        </div>
      </div>

      {/* Main Navigation Segmented Tabs */}
      <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#161f30] p-1 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs shadow-2xs overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`flex-1 min-w-[140px] py-2 px-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === 'overview'
              ? 'bg-white dark:bg-[#1f293d] text-blue-600 dark:text-blue-400 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Target className="w-4 h-4" />
          <span>Overview & Parts (A/B/C)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('chapters')}
          className={`flex-1 min-w-[140px] py-2 px-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === 'chapters'
              ? 'bg-white dark:bg-[#1f293d] text-blue-600 dark:text-blue-400 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>Chapter-Wise Analysis</span>
          {chapterSummary.weakCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400 font-extrabold">
              {chapterSummary.weakCount} Weak
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('topics')}
          className={`flex-1 min-w-[140px] py-2 px-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === 'topics'
              ? 'bg-white dark:bg-[#1f293d] text-blue-600 dark:text-blue-400 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          <span>Topic Weakness Explorer</span>
          <span className="text-[10px] text-slate-400">({allTopics.length})</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: OVERVIEW & EXAM SECTIONS (PART A / B / C) */}
      {/* ========================================================================= */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Headline Diagnostic KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Projected Score */}
            <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium">
                <span>Projected Score (Est.)</span>
                <span className="p-1.5 rounded-lg bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
                  <Award className="w-4 h-4" />
                </span>
              </div>
              <div className="my-2">
                <div className="text-3xl font-extrabold text-purple-700 dark:text-purple-400 font-mono">
                  {kpis.projectedMarks?.projectedTotal ?? 0}{' '}
                  <span className="text-sm font-normal text-slate-500 dark:text-slate-400">/ 200</span>
                </div>
                <p className="text-xs text-red-600 dark:text-red-400 mt-1 font-semibold flex items-center gap-1">
                  <span>-{kpis.projectedMarks?.totalLostToNegatives ?? 0}</span> lost to negative markings
                </p>
              </div>
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                <span>Net Part A/B/C:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {kpis.projectedMarks?.partA?.expectedScore ?? 0} /{' '}
                  {kpis.projectedMarks?.partB?.expectedScore ?? 0} /{' '}
                  {kpis.projectedMarks?.partC?.expectedScore ?? 0}
                </span>
              </div>
            </div>

            {/* Card 2: Overall Accuracy */}
            <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium">
                <span>Overall Accuracy</span>
                <span className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
                  <TrendingUp className="w-4 h-4" />
                </span>
              </div>
              <div className="my-2">
                <div
                  className={`text-3xl font-extrabold font-mono ${
                    (kpis.accuracy?.overall ?? 0) < 50
                      ? 'text-red-600 dark:text-red-400'
                      : (kpis.accuracy?.overall ?? 0) < 65
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  {kpis.accuracy?.overall ?? 0}%
                </div>
                <div className="flex items-center gap-1.5 text-xs mt-1">
                  {Number(kpis.accuracy?.trend) >= 0 ? (
                    <span className="text-emerald-600 dark:text-emerald-400 flex items-center font-bold">
                      <ArrowUpRight className="w-3.5 h-3.5" /> +{kpis.accuracy?.trend}%
                    </span>
                  ) : (
                    <span className="text-red-600 dark:text-red-400 flex items-center font-bold">
                      <ArrowDownRight className="w-3.5 h-3.5" /> {kpis.accuracy?.trend}%
                    </span>
                  )}
                  <span className="text-slate-500 dark:text-slate-400">vs prev 7 days</span>
                </div>
              </div>
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between text-[11px] text-slate-500 dark:text-slate-400">
                <span>Total Solved:</span>
                <span className="font-bold text-slate-900 dark:text-white font-mono">{kpis.volume?.totalQuestions ?? 0} Qs</span>
              </div>
            </div>

            {/* Card 3: Exam Countdown & Streak */}
            <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium">
                <span>Countdown & Consistency</span>
                <span className="p-1.5 rounded-lg bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400">
                  <Flame className="w-4 h-4" />
                </span>
              </div>
              <div className="my-2">
                <div className="text-3xl font-extrabold text-slate-900 dark:text-white font-mono">
                  {kpis.countdown?.daysToExam ?? '--'}{' '}
                  <span className="text-sm font-normal text-slate-500 dark:text-slate-400">Days Left</span>
                </div>
                <p className="text-xs text-orange-600 dark:text-orange-400 font-bold mt-1 flex items-center gap-1">
                  🔥 Streak: {kpis.volume?.currentStreak ?? 0} consecutive days
                </p>
              </div>
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between text-[11px] text-slate-500 dark:text-slate-400">
                <span>Exam Target:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{kpis.countdown?.examDate}</span>
              </div>
            </div>

            {/* Card 4: Syllabus Coverage */}
            <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium">
                <span>Syllabus Coverage</span>
                <span className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
                  <Layers className="w-4 h-4" />
                </span>
              </div>
              <div className="my-2">
                <div className="text-3xl font-extrabold text-indigo-600 dark:text-indigo-400 font-mono">
                  {kpis.coverage?.syllabusCoveragePct ?? 0}%
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  <strong className="text-slate-800 dark:text-slate-200">{kpis.coverage?.attemptedTopicsCount ?? 0}</strong> of{' '}
                  {kpis.coverage?.totalTopicsCount ?? 0} topics touched
                </p>
              </div>
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between text-[11px] text-slate-500 dark:text-slate-400">
                <span>Untouched Topics:</span>
                <span className="font-bold text-amber-600 dark:text-amber-400">{kpis.coverage?.untouchedTopics ?? 0} remaining</span>
              </div>
            </div>
          </div>

          {/* Exam Section Benchmark (Part A vs Part B vs Part C) */}
          <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
                  <Target className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  Exam Section Diagnostics (Part A vs Part B vs Part C)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Understand exactly which exam section is pulling down your score
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Part A Card */}
              {(() => {
                const acc = kpis.partsBreakdown?.partA?.accuracy ?? 0;
                const attempts = kpis.partsBreakdown?.partA?.attempts ?? 0;
                const isWeak = attempts > 0 && acc < 50;
                const isNeedsWork = attempts > 0 && acc >= 50 && acc < 65;
                const isStrong = attempts > 0 && acc >= 65;

                return (
                  <div className="bg-slate-50 dark:bg-[#161f30] p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col justify-between gap-3">
                    <div>
                      <div className="flex justify-between items-start gap-2 mb-1">
                        <div>
                          <h4 className="font-bold text-sm text-slate-900 dark:text-white">Part A: General Aptitude</h4>
                          <span className="text-[10px] text-slate-400">Max 15 Qs • +2.0 / -0.5</span>
                        </div>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            attempts === 0
                              ? 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                              : isWeak
                              ? 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800'
                              : isNeedsWork
                              ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
                              : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                          }`}
                        >
                          {attempts === 0 ? 'Untested' : isWeak ? '🔴 Critical Weakness' : isNeedsWork ? '🟡 Needs Work' : '🟢 Strong'}
                        </span>
                      </div>

                      <div className="flex items-baseline gap-2 my-2">
                        <span className="font-mono text-2xl font-extrabold text-blue-600 dark:text-blue-400">{acc}%</span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">accuracy ({attempts} Qs attempted)</span>
                      </div>

                      <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden mb-2">
                        <div
                          className={`h-2 rounded-full transition-all ${
                            isWeak ? 'bg-red-500' : isNeedsWork ? 'bg-amber-500' : 'bg-blue-600'
                          }`}
                          style={{ width: `${acc}%` }}
                        />
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex justify-between text-xs text-slate-600 dark:text-slate-400">
                      <span>Est. Score Contribution:</span>
                      <strong className="text-slate-900 dark:text-white font-mono">
                        {kpis.projectedMarks?.partA?.expectedScore ?? 0} / 30 marks
                      </strong>
                    </div>
                  </div>
                );
              })()}

              {/* Part B Card */}
              {(() => {
                const acc = kpis.partsBreakdown?.partB?.accuracy ?? 0;
                const attempts = kpis.partsBreakdown?.partB?.attempts ?? 0;
                const isWeak = attempts > 0 && acc < 50;
                const isNeedsWork = attempts > 0 && acc >= 50 && acc < 65;
                const isStrong = attempts > 0 && acc >= 65;

                return (
                  <div className="bg-slate-50 dark:bg-[#161f30] p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col justify-between gap-3">
                    <div>
                      <div className="flex justify-between items-start gap-2 mb-1">
                        <div>
                          <h4 className="font-bold text-sm text-slate-900 dark:text-white">Part B: Core Subject MCQs</h4>
                          <span className="text-[10px] text-slate-400">Max 35 Qs • +2.0 / -0.5</span>
                        </div>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            attempts === 0
                              ? 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                              : isWeak
                              ? 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800'
                              : isNeedsWork
                              ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
                              : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                          }`}
                        >
                          {attempts === 0 ? 'Untested' : isWeak ? '🔴 Critical Weakness' : isNeedsWork ? '🟡 Needs Work' : '🟢 Strong'}
                        </span>
                      </div>

                      <div className="flex items-baseline gap-2 my-2">
                        <span className="font-mono text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">{acc}%</span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">accuracy ({attempts} Qs attempted)</span>
                      </div>

                      <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden mb-2">
                        <div
                          className={`h-2 rounded-full transition-all ${
                            isWeak ? 'bg-red-500' : isNeedsWork ? 'bg-amber-500' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${acc}%` }}
                        />
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex justify-between text-xs text-slate-600 dark:text-slate-400">
                      <span>Est. Score Contribution:</span>
                      <strong className="text-slate-900 dark:text-white font-mono">
                        {kpis.projectedMarks?.partB?.expectedScore ?? 0} / 70 marks
                      </strong>
                    </div>
                  </div>
                );
              })()}

              {/* Part C Card */}
              {(() => {
                const acc = kpis.partsBreakdown?.partC?.accuracy ?? 0;
                const attempts = kpis.partsBreakdown?.partC?.attempts ?? 0;
                const isWeak = attempts > 0 && acc < 50;
                const isNeedsWork = attempts > 0 && acc >= 50 && acc < 65;
                const isStrong = attempts > 0 && acc >= 65;

                return (
                  <div className="bg-slate-50 dark:bg-[#161f30] p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col justify-between gap-3">
                    <div>
                      <div className="flex justify-between items-start gap-2 mb-1">
                        <div>
                          <h4 className="font-bold text-sm text-slate-900 dark:text-white">Part C: Analytical & Multi-Concept</h4>
                          <span className="text-[10px] text-slate-400">Max 25 Qs • +4.0 / -1.0 (Critical)</span>
                        </div>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            attempts === 0
                              ? 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                              : isWeak
                              ? 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800'
                              : isNeedsWork
                              ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
                              : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                          }`}
                        >
                          {attempts === 0 ? 'Untested' : isWeak ? '🔴 Critical Weakness' : isNeedsWork ? '🟡 Needs Work' : '🟢 Strong'}
                        </span>
                      </div>

                      <div className="flex items-baseline gap-2 my-2">
                        <span className="font-mono text-2xl font-extrabold text-purple-600 dark:text-purple-400">{acc}%</span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">accuracy ({attempts} Qs attempted)</span>
                      </div>

                      <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden mb-2">
                        <div
                          className={`h-2 rounded-full transition-all ${
                            isWeak ? 'bg-red-500' : isNeedsWork ? 'bg-amber-500' : 'bg-purple-600'
                          }`}
                          style={{ width: `${acc}%` }}
                        />
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex justify-between text-xs text-slate-600 dark:text-slate-400">
                      <span>Est. Score Contribution:</span>
                      <strong className="text-slate-900 dark:text-white font-mono">
                        {kpis.projectedMarks?.partC?.expectedScore ?? 0} / 100 marks
                      </strong>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Urgent Priority Weak Topics to Fix */}
          <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                  Top Urgent Topics to Fix Now
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Calculated using Bayesian accuracy, chapter weight, and days since practice
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setTopicStatusFilter('weak');
                  setActiveTab('topics');
                }}
                className="text-xs text-blue-600 dark:text-blue-400 font-bold hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>View all weak topics</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {top10ToFix.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">No urgent weak topics detected yet.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-[#161f30] text-slate-500 dark:text-slate-400 uppercase text-[10px] font-bold border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3"># Topic</th>
                      <th className="py-2.5 px-2">Chapter</th>
                      <th className="py-2.5 px-2 text-center">Attempts</th>
                      <th className="py-2.5 px-2 text-center">Accuracy</th>
                      <th className="py-2.5 px-2 text-center">Status</th>
                      <th className="py-2.5 px-2 text-center">Last Practice</th>
                      <th className="py-2.5 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-[#111827]">
                    {top10ToFix.slice(0, 5).map((t, idx) => (
                      <tr key={t.topicId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400 font-bold text-[10px] flex items-center justify-center">
                              {idx + 1}
                            </span>
                            <span className="font-mono font-bold text-blue-600 dark:text-blue-400 text-[11px]">{t.code}</span>
                            <span className="font-medium text-slate-900 dark:text-slate-100">{t.name}</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-2 text-slate-600 dark:text-slate-400">{t.chapterName}</td>
                        <td className="py-2.5 px-2 text-center font-mono font-medium">{t.attempts}</td>
                        <td className="py-2.5 px-2 text-center font-mono font-bold">
                          <span
                            className={
                              t.accuracy < 50
                                ? 'text-red-600 dark:text-red-400'
                                : t.accuracy < 65
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-emerald-600 dark:text-emerald-400'
                            }
                          >
                            {t.accuracy}%
                          </span>
                        </td>
                        <td className="py-2.5 px-2 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              t.classification === 'Weak'
                                ? 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400'
                                : t.classification === 'Needs work'
                                ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                            }`}
                          >
                            {t.classification}
                          </span>
                        </td>
                        <td className="py-2.5 px-2 text-center text-slate-500 dark:text-slate-400 text-[11px]">
                          {t.daysSincePracticed !== null ? `${t.daysSincePracticed}d ago` : 'Never'}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedChapterId(t.chapterId?._id || t.chapterId);
                              setActiveTab('chapters');
                            }}
                            className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors cursor-pointer"
                          >
                            Inspect Chapter →
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Mistake Pattern Diagnostic & Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Mistake Reasons Breakdown */}
            <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                Root Causes of Wrong Answers (Mistake Tags)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Where are marks being lost across your practice?
              </p>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40">
                  <span className="text-xs text-red-700 dark:text-red-400 font-bold block mb-1">Concept Gaps</span>
                  <span className="text-2xl font-extrabold text-red-900 dark:text-red-300 font-mono">
                    {mistakeTotals['concept gap']}
                  </span>
                  <p className="text-[10px] text-red-600/80 dark:text-red-400/80 mt-1">Requires theory re-reading</p>
                </div>

                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40">
                  <span className="text-xs text-amber-700 dark:text-amber-400 font-bold block mb-1">Silly Mistakes</span>
                  <span className="text-2xl font-extrabold text-amber-900 dark:text-amber-300 font-mono">
                    {mistakeTotals['silly mistake']}
                  </span>
                  <p className="text-[10px] text-amber-600/80 dark:text-amber-400/80 mt-1">Careless reading of question</p>
                </div>

                <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/40">
                  <span className="text-xs text-blue-700 dark:text-blue-400 font-bold block mb-1">Time Pressure</span>
                  <span className="text-2xl font-extrabold text-blue-900 dark:text-blue-300 font-mono">
                    {mistakeTotals['time']}
                  </span>
                  <p className="text-[10px] text-blue-600/80 dark:text-blue-400/80 mt-1">Speed drills needed</p>
                </div>

                <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900/40">
                  <span className="text-xs text-purple-700 dark:text-purple-400 font-bold block mb-1">Unsure Guessing</span>
                  <span className="text-2xl font-extrabold text-purple-900 dark:text-purple-300 font-mono">
                    {mistakeTotals['guess']}
                  </span>
                  <p className="text-[10px] text-purple-600/80 dark:text-purple-400/80 mt-1">Avoid negative penalties</p>
                </div>
              </div>
            </div>

            {/* Daily Practice Volume Chart */}
            <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">Daily Volume vs Target</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">Daily questions solved vs 100 Qs goal</p>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trends}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} />
                    <XAxis dataKey="date" stroke="#64748b" tick={{ fontSize: 10 }} />
                    <YAxis stroke="#64748b" tick={{ fontSize: 10 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#111827',
                        borderColor: '#1e293b',
                        borderRadius: 8,
                        color: '#fff',
                        fontSize: 12,
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line type="monotone" dataKey="total" name="Questions Solved" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="target" name="Daily Target" stroke="#10b981" strokeDasharray="4 4" strokeWidth={1.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Tactical Recommendations & AI Guidance */}
          <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Lightbulb className="w-5 h-5 text-amber-500" />
                  Tactical Improvement Recommendations
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Targeted action steps generated server-side from your accuracy and mistake intervals
                </p>
              </div>

              {recommendationsData?.hasAnthropicKey && (
                <button
                  type="button"
                  onClick={handleFetchAiAdvice}
                  disabled={loadingAi}
                  className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-2 shadow-xs transition-all cursor-pointer self-start sm:self-auto"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{loadingAi ? 'Analyzing with AI...' : 'Generate AI Advice'}</span>
                </button>
              )}
            </div>

            {aiAdviceText && (
              <div className="p-4 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 text-purple-900 dark:text-purple-200 text-xs space-y-2">
                <div className="flex items-center gap-2 font-bold text-purple-700 dark:text-purple-300">
                  <Sparkles className="w-4 h-4" /> AI Strategic Guidance:
                </div>
                <div className="whitespace-pre-line leading-relaxed">{aiAdviceText}</div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {recommendations.map((rec) => (
                <div
                  key={rec.id}
                  className={`p-4 rounded-xl border flex flex-col justify-between gap-2 transition-all ${
                    rec.severity === 'critical'
                      ? 'bg-red-50/60 dark:bg-red-950/30 border-red-200 dark:border-red-900/60 text-red-900 dark:text-red-200'
                      : rec.severity === 'warning'
                      ? 'bg-amber-50/60 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/60 text-amber-900 dark:text-amber-200'
                      : 'bg-blue-50/60 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900/60 text-blue-900 dark:text-blue-200'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-bold text-xs text-slate-900 dark:text-white">{rec.title}</span>
                      <span
                        className={`text-[9px] uppercase font-mono px-2 py-0.5 rounded font-bold ${
                          rec.severity === 'critical'
                            ? 'bg-red-100 dark:bg-red-900/60 text-red-700 dark:text-red-300'
                            : rec.severity === 'warning'
                            ? 'bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300'
                            : 'bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300'
                        }`}
                      >
                        {rec.severity}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">{rec.description}</p>
                  </div>

                  <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800 flex items-center gap-1.5 text-[11px] font-semibold text-slate-900 dark:text-white">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>Action: {rec.action}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: CHAPTER-WISE ANALYSIS */}
      {/* ========================================================================= */}
      {activeTab === 'chapters' && (
        <div className="space-y-6">
          {/* Chapter Selector & Summary Badges */}
          <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                Select View:
              </label>
              <select
                value={selectedChapterId}
                onChange={(e) => setSelectedChapterId(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#161f30] text-slate-800 dark:text-slate-200 text-xs font-semibold focus:outline-none focus:border-blue-500 shadow-2xs max-w-sm"
              >
                <option value="">All Chapters (Full Syllabus Overview)</option>
                {(chaptersList || []).map((ch) => (
                  <option key={ch._id} value={ch._id}>
                    {ch.isPartA ? 'Part A: General Aptitude' : `Ch ${ch.no}: ${ch.name}`}
                  </option>
                ))}
              </select>
            </div>

            {/* Quick Status Count Badges */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="px-2.5 py-1 rounded-lg bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-400 font-bold border border-red-200 dark:border-red-800 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                {chapterSummary.weakCount} Critical Weak
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 font-bold border border-amber-200 dark:border-amber-800 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                {chapterSummary.needsWorkCount} Needs Work
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 font-bold border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                {chapterSummary.strongCount} Strong
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-slate-400" />
                {chapterSummary.untestedCount} Untested
              </span>
            </div>
          </div>

          {/* If a specific chapter is selected: detailed card with its topics */}
          {selectedChapterId && activeChapterDetail ? (
            <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                      {activeChapterDetail.isPartA ? 'Part A' : `Chapter ${activeChapterDetail.no}`}
                    </span>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                      {activeChapterDetail.name}
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Exam Weight: {'★'.repeat(activeChapterDetail.weight || 3)} • Topics Covered:{' '}
                    {activeChapterDetail.topicsCoveredCount}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedChapterId('')}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors self-start sm:self-auto cursor-pointer"
                >
                  ← Back to All Chapters
                </button>
              </div>

              {/* Chapter Performance Breakdown */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#161f30] border border-slate-200 dark:border-slate-800">
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-medium block mb-1">
                    Overall Accuracy
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span
                      className={`font-mono text-2xl font-extrabold ${
                        activeChapterDetail.accuracy < 50
                          ? 'text-red-600 dark:text-red-400'
                          : activeChapterDetail.accuracy < 65
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      {activeChapterDetail.accuracy}%
                    </span>
                    <span className="text-xs text-slate-400">({activeChapterDetail.attempts} Qs)</span>
                  </div>
                </div>

                {!activeChapterDetail.isPartA && (
                  <>
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#161f30] border border-slate-200 dark:border-slate-800">
                      <span className="text-xs text-slate-500 dark:text-slate-400 font-medium block mb-1">
                        Part B Accuracy (Direct)
                      </span>
                      <div className="flex items-baseline gap-2">
                        <span className="font-mono text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
                          {activeChapterDetail.bAccuracy}%
                        </span>
                        <span className="text-xs text-slate-400">({activeChapterDetail.bAttempts} Qs)</span>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#161f30] border border-slate-200 dark:border-slate-800">
                      <span className="text-xs text-slate-500 dark:text-slate-400 font-medium block mb-1">
                        Part C Accuracy (Analytical)
                      </span>
                      <div className="flex items-baseline gap-2">
                        <span
                          className={`font-mono text-2xl font-extrabold ${
                            activeChapterDetail.cAccuracy < 50
                              ? 'text-red-600 dark:text-red-400'
                              : 'text-purple-600 dark:text-purple-400'
                          }`}
                        >
                          {activeChapterDetail.cAccuracy}%
                        </span>
                        <span className="text-xs text-slate-400">({activeChapterDetail.cAttempts} Qs)</span>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Topics under this chapter */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
                  Topics in this Chapter (Ranked by Weakness)
                </h4>
                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-[#161f30] text-slate-500 dark:text-slate-400 uppercase text-[10px] font-bold border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="py-2.5 px-3">Topic</th>
                        <th className="py-2.5 px-2 text-center">Attempts</th>
                        <th className="py-2.5 px-2 text-center">Accuracy</th>
                        <th className="py-2.5 px-2 text-center">Status</th>
                        <th className="py-2.5 px-2 text-center">Mistakes</th>
                        <th className="py-2.5 px-2 text-center">Last Practiced</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-[#111827]">
                      {allTopics
                        .filter(
                          (t) =>
                            t.chapterNo === activeChapterDetail.no ||
                            t.chapterId?._id === activeChapterDetail.chapterId ||
                            t.chapterId === activeChapterDetail.chapterId
                        )
                        .map((t) => (
                          <tr key={t.topicId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                            <td className="py-2.5 px-3">
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{t.code}</span>
                                <span className="font-medium text-slate-900 dark:text-slate-100">{t.name}</span>
                              </div>
                            </td>
                            <td className="py-2.5 px-2 text-center font-mono font-medium">{t.attempts}</td>
                            <td className="py-2.5 px-2 text-center font-mono font-bold">
                              {t.attempts > 0 ? (
                                <span
                                  className={
                                    t.accuracy < 50
                                      ? 'text-red-600 dark:text-red-400'
                                      : t.accuracy < 65
                                      ? 'text-amber-600 dark:text-amber-400'
                                      : 'text-emerald-600 dark:text-emerald-400'
                                  }
                                >
                                  {t.accuracy}%
                                </span>
                              ) : (
                                <span className="text-slate-400 font-normal">--</span>
                              )}
                            </td>
                            <td className="py-2.5 px-2 text-center">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  t.classification === 'Weak'
                                    ? 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400'
                                    : t.classification === 'Needs work'
                                    ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400'
                                    : t.classification === 'Untested'
                                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                                    : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400'
                                }`}
                              >
                                {t.classification}
                              </span>
                            </td>
                            <td className="py-2.5 px-2 text-center">
                              {t.wrong > 0 ? (
                                <span className="text-red-600 dark:text-red-400 font-bold">{t.wrong} wrong</span>
                              ) : (
                                <span className="text-slate-400">0</span>
                              )}
                            </td>
                            <td className="py-2.5 px-2 text-center text-slate-500 dark:text-slate-400 text-[11px]">
                              {t.daysSincePracticed !== null ? `${t.daysSincePracticed}d ago` : 'Never'}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            /* All Chapters Card Grid */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {chapters.map((ch) => {
                const acc = ch.accuracy || 0;
                const isWeak = ch.attempts > 0 && acc < 50;
                const isNeedsWork = ch.attempts > 0 && acc >= 50 && acc < 65;
                const isStrong = ch.attempts > 0 && acc >= 65;
                const isUntested = ch.attempts === 0;

                return (
                  <div
                    key={ch.chapterId}
                    className={`bg-white dark:bg-[#111827] border rounded-2xl p-5 shadow-xs flex flex-col justify-between gap-4 transition-all hover:shadow-md ${
                      isWeak
                        ? 'border-red-300 dark:border-red-900/60'
                        : isNeedsWork
                        ? 'border-amber-300 dark:border-amber-900/60'
                        : 'border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                            {ch.isPartA ? 'Part A' : `Ch ${ch.no}`}
                          </span>
                          <h4 className="font-bold text-sm text-slate-900 dark:text-white leading-snug truncate max-w-[200px] sm:max-w-[260px]">
                            {ch.name}
                          </h4>
                        </div>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                            isUntested
                              ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                              : isWeak
                              ? 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800'
                              : isNeedsWork
                              ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
                              : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                          }`}
                        >
                          {isUntested
                            ? 'Untested'
                            : isWeak
                            ? '🔴 Critical Weakness'
                            : isNeedsWork
                            ? '🟡 Needs Work'
                            : '🟢 Strong'}
                        </span>
                      </div>

                      {/* Accuracy & Progress Bar */}
                      <div className="my-3">
                        <div className="flex justify-between items-baseline text-xs mb-1">
                          <span className="text-slate-500 dark:text-slate-400">Chapter Accuracy</span>
                          <span
                            className={`font-mono font-extrabold text-sm ${
                              isUntested
                                ? 'text-slate-400'
                                : isWeak
                                ? 'text-red-600 dark:text-red-400'
                                : isNeedsWork
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-emerald-600 dark:text-emerald-400'
                            }`}
                          >
                            {isUntested ? '0%' : `${acc}%`}
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden">
                          <div
                            className={`h-2.5 rounded-full transition-all ${
                              isWeak ? 'bg-red-500' : isNeedsWork ? 'bg-amber-500' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${acc}%` }}
                          />
                        </div>
                      </div>

                      {/* Part B vs Part C Breakdown if not Part A */}
                      {!ch.isPartA ? (
                        <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                          <div className="p-2 rounded-lg bg-slate-50 dark:bg-[#161f30] border border-slate-200 dark:border-slate-800">
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Part B Acc</span>
                            <span className="font-mono font-bold text-slate-900 dark:text-white">
                              {ch.bAttempts > 0 ? `${ch.bAccuracy}%` : '--'}
                            </span>
                            <span className="text-[9px] text-slate-400 ml-1">({ch.bAttempts} Qs)</span>
                          </div>

                          <div className="p-2 rounded-lg bg-slate-50 dark:bg-[#161f30] border border-slate-200 dark:border-slate-800">
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Part C Acc (Analytics)</span>
                            <span
                              className={`font-mono font-bold ${
                                ch.cAttempts > 0 && ch.cAccuracy < 50
                                  ? 'text-red-600 dark:text-red-400'
                                  : 'text-slate-900 dark:text-white'
                              }`}
                            >
                              {ch.cAttempts > 0 ? `${ch.cAccuracy}%` : '--'}
                            </span>
                            <span className="text-[9px] text-slate-400 ml-1">({ch.cAttempts} Qs)</span>
                          </div>
                        </div>
                      ) : (
                        <div className="p-2 rounded-lg bg-slate-50 dark:bg-[#161f30] border border-slate-200 dark:border-slate-800 text-xs">
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 block">General Aptitude Solved</span>
                          <span className="font-mono font-bold text-slate-900 dark:text-white">
                            {ch.attempts} Questions
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        {ch.topicsCoveredCount} topics covered
                      </span>
                      <button
                        type="button"
                        onClick={() => setSelectedChapterId(ch.chapterId)}
                        className="px-3 py-1 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/60 font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <span>Drilldown</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: TOPIC WEAKNESS EXPLORER */}
      {/* ========================================================================= */}
      {activeTab === 'topics' && (
        <div className="space-y-4">
          {/* Filter Bar: Chapter, Weakness Status & Real-time Search */}
          <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              {/* Search input */}
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search topic code or name (e.g. 2A1, glycolysis)..."
                  value={topicSearchQuery}
                  onChange={(e) => setTopicSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#161f30] text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                />
                {topicSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setTopicSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Chapter filter dropdown */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">Chapter:</span>
                <select
                  value={selectedChapterId}
                  onChange={(e) => setSelectedChapterId(e.target.value)}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#161f30] text-slate-800 dark:text-slate-200 text-xs font-semibold focus:outline-none focus:border-blue-500 shadow-2xs"
                >
                  <option value="">All Chapters</option>
                  {(chaptersList || []).map((ch) => (
                    <option key={ch._id} value={ch._id}>
                      {ch.isPartA ? 'Part A: General Aptitude' : `Ch ${ch.no}: ${ch.name}`}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Status pills */}
            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
              <span className="text-xs text-slate-500 dark:text-slate-400 mr-1 font-medium">Status:</span>
              {[
                { id: 'all', label: 'All Topics' },
                { id: 'weak', label: '🔴 Weak (<50%)' },
                { id: 'needs-work', label: '🟡 Needs Work (50-65%)' },
                { id: 'good', label: '🟢 Good (>65%)' },
                { id: 'untested', label: '⚪ Untested (0 Qs)' },
              ].map((pill) => (
                <button
                  key={pill.id}
                  type="button"
                  onClick={() => setTopicStatusFilter(pill.id)}
                  className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    topicStatusFilter === pill.id
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-[#161f30] text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
                  }`}
                >
                  {pill.label}
                </button>
              ))}
            </div>
          </div>

          {/* Topics Table */}
          <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                Showing {filteredTopics.length} of {allTopics.length} topics
              </span>
              {selectedChapterId && (
                <button
                  type="button"
                  onClick={() => setSelectedChapterId('')}
                  className="text-xs text-blue-600 dark:text-blue-400 font-bold hover:underline cursor-pointer"
                >
                  Clear Chapter Filter
                </button>
              )}
            </div>

            {filteredTopics.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                No topics matching your filter criteria.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-[#161f30] text-slate-500 dark:text-slate-400 uppercase text-[10px] font-bold border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3">Topic</th>
                      <th className="py-2.5 px-2">Chapter</th>
                      <th className="py-2.5 px-2 text-center">Attempts</th>
                      <th className="py-2.5 px-2 text-center">Score (R/W)</th>
                      <th className="py-2.5 px-2 text-center">Accuracy</th>
                      <th className="py-2.5 px-2 text-center">Status</th>
                      <th className="py-2.5 px-2 text-center">Mistake Reasons</th>
                      <th className="py-2.5 px-3 text-right">Last Practiced</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-[#111827]">
                    {filteredTopics.map((t) => {
                      const isWeak = t.attempts > 0 && t.accuracy < 50;
                      const isNeedsWork = t.attempts > 0 && t.accuracy >= 50 && t.accuracy < 65;
                      const isGood = t.attempts > 0 && t.accuracy >= 65;

                      return (
                        <tr key={t.topicId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-mono font-bold text-blue-600 dark:text-blue-400 text-[11px]">
                                {t.code}
                              </span>
                              <span className="font-medium text-slate-900 dark:text-slate-100">{t.name}</span>
                              {t.isCustom && (
                                <span className="text-[8px] px-1 rounded bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 font-bold uppercase">
                                  custom
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 px-2 text-slate-600 dark:text-slate-400 truncate max-w-[140px]">
                            {t.chapterName}
                          </td>
                          <td className="py-2.5 px-2 text-center font-mono font-medium">{t.attempts}</td>
                          <td className="py-2.5 px-2 text-center font-mono">
                            {t.attempts > 0 ? (
                              <span>
                                <strong className="text-emerald-600 dark:text-emerald-400">{t.right}</strong>
                                {' / '}
                                <strong className="text-red-600 dark:text-red-400">{t.wrong}</strong>
                              </span>
                            ) : (
                              <span className="text-slate-400">--</span>
                            )}
                          </td>
                          <td className="py-2.5 px-2 text-center font-mono font-bold">
                            {t.attempts > 0 ? (
                              <span
                                className={
                                  isWeak
                                    ? 'text-red-600 dark:text-red-400'
                                    : isNeedsWork
                                    ? 'text-amber-600 dark:text-amber-400'
                                    : 'text-emerald-600 dark:text-emerald-400'
                                }
                              >
                                {t.accuracy}%
                              </span>
                            ) : (
                              <span className="text-slate-400 font-normal">--</span>
                            )}
                          </td>
                          <td className="py-2.5 px-2 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                isWeak
                                  ? 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400'
                                  : isNeedsWork
                                  ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400'
                                  : isGood
                                  ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                              }`}
                            >
                              {t.classification}
                            </span>
                          </td>
                          <td className="py-2.5 px-2 text-center">
                            {t.mistakeTags && (t.mistakeTags['concept gap'] > 0 || t.mistakeTags['silly mistake'] > 0) ? (
                              <div className="flex items-center justify-center gap-1 text-[10px]">
                                {t.mistakeTags['concept gap'] > 0 && (
                                  <span className="px-1.5 py-0.2 rounded bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800 font-semibold" title="Concept gaps">
                                    {t.mistakeTags['concept gap']} gap
                                  </span>
                                )}
                                {t.mistakeTags['silly mistake'] > 0 && (
                                  <span className="px-1.5 py-0.2 rounded bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 font-semibold" title="Silly mistakes">
                                    {t.mistakeTags['silly mistake']} silly
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-400 text-[10px]">--</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right text-slate-500 dark:text-slate-400 text-[11px]">
                            {t.daysSincePracticed !== null ? `${t.daysSincePracticed}d ago` : 'Never'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
