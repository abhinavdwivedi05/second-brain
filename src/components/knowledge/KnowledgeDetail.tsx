'use client';

import React, { useState, useEffect } from 'react';
import { useKnowledge } from '@/context/KnowledgeContext';
import { KnowledgeItem } from '@/types';
import { KnowledgeService } from '@/services/api/knowledge';
import { AIService } from '@/services/api/ai';
import {
  ArrowLeft,
  Star,
  Trash2,
  ExternalLink,
  Sparkles,
  Tag as TagIcon,
  FolderKanban,
  FileText,
  Clock,
  Share2,
  Copy,
  Check,
  Play,
  Pause,
  Download,
  Brain,
  Link2,
  FileCode,
  Layers,
  ChevronRight,
} from 'lucide-react';
import { TypeIcon } from '@/components/ui/TypeIcon';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

export const KnowledgeDetail: React.FC = () => {
  const {
    activeItem,
    setActiveView,
    toggleFavorite,
    deleteKnowledge,
    openDetailView,
    setIsAiDrawerOpen,
  } = useKnowledge();

  const [relatedItems, setRelatedItems] = useState<KnowledgeItem[]>([]);
  const [copied, setCopied] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);

  useEffect(() => {
    if (activeItem) {
      KnowledgeService.getRelatedItems(activeItem).then(setRelatedItems);
    }
  }, [activeItem]);

  if (!activeItem) {
    return (
      <div className="max-w-4xl mx-auto p-12 text-center space-y-4">
        <p className="text-zinc-500">No knowledge item selected.</p>
        <Button variant="primary" onClick={() => setActiveView('library')}>
          Go to All Knowledge
        </Button>
      </div>
    );
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(activeItem.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDelete = async () => {
    if (confirm(`Are you sure you want to delete "${activeItem.title}"?`)) {
      await deleteKnowledge(activeItem.id);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-8 animate-fade-in">
      {/* Top Navigation Bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setActiveView('library')}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
        >
          <ArrowLeft size={16} /> Back to Knowledge Base
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={() => toggleFavorite(activeItem.id)}
            className="p-2 rounded-lg text-zinc-400 hover:text-amber-400 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            title="Toggle Favorite"
          >
            <Star
              size={16}
              className={activeItem.isFavorite ? 'fill-amber-400 text-amber-400' : ''}
            />
          </button>
          <button
            onClick={handleCopy}
            className="p-2 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            title="Copy Content"
          >
            {copied ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
          </button>
          <button
            onClick={handleDelete}
            className="p-2 rounded-lg text-zinc-400 hover:text-red-500 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            title="Delete Knowledge"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* Title Header */}
      <div className="space-y-3 border-b border-zinc-200 dark:border-zinc-800 pb-6">
        <div className="flex items-center gap-2.5">
          <Badge variant="accent" size="md">
            <TypeIcon type={activeItem.type} size={14} />
            {activeItem.type}
          </Badge>

          {activeItem.collectionName && (
            <Badge variant="secondary" size="md">
              <FolderKanban size={12} className="mr-1" />
              {activeItem.collectionName}
            </Badge>
          )}

          <span className="text-xs text-zinc-400 font-medium">
            Added {new Date(activeItem.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 leading-snug">
          {activeItem.title}
        </h1>

        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          {activeItem.tags.map((t) => (
            <Badge key={t} variant="default" size="sm">
              #{t}
            </Badge>
          ))}
        </div>
      </div>

      {/* Main Content Layout (Left Column + Right Sidebar) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: AI Summary + Main Content */}
        <div className="lg:col-span-2 space-y-8">
          {/* AI Intelligence Box */}
          <div className="p-5 rounded-xl bg-gradient-to-br from-indigo-50/70 via-purple-50/40 to-white dark:from-indigo-950/40 dark:via-purple-950/20 dark:to-[#121215] border border-indigo-200/80 dark:border-indigo-800/50 space-y-4 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-300 font-bold text-xs uppercase tracking-wider">
                <Sparkles size={16} className="text-indigo-500" />
                AI Knowledge Insights & Key Concepts
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsAiDrawerOpen(true)}
                className="text-xs border-indigo-300 dark:border-indigo-700 text-indigo-600 dark:text-indigo-300"
                leftIcon={<Brain size={13} />}
              >
                Ask Assistant
              </Button>
            </div>

            <p className="text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed font-medium">
              {activeItem.summary}
            </p>

            {activeItem.keyConcepts && activeItem.keyConcepts.length > 0 && (
              <div className="pt-3 border-t border-indigo-100 dark:border-indigo-900/40 space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                  Key Concepts Identified:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {activeItem.keyConcepts.map((kc, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 p-2 rounded-lg bg-white/80 dark:bg-zinc-900/60 border border-indigo-100 dark:border-indigo-900/30 text-xs font-medium text-zinc-800 dark:text-zinc-200"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
                      {kc}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Audio Player Simulator (If Audio Knowledge) */}
          {activeItem.type === 'AUDIO' && (
            <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#121215] flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsPlayingAudio(!isPlayingAudio)}
                  className="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-md hover:scale-105 transition-transform"
                >
                  {isPlayingAudio ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
                </button>
                <div>
                  <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                    Voice Note Audio Playback ({activeItem.audioDuration || '02:45'})
                  </div>
                  <div className="text-[11px] text-zinc-400">
                    {isPlayingAudio ? 'Playing simulated audio stream...' : 'Click play to listen to recording'}
                  </div>
                </div>
              </div>
              <Button variant="ghost" size="sm" leftIcon={<Download size={14} />}>
                Download MP3
              </Button>
            </div>
          )}

          {/* Original Content Body */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">
                Full Content / Document Body
              </h2>
            </div>

            <div className="p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#121215] prose prose-zinc dark:prose-invert max-w-none text-xs sm:text-sm leading-relaxed space-y-4 font-sans whitespace-pre-wrap">
              {activeItem.content}
            </div>
          </div>
        </div>

        {/* Right Sidebar: Metadata & Related Knowledge */}
        <div className="space-y-6">
          {/* Metadata Card */}
          <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#121215] space-y-4">
            <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider border-b border-zinc-100 dark:border-zinc-800 pb-2">
              Metadata & Attributes
            </h3>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-zinc-400">Knowledge ID</span>
                <span className="font-mono text-[11px] text-zinc-600 dark:text-zinc-300">{activeItem.id}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-zinc-400">Processing Status</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  {activeItem.processingStatus}
                </span>
              </div>

              {activeItem.fileName && (
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">File Name</span>
                  <span className="font-medium text-zinc-700 dark:text-zinc-300 truncate max-w-[140px]">
                    {activeItem.fileName}
                  </span>
                </div>
              )}

              {activeItem.fileSize && (
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">File Size</span>
                  <span className="font-medium text-zinc-700 dark:text-zinc-300">{activeItem.fileSize}</span>
                </div>
              )}

              {activeItem.originalUrl && (
                <div className="pt-2">
                  <a
                    href={activeItem.originalUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                  >
                    Open Source Web Link <ExternalLink size={12} />
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Related Knowledge Graph / Connections */}
          <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#121215] space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider flex items-center gap-1.5">
                <Layers size={14} className="text-indigo-500" /> Related Connections
              </h3>
              <span className="text-[10px] text-zinc-400">{relatedItems.length} found</span>
            </div>

            <div className="space-y-2.5">
              {relatedItems.map((rel) => (
                <div
                  key={rel.id}
                  onClick={() => openDetailView(rel)}
                  className="p-3 rounded-lg border border-zinc-100 dark:border-zinc-800 hover:border-indigo-500/50 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
                      <TypeIcon type={rel.type} size={12} />
                      {rel.type}
                    </span>
                    <span className="text-[10px] font-medium text-indigo-500">92% Match</span>
                  </div>
                  <h4 className="mt-1 text-xs font-bold text-zinc-800 dark:text-zinc-200 group-hover:text-indigo-500 transition-colors line-clamp-1">
                    {rel.title}
                  </h4>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
