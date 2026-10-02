'use client';

import React, { useState } from 'react';
import { useKnowledge } from '@/context/KnowledgeContext';
import { Settings as SettingsIcon, User, HardDrive, Key, Database, Download, Check, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export const SettingsView: React.FC = () => {
  const { user, knowledgeItems } = useKnowledge();
  const [fastApiEndpoint, setFastApiEndpoint] = useState('http://localhost:8000/api/v1');
  const [isSaved, setIsSaved] = useState(false);

  const handleExport = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(knowledgeItems, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `second-brain-backup-${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-8 animate-fade-in">
      {/* Header */}
      <div className="border-b border-zinc-200 dark:border-zinc-800 pb-4">
        <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
          <SettingsIcon className="text-indigo-500" size={22} /> Settings & API Integrations
        </h1>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
          Manage system preferences, backend connection endpoints, and data exports.
        </p>
      </div>

      <div className="space-y-6">
        {/* Profile Card */}
        <div className="p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#121215] space-y-4">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100">
            <User size={16} className="text-indigo-500" /> User Profile
          </div>

          <div className="flex items-center gap-4">
            <img
              src={user.avatarUrl}
              alt={user.name}
              className="w-14 h-14 rounded-full object-cover ring-2 ring-indigo-500/30"
            />
            <div>
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">{user.name}</h2>
              <p className="text-xs text-zinc-500">{user.email} • {user.role}</p>
            </div>
          </div>
        </div>

        {/* Backend Connectivity Settings */}
        <form onSubmit={handleSaveSettings} className="p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#121215] space-y-4">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100">
            <Database size={16} className="text-indigo-500" /> FastAPI + PostgreSQL Integration
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
              FastAPI Gateway Base URL
            </label>
            <Input
              value={fastApiEndpoint}
              onChange={(e) => setFastApiEndpoint(e.target.value)}
              placeholder="http://localhost:8000/api/v1"
            />
            <p className="text-[11px] text-zinc-400">
              The application architecture uses isolated service abstractions ready for production FastAPI endpoints.
            </p>
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500" /> API Abstraction Layer Active
            </span>
            <Button type="submit" variant="primary" size="sm">
              {isSaved ? <span className="flex items-center gap-1"><Check size={14} /> Saved</span> : 'Save Config'}
            </Button>
          </div>
        </form>

        {/* Data Export & Backup */}
        <div className="p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#121215] space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <Download size={16} className="text-indigo-500" /> Export Knowledge Base
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                Download all your saved notes, links, documents, tags, and collections in standardized JSON format.
              </p>
            </div>
            <Button variant="secondary" size="sm" onClick={handleExport} leftIcon={<Download size={14} />}>
              Export Backup
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
