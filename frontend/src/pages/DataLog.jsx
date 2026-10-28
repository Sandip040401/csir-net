import React, { useState, useEffect } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Save,
  Sparkles,
  Clock,
  Tag,
  Check,
  AlertTriangle,
  FileText,
  HelpCircle,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

const MISTAKE_OPTIONS = ['concept gap', 'silly mistake', 'time', 'guess'];

export const DataLog = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [selectedDate, setSelectedDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [slot, setSlot] = useState(() => localStorage.getItem('last_slot') || 'morning');
  const [kind, setKind] = useState(() => (slot === 'night' ? 'mock' : 'practice'));

  const [chapterBlocks, setChapterBlocks] = useState([
    {
      id: 'block-1',
      chapterId: '',
      timeTakenMin: '',
      notes: '',
      entries: [],
    },
  ]);

  const [toastMessage, setToastMessage] = useState(null);
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState(null);
  const [daySummary, setDaySummary] = useState(null);

  const { data: chaptersData } = useQuery({
    queryKey: ['chapters'],
    queryFn: async () => {
      const res = await api.get('/chapters');
      return res.data.data;
    },
  });

  const chapters = chaptersData || [];

  const { data: allTopicsData } = useQuery({
    queryKey: ['all-topics'],
    queryFn: async () => {
      const res = await api.get('/chapters/all-topics');
      return res.data.data;
    },
  });
  const allTopics = allTopicsData || [];

  const { data: daySessionsData, refetch: refetchDaySessions } = useQuery({
    queryKey: ['sessions-by-date', selectedDate],
    queryFn: async () => {
      const res = await api.get(`/sessions/by-date/${selectedDate}`);
      return res.data.data;
    },
    enabled: Boolean(selectedDate),
  });

  useEffect(() => {
    if (daySessionsData && daySessionsData.length > 0) {
      const matching = daySessionsData.filter((s) => s.slot === slot);
      if (matching.length > 0) {
        const blocks = matching.map((s, idx) => ({
          id: `block-${idx + 1}`,
          sessionId: s._id,
          chapterId: s.chapterId?._id || s.chapterId,
          timeTakenMin: s.timeTakenMin ?? '',
          notes: s.notes || '',
          entries: (s.entries || []).map((e) => ({
            topicId: e.topicId?._id || e.topicId,
            topicCode: e.topicCode || e.topicId?.code || '',
            topicName: e.topicName || e.topicId?.name || '',
            description: e.topicId?.description || '',
            total: e.total,
            right: e.right,
            wrong: e.wrong,
            bTotal: e.bTotal || 0,
            cTotal: e.cTotal || 0,
            bRight: e.bRight ?? '',
            skipped: e.skipped || 0,
            mistakeTags: e.mistakeTags || [],
          })),
        }));
        setChapterBlocks(blocks);
        return;
      }
    }

    const draft = localStorage.getItem(`draft_${selectedDate}_${slot}`);
    if (draft) {
      try {
        setChapterBlocks(JSON.parse(draft));
        return;
      } catch (e) {}
    }

    const lastChId = localStorage.getItem('last_chapterId') || (chapters[1]?._id || '');
    setChapterBlocks([
      {
        id: 'block-1',
        chapterId: lastChId,
        timeTakenMin: '',
        notes: '',
        entries: [],
      },
    ]);
  }, [daySessionsData, selectedDate, slot, chapters]);

  const handleSlotChange = (newSlot) => {
    setSlot(newSlot);
    setKind(newSlot === 'night' ? 'mock' : 'practice');
    localStorage.setItem('last_slot', newSlot);
  };

  const shiftDay = (days) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  useEffect(() => {
    if (chapterBlocks.length > 0) {
      localStorage.setItem(`draft_${selectedDate}_${slot}`, JSON.stringify(chapterBlocks));
    }
  }, [chapterBlocks, selectedDate, slot]);

  const updateBlock = (blockId, updates) => {
    setChapterBlocks((prev) =>
      prev.map((b) => (b.id === blockId ? { ...b, ...updates } : b))
    );
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      setLastSavedSnapshot(JSON.parse(JSON.stringify(chapterBlocks)));

      let savedCount = 0;
      let totalQs = 0;
      let totalRight = 0;
      const topicMistakeMap = {};

      for (const block of chapterBlocks) {
        if (!block.chapterId || block.entries.length === 0) continue;

        const payload = {
          date: selectedDate,
          slot,
          kind,
          chapterId: block.chapterId,
          timeTakenMin: block.timeTakenMin ? Number(block.timeTakenMin) : null,
          notes: block.notes || '',
          entries: block.entries.map((e) => {
            totalQs += Number(e.total || 0);
            totalRight += Number(e.right || 0);
            const wrongCount = Number(e.wrong || 0);
            if (wrongCount > 0) {
              topicMistakeMap[e.topicName] = (topicMistakeMap[e.topicName] || 0) + wrongCount;
            }

            return {
              topicId: e.topicId,
              topicCode: e.topicCode,
              topicName: e.topicName,
              total: Number(e.total || 0),
              right: Number(e.right || 0),
              wrong: Number(e.wrong || 0),
              bTotal: Number(e.bTotal || 0),
              cTotal: Number(e.cTotal || 0),
              bRight: e.bRight !== '' && e.bRight !== null ? Number(e.bRight) : null,
              skipped: Number(e.skipped || 0),
              mistakeTags: e.mistakeTags || [],
            };
          }),
        };

        await api.put('/sessions', payload);
        savedCount++;
      }

      let weakestToday = null;
      let maxWrong = 0;
      for (const [tName, wrongs] of Object.entries(topicMistakeMap)) {
        if (wrongs > maxWrong) {
          maxWrong = wrongs;
          weakestToday = tName;
        }
      }

      const accToday = totalQs > 0 ? Math.round((totalRight / totalQs) * 100) : 0;
      setDaySummary({
        totalQuestions: totalQs,
        accuracy: accToday,
        weakestTopic: weakestToday,
      });

      localStorage.removeItem(`draft_${selectedDate}_${slot}`);
      return savedCount;
    },
    onSuccess: (count) => {
      refetchDaySessions();
      queryClient.invalidateQueries({ queryKey: ['quick-kpis'] });
      queryClient.invalidateQueries({ queryKey: ['analytics-overview'] });
      showToast(`Saved ${count} session block${count === 1 ? '' : 's'} successfully!`);
    },
    onError: (err) => {
      showToast(err.response?.data?.error || 'Failed to save session.', 'error');
    },
  });

  const showToast = (msg, type = 'success') => {
    setToastMessage({ msg, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleUndo = () => {
    if (lastSavedSnapshot) {
      setChapterBlocks(lastSavedSnapshot);
      setLastSavedSnapshot(null);
      showToast('Restored previous draft state.', 'info');
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        saveMutation.mutate();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [chapterBlocks, selectedDate, slot, kind]);

  const addChapterBlock = () => {
    setChapterBlocks((prev) => [
      ...prev,
      {
        id: `block-${Date.now()}`,
        chapterId: '',
        timeTakenMin: '',
        notes: '',
        entries: [],
      },
    ]);
  };

  const removeChapterBlock = (blockId) => {
    if (chapterBlocks.length === 1) {
      updateBlock(blockId, { entries: [] });
      return;
    }
    setChapterBlocks((prev) => prev.filter((b) => b.id !== blockId));
  };

  const dayTotals = chapterBlocks.reduce(
    (acc, b) => {
      b.entries.forEach((e) => {
        acc.total += Number(e.total || 0);
        acc.right += Number(e.right || 0);
        acc.wrong += Number(e.wrong || 0);
        acc.bTotal += Number(e.bTotal || 0);
        acc.cTotal += Number(e.cTotal || 0);
      });
      return acc;
    },
    { total: 0, right: 0, wrong: 0, bTotal: 0, cTotal: 0 }
  );

  const dayAccuracy = dayTotals.total > 0 ? Math.round((dayTotals.right / dayTotals.total) * 100) : 0;
  const dailyTarget = user?.dailyTarget || 100;
  const progressPct = Math.min(100, Math.round((dayTotals.total / dailyTarget) * 100));

  return (
    <div className="space-y-6 animate-fade-in text-slate-800">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-xl border text-sm flex items-center gap-3 transition-all ${
            toastMessage.type === 'error'
              ? 'bg-red-50 text-red-800 border-red-200'
              : toastMessage.type === 'info'
              ? 'bg-blue-50 text-blue-800 border-blue-200'
              : 'bg-emerald-50 text-emerald-800 border-emerald-200'
          }`}
        >
          {toastMessage.type === 'error' ? (
            <AlertTriangle className="w-5 h-5 text-red-600" />
          ) : (
            <Check className="w-5 h-5 text-emerald-600" />
          )}
          <span>{toastMessage.msg}</span>
          {lastSavedSnapshot && (
            <button
              onClick={handleUndo}
              className="ml-2 px-2 py-0.5 rounded bg-white border border-slate-300 text-xs font-semibold uppercase tracking-wider text-slate-700 hover:bg-slate-50"
            >
              Undo
            </button>
          )}
        </div>
      )}

      {/* Top Controls Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Date Navigator */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-between">
          <button
            onClick={() => shiftDay(-1)}
            title="Previous Day"
            className="p-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 hover:text-slate-900 hover:border-blue-400 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 font-medium focus:outline-none focus:border-blue-500"
          />

          <button
            onClick={() => shiftDay(1)}
            title="Next Day"
            className="p-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 hover:text-slate-900 hover:border-blue-400 transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>

          <button
            onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
            className="text-xs font-semibold text-blue-600 hover:underline px-2"
          >
            Today
          </button>
        </div>

        {/* Segmented Slot Toggle [Morning Practice | Night Mock] */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 w-full md:w-auto">
          <button
            type="button"
            onClick={() => handleSlotChange('morning')}
            className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              slot === 'morning'
                ? 'bg-white text-blue-600 shadow-sm border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            ☀️ Morning Practice
          </button>
          <button
            type="button"
            onClick={() => handleSlotChange('night')}
            className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              slot === 'night'
                ? 'bg-white text-indigo-600 shadow-sm border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            🌙 Night Mock
          </button>
        </div>

        {/* Save button & Target Progress */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
          <div className="hidden sm:flex flex-col items-end text-xs">
            <span className="text-slate-500">
              Daily Target: <strong className="text-slate-900">{dayTotals.total}</strong>/{dailyTarget}
            </span>
            <div className="w-24 bg-slate-200 rounded-full h-1.5 mt-1 overflow-hidden">
              <div
                className="bg-emerald-500 h-1.5 rounded-full"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          <button
            type="button"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold text-sm shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 transition-all active:scale-95"
          >
            <Save className="w-4 h-4" />
            <span>{saveMutation.isPending ? 'Saving...' : 'Save (Ctrl+Enter)'}</span>
          </button>
        </div>
      </div>

      {/* Quick Day Summary Card */}
      {(daySummary || dayTotals.total > 0) && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shadow-sm">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Today's Performance</p>
              <p className="text-sm font-bold text-slate-900">
                {dayTotals.total} Questions Solved •{' '}
                <span className={dayAccuracy >= 70 ? 'text-emerald-600' : 'text-amber-600'}>
                  {dayAccuracy}% Accuracy
                </span>
              </p>
            </div>
          </div>

          {daySummary?.weakestTopic && (
            <div className="text-xs bg-red-50 border border-red-200 px-3 py-1.5 rounded-xl text-red-700 flex items-center gap-1.5 font-medium">
              <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
              <span>
                Weakest topic today: <strong className="text-red-900">{daySummary.weakestTopic}</strong>
              </span>
            </div>
          )}
        </div>
      )}

      {/* Chapter Blocks */}
      <div className="space-y-6">
        {chapterBlocks.map((block, bIdx) => (
          <ChapterEntryBlock
            key={block.id}
            blockIndex={bIdx}
            block={block}
            chapters={chapters}
            allTopics={allTopics}
            slot={slot}
            kind={kind}
            onUpdateBlock={(updates) => updateBlock(block.id, updates)}
            onRemoveBlock={() => removeChapterBlock(block.id)}
          />
        ))}
      </div>

      {/* "+ Add another chapter" Button */}
      <div className="flex justify-center pt-2">
        <button
          type="button"
          onClick={addChapterBlock}
          className="px-4 py-2.5 rounded-xl border border-dashed border-slate-300 hover:border-blue-500 text-slate-600 hover:text-blue-600 bg-white shadow-sm text-sm font-medium flex items-center gap-2 transition-all"
        >
          <Plus className="w-4 h-4 text-blue-600" />
          <span>+ Add another chapter for this session</span>
        </button>
      </div>
    </div>
  );
};

const ChapterEntryBlock = ({
  blockIndex,
  block,
  chapters,
  allTopics,
  slot,
  kind,
  onUpdateBlock,
  onRemoveBlock,
}) => {
  const currentChapter = chapters.find((c) => c._id === block.chapterId);
  const isPartA = currentChapter?.isPartA;

  const chapterTopics = allTopics.filter(
    (t) => t.chapterId === block.chapterId || t.chapterId?._id === block.chapterId
  );

  const handleChapterSelect = (cid) => {
    onUpdateBlock({ chapterId: cid, entries: [] });
    localStorage.setItem('last_chapterId', cid);
  };

  const addTopicRow = (topic) => {
    if (block.entries.some((e) => e.topicId === topic._id)) return;

    const newEntry = {
      topicId: topic._id,
      topicCode: topic.code,
      topicName: topic.name,
      description: topic.description || '',
      total: 20,
      right: 14,
      wrong: 6,
      bTotal: isPartA ? 0 : 8,
      cTotal: isPartA ? 0 : 12,
      bRight: '',
      skipped: 0,
      mistakeTags: [],
    };

    onUpdateBlock({ entries: [...block.entries, newEntry] });
  };

  const handleAddAll = () => {
    const existingIds = new Set(block.entries.map((e) => e.topicId));
    const toAdd = chapterTopics
      .filter((t) => !existingIds.has(t._id))
      .map((topic) => ({
        topicId: topic._id,
        topicCode: topic.code,
        topicName: topic.name,
        description: topic.description || '',
        total: 10,
        right: 7,
        wrong: 3,
        bTotal: isPartA ? 0 : 4,
        cTotal: isPartA ? 0 : 6,
        bRight: '',
        skipped: 0,
        mistakeTags: [],
      }));

    onUpdateBlock({ entries: [...block.entries, ...toAdd] });
  };

  const handleLoadLastTopics = async () => {
    if (!block.chapterId) return;
    try {
      const res = await api.get(`/sessions/recent-topics/${block.chapterId}`);
      const recent = res.data.data;
      if (recent && recent.length > 0) {
        const rows = recent.map((t) => ({
          topicId: t.topicId,
          code: t.code,
          name: t.name,
          description: t.description || '',
          total: 20,
          right: 14,
          wrong: 6,
          bTotal: isPartA ? 0 : 8,
          cTotal: isPartA ? 0 : 12,
          bRight: '',
          skipped: 0,
          mistakeTags: [],
        }));
        onUpdateBlock({ entries: rows });
      }
    } catch (e) {}
  };

  const updateEntryCell = (index, field, value) => {
    const updated = [...block.entries];
    const row = { ...updated[index] };
    const numVal = value === '' ? '' : Math.max(0, parseInt(value, 10) || 0);

    row[field] = numVal;

    if (field === 'total') {
      const tot = numVal === '' ? 0 : numVal;
      const r = typeof row.right === 'number' ? row.right : 0;
      if (r > tot) row.right = tot;
      row.wrong = Math.max(0, tot - (row.right || 0) - (row.skipped || 0));

      if (!isPartA) {
        const b = Math.min(row.bTotal || 0, tot);
        row.bTotal = b;
        row.cTotal = Math.max(0, tot - b);
      }
    } else if (field === 'right') {
      const r = numVal === '' ? 0 : numVal;
      const tot = typeof row.total === 'number' ? row.total : 0;
      row.wrong = Math.max(0, tot - r - (row.skipped || 0));
    } else if (field === 'wrong') {
      const w = numVal === '' ? 0 : numVal;
      const tot = typeof row.total === 'number' ? row.total : 0;
      row.right = Math.max(0, tot - w - (row.skipped || 0));
    } else if (field === 'bTotal') {
      const b = numVal === '' ? 0 : numVal;
      const tot = typeof row.total === 'number' ? row.total : 0;
      row.cTotal = Math.max(0, tot - b);
    } else if (field === 'cTotal') {
      const c = numVal === '' ? 0 : numVal;
      const tot = typeof row.total === 'number' ? row.total : 0;
      row.bTotal = Math.max(0, tot - c);
    }

    updated[index] = row;
    onUpdateBlock({ entries: updated });
  };

  const stepValue = (index, field, delta) => {
    const row = block.entries[index];
    const cur = typeof row[field] === 'number' ? row[field] : 0;
    const nextVal = Math.max(0, cur + delta);
    updateEntryCell(index, field, nextVal);
  };

  const removeRow = (index) => {
    const updated = block.entries.filter((_, i) => i !== index);
    onUpdateBlock({ entries: updated });
  };

  const toggleMistakeTag = (index, tag) => {
    const updated = [...block.entries];
    const row = { ...updated[index] };
    const tags = new Set(row.mistakeTags || []);
    if (tags.has(tag)) {
      tags.delete(tag);
    } else {
      tags.add(tag);
    }
    row.mistakeTags = Array.from(tags);
    updated[index] = row;
    onUpdateBlock({ entries: updated });
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 md:p-6 shadow-sm space-y-4">
      {/* Chapter header bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex-1 flex flex-col sm:flex-row sm:items-center gap-3 w-full">
          <div className="w-full sm:w-80">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Select Chapter
            </label>
            <select
              value={block.chapterId}
              onChange={(e) => handleChapterSelect(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 font-medium focus:outline-none focus:border-blue-500"
            >
              <option value="">-- Choose Chapter --</option>
              {chapters.map((ch) => (
                <option key={ch._id} value={ch._id}>
                  {ch.isPartA ? `★ ${ch.name}` : `Ch ${ch.no}: ${ch.name}`}
                </option>
              ))}
            </select>
          </div>

          {slot === 'night' && (
            <div className="w-32">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1">
                <Clock className="w-3 h-3 text-indigo-500" /> Time (min)
              </label>
              <input
                type="number"
                inputMode="numeric"
                min="1"
                placeholder="e.g. 45"
                value={block.timeTakenMin}
                onChange={(e) => onUpdateBlock({ timeTakenMin: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:border-indigo-500"
              />
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onRemoveBlock}
          title="Remove Chapter Block"
          className="text-xs text-slate-400 hover:text-red-500 p-2 rounded-lg hover:bg-red-50 transition-colors self-end sm:self-center"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Topic selection chips */}
      {block.chapterId && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700">
              Select topics attempted in this session:
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleAddAll}
                className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 transition-colors"
              >
                + Add all topics
              </button>
              <span className="text-slate-300">•</span>
              <button
                type="button"
                onClick={handleLoadLastTopics}
                className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
              >
                ↻ Same as last time
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1">
            {chapterTopics.map((topic) => {
              const isSelected = block.entries.some((e) => e.topicId === topic._id);
              return (
                <button
                  key={topic._id}
                  type="button"
                  title={topic.description || topic.name}
                  onClick={() => addTopicRow(topic)}
                  disabled={isSelected}
                  className={`text-xs px-2.5 py-1 rounded-lg border transition-all text-left flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-blue-50 text-blue-700 border-blue-200 opacity-60 cursor-default'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-blue-400 hover:bg-white'
                  }`}
                >
                  <span className="font-mono text-[10px] text-blue-600 font-bold">
                    {topic.code}
                  </span>
                  <span className="truncate max-w-[200px]">{topic.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Entry Grid */}
      {block.entries.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px] font-bold border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3 min-w-[200px]">Topic</th>
                <th className="py-2.5 px-2 w-24 text-center">Total</th>
                <th className="py-2.5 px-2 w-24 text-center">Right</th>
                <th className="py-2.5 px-2 w-24 text-center">Wrong</th>
                {!isPartA && (
                  <>
                    <th className="py-2.5 px-2 w-24 text-center">Part B</th>
                    <th className="py-2.5 px-2 w-24 text-center">Part C</th>
                  </>
                )}
                <th className="py-2.5 px-2 text-center w-16">Acc %</th>
                <th className="py-2.5 px-2 text-center w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {block.entries.map((entry, idx) => {
                const tot = Number(entry.total || 0);
                const r = Number(entry.right || 0);
                const w = Number(entry.wrong || 0);
                const acc = tot > 0 ? Math.round((r / tot) * 100) : 0;

                return (
                  <React.Fragment key={entry.topicId || idx}>
                    <tr className="hover:bg-slate-50/70">
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-blue-600 text-[11px]">
                            {entry.topicCode}
                          </span>
                          <span className="font-semibold text-slate-900 truncate max-w-[220px]">
                            {entry.topicName}
                          </span>
                          {entry.description && (
                            <span title={entry.description} className="text-slate-400 cursor-help">
                              <HelpCircle className="w-3.5 h-3.5" />
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-1 px-1 text-center">
                        <StepperInput
                          value={entry.total}
                          onChange={(v) => updateEntryCell(idx, 'total', v)}
                          onStep={(d) => stepValue(idx, 'total', d)}
                        />
                      </td>

                      <td className="py-1 px-1 text-center">
                        <StepperInput
                          value={entry.right}
                          className="text-emerald-600 font-bold"
                          onChange={(v) => updateEntryCell(idx, 'right', v)}
                          onStep={(d) => stepValue(idx, 'right', d)}
                        />
                      </td>

                      <td className="py-1 px-1 text-center">
                        <StepperInput
                          value={entry.wrong}
                          className="text-red-600 font-bold"
                          onChange={(v) => updateEntryCell(idx, 'wrong', v)}
                          onStep={(d) => stepValue(idx, 'wrong', d)}
                        />
                      </td>

                      {!isPartA && (
                        <>
                          <td className="py-1 px-1 text-center">
                            <StepperInput
                              value={entry.bTotal}
                              onChange={(v) => updateEntryCell(idx, 'bTotal', v)}
                              onStep={(d) => stepValue(idx, 'bTotal', d)}
                            />
                          </td>
                          <td className="py-1 px-1 text-center">
                            <StepperInput
                              value={entry.cTotal}
                              onChange={(v) => updateEntryCell(idx, 'cTotal', v)}
                              onStep={(d) => stepValue(idx, 'cTotal', d)}
                            />
                          </td>
                        </>
                      )}

                      <td className="py-1 px-2 text-center font-mono font-bold">
                        <span
                          className={
                            acc >= 75
                              ? 'text-emerald-600'
                              : acc >= 50
                              ? 'text-amber-600'
                              : 'text-red-600'
                          }
                        >
                          {acc}%
                        </span>
                      </td>

                      <td className="py-1 px-2 text-center">
                        <button
                          type="button"
                          onClick={() => removeRow(idx)}
                          className="text-slate-400 hover:text-red-500 p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>

                    <tr>
                      <td colSpan={isPartA ? 6 : 8} className="px-3 py-1.5 bg-slate-50 border-b border-slate-100">
                        <div className="flex flex-wrap items-center gap-2 text-[11px]">
                          <span className="text-slate-500 font-medium flex items-center gap-1">
                            <Tag className="w-3 h-3" /> Error tags:
                          </span>
                          {MISTAKE_OPTIONS.map((tag) => {
                            const isTagged = (entry.mistakeTags || []).includes(tag);
                            return (
                              <button
                                key={tag}
                                type="button"
                                onClick={() => toggleMistakeTag(idx, tag)}
                                className={`px-2 py-0.5 rounded-full border text-[10px] transition-colors ${
                                  isTagged
                                    ? 'bg-amber-100 text-amber-800 border-amber-300 font-bold'
                                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                                }`}
                              >
                                {tag}
                              </button>
                            );
                          })}

                          <div className="ml-auto flex items-center gap-1.5 text-slate-500">
                            <span>Skipped:</span>
                            <input
                              type="number"
                              inputMode="numeric"
                              value={entry.skipped || 0}
                              onChange={(e) => updateEntryCell(idx, 'skipped', e.target.value)}
                              className="w-10 px-1 py-0.5 bg-white border border-slate-200 rounded text-center text-xs text-slate-800"
                            />
                          </div>
                        </div>
                      </td>
                    </tr>
                  </React.Fragment>
                );
              })}
            </tbody>
            <tfoot className="bg-slate-50 font-bold text-slate-900 text-xs border-t border-slate-200">
              <tr>
                <td className="py-2.5 px-3">Total / Chapter Summary</td>
                <td className="py-2.5 px-2 text-center">
                  {block.entries.reduce((s, e) => s + Number(e.total || 0), 0)}
                </td>
                <td className="py-2.5 px-2 text-center text-emerald-600">
                  {block.entries.reduce((s, e) => s + Number(e.right || 0), 0)}
                </td>
                <td className="py-2.5 px-2 text-center text-red-600">
                  {block.entries.reduce((s, e) => s + Number(e.wrong || 0), 0)}
                </td>
                {!isPartA && (
                  <>
                    <td className="py-2.5 px-2 text-center">
                      {block.entries.reduce((s, e) => s + Number(e.bTotal || 0), 0)}
                    </td>
                    <td className="py-2.5 px-2 text-center">
                      {block.entries.reduce((s, e) => s + Number(e.cTotal || 0), 0)}
                    </td>
                  </>
                )}
                <td className="py-2.5 px-2 text-center text-blue-600">
                  {(() => {
                    const tot = block.entries.reduce((s, e) => s + Number(e.total || 0), 0);
                    const r = block.entries.reduce((s, e) => s + Number(e.right || 0), 0);
                    return tot > 0 ? `${Math.round((r / tot) * 100)}%` : '0%';
                  })()}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Session Notes */}
      <div>
        <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5" /> Notes / Key Observations
        </label>
        <textarea
          rows={2}
          value={block.notes}
          onChange={(e) => onUpdateBlock({ notes: e.target.value })}
          placeholder="e.g. Formula confusion in Michaelis-Menten plot; reviewed Lodish Fig 3.2..."
          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500"
        />
      </div>
    </div>
  );
};

const StepperInput = ({ value, onChange, onStep, className = '' }) => {
  return (
    <div className="inline-flex items-center rounded-lg border border-slate-200 bg-white overflow-hidden shadow-xs">
      <button
        type="button"
        tabIndex={-1}
        onClick={() => onStep(-1)}
        className="px-1.5 py-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 active:bg-slate-200 transition-colors font-bold"
      >
        -
      </button>
      <input
        type="number"
        inputMode="numeric"
        min="0"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-11 text-center bg-transparent py-1 text-xs focus:outline-none focus:bg-blue-50 font-medium ${className}`}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => onStep(1)}
        className="px-1.5 py-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 active:bg-slate-200 transition-colors font-bold"
      >
        +
      </button>
    </div>
  );
};
