import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Settings as SettingsIcon,
  Save,
  Download,
  Upload,
  Database,
  Plus,
  Sliders,
  Check,
} from 'lucide-react';
import api from '../api/client';

export const Settings = () => {
  const { user, updateUser } = useAuth();
  const queryClient = useQueryClient();

  const [examDate, setExamDate] = useState(user?.examDate || '2026-12-19');
  const [dailyTarget, setDailyTarget] = useState(user?.dailyTarget || 100);
  const [weakThreshold, setWeakThreshold] = useState(user?.settings?.weakThreshold || 50);
  const [needsWorkThreshold, setNeedsWorkThreshold] = useState(user?.settings?.needsWorkThreshold || 65);
  const [goodThreshold, setGoodThreshold] = useState(user?.settings?.goodThreshold || 80);

  const [selectedChapterId, setSelectedChapterId] = useState('');
  const [newTopicName, setNewTopicName] = useState('');
  const [newTopicCode, setNewTopicCode] = useState('');
  const [newTopicDesc, setNewTopicDesc] = useState('');

  const [toast, setToast] = useState('');

  const { data: chaptersData } = useQuery({
    queryKey: ['chapters'],
    queryFn: async () => {
      const res = await api.get('/chapters');
      return res.data.data;
    },
  });

  const { data: allTopicsData, refetch: refetchTopics } = useQuery({
    queryKey: ['all-topics'],
    queryFn: async () => {
      const res = await api.get('/chapters/all-topics');
      return res.data.data;
    },
  });

  const chapters = chaptersData || [];

  const saveSettingsMutation = useMutation({
    mutationFn: async () => {
      const res = await api.patch('/auth/me', {
        examDate,
        dailyTarget: Number(dailyTarget),
        settings: {
          weakThreshold: Number(weakThreshold),
          needsWorkThreshold: Number(needsWorkThreshold),
          goodThreshold: Number(goodThreshold),
        },
      });
      return res.data.user;
    },
    onSuccess: (updatedUser) => {
      updateUser(updatedUser);
      queryClient.invalidateQueries({ queryKey: ['quick-kpis'] });
      queryClient.invalidateQueries({ queryKey: ['analytics-overview'] });
      showToast('Settings saved successfully!');
    },
  });

  const createTopicMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/chapters/topics', {
        chapterId: selectedChapterId,
        name: newTopicName,
        code: newTopicCode || undefined,
        description: newTopicDesc,
      });
      return res.data.data;
    },
    onSuccess: () => {
      refetchTopics();
      setNewTopicName('');
      setNewTopicCode('');
      setNewTopicDesc('');
      showToast('Custom topic added successfully!');
    },
  });

  const handleExportJSON = async () => {
    try {
      const res = await api.get('/export?format=json');
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(res.data, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', `csir_net_tracker_full_backup_${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } catch (e) {
      alert('Export failed.');
    }
  };

  const handleImportJSON = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const payload = JSON.parse(event.target.result);
        const res = await api.post('/import', {
          sessions: payload.sessions || payload,
          clearExisting: false,
        });
        showToast(res.data.message || 'Import completed!');
        queryClient.invalidateQueries();
      } catch (err) {
        alert('Failed to parse and import JSON file.');
      }
    };
    reader.readAsText(file);
  };

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 4000);
  };

  return (
    <div className="space-y-8 max-w-4xl animate-fade-in text-slate-800">
      {toast && (
        <div className="fixed top-4 right-4 z-50 px-4 py-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl shadow-lg text-xs flex items-center gap-2 font-medium">
          <Check className="w-4 h-4 text-emerald-600" />
          <span>{toast}</span>
        </div>
      )}

      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
          <SettingsIcon className="w-6 h-6 text-blue-600" /> System Settings & Syllabus Control
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Configure exam date, daily question target, performance thresholds, and customize topics
        </p>
      </div>

      {/* Target & Thresholds Config */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
          <Sliders className="w-4 h-4 text-blue-600" /> Exam Schedule & Performance Thresholds
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              CSIR NET Exam Date
            </label>
            <input
              type="date"
              value={examDate}
              onChange={(e) => setExamDate(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-blue-500"
            />
            <span className="text-[10px] text-slate-400">Default: 2026-12-19</span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Daily Target Questions
            </label>
            <input
              type="number"
              inputMode="numeric"
              value={dailyTarget}
              onChange={(e) => setDailyTarget(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-blue-500"
            />
            <span className="text-[10px] text-slate-400">Default: 100 Qs/day</span>
          </div>
        </div>

        {/* Accuracy Classification Thresholds */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-2">
            Classification Thresholds (% Accuracy)
          </label>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <span className="block text-[11px] text-red-600 font-semibold mb-1">Weak (&lt; %)</span>
              <input
                type="number"
                value={weakThreshold}
                onChange={(e) => setWeakThreshold(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 text-center font-bold focus:outline-none focus:border-red-500"
              />
            </div>

            <div>
              <span className="block text-[11px] text-amber-600 font-semibold mb-1">Needs Work (&lt; %)</span>
              <input
                type="number"
                value={needsWorkThreshold}
                onChange={(e) => setNeedsWorkThreshold(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 text-center font-bold focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <span className="block text-[11px] text-emerald-600 font-semibold mb-1">Good (&lt; %)</span>
              <input
                type="number"
                value={goodThreshold}
                onChange={(e) => setGoodThreshold(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 text-center font-bold focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>
        </div>

        <button
          onClick={() => saveSettingsMutation.mutate()}
          disabled={saveSettingsMutation.isPending}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-xs transition-colors"
        >
          <Save className="w-4 h-4" />
          <span>{saveSettingsMutation.isPending ? 'Saving...' : 'Save Configuration'}</span>
        </button>
      </div>

      {/* Custom Topic Addition */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
          <Plus className="w-4 h-4 text-emerald-600" /> Add Custom Topic
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-1">
            <label className="block text-xs text-slate-500 mb-1 font-medium">Target Chapter</label>
            <select
              value={selectedChapterId}
              onChange={(e) => setSelectedChapterId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-blue-500"
            >
              <option value="">-- Choose Chapter --</option>
              {chapters.map((ch) => (
                <option key={ch._id} value={ch._id}>
                  {ch.isPartA ? ch.name : `Ch ${ch.no}: ${ch.name}`}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-1">
            <label className="block text-xs text-slate-500 mb-1 font-medium">Topic Code (Optional)</label>
            <input
              type="text"
              placeholder="e.g. 1K"
              value={newTopicCode}
              onChange={(e) => setNewTopicCode(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="sm:col-span-1">
            <label className="block text-xs text-slate-500 mb-1 font-medium">Topic Name</label>
            <input
              type="text"
              placeholder="e.g. Single-cell RNA seq"
              value={newTopicName}
              onChange={(e) => setNewTopicName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs text-slate-500 mb-1 font-medium">Description / Tooltip Sub-points</label>
          <input
            type="text"
            placeholder="Sub-points for tooltip recall..."
            value={newTopicDesc}
            onChange={(e) => setNewTopicDesc(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-blue-500"
          />
        </div>

        <button
          onClick={() => createTopicMutation.mutate()}
          disabled={!selectedChapterId || !newTopicName || createTopicMutation.isPending}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Custom Topic</span>
        </button>
      </div>

      {/* Backup, Import & Export */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
          <Database className="w-4 h-4 text-purple-600" /> Data Backup, Export & Restore
        </h3>
        <p className="text-xs text-slate-500">
          Export full JSON snapshots of your sessions or restore previous backups seamlessly
        </p>

        <div className="flex flex-wrap items-center gap-4 pt-2">
          <button
            onClick={handleExportJSON}
            className="px-4 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 flex items-center gap-2 transition-colors shadow-xs"
          >
            <Download className="w-4 h-4 text-purple-600" />
            <span>Download JSON Full Backup</span>
          </button>

          <label className="px-4 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 flex items-center gap-2 transition-colors cursor-pointer shadow-xs">
            <Upload className="w-4 h-4 text-blue-600" />
            <span>Import JSON Backup</span>
            <input type="file" accept=".json" onChange={handleImportJSON} className="hidden" />
          </label>
        </div>
      </div>
    </div>
  );
};
