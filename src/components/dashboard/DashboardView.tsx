'use client';

import React from 'react';
import { useKnowledge } from '@/context/KnowledgeContext';
import {
  Search,
  FileText,
  Link2,
  FileCode,
  Sparkles,
  ArrowRight,
  Star,
  Clock,
  FolderKanban,
  Brain,
  Activity,
  CheckCircle2,
  Plus,
  Bookmark,
  Layers,
  Tags,
} from 'lucide-react';
import { TypeIcon } from '@/components/ui/TypeIcon';
import { Badge } from '@/components/ui/Badge';

export const DashboardView: React.FC = () => {
  const {
    user,
    knowledgeItems,
    collections,
    tags,
    activities,
    dashboardStats,
    setActiveView,
    openDetailView,
    setIsAddModalOpen,
    setIsCommandPaletteOpen,
    toggleFavorite,
    selectCollectionFilter,
    selectTypeFilter,
    setFilterOptions,
    resetFilters,
  } = useKnowledge();

  // Time-based greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  // Live PostgreSQL statistics with fallback to client cache
  const totalKnowledge = dashboardStats?.totalKnowledge ?? knowledgeItems.length;
  const notesCount = dashboardStats?.totalNotes ?? knowledgeItems.filter((i) => i.type === 'NOTE').length;
  const linksCount = dashboardStats?.totalLinks ?? knowledgeItems.filter((i) => i.type === 'LINK').length;
  const docsCount = dashboardStats?.totalDocuments ?? knowledgeItems.filter((i) => i.type === 'PDF' || i.type === 'DOCUMENT').length;
  const favCount = dashboardStats?.totalFavorites ?? knowledgeItems.filter((i) => i.isFavorite).length;
  const colCount = dashboardStats?.totalCollections ?? collections.length;
  const tagCount = dashboardStats?.totalTags ?? tags.length;

  const recentItems = dashboardStats?.recentItems && dashboardStats.recentItems.length > 0
    ? dashboardStats.recentItems
    : knowledgeItems.slice(0, 4);

  const favoriteItems = knowledgeItems.filter((i) => i.isFavorite).slice(0, 4);

  const recentActivities = activities.length > 0
    ? activities
    : (dashboardStats?.recentActivities ?? []);

  const quickCaptures = [
    { label: 'Note', icon: FileText, color: 'text-blue-500 bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-900/40' },
    { label: 'Link', icon: Link2, color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-900/40' },
    { label: 'Upload File', icon: FileCode, color: 'text-purple-500 bg-purple-50 dark:bg-purple-950/50 border-purple-200 dark:border-purple-900/40' },
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

      {/* Real-time PostgreSQL Metric Cards */}
      <section className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {/* Total Knowledge */}
        <div
          onClick={() => {
            resetFilters();
            setActiveView('library');
          }}
          className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#121215] hover:border-indigo-500/50 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">All Items</span>
            <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-500">
              <Layers size={14} />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline justify-between">
            <span className="text-xl font-bold text-zinc-900 dark:text-zinc-100">{totalKnowledge}</span>
            <span className="text-[10px] text-zinc-400 group-hover:text-indigo-500 transition-colors flex items-center">
              View <ArrowRight size={10} className="ml-0.5" />
            </span>
          </div>
        </div>

        {/* Notes */}
        <div
          onClick={() => selectTypeFilter('NOTE')}
          className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#121215] hover:border-blue-500/50 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Notes</span>
            <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-500">
              <FileText size={14} />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline justify-between">
            <span className="text-xl font-bold text-zinc-900 dark:text-zinc-100">{notesCount}</span>
            <span className="text-[10px] text-zinc-400 group-hover:text-blue-500 transition-colors flex items-center">
              View <ArrowRight size={10} className="ml-0.5" />
            </span>
          </div>
        </div>

        {/* Links */}
        <div
          onClick={() => selectTypeFilter('LINK')}
          className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#121215] hover:border-emerald-500/50 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Links</span>
            <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-500">
              <Link2 size={14} />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline justify-between">
            <span className="text-xl font-bold text-zinc-900 dark:text-zinc-100">{linksCount}</span>
            <span className="text-[10px] text-zinc-400 group-hover:text-emerald-500 transition-colors flex items-center">
              View <ArrowRight size={10} className="ml-0.5" />
            </span>
          </div>
        </div>

        {/* Documents */}
        <div
          onClick={() => selectTypeFilter('PDF')}
          className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#121215] hover:border-purple-500/50 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Docs</span>
            <div className="p-1.5 rounded-lg bg-purple-50 dark:bg-purple-950/50 text-purple-500">
              <FileCode size={14} />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline justify-between">
            <span className="text-xl font-bold text-zinc-900 dark:text-zinc-100">{docsCount}</span>
            <span className="text-[10px] text-zinc-400 group-hover:text-purple-500 transition-colors flex items-center">
              View <ArrowRight size={10} className="ml-0.5" />
            </span>
          </div>
        </div>

        {/* Favorites */}
        <div
          onClick={() => {
            resetFilters();
            setFilterOptions((prev) => ({ ...prev, favoritesOnly: true }));
            setActiveView('library');
          }}
          className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#121215] hover:border-amber-500/50 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Favorites</span>
            <div className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-500">
              <Star size={14} />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline justify-between">
            <span className="text-xl font-bold text-zinc-900 dark:text-zinc-100">{favCount}</span>
            <span className="text-[10px] text-zinc-400 group-hover:text-amber-500 transition-colors flex items-center">
              View <ArrowRight size={10} className="ml-0.5" />
            </span>
          </div>
        </div>

        {/* Collections */}
        <div
          onClick={() => setActiveView('collections')}
          className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#121215] hover:border-rose-500/50 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Collections</span>
            <div className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/50 text-rose-500">
              <FolderKanban size={14} />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline justify-between">
            <span className="text-xl font-bold text-zinc-900 dark:text-zinc-100">{colCount}</span>
            <span className="text-[10px] text-zinc-400 group-hover:text-rose-500 transition-colors flex items-center">
              View <ArrowRight size={10} className="ml-0.5" />
            </span>
          </div>
        </div>

        {/* Tags */}
        <div
          onClick={() => setActiveView('tags')}
          className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#121215] hover:border-teal-500/50 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Tags</span>
            <div className="p-1.5 rounded-lg bg-teal-50 dark:bg-teal-950/50 text-teal-500">
              <Tags size={14} />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline justify-between">
            <span className="text-xl font-bold text-zinc-900 dark:text-zinc-100">{tagCount}</span>
            <span className="text-[10px] text-zinc-400 group-hover:text-teal-500 transition-colors flex items-center">
              View <ArrowRight size={10} className="ml-0.5" />
            </span>
          </div>
        </div>
      </section>

      {/* Main Grid: Recent Knowledge & Favorites / Real Activity */}
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
              className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              See all ({totalKnowledge}) <ArrowRight size={12} />
            </button>
          </div>

          {recentItems.length === 0 ? (
            <div className="p-8 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-800 bg-white/50 dark:bg-[#121215]/50 text-center space-y-3">
              <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-500 mx-auto flex items-center justify-center">
                <FileText size={20} />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">No knowledge items yet</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto">
                  Your Second Brain is ready. Start by capturing a note, saving a website link, or uploading a document.
                </p>
              </div>
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-500 transition-colors shadow-xs cursor-pointer"
              >
                <Plus size={14} /> Add First Knowledge Item
              </button>
            </div>
          ) : (
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
                      {item.summary || (item.content ? item.content.slice(0, 120) : 'No summary available.')}
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between">
                    <div className="flex flex-wrap gap-1">
                      {(item.tags || []).slice(0, 2).map((t) => (
                        <Badge key={t} variant="default" size="sm">
                          #{t}
                        </Badge>
                      ))}
                    </div>
                    <span className="text-[11px] text-zinc-400" suppressHydrationWarning>
                      {new Date(item.createdAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Favorites Spotlight & Real Activity */}
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

            {favoriteItems.length === 0 ? (
              <div className="p-4 text-center text-xs text-zinc-500 dark:text-zinc-400 space-y-1">
                <Bookmark size={20} className="mx-auto text-zinc-400 dark:text-zinc-600 mb-1.5" />
                <p className="font-medium text-zinc-700 dark:text-zinc-300">No pinned favorites yet</p>
                <p className="text-[11px] text-zinc-400">Click the star icon on any note to pin it here.</p>
              </div>
            ) : (
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
            )}
          </div>

          {/* Activity Timeline Grounded in PostgreSQL */}
          <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#121215] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">
                <Activity size={14} className="text-indigo-500" />
                Recent System Activity
              </div>
              <span className="text-[11px] text-zinc-400">{recentActivities.length} events</span>
            </div>

            {recentActivities.length === 0 ? (
              <div className="p-4 text-center text-xs text-zinc-500 dark:text-zinc-400 space-y-1">
                <Clock size={20} className="mx-auto text-zinc-400 dark:text-zinc-600 mb-1.5" />
                <p className="font-medium text-zinc-700 dark:text-zinc-300">No recent activity yet</p>
                <p className="text-[11px] text-zinc-400">Operations will automatically log here as you build your knowledge base.</p>
              </div>
            ) : (
              <div className="space-y-3 relative before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-zinc-200 dark:before:bg-zinc-800">
                {recentActivities.slice(0, 5).map((act) => (
                  <div key={act.id} className="relative pl-6 space-y-0.5 text-xs">
                    <div className="absolute left-0 top-1 w-4 h-4 rounded-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 flex items-center justify-center text-[10px]">
                      <CheckCircle2 size={10} className="text-indigo-500" />
                    </div>
                    <p className="text-zinc-700 dark:text-zinc-300 font-medium">
                      <span className="font-semibold text-zinc-900 dark:text-zinc-100">{act.action}</span> &ldquo;{act.knowledgeTitle}&rdquo;
                    </p>
                    <p className="text-[10px] text-zinc-400" suppressHydrationWarning>
                      {new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(act.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                    </p>
                  </div>
                ))}
              </div>
            )}
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
            className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
          >
            Manage Collections ({colCount}) <ArrowRight size={12} />
          </button>
        </div>

        {collections.length === 0 ? (
          <div className="p-6 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-800 bg-white/50 dark:bg-[#121215]/50 text-center space-y-2">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">No collections created yet.</p>
            <button
              onClick={() => setActiveView('collections')}
              className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-500 hover:underline cursor-pointer"
            >
              Create a Collection <ArrowRight size={12} />
            </button>
          </div>
        ) : (
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
        )}
      </section>
    </div>
  );
};
