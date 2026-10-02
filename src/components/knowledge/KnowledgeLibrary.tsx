'use client';

import React from 'react';
import { useKnowledge, ViewMode } from '@/context/KnowledgeContext';
import { KnowledgeType, KnowledgeItem } from '@/types';
import {
  Search,
  LayoutGrid,
  List,
  AlignJustify,
  Filter,
  Star,
  Plus,
  ArrowUpDown,
  Tag as TagIcon,
  FolderKanban,
  FileText,
  Link2,
  FileCode,
  Image,
  FileAudio,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import { TypeIcon } from '@/components/ui/TypeIcon';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

export const KnowledgeLibrary: React.FC = () => {
  const {
    knowledgeItems,
    filterOptions,
    setFilterOptions,
    resetFilters,
    viewMode,
    setViewMode,
    openDetailView,
    toggleFavorite,
    setIsAddModalOpen,
    collections,
    tags,
    isLoading,
  } = useKnowledge();

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilterOptions((prev) => ({ ...prev, query: e.target.value }));
  };

  const handleTypeSelect = (type: KnowledgeType | 'ALL') => {
    setFilterOptions((prev) => ({ ...prev, type, favoritesOnly: false }));
  };

  const types: { key: KnowledgeType | 'ALL'; label: string; icon?: React.ReactNode }[] = [
    { key: 'ALL', label: 'All Items' },
    { key: 'NOTE', label: 'Notes', icon: <FileText size={14} /> },
    { key: 'LINK', label: 'Links', icon: <Link2 size={14} /> },
    { key: 'PDF', label: 'PDFs', icon: <FileCode size={14} /> },
    { key: 'DOCUMENT', label: 'Docs', icon: <FileText size={14} /> },
    { key: 'AUDIO', label: 'Audio', icon: <FileAudio size={14} /> },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6 animate-fade-in">
      {/* Top Filter Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-4">
        {/* Left: Type Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          {types.map((t) => {
            const isActive =
              filterOptions.type === t.key && !filterOptions.favoritesOnly;
            return (
              <button
                key={t.key}
                onClick={() => handleTypeSelect(t.key)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${isActive
                  ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-sm'
                  : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200/70 dark:bg-zinc-800/60 dark:text-zinc-400 dark:hover:bg-zinc-800'
                  }`}
              >
                {t.icon}
                {t.label}
              </button>
            );
          })}

          <button
            onClick={() =>
              setFilterOptions((prev) => ({ ...prev, favoritesOnly: !prev.favoritesOnly }))
            }
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${filterOptions.favoritesOnly
              ? 'bg-amber-500 text-white shadow-sm'
              : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200/70 dark:bg-zinc-800/60 dark:text-zinc-400 dark:hover:bg-zinc-800'
              }`}
          >
            <Star size={14} className={filterOptions.favoritesOnly ? 'fill-white' : ''} />
            Favorites
          </button>
        </div>

        {/* Right: View Mode Toggle & Sort */}
        <div className="flex items-center gap-2">
          {/* Sort Dropdown */}
          <div className="relative inline-flex items-center">
            <select
              value={filterOptions.sortBy || 'newest'}
              onChange={(e) =>
                setFilterOptions((prev) => ({
                  ...prev,
                  sortBy: e.target.value as any,
                }))
              }
              className="text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700/80 rounded-lg px-2.5 py-1.5 pr-6 focus:outline-none cursor-pointer appearance-none"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="recently_accessed">Recently Accessed</option>
              <option value="title">Alphabetical (A-Z)</option>
            </select>
            <ArrowUpDown size={12} className="absolute right-2 text-zinc-400 pointer-events-none" />
          </div>

          {/* View Switchers */}
          <div className="flex items-center bg-zinc-100 dark:bg-zinc-800/80 p-0.5 rounded-lg border border-zinc-200/80 dark:border-zinc-700/60">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-md text-zinc-500 transition-colors ${viewMode === 'grid'
                ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-xs'
                : 'hover:text-zinc-900 dark:hover:text-zinc-200'
                }`}
              title="Grid View"
            >
              <LayoutGrid size={15} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-md text-zinc-500 transition-colors ${viewMode === 'list'
                ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-xs'
                : 'hover:text-zinc-900 dark:hover:text-zinc-200'
                }`}
              title="Detailed List View"
            >
              <List size={15} />
            </button>
            <button
              onClick={() => setViewMode('compact')}
              className={`p-1.5 rounded-md text-zinc-500 transition-colors ${viewMode === 'compact'
                ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-xs'
                : 'hover:text-zinc-900 dark:hover:text-zinc-200'
                }`}
              title="Compact View"
            >
              <AlignJustify size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* Filter Chips Bar (Query, Tag, Collection active indicator) */}
      {(filterOptions.query || filterOptions.tag || filterOptions.collectionId) && (
        <div className="flex flex-wrap items-center gap-2 bg-indigo-50/50 dark:bg-indigo-950/30 p-2.5 rounded-lg border border-indigo-200/50 dark:border-indigo-900/40 text-xs">
          <span className="font-semibold text-indigo-700 dark:text-indigo-300">Active Filters:</span>

          {filterOptions.query && (
            <Badge variant="accent" size="sm">
              Search: "{filterOptions.query}"
            </Badge>
          )}

          {filterOptions.tag && (
            <Badge variant="accent" size="sm">
              Tag: #{filterOptions.tag}
            </Badge>
          )}

          {filterOptions.collectionId && (
            <Badge variant="accent" size="sm">
              Collection: {collections.find((c) => c.id === filterOptions.collectionId)?.name || filterOptions.collectionId}
            </Badge>
          )}

          <button
            onClick={resetFilters}
            className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline ml-auto"
          >
            Clear all filters
          </button>
        </div>
      )}

      {/* Knowledge Items Render */}
      {knowledgeItems.length === 0 ? (
        <div className="text-center py-16 px-4 space-y-4 rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-800 bg-white/50 dark:bg-[#121215]/50">
          <div className="mx-auto w-12 h-12 rounded-full bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-500">
            <Search size={22} />
          </div>
          <div className="max-w-sm mx-auto space-y-1">
            <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-100">
              No knowledge found
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              We couldn't find any knowledge entries matching your active filters.
            </p>
          </div>
          <div className="flex justify-center gap-3 pt-2">
            <Button variant="outline" size="sm" onClick={resetFilters}>
              Reset Filters
            </Button>
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus size={14} />}
              onClick={() => setIsAddModalOpen(true)}
            >
              Add Knowledge
            </Button>
          </div>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {knowledgeItems.map((item) => (
            <KnowledgeCardGrid key={item.id} item={item} />
          ))}
        </div>
      ) : viewMode === 'list' ? (
        <div className="space-y-3">
          {knowledgeItems.map((item) => (
            <KnowledgeCardList key={item.id} item={item} />
          ))}
        </div>
      ) : (
        <div className="divide-y divide-zinc-200 dark:divide-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#121215] overflow-hidden">
          {knowledgeItems.map((item) => (
            <KnowledgeCardCompact key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
};

// Component: Grid Card
const KnowledgeCardGrid: React.FC<{ item: KnowledgeItem }> = ({ item }) => {
  const { openDetailView, toggleFavorite } = useKnowledge();

  return (
    <div
      onClick={() => openDetailView(item)}
      className="group relative flex flex-col justify-between p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#121215] hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-md transition-all cursor-pointer"
    >
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
            <TypeIcon type={item.type} size={14} />
            {item.type}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleFavorite(item.id);
            }}
            className="text-zinc-300 dark:text-zinc-700 hover:text-amber-400 transition-colors p-1"
          >
            <Star
              size={16}
              className={item.isFavorite ? 'fill-amber-400 text-amber-400' : ''}
            />
          </button>
        </div>

        <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-2 leading-snug">
          {item.title}
        </h3>

        <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-3 leading-relaxed">
          {item.summary}
        </p>
      </div>

      <div className="mt-5 pt-3 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between">
        <div className="flex flex-wrap gap-1">
          {item.tags.slice(0, 2).map((t) => (
            <Badge key={t} variant="default" size="sm">
              #{t}
            </Badge>
          ))}
        </div>
        <span className="text-[11px] font-medium text-zinc-400" suppressHydrationWarning>
          {new Date(item.createdAt).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
          })}
        </span>
      </div>
    </div>
  );
};

// Component: Detailed List Card
const KnowledgeCardList: React.FC<{ item: KnowledgeItem }> = ({ item }) => {
  const { openDetailView, toggleFavorite } = useKnowledge();

  return (
    <div
      onClick={() => openDetailView(item)}
      className="group flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#121215] hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-xs transition-all cursor-pointer gap-4"
    >
      <div className="flex items-start gap-3.5 min-w-0 flex-1">
        <div className="p-2.5 rounded-lg bg-zinc-100 dark:bg-zinc-800/80 shrink-0 mt-0.5">
          <TypeIcon type={item.type} size={18} />
        </div>

        <div className="space-y-1 min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors truncate">
              {item.title}
            </h3>
            {item.collectionName && (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hidden md:inline">
                {item.collectionName}
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-1">
            {item.summary}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0">
        <div className="flex flex-wrap gap-1">
          {item.tags.slice(0, 2).map((t) => (
            <Badge key={t} variant="default" size="sm">
              #{t}
            </Badge>
          ))}
        </div>

        <span className="text-xs text-zinc-400 font-medium" suppressHydrationWarning>
          {new Date(item.createdAt).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
          })}
        </span>

        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleFavorite(item.id);
          }}
          className="text-zinc-300 dark:text-zinc-700 hover:text-amber-400 transition-colors p-1"
        >
          <Star
            size={16}
            className={item.isFavorite ? 'fill-amber-400 text-amber-400' : ''}
          />
        </button>

        <ChevronRight size={16} className="text-zinc-400 group-hover:text-indigo-500 transition-colors" />
      </div>
    </div>
  );
};

// Component: Compact List Card
const KnowledgeCardCompact: React.FC<{ item: KnowledgeItem }> = ({ item }) => {
  const { openDetailView } = useKnowledge();

  return (
    <div
      onClick={() => openDetailView(item)}
      className="flex items-center justify-between px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer group text-xs"
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <TypeIcon type={item.type} size={15} className="shrink-0" />
        <span className="font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-indigo-500 truncate">
          {item.title}
        </span>
      </div>

      <div className="flex items-center gap-4 text-zinc-400 shrink-0">
        <span className="hidden sm:inline text-[11px] font-mono">#{item.tags[0] || 'general'}</span>
        <span suppressHydrationWarning>
          {new Date(item.createdAt).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
          })}
        </span>
      </div>
    </div>
  );
};
