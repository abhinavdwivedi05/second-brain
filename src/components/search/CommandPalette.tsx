'use client';

import React, { useState, useEffect } from 'react';
import { useKnowledge } from '@/context/KnowledgeContext';
import { useTheme } from '@/context/ThemeContext';
import { Search, Plus, FileText, FolderKanban, Tags, LayoutDashboard, Sun, Moon, ArrowRight, CornerDownLeft } from 'lucide-react';
import { TypeIcon } from '@/components/ui/TypeIcon';
import { KnowledgeService } from '@/services/api/knowledge';
import { Skeleton } from '@/components/ui/Skeleton';

export const CommandPalette: React.FC = () => {
  const {
    isCommandPaletteOpen,
    setIsCommandPaletteOpen,
    knowledgeItems,
    openDetailView,
    setActiveView,
    setIsAddModalOpen,
  } = useKnowledge();

  const { theme, toggleTheme } = useTheme();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  // Search state
  const [searchState, setSearchState] = useState<'IDLE' | 'LOADING' | 'RESULTS' | 'EMPTY' | 'ERROR'>('IDLE');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const abortControllerRef = React.useRef<AbortController | null>(null);
  const debounceTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  // Pagination (if needed)
  const [pageInfo, setPageInfo] = useState({ page: 1, pageSize: 20, totalPages: 0, total: 0 });

  useEffect(() => {
    setQuery('');
    setSelectedIndex(0);
  }, [isCommandPaletteOpen]);

  if (!isCommandPaletteOpen) return null;

  // Perform debounced search when query changes
  useEffect(() => {
    if (!query.trim()) {
      setSearchState('IDLE');
      setSearchResults([]);
      return;
    }
    setSearchState('LOADING');
    if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
    debounceTimeoutRef.current = setTimeout(() => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;
      KnowledgeService.searchKnowledge({ q: query.trim(), page: pageInfo.page, pageSize: pageInfo.pageSize })
        .then((resp) => {
          setSearchResults(resp.items);
          setPageInfo({ page: resp.page, pageSize: resp.pageSize, totalPages: resp.totalPages, total: resp.total });
          setSearchState(resp.items.length ? 'RESULTS' : 'EMPTY');
        })
        .catch((err) => {
          if (err.name === 'AbortError') return;
          console.error(err);
          setSearchState('ERROR');
        });
    }, 300);
    return () => {
      if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
    };
  }, [query, pageInfo.page, pageInfo.pageSize]);

  const displayItems = query.trim() ? searchResults : knowledgeItems.slice(0, 5);

  const quickActions = [
    {
      id: 'action-add',
      label: 'Add New Knowledge Note',
      icon: Plus,
      action: () => {
        setIsCommandPaletteOpen(false);
        setIsAddModalOpen(true);
      },
    },
    {
      id: 'action-dashboard',
      label: 'Go to Dashboard',
      icon: LayoutDashboard,
      action: () => {
        setIsCommandPaletteOpen(false);
        setActiveView('dashboard');
      },
    },
    {
      id: 'action-collections',
      label: 'Open Collections',
      icon: FolderKanban,
      action: () => {
        setIsCommandPaletteOpen(false);
        setActiveView('collections');
      },
    },
    {
      id: 'action-tags',
      label: 'Open Tags Cloud',
      icon: Tags,
      action: () => {
        setIsCommandPaletteOpen(false);
        setActiveView('tags');
      },
    },
    {
      id: 'action-theme',
      label: `Toggle Theme (${theme === 'dark' ? 'Light' : 'Dark'})`,
      icon: theme === 'dark' ? Sun : Moon,
      action: () => {
        toggleTheme();
        setIsCommandPaletteOpen(false);
      },
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div className="w-full max-w-xl bg-white dark:bg-[#121215] rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden flex flex-col">
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-zinc-200 dark:border-zinc-800/80">
          <Search size={18} className="text-zinc-400 mr-3 shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command or search knowledge base..."
            className="w-full bg-transparent text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none"
            autoFocus
          />
          <button
            onClick={() => setIsCommandPaletteOpen(false)}
            className="text-[11px] font-mono px-2 py-1 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-400 hover:text-zinc-600"
          >
            ESC
          </button>
        </div>

        {/* Results Scroll List */}
        <div className="max-h-[60vh] overflow-y-auto p-2 space-y-4">
          {/* Knowledge Search Results */}
          <div className="space-y-1">
            <div className="px-3 py-1 text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
              {query ? 'Matching Knowledge' : 'Recent Knowledge'}
            </div>
            {displayItems.length === 0 ? (
              <div className="px-3 py-4 text-xs text-zinc-500 text-center">
                {searchState === 'LOADING' ? (
                  <Skeleton className="h-4 w-3/4 mx-auto" />
                ) : (
                  `No matching knowledge entries found for "${query}"`
                )}
              </div>
            ) : (
              displayItems.map((item) => (
                <div
                  key={item.id}
                  onClick={() => {
                    setIsCommandPaletteOpen(false);
                    openDetailView(item);
                  }}
                  className="flex items-center justify-between p-2.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800/70 cursor-pointer group transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <TypeIcon type={item.type} size={16} className="shrink-0" />
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 group-hover:text-indigo-500 truncate">
                        {item.title}
                      </h4>
                      <p className="text-[11px] text-zinc-400 truncate">{item.summary}</p>
                    </div>
                  </div>
                  <CornerDownLeft size={14} className="text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2" />
                </div>
              ))
            )}
          </div>


          {/* Quick Commands */}
          {!query && (
            <div className="space-y-1 pt-2 border-t border-zinc-100 dark:border-zinc-800/80">
              <div className="px-3 py-1 text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                System Commands
              </div>
              {quickActions.map((cmd) => {
                const Icon = cmd.icon;
                return (
                  <div
                    key={cmd.id}
                    onClick={cmd.action}
                    className="flex items-center justify-between p-2.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800/70 cursor-pointer group transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Icon size={16} className="text-zinc-400 group-hover:text-indigo-500" />
                      <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300 group-hover:text-zinc-900 dark:group-hover:text-zinc-100">
                        {cmd.label}
                      </span>
                    </div>
                    <ArrowRight size={12} className="text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer shortcuts hint */}
        <div className="px-4 py-2 bg-zinc-50 dark:bg-zinc-900/60 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-[11px] text-zinc-400 font-mono">
          <span>Second Brain Quick Search</span>
          <div className="flex items-center gap-3">
            <span>↵ Select</span>
            <span>ESC Close</span>
          </div>
        </div>
      </div>
    </div>
  );
};
