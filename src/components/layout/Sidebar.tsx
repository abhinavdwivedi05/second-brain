'use client';

import React from 'react';
import { useKnowledge, ActiveView } from '@/context/KnowledgeContext';
import { useTheme } from '@/context/ThemeContext';
import { KnowledgeType } from '@/types';
import {
  Brain,
  Plus,
  LayoutDashboard,
  Library,
  FileText,
  Link2,
  FileCode,
  Image,
  FileAudio,
  FolderKanban,
  Tags,
  Star,
  Clock,
  Sparkles,
  Settings,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  Compass,
  HardDrive,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';

export const Sidebar: React.FC = () => {
  const {
    activeView,
    setActiveView,
    knowledgeItems,
    collections,
    tags,
    user,
    setIsAddModalOpen,
    setIsAiDrawerOpen,
    isSidebarCollapsed,
    setIsSidebarCollapsed,
    selectTypeFilter,
    resetFilters,
  } = useKnowledge();

  const { theme, toggleTheme } = useTheme();

  // Helper counts
  const totalCount = knowledgeItems.length;
  const favoriteCount = knowledgeItems.filter((i) => i.isFavorite).length;

  const countByType = (type: KnowledgeType) =>
    knowledgeItems.filter((i) => i.type === type).length;

  const navItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      action: () => {
        resetFilters();
        setActiveView('dashboard');
      },
      active: activeView === 'dashboard',
    },
    {
      id: 'library',
      label: 'All Knowledge',
      icon: Library,
      count: totalCount,
      action: () => {
        resetFilters();
        setActiveView('library');
      },
      active: activeView === 'library',
    },
    {
      id: 'favorites',
      label: 'Favorites',
      icon: Star,
      count: favoriteCount,
      action: () => {
        resetFilters();
        useKnowledge().setFilterOptions((prev) => ({ ...prev, favoritesOnly: true }));
        setActiveView('library');
      },
      active: activeView === 'library' && useKnowledge().filterOptions.favoritesOnly,
    },
  ];

  const typeNavItems = [
    { type: 'NOTE' as KnowledgeType, label: 'Notes', icon: FileText, count: countByType('NOTE') },
    { type: 'LINK' as KnowledgeType, label: 'Links', icon: Link2, count: countByType('LINK') },
    { type: 'PDF' as KnowledgeType, label: 'PDFs', icon: FileCode, count: countByType('PDF') },
    { type: 'DOCUMENT' as KnowledgeType, label: 'Documents', icon: FileText, count: countByType('DOCUMENT') },
    { type: 'IMAGE' as KnowledgeType, label: 'Images', icon: Image, count: countByType('IMAGE') },
    { type: 'AUDIO' as KnowledgeType, label: 'Audio', icon: FileAudio, count: countByType('AUDIO') },
  ];

  const secondaryNavItems = [
    {
      id: 'collections',
      label: 'Collections',
      icon: FolderKanban,
      count: collections.length,
      action: () => setActiveView('collections'),
      active: activeView === 'collections',
    },
    {
      id: 'tags',
      label: 'Tags',
      icon: Tags,
      count: tags.length,
      action: () => setActiveView('tags'),
      active: activeView === 'tags',
    },
    {
      id: 'landing',
      label: 'Product Overview',
      icon: Compass,
      action: () => setActiveView('landing'),
      active: activeView === 'landing',
    },
  ];

  const percentStorage = Math.min(
    100,
    Math.round((user.storageUsedBytes / user.storageLimitBytes) * 100)
  );

  return (
    <aside
      className={`relative flex flex-col h-screen border-r border-zinc-200 dark:border-zinc-800/80 bg-zinc-50/70 dark:bg-[#0c0c0e] transition-all duration-300 z-30 select-none ${
        isSidebarCollapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Brand Header */}
      <div className="flex items-center justify-between px-3.5 py-4 border-b border-zinc-200/60 dark:border-zinc-800/50">
        <div
          onClick={() => setActiveView('dashboard')}
          className="flex items-center gap-2.5 cursor-pointer group overflow-hidden"
        >
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-600 text-white shadow-sm shadow-indigo-600/30 shrink-0 group-hover:scale-105 transition-transform">
            <Brain size={18} />
          </div>
          {!isSidebarCollapsed && (
            <div className="flex flex-col min-w-0">
              <span className="font-bold text-sm tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5 truncate">
                SECOND BRAIN
                <span className="text-[10px] font-medium px-1.5 py-0.2 rounded bg-indigo-100 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/40">
                  v2.4
                </span>
              </span>
              <span className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                Knowledge OS
              </span>
            </div>
          )}
        </div>

        {/* Collapse button */}
        <button
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          className="p-1 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200/60 dark:hover:bg-zinc-800/60 transition-colors"
          title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isSidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Quick Add Button */}
      <div className="p-3">
        {isSidebarCollapsed ? (
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="w-full flex items-center justify-center p-2.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 transition-colors shadow-sm"
            title="Add Knowledge"
          >
            <Plus size={18} />
          </button>
        ) : (
          <Button
            onClick={() => setIsAddModalOpen(true)}
            variant="primary"
            className="w-full justify-center shadow-sm py-2 text-sm font-medium"
            leftIcon={<Plus size={16} />}
          >
            Add Knowledge
          </Button>
        )}
      </div>

      {/* Main Navigation Scroll area */}
      <div className="flex-1 overflow-y-auto px-3 py-1 space-y-6">
        {/* Main Section */}
        <div>
          {!isSidebarCollapsed && (
            <div className="px-2 mb-1.5 text-[11px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
              Overview
            </div>
          )}
          <nav className="space-y-0.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={item.action}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    item.active
                      ? 'bg-zinc-200/80 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-semibold'
                      : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/40 dark:hover:bg-zinc-800/40 hover:text-zinc-900 dark:hover:text-zinc-200'
                  }`}
                  title={isSidebarCollapsed ? item.label : undefined}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon
                      size={16}
                      className={item.active ? 'text-indigo-600 dark:text-indigo-400' : ''}
                    />
                    {!isSidebarCollapsed && <span className="truncate">{item.label}</span>}
                  </div>
                  {!isSidebarCollapsed && item.count !== undefined && (
                    <span className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 px-1.5 py-0.5 rounded bg-zinc-200/40 dark:bg-zinc-800/40">
                      {item.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Knowledge Types */}
        <div>
          {!isSidebarCollapsed && (
            <div className="px-2 mb-1.5 text-[11px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
              Knowledge Types
            </div>
          )}
          <nav className="space-y-0.5">
            {typeNavItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                activeView === 'library' &&
                useKnowledge().filterOptions.type === item.type &&
                !useKnowledge().filterOptions.favoritesOnly;

              return (
                <button
                  key={item.type}
                  onClick={() => selectTypeFilter(item.type)}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-zinc-200/80 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-semibold'
                      : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/40 dark:hover:bg-zinc-800/40 hover:text-zinc-900 dark:hover:text-zinc-200'
                  }`}
                  title={isSidebarCollapsed ? item.label : undefined}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon size={16} className={isActive ? 'text-indigo-500' : 'text-zinc-400'} />
                    {!isSidebarCollapsed && <span className="truncate">{item.label}</span>}
                  </div>
                  {!isSidebarCollapsed && (
                    <span className="text-[10px] text-zinc-400 dark:text-zinc-500 px-1.5 py-0.5 rounded">
                      {item.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Organization */}
        <div>
          {!isSidebarCollapsed && (
            <div className="px-2 mb-1.5 text-[11px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
              Organize
            </div>
          )}
          <nav className="space-y-0.5">
            {secondaryNavItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={item.action}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    item.active
                      ? 'bg-zinc-200/80 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-semibold'
                      : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/40 dark:hover:bg-zinc-800/40 hover:text-zinc-900 dark:hover:text-zinc-200'
                  }`}
                  title={isSidebarCollapsed ? item.label : undefined}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon size={16} className={item.active ? 'text-indigo-500' : ''} />
                    {!isSidebarCollapsed && <span className="truncate">{item.label}</span>}
                  </div>
                  {!isSidebarCollapsed && item.count !== undefined && (
                    <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
                      {item.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* AI Assistant Quick Trigger */}
        <div>
          <button
            onClick={() => setIsAiDrawerOpen(true)}
            className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 border border-indigo-500/20 text-indigo-700 dark:text-indigo-300 hover:border-indigo-500/40 transition-all group"
            title="Open AI Knowledge Assistant"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <Sparkles size={16} className="text-indigo-500 group-hover:scale-110 transition-transform" />
              {!isSidebarCollapsed && <span className="text-xs font-semibold">AI Assistant</span>}
            </div>
            {!isSidebarCollapsed && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-600 dark:text-indigo-400">
                ASK
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Footer Area */}
      <div className="p-3 border-t border-zinc-200/60 dark:border-zinc-800/50 space-y-3">
        {/* Storage Bar */}
        {!isSidebarCollapsed && (
          <div className="px-1 space-y-1.5">
            <div className="flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400">
              <span className="flex items-center gap-1">
                <HardDrive size={12} /> Storage
              </span>
              <span>142 MB / 10 GB</span>
            </div>
            <div className="h-1.5 w-full bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-600 dark:bg-indigo-500 rounded-full transition-all duration-500"
                style={{ width: `${percentStorage}%` }}
              />
            </div>
          </div>
        )}

        {/* User profile & Theme toggle */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2 min-w-0">
            <img
              src={user.avatarUrl}
              alt={user.name}
              className="w-7 h-7 rounded-full object-cover ring-1 ring-zinc-300 dark:ring-zinc-700"
            />
            {!isSidebarCollapsed && (
              <div className="flex flex-col min-w-0 text-left">
                <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                  {user.name}
                </span>
                <span className="text-[10px] text-zinc-400 truncate">{user.role}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveView('settings')}
              className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200/60 dark:hover:bg-zinc-800/60 transition-colors"
              title="Settings"
            >
              <Settings size={15} />
            </button>
            <button
              onClick={toggleTheme}
              className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200/60 dark:hover:bg-zinc-800/60 transition-colors"
              title={theme === 'dark' ? 'Switch to Light mode' : 'Switch to Dark mode'}
            >
              {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};
