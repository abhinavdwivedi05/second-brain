'use client';

import React from 'react';
import { useKnowledge } from '@/context/KnowledgeContext';
import { useTheme } from '@/context/ThemeContext';
import {
  Search,
  Plus,
  Sparkles,
  Command,
  Sun,
  Moon,
  Menu,
  ChevronRight,
  Bell,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';

export const Header: React.FC = () => {
  const {
    activeView,
    activeItem,
    filterOptions,
    setIsAddModalOpen,
    setIsCommandPaletteOpen,
    setIsAiDrawerOpen,
    isSidebarCollapsed,
    setIsSidebarCollapsed,
  } = useKnowledge();

  const { theme, toggleTheme } = useTheme();

  // Breadcrumb text determination
  const getBreadcrumb = () => {
    switch (activeView) {
      case 'dashboard':
        return 'Dashboard';
      case 'library':
        if (filterOptions.favoritesOnly) return 'Favorites';
        if (filterOptions.type && filterOptions.type !== 'ALL') return `${filterOptions.type} Library`;
        if (filterOptions.tag) return `#${filterOptions.tag}`;
        return 'All Knowledge';
      case 'detail':
        return activeItem ? activeItem.title : 'Knowledge Detail';
      case 'collections':
        return 'Collections';
      case 'tags':
        return 'Tags';
      case 'settings':
        return 'Settings';
      case 'landing':
        return 'Product Overview';
      default:
        return 'Second Brain';
    }
  };

  return (
    <header className="h-14 border-b border-zinc-200 dark:border-zinc-800/80 bg-white/80 dark:bg-[#09090b]/80 backdrop-blur-md sticky top-0 z-20 flex items-center justify-between px-4 sm:px-6 transition-colors">
      {/* Left: Hamburger & Breadcrumbs */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          className="md:hidden p-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        >
          <Menu size={18} />
        </button>

        <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400 min-w-0">
          <span className="font-medium text-zinc-400 dark:text-zinc-500 hidden sm:inline">
            Second Brain
          </span>
          <ChevronRight size={14} className="text-zinc-300 dark:text-zinc-600 hidden sm:inline" />
          <span className="font-semibold text-zinc-900 dark:text-zinc-100 truncate max-w-[220px] sm:max-w-md">
            {getBreadcrumb()}
          </span>
        </div>
      </div>

      {/* Center: Command Palette Trigger Input */}
      <div className="flex-1 max-w-md mx-4 hidden md:block">
        <button
          onClick={() => setIsCommandPaletteOpen(true)}
          className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 text-zinc-400 dark:text-zinc-500 hover:border-zinc-300 dark:hover:border-zinc-700 hover:text-zinc-600 dark:hover:text-zinc-300 transition-all text-xs group"
        >
          <div className="flex items-center gap-2">
            <Search size={14} className="group-hover:text-indigo-500 transition-colors" />
            <span>Search your knowledge base...</span>
          </div>
          <kbd className="inline-flex items-center gap-0.5 text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-200/60 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border border-zinc-300/50 dark:border-zinc-700/50">
            <Command size={10} /> K
          </kbd>
        </button>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        {/* Mobile Search Button */}
        <button
          onClick={() => setIsCommandPaletteOpen(true)}
          className="md:hidden p-2 rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          title="Search"
        >
          <Search size={18} />
        </button>

        {/* AI Assistant Drawer Trigger */}
        <Button
          onClick={() => setIsAiDrawerOpen(true)}
          variant="outline"
          size="sm"
          className="hidden sm:inline-flex border-indigo-500/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/40"
          leftIcon={<Sparkles size={14} className="text-indigo-500" />}
        >
          Ask AI
        </Button>

        {/* Quick Add Button */}
        <Button
          onClick={() => setIsAddModalOpen(true)}
          variant="primary"
          size="sm"
          leftIcon={<Plus size={14} />}
        >
          <span className="hidden sm:inline">Add Knowledge</span>
          <span className="sm:hidden">Add</span>
        </Button>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors ml-1"
          title={theme === 'dark' ? 'Switch to Light mode' : 'Switch to Dark mode'}
        >
          {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
        </button>
      </div>
    </header>
  );
};
