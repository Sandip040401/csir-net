import React, { useState } from 'react';
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
  const [dateRange, setDateRange] = useState('all');
  const [kindFilter, setKindFilter] = useState('both');
  const [chapterFilter, setChapterFilter] = useState('');
  const [classificationFilter, setClassificationFilter] = useState('all');

  const [aiAdviceText, setAiAdviceText] = useState(null);
  const [loadingAi, setLoadingAi] = useState(false);

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

  const { data: overviewData } = useQuery({
    queryKey: ['analytics-overview', dateRange, kindFilter, chapterFilter],
    queryFn: async () => {
      const res = await api.get('/analytics/overview', { params: queryParams });
      return res.data.data;
    },
  });

  const { data: topicAnalyticsData } = useQuery({
    queryKey: ['analytics-topics', dateRange, kindFilter, chapterFilter],
    queryFn: async () => {
      const res = await api.get('/analytics/topics', { params: queryParams });
      return res.data;
    },
  });

  const { data: chapterAnalyticsData } = useQuery({
    queryKey: ['analytics-chapters', dateRange, kindFilter],
    queryFn: async () => {
      const res = await api.get('/analytics/chapters', { params: queryParams });
      return res.data.data;
    },
  });

  const { data: trendsData } = useQuery({
    queryKey: ['analytics-trends', dateRange, kindFilter, chapterFilter],
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
  const top10ToFix = topicAnalyticsData?.top10ToFix || [];
  const chapters = chapterAnalyticsData || [];
  const trends = trendsData || [];
  const recommendations = recommendationsData?.data || [];

  const radarData = chapters.map((c) => ({
    chapter: c.isPartA ? 'Part A' : `Ch ${c.no}`,
    accuracy: c.accuracy,
  }));

  return (
    <div className="space-y-8 animate-fade-in text-slate-800">
      {/* Top Header & Global Filters */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            Performance & Weakness Analytics
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 font-semibold border border-blue-200">
              Bayesian Engine
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time diagnostics, projected exam marks, and tactical revision recommendations
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 bg-white p-1.5 rounded-xl border border-slate-200 text-xs shadow-xs">
          <div className="flex rounded-lg bg-slate-100 p-0.5">
            {['7d', '14d', '30d', 'all'].map((r) => (
              <button
                key={r}
                onClick={() => setDateRange(r)}
                className={`px-2.5 py-1 rounded-md font-semibold uppercase text-[10px] transition-all ${
                  dateRange === r
                    ? 'bg-white text-blue-700 font-bold shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {r}
              </button>
            ))}
          </div>

          <select
            value={kindFilter}
            onChange={(e) => setKindFilter(e.target.value)}
            className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 text-xs font-medium focus:outline-none"
          >
            <option value="both">Practice & Mocks</option>
            <option value="practice">Practice Only</option>
            <option value="mock">Mocks Only</option>
          </select>
        </div>
      </div>

      {/* SECTION A: HEADLINE KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Exam Countdown */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Exam Countdown</span>
            <span className="p-1 rounded-lg bg-blue-50 text-blue-600">
              <Clock className="w-4 h-4" />
            </span>
          </div>
          <div className="my-2">
            <div className="text-3xl font-extrabold text-slate-900">
              {kpis.countdown?.daysToExam ?? '--'}{' '}
              <span className="text-sm font-normal text-slate-500">Days</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Target: <strong className="text-slate-800">{kpis.countdown?.examDate}</strong>
            </p>
          </div>
          <div className="pt-2 border-t border-slate-100 flex justify-between text-[11px] text-slate-500">
            <span>Total Solved:</span>
            <span className="font-bold text-slate-900">{kpis.volume?.totalQuestions ?? 0} Qs</span>
          </div>
        </div>

        {/* Card 2: Overall Accuracy */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Overall Accuracy</span>
            <span className="p-1 rounded-lg bg-emerald-50 text-emerald-600">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <div className="my-2">
            <div className="text-3xl font-extrabold text-emerald-600 font-mono">
              {kpis.accuracy?.overall ?? 0}%
            </div>
            <div className="flex items-center gap-1.5 text-xs mt-1">
              {Number(kpis.accuracy?.trend) >= 0 ? (
                <span className="text-emerald-600 flex items-center font-bold">
                  <ArrowUpRight className="w-3.5 h-3.5" /> +{kpis.accuracy?.trend}%
                </span>
              ) : (
                <span className="text-red-600 flex items-center font-bold">
                  <ArrowDownRight className="w-3.5 h-3.5" /> {kpis.accuracy?.trend}%
                </span>
              )}
              <span className="text-slate-500">vs prev 7 days</span>
            </div>
          </div>
          <div className="pt-2 border-t border-slate-100 flex justify-between text-[11px] text-slate-500">
            <span>Streak:</span>
            <span className="font-bold text-orange-600">🔥 {kpis.volume?.currentStreak ?? 0} days</span>
          </div>
        </div>

        {/* Card 3: Projected Marks */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Projected Score (Est.)</span>
            <span className="p-1 rounded-lg bg-purple-50 text-purple-600">
              <Award className="w-4 h-4" />
            </span>
          </div>
          <div className="my-2">
            <div className="text-3xl font-extrabold text-purple-700 font-mono">
              {kpis.projectedMarks?.projectedTotal ?? 0}{' '}
              <span className="text-sm font-normal text-slate-500">/ 200</span>
            </div>
            <p className="text-xs text-red-600 mt-1 font-medium">
              -{kpis.projectedMarks?.totalLostToNegatives ?? 0} marks lost to negative penalties
            </p>
          </div>
          <div className="pt-2 border-t border-slate-100 flex justify-between text-[11px] text-slate-500">
            <span>Part A/B/C Net:</span>
            <span className="font-bold text-slate-800">
              {kpis.projectedMarks?.partA?.expectedScore ?? 0} /{' '}
              {kpis.projectedMarks?.partB?.expectedScore ?? 0} /{' '}
              {kpis.projectedMarks?.partC?.expectedScore ?? 0}
            </span>
          </div>
        </div>

        {/* Card 4: Syllabus Coverage */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Syllabus Coverage</span>
            <span className="p-1 rounded-lg bg-indigo-50 text-indigo-600">
              <Layers className="w-4 h-4" />
            </span>
          </div>
          <div className="my-2">
            <div className="text-3xl font-extrabold text-indigo-600 font-mono">
              {kpis.coverage?.syllabusCoveragePct ?? 0}%
            </div>
            <p className="text-xs text-slate-500 mt-1">
              <strong className="text-slate-800">{kpis.coverage?.attemptedTopicsCount ?? 0}</strong> of{' '}
              {kpis.coverage?.totalTopicsCount ?? 0} topics touched
            </p>
          </div>
          <div className="pt-2 border-t border-slate-100 flex justify-between text-[11px] text-slate-500">
            <span>Untouched Topics:</span>
            <span className="font-bold text-amber-600">
              {kpis.coverage?.untouchedTopics ?? 0} remaining
            </span>
          </div>
        </div>
      </div>

      {/* Part A vs Part B vs Part C Benchmark */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 md:p-6 shadow-xs">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 mb-3 flex items-center gap-2">
          <Target className="w-4 h-4 text-blue-600" />
          Exam Section Benchmark (Part A vs B vs C)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div className="flex justify-between items-center mb-1">
              <span className="font-bold text-sm text-slate-900">Part A (General Aptitude)</span>
              <span className="font-mono font-bold text-blue-600">
                {kpis.partsBreakdown?.partA?.accuracy ?? 0}%
              </span>
            </div>
            <p className="text-xs text-slate-500 mb-2">
              {kpis.partsBreakdown?.partA?.attempts ?? 0} Qs attempted • +2 / -0.5
            </p>
            <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
              <div
                className="bg-blue-600 h-2 rounded-full"
                style={{ width: `${kpis.partsBreakdown?.partA?.accuracy ?? 0}%` }}
              />
            </div>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div className="flex justify-between items-center mb-1">
              <span className="font-bold text-sm text-slate-900">Part B (Direct MCQs)</span>
              <span className="font-mono font-bold text-emerald-600">
                {kpis.partsBreakdown?.partB?.accuracy ?? 0}%
              </span>
            </div>
            <p className="text-xs text-slate-500 mb-2">
              {kpis.partsBreakdown?.partB?.attempts ?? 0} Qs attempted • +2 / -0.5
            </p>
            <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
              <div
                className="bg-emerald-500 h-2 rounded-full"
                style={{ width: `${kpis.partsBreakdown?.partB?.accuracy ?? 0}%` }}
              />
            </div>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div className="flex justify-between items-center mb-1">
              <span className="font-bold text-sm text-slate-900">Part C (Analytics)</span>
              <span className="font-mono font-bold text-purple-600">
                {kpis.partsBreakdown?.partC?.accuracy ?? 0}%
              </span>
            </div>
            <p className="text-xs text-slate-500 mb-2">
              {kpis.partsBreakdown?.partC?.attempts ?? 0} Qs attempted • +4 / -1.0
            </p>
            <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
              <div
                className="bg-purple-600 h-2 rounded-full"
                style={{ width: `${kpis.partsBreakdown?.partC?.accuracy ?? 0}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* SECTION B: WEAKNESS ENGINE - TOP 10 TOPICS */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 md:p-6 shadow-xs space-y-4">
        <div>
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            Priority Deficit Engine — Top 10 Topics to Fix Now
          </h3>
          <p className="text-xs text-slate-500">
            Ranked by: Weight × (1 − Wilson/Bayesian accuracy) × Staleness Factor × Chapter Weight
          </p>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold tracking-wider border-b border-slate-200">
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
            <tbody className="divide-y divide-slate-100 bg-white">
              {top10ToFix.map((t, idx) => (
                <tr key={t.topicId} className="hover:bg-slate-50">
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-red-100 text-red-700 font-bold text-[10px] flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <span className="font-mono font-bold text-blue-600">{t.code}</span>
                      <span className="font-semibold text-slate-900">{t.name}</span>
                    </div>
                  </td>
                  <td className="py-2.5 px-2 text-slate-600 truncate max-w-[160px]">
                    {t.chapterName}
                  </td>
                  <td className="py-2.5 px-2 text-center font-mono font-medium">{t.attempts}</td>
                  <td className="py-2.5 px-2 text-center font-mono font-bold">
                    <span
                      className={
                        t.accuracy < 50
                          ? 'text-red-600'
                          : t.accuracy < 70
                          ? 'text-amber-600'
                          : 'text-emerald-600'
                      }
                    >
                      {t.accuracy}%
                    </span>
                  </td>
                  <td className="py-2.5 px-2 text-center font-mono text-slate-700">
                    {t.smoothedAccuracy}%
                  </td>
                  <td className="py-2.5 px-2 text-center text-slate-500 text-[11px]">
                    {t.daysSincePracticed !== null
                      ? `${t.daysSincePracticed}d ago`
                      : 'Never'}
                  </td>
                  <td className="py-2.5 px-2 text-center">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        t.classification === 'Weak'
                          ? 'bg-red-50 text-red-700 border border-red-200'
                          : t.classification === 'Needs work'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : t.classification === 'Untested'
                          ? 'bg-slate-100 text-slate-700'
                          : 'bg-blue-50 text-blue-700'
                      }`}
                    >
                      {t.classification}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-600">
                    {t.priorityScore}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION C: CHARTS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 md:p-6 shadow-xs">
          <h3 className="text-sm font-bold text-slate-900 mb-1">Daily Question Volume</h3>
          <p className="text-xs text-slate-500 mb-4">Questions solved vs 100 Qs daily goal</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trends}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" stroke="#64748b" tick={{ fontSize: 10 }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: 8 }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line
                  type="monotone"
                  dataKey="total"
                  name="Questions Solved"
                  stroke="#2563eb"
                  strokeWidth={2}
                  dot={{ r: 3 }}
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

        <div className="bg-white border border-slate-200 rounded-2xl p-4 md:p-6 shadow-xs">
          <h3 className="text-sm font-bold text-slate-900 mb-1">Chapter Competency Map</h3>
          <p className="text-xs text-slate-500 mb-4">Accuracy % per chapter</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData}>
                <PolarGrid stroke="#e2e8f0" />
                <PolarAngleAxis dataKey="chapter" stroke="#64748b" tick={{ fontSize: 10 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="#94a3b8" />
                <Radar
                  name="Accuracy %"
                  dataKey="accuracy"
                  stroke="#7c3aed"
                  fill="#7c3aed"
                  fillOpacity={0.3}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: 8 }}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* SECTION D: TACTICAL IMPROVEMENT RECOMMENDATIONS */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 md:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-amber-500" />
              Tactical Improvement Recommendations (Deterministic Engine)
            </h3>
            <p className="text-xs text-slate-500">
              Rule-based diagnostics generated server-side from your accuracy and mistake intervals
            </p>
          </div>

          {recommendationsData?.hasAnthropicKey && (
            <button
              onClick={handleFetchAiAdvice}
              disabled={loadingAi}
              className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-2 shadow-xs transition-all self-start sm:self-auto"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{loadingAi ? 'Consulting Claude...' : 'Generate AI Advice'}</span>
            </button>
          )}
        </div>

        {aiAdviceText && (
          <div className="p-4 rounded-xl bg-purple-50 border border-purple-200 text-purple-900 text-xs space-y-2">
            <div className="flex items-center gap-2 font-bold text-purple-700">
              <Sparkles className="w-4 h-4" /> Claude AI Tactical Guidance:
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
                  ? 'bg-red-50/60 border-red-200 text-red-900'
                  : rec.severity === 'warning'
                  ? 'bg-amber-50/60 border-amber-200 text-amber-900'
                  : 'bg-blue-50/60 border-blue-200 text-blue-900'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="font-bold text-xs text-slate-900">{rec.title}</span>
                  <span
                    className={`text-[9px] uppercase font-mono px-2 py-0.5 rounded font-bold ${
                      rec.severity === 'critical'
                        ? 'bg-red-100 text-red-700'
                        : rec.severity === 'warning'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}
                  >
                    {rec.severity}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">{rec.description}</p>
              </div>

              <div className="pt-2 border-t border-slate-200/60 flex items-center gap-1.5 text-[11px] font-semibold text-slate-900">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Action: {rec.action}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
