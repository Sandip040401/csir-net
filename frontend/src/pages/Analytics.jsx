import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  TrendingUp,
  Target,
  AlertTriangle,
  Award,
  Layers,
  Flame,
  Brain,
  Lightbulb,
  Clock,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  BookOpen,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
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
  // Global filters
  const [dateRange, setDateRange] = useState('all'); // '7d', '14d', '30d', 'all'
  const [kindFilter, setKindFilter] = useState('both');
  const [chapterFilter, setChapterFilter] = useState('');
  const [classificationFilter, setClassificationFilter] = useState('all');

  // AI Advice state
  const [aiAdviceText, setAiAdviceText] = useState(null);
  const [loadingAi, setLoadingAi] = useState(false);

  // Compute 'from' date for query params
  const computeFromDate = () => {
    if (dateRange === 'all') return undefined;
    const days = dateRange === '7d' ? 7 : dateRange === '14d' ? 14 : 30;
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString().split('T')[0];
  };

  const queryParams = {
    from: computeFromDate(),
    kind: kindFilter,
    chapterId: chapterFilter || undefined,
  };

  // 1. Overview KPIs
  const { data: overviewData, isLoading: loadingOverview } = useQuery({
    queryKey: ['analytics-overview', dateRange, kindFilter, chapterFilter],
    queryFn: async () => {
      const res = await api.get('/analytics/overview', { params: queryParams });
      return res.data.data;
    },
  });

  // 2. Topic Weakness Engine
  const { data: topicAnalyticsData, isLoading: loadingTopics } = useQuery({
    queryKey: ['analytics-topics', dateRange, kindFilter, chapterFilter],
    queryFn: async () => {
      const res = await api.get('/analytics/topics', { params: queryParams });
      return res.data;
    },
  });

  // 3. Chapter Analytics & Radar
  const { data: chapterAnalyticsData } = useQuery({
    queryKey: ['analytics-chapters', dateRange, kindFilter],
    queryFn: async () => {
      const res = await api.get('/analytics/chapters', { params: queryParams });
      return res.data.data;
    },
  });

  // 4. Daily Trends Timeline
  const { data: trendsData } = useQuery({
    queryKey: ['analytics-trends', dateRange, kindFilter, chapterFilter],
    queryFn: async () => {
      const res = await api.get('/analytics/trends', { params: queryParams });
      return res.data.data;
    },
  });

  // 5. Deterministic Recommendations
  const { data: recommendationsData } = useQuery({
    queryKey: ['analytics-recommendations'],
    queryFn: async () => {
      const res = await api.get('/analytics/recommendations');
      return res.data;
    },
  });

  // Fetch AI Advice handler
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
      alert(err.response?.data?.error || 'Failed to generate AI advice. Verify ANTHROPIC_API_KEY in .env.');
    } finally {
      setLoadingAi(false);
    }
  };

  const kpis = overviewData || {};
  const topicList = (topicAnalyticsData?.data || []).filter((t) => {
    if (classificationFilter === 'all') return true;
    return t.classification.toLowerCase() === classificationFilter.toLowerCase();
  });
  const top10ToFix = topicAnalyticsData?.top10ToFix || [];
  const chapters = chapterAnalyticsData || [];
  const trends = trendsData || [];
  const recommendations = recommendationsData?.data || [];

  // Radar data preparation
  const radarData = chapters.map((c) => ({
    chapter: c.isPartA ? 'Part A' : `Ch ${c.no}`,
    accuracy: c.accuracy,
    weight: (c.weight || 3) * 20, // scale 1-5 to 100 for comparison
  }));

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Top Header & Global Filters */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            Performance & Weakness Analytics
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 font-mono">
              Bayesian Engine
            </span>
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Real-time diagnostics, projected exam marks, and tactical revision recommendations
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 bg-[#161f30] p-1.5 rounded-xl border border-[#1f293d] text-xs">
          {/* Date range */}
          <div className="flex rounded-lg bg-[#0b0f19] p-0.5">
            {['7d', '14d', '30d', 'all'].map((r) => (
              <button
                key={r}
                onClick={() => setDateRange(r)}
                className={`px-2.5 py-1 rounded-md font-medium uppercase text-[10px] transition-all ${
                  dateRange === r
                    ? 'bg-blue-600 text-white font-bold shadow'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                {r}
              </button>
            ))}
          </div>

          {/* Session Kind */}
          <select
            value={kindFilter}
            onChange={(e) => setKindFilter(e.target.value)}
            className="px-2.5 py-1 bg-[#0b0f19] border border-[#1f293d] rounded-lg text-white text-xs focus:outline-none"
          >
            <option value="both">Practice & Mocks</option>
            <option value="practice">Practice Only</option>
            <option value="mock">Mocks Only</option>
          </select>
        </div>
      </div>

      {/* SECTION A: HEADLINE KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Exam Countdown & Total Questions */}
        <div className="bg-[#161f30] border border-[#1f293d] rounded-2xl p-4 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-400 text-xs">
            <span>Exam Countdown</span>
            <span className="p-1 rounded-lg bg-blue-500/10 text-blue-400">
              <Clock className="w-4 h-4" />
            </span>
          </div>
          <div className="my-2">
            <div className="text-3xl font-extrabold text-white">
              {kpis.countdown?.daysToExam ?? '--'}{' '}
              <span className="text-sm font-normal text-gray-400">Days</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Target: <strong className="text-white">{kpis.countdown?.examDate}</strong>
            </p>
          </div>
          <div className="pt-2 border-t border-[#1f293d] flex justify-between text-[11px] text-gray-400">
            <span>Total Solved:</span>
            <span className="font-bold text-white">{kpis.volume?.totalQuestions ?? 0} Qs</span>
          </div>
        </div>

        {/* Card 2: Overall Accuracy & 7-Day Trend */}
        <div className="bg-[#161f30] border border-[#1f293d] rounded-2xl p-4 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-400 text-xs">
            <span>Overall Accuracy</span>
            <span className="p-1 rounded-lg bg-emerald-500/10 text-emerald-400">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <div className="my-2">
            <div className="text-3xl font-extrabold text-emerald-400 font-mono">
              {kpis.accuracy?.overall ?? 0}%
            </div>
            <div className="flex items-center gap-1.5 text-xs mt-1">
              {Number(kpis.accuracy?.trend) >= 0 ? (
                <span className="text-emerald-400 flex items-center font-medium">
                  <ArrowUpRight className="w-3.5 h-3.5" /> +{kpis.accuracy?.trend}%
                </span>
              ) : (
                <span className="text-red-400 flex items-center font-medium">
                  <ArrowDownRight className="w-3.5 h-3.5" /> {kpis.accuracy?.trend}%
                </span>
              )}
              <span className="text-gray-400">vs previous 7 days</span>
            </div>
          </div>
          <div className="pt-2 border-t border-[#1f293d] flex justify-between text-[11px] text-gray-400">
            <span>Streak:</span>
            <span className="font-bold text-orange-400">🔥 {kpis.volume?.currentStreak ?? 0} days</span>
          </div>
        </div>

        {/* Card 3: Projected Marks / 200 */}
        <div className="bg-[#161f30] border border-[#1f293d] rounded-2xl p-4 shadow-lg flex flex-col justify-between relative overflow-hidden">
          <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-blue-500/5 rounded-full pointer-events-none" />
          <div className="flex items-center justify-between text-gray-400 text-xs">
            <span>Projected Score (Est.)</span>
            <span className="p-1 rounded-lg bg-purple-500/10 text-purple-400">
              <Award className="w-4 h-4" />
            </span>
          </div>
          <div className="my-2">
            <div className="text-3xl font-extrabold text-purple-300 font-mono">
              {kpis.projectedMarks?.projectedTotal ?? 0}{' '}
              <span className="text-sm font-normal text-gray-400">/ 200</span>
            </div>
            <p className="text-xs text-red-400/90 mt-1">
              -{kpis.projectedMarks?.totalLostToNegatives ?? 0} marks lost to negative penalties
            </p>
          </div>
          <div className="pt-2 border-t border-[#1f293d] flex justify-between text-[11px] text-gray-400">
            <span>Part A/B/C Net:</span>
            <span className="font-bold text-gray-300">
              {kpis.projectedMarks?.partA?.expectedScore ?? 0} /{' '}
              {kpis.projectedMarks?.partB?.expectedScore ?? 0} /{' '}
              {kpis.projectedMarks?.partC?.expectedScore ?? 0}
            </span>
          </div>
        </div>

        {/* Card 4: Syllabus Coverage */}
        <div className="bg-[#161f30] border border-[#1f293d] rounded-2xl p-4 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-400 text-xs">
            <span>Syllabus Coverage</span>
            <span className="p-1 rounded-lg bg-indigo-500/10 text-indigo-400">
              <Layers className="w-4 h-4" />
            </span>
          </div>
          <div className="my-2">
            <div className="text-3xl font-extrabold text-indigo-400 font-mono">
              {kpis.coverage?.syllabusCoveragePct ?? 0}%
            </div>
            <p className="text-xs text-gray-400 mt-1">
              <strong className="text-white">{kpis.coverage?.attemptedTopicsCount ?? 0}</strong> of{' '}
              {kpis.coverage?.totalTopicsCount ?? 0} topics touched
            </p>
          </div>
          <div className="pt-2 border-t border-[#1f293d] flex justify-between text-[11px] text-gray-400">
            <span>Untouched Topics:</span>
            <span className="font-bold text-amber-400">
              {kpis.coverage?.untouchedTopics ?? 0} remaining
            </span>
          </div>
        </div>
      </div>

      {/* Part A vs Part B vs Part C Accuracy Breakdown Bar */}
      <div className="bg-[#161f30] border border-[#1f293d] rounded-2xl p-4 md:p-6 shadow-xl">
        <h3 className="text-sm font-bold uppercase tracking-wider text-gray-300 mb-3 flex items-center gap-2">
          <Target className="w-4 h-4 text-blue-400" />
          Exam Section Benchmark (Part A vs B vs C)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Part A */}
          <div className="bg-[#0b0f19] p-4 rounded-xl border border-[#1f293d]">
            <div className="flex justify-between items-center mb-1">
              <span className="font-bold text-sm text-white">Part A (General Aptitude)</span>
              <span className="font-mono font-bold text-blue-400">
                {kpis.partsBreakdown?.partA?.accuracy ?? 0}%
              </span>
            </div>
            <p className="text-xs text-gray-400 mb-2">
              {kpis.partsBreakdown?.partA?.attempts ?? 0} Qs attempted • +2 / -0.5
            </p>
            <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
              <div
                className="bg-blue-500 h-2 rounded-full"
                style={{ width: `${kpis.partsBreakdown?.partA?.accuracy ?? 0}%` }}
              />
            </div>
          </div>

          {/* Part B */}
          <div className="bg-[#0b0f19] p-4 rounded-xl border border-[#1f293d]">
            <div className="flex justify-between items-center mb-1">
              <span className="font-bold text-sm text-white">Part B (Direct Subject MCQs)</span>
              <span className="font-mono font-bold text-emerald-400">
                {kpis.partsBreakdown?.partB?.accuracy ?? 0}%
              </span>
            </div>
            <p className="text-xs text-gray-400 mb-2">
              {kpis.partsBreakdown?.partB?.attempts ?? 0} Qs attempted • +2 / -0.5
            </p>
            <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
              <div
                className="bg-emerald-500 h-2 rounded-full"
                style={{ width: `${kpis.partsBreakdown?.partB?.accuracy ?? 0}%` }}
              />
            </div>
          </div>

          {/* Part C */}
          <div className="bg-[#0b0f19] p-4 rounded-xl border border-[#1f293d]">
            <div className="flex justify-between items-center mb-1">
              <span className="font-bold text-sm text-white">Part C (High-Yield Analytics)</span>
              <span className="font-mono font-bold text-purple-400">
                {kpis.partsBreakdown?.partC?.accuracy ?? 0}%
              </span>
            </div>
            <p className="text-xs text-gray-400 mb-2">
              {kpis.partsBreakdown?.partC?.attempts ?? 0} Qs attempted • +4 / -1.0
            </p>
            <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
              <div
                className="bg-purple-500 h-2 rounded-full"
                style={{ width: `${kpis.partsBreakdown?.partC?.accuracy ?? 0}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* SECTION B: WEAKNESS ENGINE - TOP 10 TOPICS TO FIX NOW */}
      <div className="bg-[#161f30] border border-[#1f293d] rounded-2xl p-4 md:p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
              Priority Deficit Engine — Top 10 Topics to Fix Now
            </h3>
            <p className="text-xs text-gray-400">
              Ranked by: Weight × (1 − Wilson/Bayesian accuracy) × Staleness Factor × Chapter Weight
            </p>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-[#1f293d]">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0b0f19] text-gray-400 uppercase text-[10px] tracking-wider border-b border-[#1f293d]">
              <tr>
                <th className="py-2.5 px-3">Rank & Topic</th>
                <th className="py-2.5 px-2">Chapter</th>
                <th className="py-2.5 px-2 text-center">Attempts</th>
                <th className="py-2.5 px-2 text-center">Raw Acc</th>
                <th className="py-2.5 px-2 text-center">Smoothed (Bayesian)</th>
                <th className="py-2.5 px-2 text-center">Last Practiced</th>
                <th className="py-2.5 px-2 text-center">Status</th>
                <th className="py-2.5 px-3 text-right">Priority Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800 bg-[#111827]">
              {top10ToFix.map((t, idx) => (
                <tr key={t.topicId} className="hover:bg-[#161f30]/60">
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-red-500/20 text-red-300 font-bold text-[10px] flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <span className="font-mono font-bold text-blue-400">{t.code}</span>
                      <span className="font-medium text-white">{t.name}</span>
                    </div>
                  </td>
                  <td className="py-2.5 px-2 text-gray-400 truncate max-w-[160px]">
                    {t.chapterName}
                  </td>
                  <td className="py-2.5 px-2 text-center font-mono">{t.attempts}</td>
                  <td className="py-2.5 px-2 text-center font-mono font-semibold">
                    <span
                      className={
                        t.accuracy < 50
                          ? 'text-red-400'
                          : t.accuracy < 70
                          ? 'text-amber-400'
                          : 'text-emerald-400'
                      }
                    >
                      {t.accuracy}%
                    </span>
                  </td>
                  <td className="py-2.5 px-2 text-center font-mono text-gray-300">
                    {t.smoothedAccuracy}%
                  </td>
                  <td className="py-2.5 px-2 text-center text-gray-400 text-[11px]">
                    {t.daysSincePracticed !== null
                      ? `${t.daysSincePracticed}d ago`
                      : 'Never (Untested)'}
                  </td>
                  <td className="py-2.5 px-2 text-center">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        t.classification === 'Weak'
                          ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                          : t.classification === 'Needs work'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : t.classification === 'Untested'
                          ? 'bg-gray-700 text-gray-300'
                          : 'bg-blue-500/20 text-blue-300'
                      }`}
                    >
                      {t.classification}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-400">
                    {t.priorityScore}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION C: VISUAL CHARTS (Daily Volume Line + Chapter Radar & Accuracy) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Volume & Target Chart */}
        <div className="bg-[#161f30] border border-[#1f293d] rounded-2xl p-4 md:p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-white">Daily Question Volume</h3>
              <p className="text-xs text-gray-400">Questions solved per day vs 100 Qs target</p>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trends}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f293d" />
                <XAxis dataKey="date" stroke="#6b7280" tick={{ fontSize: 10 }} />
                <YAxis stroke="#6b7280" tick={{ fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#111827', borderColor: '#1f293d', borderRadius: 8 }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line
                  type="monotone"
                  dataKey="total"
                  name="Questions Solved"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 6 }}
                />
                <Line
                  type="monotone"
                  dataKey="target"
                  name="Daily Target"
                  stroke="#10b981"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chapter Competency Radar Chart */}
        <div className="bg-[#161f30] border border-[#1f293d] rounded-2xl p-4 md:p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-white">Chapter Competency Map</h3>
              <p className="text-xs text-gray-400">Accuracy % per chapter vs syllabus weight</p>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData}>
                <PolarGrid stroke="#1f293d" />
                <PolarAngleAxis dataKey="chapter" stroke="#9ca3af" tick={{ fontSize: 10 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="#4b5563" />
                <Radar
                  name="Accuracy %"
                  dataKey="accuracy"
                  stroke="#8b5cf6"
                  fill="#8b5cf6"
                  fillOpacity={0.4}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#111827', borderColor: '#1f293d', borderRadius: 8 }}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Chapter Deep Dive Table (Practice vs Mock Gap & Part B vs C) */}
      <div className="bg-[#161f30] border border-[#1f293d] rounded-2xl p-4 md:p-6 shadow-xl space-y-4">
        <h3 className="text-sm font-bold uppercase tracking-wider text-gray-300 flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-blue-400" /> Chapter Breakdown & Exam-Pressure Gap
        </h3>

        <div className="overflow-x-auto rounded-xl border border-[#1f293d]">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0b0f19] text-gray-400 uppercase text-[10px] tracking-wider border-b border-[#1f293d]">
              <tr>
                <th className="py-2.5 px-3">Chapter</th>
                <th className="py-2.5 px-2 text-center">Weight</th>
                <th className="py-2.5 px-2 text-center">Attempts</th>
                <th className="py-2.5 px-2 text-center">Overall Acc</th>
                <th className="py-2.5 px-2 text-center">Part B Acc</th>
                <th className="py-2.5 px-2 text-center">Part C Acc</th>
                <th className="py-2.5 px-2 text-center">Practice Acc</th>
                <th className="py-2.5 px-2 text-center">Mock Acc</th>
                <th className="py-2.5 px-3 text-right">Pressure Gap</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800 bg-[#111827]">
              {chapters.map((ch) => (
                <tr key={ch.chapterId} className="hover:bg-[#161f30]/60">
                  <td className="py-2.5 px-3 font-medium text-white">
                    {ch.isPartA ? ch.name : `Ch ${ch.no}: ${ch.name}`}
                  </td>
                  <td className="py-2.5 px-2 text-center font-bold text-blue-400">
                    {'★'.repeat(ch.weight || 3)}
                  </td>
                  <td className="py-2.5 px-2 text-center font-mono">{ch.attempts}</td>
                  <td className="py-2.5 px-2 text-center font-mono font-semibold">
                    <span
                      className={
                        ch.accuracy >= 70
                          ? 'text-emerald-400'
                          : ch.accuracy >= 50
                          ? 'text-amber-400'
                          : 'text-red-400'
                      }
                    >
                      {ch.accuracy}%
                    </span>
                  </td>
                  <td className="py-2.5 px-2 text-center font-mono text-gray-300">
                    {ch.isPartA ? '—' : `${ch.bAccuracy}%`}
                  </td>
                  <td className="py-2.5 px-2 text-center font-mono text-gray-300">
                    {ch.isPartA ? '—' : `${ch.cAccuracy}%`}
                  </td>
                  <td className="py-2.5 px-2 text-center font-mono text-gray-400">
                    {ch.practiceAccuracy}%
                  </td>
                  <td className="py-2.5 px-2 text-center font-mono text-indigo-400">
                    {ch.mockAccuracy > 0 ? `${ch.mockAccuracy}%` : '—'}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono">
                    {ch.mockGap > 10 ? (
                      <span className="text-red-400 font-bold">-{ch.mockGap}% gap</span>
                    ) : ch.mockGap < 0 ? (
                      <span className="text-emerald-400 font-bold">+{Math.abs(ch.mockGap)}% mock</span>
                    ) : (
                      <span className="text-gray-500">0%</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION D: "HOW TO IMPROVE" ACTION PANEL */}
      <div className="bg-[#161f30] border border-[#1f293d] rounded-2xl p-4 md:p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-amber-400" />
              Tactical Improvement Recommendations (Deterministic Engine)
            </h3>
            <p className="text-xs text-gray-400">
              Rule-based diagnostics generated server-side from your accuracy, mistake tags, and time intervals
            </p>
          </div>

          {/* Optional AI Study Advice Button */}
          {recommendationsData?.hasAnthropicKey && (
            <button
              onClick={handleFetchAiAdvice}
              disabled={loadingAi}
              className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-2 shadow-md shadow-purple-600/30 transition-all self-start sm:self-auto"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{loadingAi ? 'Consulting Claude...' : 'Generate AI Study Advice'}</span>
            </button>
          )}
        </div>

        {/* AI Advice Output if fetched */}
        {aiAdviceText && (
          <div className="p-4 rounded-xl bg-purple-950/30 border border-purple-500/30 text-purple-200 text-xs space-y-2">
            <div className="flex items-center gap-2 font-bold text-purple-300">
              <Sparkles className="w-4 h-4" /> Claude AI Tactical Guidance:
            </div>
            <div className="whitespace-pre-line leading-relaxed">{aiAdviceText}</div>
          </div>
        )}

        {/* Recommendations list */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {recommendations.map((rec) => (
            <div
              key={rec.id}
              className={`p-4 rounded-xl border flex flex-col justify-between gap-2 transition-all ${
                rec.severity === 'critical'
                  ? 'bg-red-950/20 border-red-500/30 text-red-200'
                  : rec.severity === 'warning'
                  ? 'bg-amber-950/20 border-amber-500/30 text-amber-200'
                  : 'bg-blue-950/20 border-blue-500/30 text-blue-200'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="font-bold text-xs text-white">{rec.title}</span>
                  <span
                    className={`text-[9px] uppercase font-mono px-2 py-0.5 rounded font-bold ${
                      rec.severity === 'critical'
                        ? 'bg-red-500/20 text-red-400'
                        : rec.severity === 'warning'
                        ? 'bg-amber-500/20 text-amber-400'
                        : 'bg-blue-500/20 text-blue-400'
                    }`}
                  >
                    {rec.severity}
                  </span>
                </div>
                <p className="text-[11px] text-gray-300 leading-relaxed">{rec.description}</p>
              </div>

              <div className="pt-2 border-t border-white/10 flex items-center gap-1.5 text-[11px] font-semibold text-white">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Action: {rec.action}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
