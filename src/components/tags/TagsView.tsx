'use client';

import React from 'react';
import { useKnowledge } from '@/context/KnowledgeContext';
import { Tags as TagsIcon, Hash, ArrowRight } from 'lucide-react';

export const TagsView: React.FC = () => {
  const { tags, selectTagFilter } = useKnowledge();

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8 animate-fade-in">
      {/* Header */}
      <div className="border-b border-zinc-200 dark:border-zinc-800 pb-4">
        <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
          <TagsIcon className="text-indigo-500" size={22} /> Tag Cloud & Index
        </h1>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
          Lightweight semantic tags assigned across your notes, links, and documents.
        </p>
      </div>

      {/* Cloud Grid */}
      <div className="flex flex-wrap gap-3">
        {tags.map((t) => (
          <div
            key={t.id}
            onClick={() => selectTagFilter(t.name)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#121215] hover:border-indigo-500/60 hover:shadow-md transition-all cursor-pointer group"
          >
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: t.color }}
            />
            <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
              #{t.name}
            </span>
            <span className="text-[10px] font-semibold text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
              {t.itemCount}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
