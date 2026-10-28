import React, { useState, useEffect } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Save,
  Clock,
  Tag,
  Check,
  AlertTriangle,
  FileText,
  HelpCircle,
  Search,
  MoreVertical,
  EyeOff,
  Edit2,
  X,
  Sun,
  Moon,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const MISTAKE_OPTIONS = ['concept gap', 'silly mistake', 'time', 'guess'];

const ThemeToggleBtn = () => {
  const { isDark, toggleTheme } = useTheme();
  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={isDark ? 'Switch to Light Mode' : 'Switch to Night/Dark Mode'}
      className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors flex items-center gap-1.5 text-xs font-medium"
    >
      {isDark ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-slate-500" />}
      <span className="hidden md:inline">{isDark ? 'Light' : 'Night'}</span>
    </button>
  );
};

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

  // Fetch Chapters list
  const { data: chaptersData } = useQuery({
    queryKey: ['chapters'],
    queryFn: async () => {
      const res = await api.get('/chapters');
      return res.data.data;
    },
  });

  const chapters = chaptersData || [];

  // Fetch All Topics
  const { data: allTopicsData, refetch: refetchAllTopics } = useQuery({
    queryKey: ['all-topics'],
    queryFn: async () => {
      const res = await api.get('/chapters/all-topics');
      return res.data.data;
    },
  });
  const allTopics = allTopicsData || [];

  // Fetch existing sessions for the selected day
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
            isCustom: e.topicId?.isCustom || false,
            total: e.total ?? 0,
            right: e.right ?? 0,
            wrong: e.wrong ?? 0,
            bTotal: e.bTotal ?? 0,
            cTotal: e.cTotal ?? 0,
            bRight: e.bRight ?? '',
            skipped: e.skipped ?? 0,
            mistakeTags: e.mistakeTags || [],
            showTags: Boolean(e.mistakeTags && e.mistakeTags.length > 0),
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

    const lastChId = localStorage.getItem('last_chapterId') || (chapters[0]?._id || '');
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

      for (const block of chapterBlocks) {
        if (!block.chapterId || block.entries.length === 0) continue;

        const payload = {
          date: selectedDate,
          slot,
          kind,
          chapterId: block.chapterId,
          timeTakenMin: block.timeTakenMin ? Number(block.timeTakenMin) : null,
          notes: block.notes || '',
          entries: block.entries.map((e) => ({
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
          })),
        };

        await api.put('/sessions', payload);
        savedCount++;
      }

      localStorage.removeItem(`draft_${selectedDate}_${slot}`);
      return savedCount;
    },
    onSuccess: (count) => {
      refetchDaySessions();
      queryClient.invalidateQueries({ queryKey: ['quick-kpis'] });
      queryClient.invalidateQueries({ queryKey: ['analytics-overview'] });
      showToast(count > 0 ? `Saved ${count} session block${count === 1 ? '' : 's'}!` : 'No entries to save.');
    },
    onError: (err) => {
      showToast(err.response?.data?.error || 'Failed to save session.', 'error');
    },
  });

  const showToast = (msg, type = 'success') => {
    setToastMessage({ msg, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleUndo = () => {
    if (lastSavedSnapshot) {
      setChapterBlocks(lastSavedSnapshot);
      setLastSavedSnapshot(null);
      showToast('Restored previous draft.', 'info');
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

  const dailyTarget = user?.dailyTarget || 100;

  return (
    <div className="space-y-4 animate-fade-in text-slate-800 w-full">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed top-4 right-4 z-50 px-3.5 py-2 rounded-xl shadow-lg border text-xs flex items-center gap-2 transition-all ${
            toastMessage.type === 'error'
              ? 'bg-red-50 text-red-800 border-red-200'
              : toastMessage.type === 'info'
              ? 'bg-blue-50 text-blue-800 border-blue-200'
              : 'bg-emerald-50 text-emerald-800 border-emerald-200'
          }`}
        >
          {toastMessage.type === 'error' ? (
            <AlertTriangle className="w-4 h-4 text-red-600" />
          ) : (
            <Check className="w-4 h-4 text-emerald-600" />
          )}
          <span>{toastMessage.msg}</span>
          {lastSavedSnapshot && (
            <button
              onClick={handleUndo}
              className="ml-2 px-1.5 py-0.5 rounded bg-white border border-slate-300 text-[10px] font-bold uppercase text-slate-700 hover:bg-slate-50"
            >
              Undo
            </button>
          )}
        </div>
      )}

      {/* Clean, Compact Top Controls Bar */}
      <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-xs flex flex-wrap items-center justify-between gap-3">
        {/* Date Navigator */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => shiftDay(-1)}
            title="Previous Day"
            className="p-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-600 hover:text-slate-900 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-800 font-medium focus:outline-none focus:border-blue-500"
          />

          <button
            onClick={() => shiftDay(1)}
            title="Next Day"
            className="p-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-600 hover:text-slate-900 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <button
            onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
            className="text-xs font-semibold text-blue-600 hover:underline px-1.5"
          >
            Today
          </button>
        </div>

        {/* Slot Toggle [Morning Practice | Night Mock] */}
        <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
          <button
            type="button"
            onClick={() => handleSlotChange('morning')}
            className={`px-3 py-1 rounded-md font-semibold transition-all ${
              slot === 'morning'
                ? 'bg-white text-blue-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            ☀️ Morning Practice
          </button>
          <button
            type="button"
            onClick={() => handleSlotChange('night')}
            className={`px-3 py-1 rounded-md font-semibold transition-all ${
              slot === 'night'
                ? 'bg-white text-indigo-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            🌙 Night Mock
          </button>
        </div>

        {/* Save button, Theme Toggle & Target Indicator */}
        <div className="flex items-center gap-2 sm:gap-3">
          <span className="text-xs text-slate-500 dark:text-slate-400 hidden sm:inline">
            Today: <strong className="text-slate-900 dark:text-white">{dayTotals.total}</strong>/{dailyTarget} Qs
          </span>

          <ThemeToggleBtn />

          <button
            type="button"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold text-xs shadow-xs flex items-center gap-1.5 transition-all active:scale-95"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saveMutation.isPending ? 'Saving...' : 'Save (Ctrl+Enter)'}</span>
          </button>
        </div>
      </div>

      {/* Chapter Blocks */}
      <div className="space-y-4">
        {chapterBlocks.map((block, bIdx) => (
          <ChapterEntryBlock
            key={block.id}
            blockIndex={bIdx}
            block={block}
            chapters={chapters}
            allTopics={allTopics}
            slot={slot}
            onUpdateBlock={(updates) => updateBlock(block.id, updates)}
            onRemoveBlock={() => removeChapterBlock(block.id)}
            refetchAllTopics={refetchAllTopics}
          />
        ))}
      </div>

      {/* "+ Add another chapter" Button */}
      <div className="flex justify-center pt-1">
        <button
          type="button"
          onClick={addChapterBlock}
          className="px-3.5 py-1.5 rounded-xl border border-dashed border-slate-300 hover:border-blue-500 text-slate-600 hover:text-blue-600 bg-white text-xs font-medium flex items-center gap-1.5 transition-all shadow-2xs"
        >
          <Plus className="w-3.5 h-3.5 text-blue-600" />
          <span>Add another chapter</span>
        </button>
      </div>
    </div>
  );
};

// Subcomponent: Individual Chapter Block (Clutter-free and compact)
const ChapterEntryBlock = ({
  blockIndex,
  block,
  chapters,
  allTopics,
  slot,
  onUpdateBlock,
  onRemoveBlock,
  refetchAllTopics,
}) => {
  const currentChapter = chapters.find((c) => c._id === block.chapterId);
  const isPartA = currentChapter?.isPartA;

  const [topicSearchQuery, setTopicSearchQuery] = useState('');
  const [isInlineAdding, setIsInlineAdding] = useState(false);
  const [inlineTopicName, setInlineTopicName] = useState('');
  const [showNotes, setShowNotes] = useState(Boolean(block.notes));

  const chapterTopics = allTopics
    .filter((t) => (t.chapterId === block.chapterId || t.chapterId?._id === block.chapterId) && !t.hidden)
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  const filteredTopics = chapterTopics.filter((t) => {
    if (!topicSearchQuery) return true;
    const q = topicSearchQuery.toLowerCase();
    return (t.name || '').toLowerCase().includes(q) || (t.code || '').toLowerCase().includes(q);
  });

  const handleChapterSelect = (cid) => {
    onUpdateBlock({ chapterId: cid, entries: [] });
    localStorage.setItem('last_chapterId', cid);
    setTopicSearchQuery('');
    setIsInlineAdding(false);
  };

  // Add topic with 0 initial values (no dummy numbers)
  const addTopicRow = (topic, shouldFocus = false) => {
    if (block.entries.some((e) => e.topicId === topic._id)) return;

    const newEntry = {
      topicId: topic._id,
      topicCode: topic.code,
      topicName: topic.name,
      description: topic.description || '',
      isCustom: Boolean(topic.isCustom),
      total: 0,
      right: 0,
      wrong: 0,
      bTotal: 0,
      cTotal: 0,
      bRight: '',
      skipped: 0,
      mistakeTags: [],
      showTags: false,
    };

    onUpdateBlock({ entries: [...block.entries, newEntry] });

    if (shouldFocus) {
      setTimeout(() => {
        const inputs = document.querySelectorAll(`input[data-total-input="${topic._id}"]`);
        if (inputs.length > 0) {
          inputs[0].focus();
          inputs[0].select();
        }
      }, 50);
    }
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
        isCustom: Boolean(topic.isCustom),
        total: 0,
        right: 0,
        wrong: 0,
        bTotal: 0,
        cTotal: 0,
        bRight: '',
        skipped: 0,
        mistakeTags: [],
        showTags: false,
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
          topicCode: t.code,
          topicName: t.name,
          description: t.description || '',
          isCustom: false,
          total: 0,
          right: 0,
          wrong: 0,
          bTotal: 0,
          cTotal: 0,
          bRight: '',
          skipped: 0,
          mistakeTags: [],
          showTags: false,
        }));
        onUpdateBlock({ entries: rows });
      }
    } catch (e) {}
  };

  const handleInlineAddTopic = async () => {
    const nameToAdd = (inlineTopicName || topicSearchQuery).trim();
    if (!nameToAdd || !block.chapterId) return;

    try {
      const res = await api.post(`/chapters/${block.chapterId}/topics`, { name: nameToAdd });
      const createdTopic = res.data.data;
      await refetchAllTopics();
      addTopicRow(createdTopic, true);
      setInlineTopicName('');
      setTopicSearchQuery('');
      setIsInlineAdding(false);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to add custom topic');
    }
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

  const toggleRowTags = (index) => {
    const updated = [...block.entries];
    updated[index] = { ...updated[index], showTags: !updated[index].showTags };
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
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
      {/* Chapter header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2.5 border-b border-slate-100">
        <div className="flex items-center gap-3 flex-1 min-w-[260px]">
          <select
            value={block.chapterId}
            onChange={(e) => handleChapterSelect(e.target.value)}
            className="w-full max-w-sm px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-500"
          >
            <option value="">-- Choose Chapter --</option>
            {chapters.map((ch) => (
              <option key={ch._id} value={ch._id}>
                {ch.isPartA ? `★ ${ch.name}` : `Ch ${ch.no}: ${ch.name}`}
              </option>
            ))}
          </select>

          {slot === 'night' && (
            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <Clock className="w-3.5 h-3.5 text-indigo-500" />
              <input
                type="number"
                inputMode="numeric"
                min="1"
                placeholder="Time (min)"
                value={block.timeTakenMin}
                onChange={(e) => onUpdateBlock({ timeTakenMin: e.target.value })}
                className="w-20 px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800"
              />
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowNotes(!showNotes)}
            className={`text-[11px] font-medium px-2 py-1 rounded-md border transition-colors ${
              showNotes
                ? 'bg-blue-50 text-blue-600 border-blue-200'
                : 'text-slate-500 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {showNotes ? 'Hide notes' : '+ Notes'}
          </button>

          <button
            type="button"
            onClick={onRemoveBlock}
            title="Remove Chapter"
            className="text-slate-400 hover:text-red-500 p-1 rounded-md hover:bg-red-50"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Immediate Clean Topic Selector */}
      {block.chapterId && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            {/* Search topic input */}
            <div className="relative w-full sm:w-64">
              <Search className="w-3 h-3 text-slate-400 absolute left-2.5 top-2" />
              <input
                type="text"
                placeholder="Search or type new topic..."
                value={topicSearchQuery}
                onChange={(e) => {
                  setTopicSearchQuery(e.target.value);
                  if (!isInlineAdding && e.target.value) {
                    setInlineTopicName(e.target.value);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && topicSearchQuery.trim()) {
                    e.preventDefault();
                    if (filteredTopics.length === 1) {
                      addTopicRow(filteredTopics[0], true);
                      setTopicSearchQuery('');
                    } else if (filteredTopics.length === 0) {
                      handleInlineAddTopic();
                    }
                  }
                }}
                className="w-full pl-7 pr-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex items-center gap-2 text-[11px]">
              <button
                type="button"
                onClick={handleAddAll}
                className="text-blue-600 hover:underline font-medium"
              >
                + Add all
              </button>
              <span className="text-slate-300">•</span>
              <button
                type="button"
                onClick={handleLoadLastTopics}
                className="text-indigo-600 hover:underline font-medium"
              >
                ↻ Last used
              </button>
              <span className="text-slate-300">•</span>
              <button
                type="button"
                onClick={() => {
                  setIsInlineAdding(true);
                  setInlineTopicName(topicSearchQuery || '');
                }}
                className="text-emerald-600 hover:underline font-semibold"
              >
                + Custom
              </button>
            </div>
          </div>

          {/* Quick single-tap Add "<typed text>" if no match */}
          {topicSearchQuery.trim() && filteredTopics.length === 0 && (
            <div className="p-2 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between text-xs">
              <span className="text-blue-900">
                Topic not in list: "<strong>{topicSearchQuery.trim()}</strong>"
              </span>
              <button
                type="button"
                onClick={handleInlineAddTopic}
                className="px-2.5 py-0.5 bg-blue-600 text-white font-bold text-xs rounded shadow-2xs"
              >
                Add & Log
              </button>
            </div>
          )}

          {/* Inline Add input */}
          {isInlineAdding && (
            <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg flex items-center gap-2 text-xs">
              <input
                type="text"
                autoFocus
                placeholder="Topic name..."
                value={inlineTopicName}
                onChange={(e) => setInlineTopicName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleInlineAddTopic();
                  } else if (e.key === 'Escape') {
                    setIsInlineAdding(false);
                  }
                }}
                className="flex-1 px-2.5 py-1 bg-white border border-slate-200 rounded text-xs text-slate-800"
              />
              <button
                type="button"
                onClick={handleInlineAddTopic}
                className="px-3 py-1 bg-blue-600 text-white font-bold rounded"
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => setIsInlineAdding(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Clean, minimalist Topic Chips list */}
          <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto pr-1">
            {filteredTopics.map((topic) => {
              const isSelected = block.entries.some((e) => e.topicId === topic._id);

              return (
                <button
                  key={topic._id}
                  type="button"
                  title={topic.description || topic.name}
                  onClick={() => addTopicRow(topic)}
                  disabled={isSelected}
                  className={`text-[11px] px-2 py-0.5 rounded border transition-all text-left flex items-center gap-1 ${
                    isSelected
                      ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-default opacity-50'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-blue-400 hover:text-blue-600'
                  }`}
                >
                  <span className="font-mono text-[9px] font-bold text-blue-600">
                    {topic.code}
                  </span>
                  <span className="truncate max-w-[170px]">{topic.name}</span>
                  {topic.isCustom && (
                    <span className="text-[8px] px-1 rounded bg-amber-50 text-amber-700 border border-amber-200 font-bold uppercase">
                      custom
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Grid Table */}
      {block.entries.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px] font-bold border-b border-slate-200">
              <tr>
                <th className="py-1.5 px-3 min-w-[200px]">Topic</th>
                <th className="py-1.5 px-1.5 w-24 text-center">Total</th>
                <th className="py-1.5 px-1.5 w-24 text-center">Right</th>
                <th className="py-1.5 px-1.5 w-24 text-center">Wrong</th>
                {!isPartA && (
                  <>
                    <th className="py-1.5 px-1.5 w-24 text-center">Part B</th>
                    <th className="py-1.5 px-1.5 w-24 text-center">Part C</th>
                  </>
                )}
                <th className="py-1.5 px-2 text-center w-14">Acc %</th>
                <th className="py-1.5 px-1 text-center w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {block.entries.map((entry, idx) => {
                const tot = Number(entry.total || 0);
                const r = Number(entry.right || 0);
                const acc = tot > 0 ? Math.round((r / tot) * 100) : 0;

                return (
                  <React.Fragment key={entry.topicId || idx}>
                    <tr className="hover:bg-slate-50/50">
                      <td className="py-1.5 px-3">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-blue-600 text-[10px]">
                            {entry.topicCode}
                          </span>
                          <span className="font-medium text-slate-900 truncate max-w-[220px]">
                            {entry.topicName}
                          </span>
                          {entry.isCustom && (
                            <span className="text-[8px] px-1 rounded bg-amber-50 text-amber-700 border border-amber-200 font-bold uppercase">
                              custom
                            </span>
                          )}
                          {entry.description && (
                            <span title={entry.description} className="text-slate-400 cursor-help">
                              <HelpCircle className="w-3 h-3" />
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => toggleRowTags(idx)}
                            className={`ml-1 text-[10px] px-1 rounded border transition-colors ${
                              (entry.mistakeTags || []).length > 0 || entry.showTags
                                ? 'bg-amber-50 text-amber-700 border-amber-300 font-bold'
                                : 'text-slate-400 border-transparent hover:border-slate-200'
                            }`}
                          >
                            tag
                          </button>
                        </div>
                      </td>

                      <td className="py-1 px-1 text-center">
                        <StepperInput
                          dataAttribute={entry.topicId}
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

                      <td className="py-1 px-2 text-center font-mono font-bold text-xs">
                        <span
                          className={
                            tot === 0
                              ? 'text-slate-400'
                              : acc >= 75
                              ? 'text-emerald-600'
                              : acc >= 50
                              ? 'text-amber-600'
                              : 'text-red-600'
                          }
                        >
                          {tot === 0 ? '—' : `${acc}%`}
                        </span>
                      </td>

                      <td className="py-1 px-1 text-center">
                        <button
                          type="button"
                          onClick={() => removeRow(idx)}
                          className="text-slate-300 hover:text-red-500 p-0.5"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>

                    {/* Compact expandable mistake tags */}
                    {entry.showTags && (
                      <tr>
                        <td colSpan={isPartA ? 6 : 8} className="px-3 py-1 bg-slate-50/70 border-b border-slate-100">
                          <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                            <span className="text-slate-500 font-medium">Error tags:</span>
                            {MISTAKE_OPTIONS.map((tag) => {
                              const isTagged = (entry.mistakeTags || []).includes(tag);
                              return (
                                <button
                                  key={tag}
                                  type="button"
                                  onClick={() => toggleMistakeTag(idx, tag)}
                                  className={`px-1.5 py-0.2 rounded border transition-colors ${
                                    isTagged
                                      ? 'bg-amber-100 text-amber-800 border-amber-300 font-bold'
                                      : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-100'
                                  }`}
                                >
                                  {tag}
                                </button>
                              );
                            })}

                            <div className="ml-auto flex items-center gap-1 text-slate-500">
                              <span>Skipped:</span>
                              <input
                                type="number"
                                inputMode="numeric"
                                value={entry.skipped || 0}
                                onChange={(e) => updateEntryCell(idx, 'skipped', e.target.value)}
                                className="w-8 px-1 py-0.2 bg-white border border-slate-200 rounded text-center text-[10px]"
                              />
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
            {/* Totals Row */}
            <tfoot className="bg-slate-50 font-bold text-slate-900 text-xs border-t border-slate-200">
              <tr>
                <td className="py-2 px-3">Total / Chapter</td>
                <td className="py-2 px-1 text-center">
                  {block.entries.reduce((s, e) => s + Number(e.total || 0), 0)}
                </td>
                <td className="py-2 px-1 text-center text-emerald-600">
                  {block.entries.reduce((s, e) => s + Number(e.right || 0), 0)}
                </td>
                <td className="py-2 px-1 text-center text-red-600">
                  {block.entries.reduce((s, e) => s + Number(e.wrong || 0), 0)}
                </td>
                {!isPartA && (
                  <>
                    <td className="py-2 px-1 text-center">
                      {block.entries.reduce((s, e) => s + Number(e.bTotal || 0), 0)}
                    </td>
                    <td className="py-2 px-1 text-center">
                      {block.entries.reduce((s, e) => s + Number(e.cTotal || 0), 0)}
                    </td>
                  </>
                )}
                <td className="py-2 px-2 text-center text-blue-600">
                  {(() => {
                    const tot = block.entries.reduce((s, e) => s + Number(e.total || 0), 0);
                    const r = block.entries.reduce((s, e) => s + Number(e.right || 0), 0);
                    return tot > 0 ? `${Math.round((r / tot) * 100)}%` : '—';
                  })()}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Collapsible Notes */}
      {showNotes && (
        <div className="pt-1">
          <textarea
            rows={2}
            value={block.notes}
            onChange={(e) => onUpdateBlock({ notes: e.target.value })}
            placeholder="Session notes / formula observations..."
            className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500"
          />
        </div>
      )}
    </div>
  );
};

const StepperInput = ({ value, onChange, onStep, className = '', dataAttribute }) => {
  return (
    <div className="inline-flex items-center rounded border border-slate-200 bg-white overflow-hidden shadow-2xs">
      <button
        type="button"
        tabIndex={-1}
        onClick={() => onStep(-1)}
        className="px-1 py-0.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors font-bold text-xs"
      >
        -
      </button>
      <input
        type="number"
        data-total-input={dataAttribute}
        inputMode="numeric"
        min="0"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-10 text-center bg-transparent py-0.5 text-xs focus:outline-none focus:bg-blue-50 font-medium ${className}`}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => onStep(1)}
        className="px-1 py-0.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors font-bold text-xs"
      >
        +
      </button>
    </div>
  );
};
