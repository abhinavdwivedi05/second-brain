'use client';

import React, { useState } from 'react';
import { useKnowledge } from '@/context/KnowledgeContext';
import { KnowledgeType } from '@/types';
import {
  Search,
  Plus,
  FileText,
  Link2,
  FileCode,
  Image,
  FileAudio,
  Sparkles,
  ArrowRight,
  Star,
  Clock,
  FolderKanban,
  Tags,
  Command,
  TrendingUp,
  Brain,
  HardDrive,
  Activity,
  CheckCircle2,
} from 'lucide-react';
import { TypeIcon } from '@/components/ui/TypeIcon';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

export const DashboardView: React.FC = () => {
  const {
    user,
    knowledgeItems,
    collections,
    tags,
    activities,
    setActiveView,
    openDetailView,
    setIsAddModalOpen,
    setIsCommandPaletteOpen,
    setIsAiDrawerOpen,
    toggleFavorite,
    selectCollectionFilter,
    selectTagFilter,
    selectTypeFilter,
  } = useKnowledge();

  const [searchQuery, setSearchQuery] = useState('');

  // Time-based greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const recentItems = knowledgeItems.slice(0, 4);
  const favoriteItems = knowledgeItems.filter((i) => i.isFavorite).slice(0, 3);

  const notesCount = knowledgeItems.filter((i) => i.type === 'NOTE').length;
  const linksCount = knowledgeItems.filter((i) => i.type === 'LINK').length;
  const docsCount = knowledgeItems.filter((i) => i.type === 'PDF' || i.type === 'DOCUMENT').length;
  const audioCount = knowledgeItems.filter((i) => i.type === 'AUDIO').length;

  const quickCaptures = [
    { label: 'Note', icon: FileText, color: 'text-blue-500 bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-900/40' },
    { label: 'Link', icon: Link2, color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-900/40' },
    { label: 'Upload File', icon: FileCode, color: 'text-purple-500 bg-purple-50 dark:bg-purple-950/50 border-purple-200 dark:border-purple-900/40' },
    { label: 'Voice Note', icon: FileAudio, color: 'text-amber-500 bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-900/40' },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-10 animate-fade-in">
      {/* Hero Welcome & Search Banner */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-zinc-900 to-zinc-950 text-white p-6 sm:p-8 border border-zinc-800 shadow-xl">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <Brain size={240} className="text-indigo-400" />
        </div>

        <div className="relative z-10 space-y-6 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-medium">
            <Sparkles size={14} className="text-indigo-400" />
            Personal Knowledge Operating System
          </div>

          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-100">
              {getGreeting()}, {user.name}.
            </h1>
            <p className="mt-1.5 text-sm sm:text-base text-zinc-400 leading-relaxed">
              What would you like to retrieve or capture in your Second Brain today?
            </p>
          </div>

          {/* Prominent Search Bar */}
          <div className="relative">
            <button
              onClick={() => setIsCommandPaletteOpen(true)}
              className="w-full flex items-center justify-between px-4 py-3.5 rounded-xl bg-zinc-900/90 border border-zinc-700/80 text-zinc-400 hover:border-indigo-500/60 hover:text-zinc-200 transition-all shadow-inner group cursor-pointer text-left"
            >
              <div className="flex items-center gap-3">
                <Search size={18} className="text-zinc-400 group-hover:text-indigo-400 transition-colors" />
                <span className="text-sm font-medium">Search notes, documents, tags, or ask AI...</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                <kbd className="px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 font-mono text-[11px]">
                  ⌘ K
                </kbd>
              </div>
            </button>
          </div>

          {/* Quick Capture Pill Actions */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-xs font-medium text-zinc-400 mr-1">Quick Capture:</span>
            {quickCaptures.map((cap) => {
              const Icon = cap.icon;
              return (
                <button
                  key={cap.label}
                  onClick={() => setIsAddModalOpen(true)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all hover:scale-[1.02] cursor-pointer ${cap.color}`}
                >
                  <Icon size={14} />
                  {cap.label}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Knowledge Breakdown Metric Cards */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div
          onClick={() => {
            selectTypeFilter('NOTE');
          }}
          className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#121215] hover:border-zinc-300 dark:hover:border-zinc-700 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Notes</span>
            <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-500">
              <FileText size={16} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{notesCount}</span>
            <span className="text-[11px] text-zinc-400 group-hover:text-indigo-500 transition-colors flex items-center">
              View <ArrowRight size={12} className="ml-0.5" />
            </span>
          </div>
        </div>

        <div
          onClick={() => {
            selectTypeFilter('LINK');
          }}
          className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#121215] hover:border-zinc-300 dark:hover:border-zinc-700 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Links</span>
            <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-500">
              <Link2 size={16} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{linksCount}</span>
            <span className="text-[11px] text-zinc-400 group-hover:text-indigo-500 transition-colors flex items-center">
              View <ArrowRight size={12} className="ml-0.5" />
            </span>
          </div>
        </div>

        <div
          onClick={() => {
            selectTypeFilter('PDF');
          }}
          className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#121215] hover:border-zinc-300 dark:hover:border-zinc-700 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Documents</span>
            <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-950/50 text-purple-500">
              <FileCode size={16} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{docsCount}</span>
            <span className="text-[11px] text-zinc-400 group-hover:text-indigo-500 transition-colors flex items-center">
              View <ArrowRight size={12} className="ml-0.5" />
            </span>
          </div>
        </div>

        <div
          onClick={() => {
            selectTypeFilter('AUDIO');
          }}
          className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#121215] hover:border-zinc-300 dark:hover:border-zinc-700 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Audio / Voice</span>
            <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-500">
              <FileAudio size={16} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{audioCount}</span>
            <span className="text-[11px] text-zinc-400 group-hover:text-indigo-500 transition-colors flex items-center">
              View <ArrowRight size={12} className="ml-0.5" />
            </span>
          </div>
        </div>
      </section>

      {/* Main Grid: Recent Knowledge & Favorites / Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Columns: Recently Added Knowledge */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-indigo-500" />
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                Recently Added
              </h2>
            </div>
            <button
              onClick={() => setActiveView('library')}
              className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
            >
              See all ({knowledgeItems.length}) <ArrowRight size={12} />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {recentItems.map((item) => (
              <div
                key={item.id}
                onClick={() => openDetailView(item)}
                className="group relative flex flex-col justify-between p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#121215] hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-md transition-all cursor-pointer"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                      <TypeIcon type={item.type} size={14} />
                      {item.type}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite(item.id);
                      }}
                      className="text-zinc-300 dark:text-zinc-700 hover:text-amber-400 transition-colors"
                    >
                      <Star
                        size={15}
                        className={item.isFavorite ? 'fill-amber-400 text-amber-400' : ''}
                      />
                    </button>
                  </div>

                  <h3 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-2">
                    {item.title}
                  </h3>

                  <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2 leading-relaxed">
                    {item.summary}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between">
                  <div className="flex flex-wrap gap-1">
                    {item.tags.slice(0, 2).map((t) => (
                      <Badge key={t} variant="default" size="sm">
                        #{t}
                      </Badge>
                    ))}
                  </div>
                  <span className="text-[11px] text-zinc-400">
                    {new Date(item.createdAt).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Favorites Spotlight & Recent Activity */}
        <div className="space-y-6">
          {/* Favorite Knowledge Spotlight */}
          <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#121215] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">
                <Star size={14} className="text-amber-400 fill-amber-400" />
                Favorite Knowledge
              </div>
              <span className="text-[11px] text-zinc-400">{favoriteItems.length} pinned</span>
            </div>

            <div className="space-y-2">
              {favoriteItems.map((fav) => (
                <div
                  key={fav.id}
                  onClick={() => openDetailView(fav)}
                  className="flex items-start justify-between p-2.5 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer group"
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <TypeIcon type={fav.type} size={15} className="mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <h4 className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 group-hover:text-indigo-500 truncate">
                        {fav.title}
                      </h4>
                      <p className="text-[11px] text-zinc-400 truncate">{fav.collectionName || 'General'}</p>
                    </div>
                  </div>
                  <ArrowRight size={12} className="text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-1" />
                </div>
              ))}
            </div>
          </div>

          {/* Activity Timeline */}
          <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#121215] space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">
              <Activity size={14} className="text-indigo-500" />
              Recent System Activity
            </div>

            <div className="space-y-3 relative before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-zinc-200 dark:before:bg-zinc-800">
              {activities.slice(0, 4).map((act) => (
                <div key={act.id} className="relative pl-6 space-y-0.5 text-xs">
                  <div className="absolute left-0 top-1 w-4 h-4 rounded-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 flex items-center justify-center text-[10px]">
                    <CheckCircle2 size={10} className="text-indigo-500" />
                  </div>
                  <p className="text-zinc-700 dark:text-zinc-300 font-medium">
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100">{act.action}</span> "{act.knowledgeTitle}"
                  </p>
                  <p className="text-[10px] text-zinc-400">
                    {new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Collections Snapshot Grid */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderKanban size={16} className="text-indigo-500" />
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
              Knowledge Collections
            </h2>
          </div>
          <button
            onClick={() => setActiveView('collections')}
            className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
          >
            Manage Collections <ArrowRight size={12} />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {collections.map((col) => (
            <div
              key={col.id}
              onClick={() => selectCollectionFilter(col.id)}
              className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#121215] hover:border-indigo-500/50 transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: col.color }}
                />
                <span className="text-[10px] font-semibold text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
                  {col.itemCount} items
                </span>
              </div>
              <h3 className="mt-2.5 text-xs font-bold text-zinc-800 dark:text-zinc-200 group-hover:text-indigo-500 transition-colors truncate">
                {col.name}
              </h3>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
