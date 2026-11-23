'use client';

import React, { useState, useEffect } from 'react';
import { useKnowledge } from '@/context/KnowledgeContext';
import { KnowledgeItem } from '@/types';
import { KnowledgeService, getKnowledge } from '@/services/api/knowledge';
import { downloadFile, listFiles } from '@/services/api/files';
import { AIService } from '@/services/api/ai';
import {
  ArrowLeft,
  Star,
  Trash2,
  ExternalLink,
  Sparkles,
  Tag as TagIcon,
  FolderKanban,
  Edit3,
  Archive,
  ArchiveRestore,
  Copy,
  Check,
  Download,
  Brain,
  Layers,
  X,
  AlertCircle,
  Save,
  FileText,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Globe,
} from 'lucide-react';
import { TypeIcon } from '@/components/ui/TypeIcon';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

function getDomainName(urlStr?: string): string {
  if (!urlStr) return '';
  try {
    const parsed = new URL(urlStr);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return urlStr;
  }
}

export const KnowledgeDetail: React.FC = () => {
  const {
    activeItem,
    setActiveItem,
    setActiveView,
    toggleFavorite,
    toggleArchive,
    deleteKnowledge,
    updateKnowledge,
    openDetailView,
    setIsAiDrawerOpen,
    collections,
  } = useKnowledge();

  const [relatedItems, setRelatedItems] = useState<KnowledgeItem[]>([]);
  const [copied, setCopied] = useState(false);

  // File Download & Processing State
  const [linkedFileId, setLinkedFileId] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  // Edit Mode States
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editSummary, setEditSummary] = useState('');
  const [editCollectionId, setEditCollectionId] = useState<string>('');
  const [editTags, setEditTags] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // AI Operations State
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiActionMessage, setAiActionMessage] = useState<string | null>(null);
  const [suggestedTagsList, setSuggestedTagsList] = useState<string[]>([]);

  useEffect(() => {
    if (activeItem) {
      KnowledgeService.getRelatedItems(activeItem).then(setRelatedItems);

      // Check if item has a linked backend file
      if (activeItem.type === 'PDF' || activeItem.type === 'DOCUMENT' || activeItem.fileName) {
        listFiles({ knowledgeId: activeItem.id })
          .then((res) => {
            if (res.items && res.items.length > 0) {
              setLinkedFileId(res.items[0].id);
            }
          })
          .catch(() => {});
      }
    }
  }, [activeItem]);

  // Poll for document extraction completion if processing
  useEffect(() => {
    if (!activeItem) return;
    if (activeItem.processingStatus !== 'PROCESSING' && activeItem.processingStatus !== 'PENDING') {
      return;
    }

    const pollInterval = setInterval(async () => {
      try {
        const fresh = await getKnowledge(activeItem.id);
        if (fresh && (fresh.processingStatus === 'COMPLETED' || fresh.processingStatus === 'FAILED')) {
          openDetailView(fresh);
        }
      } catch {
        // Polling retry
      }
    }, 2500);

    return () => clearInterval(pollInterval);
  }, [activeItem, openDetailView]);

  // Track active item ID changes to reset editing state safely without cascading effects
  const [lastItemId, setLastItemId] = useState<string | null>(null);
  if (activeItem && activeItem.id !== lastItemId) {
    setLastItemId(activeItem.id);
    setIsEditing(false);
    setEditError(null);
    setDownloadError(null);
    setAiActionMessage(null);
    setSuggestedTagsList([]);
  }

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

  const handleStartEdit = () => {
    setEditTitle(activeItem.title);
    setEditContent(activeItem.content);
    setEditSummary(activeItem.summary || '');
    setEditCollectionId(activeItem.collectionId || '');
    setEditTags([...activeItem.tags]);
    setEditError(null);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditError(null);
  };

  const handleAddEditTag = () => {
    const clean = newTagInput.trim().replace(/^#/, '').toLowerCase();
    if (clean && !editTags.includes(clean)) {
      setEditTags([...editTags, clean]);
      setNewTagInput('');
    }
  };

  const handleRemoveEditTag = (tagToRemove: string) => {
    setEditTags(editTags.filter((t) => t !== tagToRemove));
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = editTitle.trim();
    if (!cleanTitle) {
      setEditError('Title cannot be empty');
      return;
    }

    setIsSaving(true);
    setEditError(null);

    try {
      await updateKnowledge(activeItem.id, {
        title: cleanTitle,
        content: editContent,
        summary: editSummary,
        collectionId: editCollectionId || '',
        tags: editTags,
      });
      setIsEditing(false);
    } catch (err: unknown) {
      console.error('Failed to update knowledge item:', err);
      setEditError((err as Error)?.message || 'Failed to save updates to the server');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(activeItem.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRegenerateSummary = async () => {
    if (!activeItem || isAiLoading) return;
    setIsAiLoading(true);
    setAiActionMessage(null);
    try {
      const summary = await AIService.summarizeContent(
        activeItem.content,
        activeItem.title,
        activeItem.id
      );
      await updateKnowledge(activeItem.id, { summary });
      openDetailView({ ...activeItem, summary });
      setAiActionMessage('Summary regenerated and saved successfully!');
    } catch (err: unknown) {
      setAiActionMessage(`AI error: ${(err as Error)?.message || 'Failed to generate summary'}`);
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleExtractConcepts = async () => {
    if (!activeItem || isAiLoading) return;
    setIsAiLoading(true);
    setAiActionMessage(null);
    try {
      const concepts = await AIService.extractKeyConcepts(activeItem.content, activeItem.id);
      await updateKnowledge(activeItem.id, { keyConcepts: concepts });
      openDetailView({ ...activeItem, keyConcepts: concepts });
      setAiActionMessage('Key concepts extracted and saved!');
    } catch (err: unknown) {
      setAiActionMessage(`AI error: ${(err as Error)?.message || 'Failed to extract concepts'}`);
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleSuggestTags = async () => {
    if (!activeItem || isAiLoading) return;
    setIsAiLoading(true);
    setAiActionMessage(null);
    try {
      const tags = await AIService.generateSuggestedTags(
        activeItem.content,
        activeItem.title,
        activeItem.id
      );
      setSuggestedTagsList(tags);
      setAiActionMessage(`Found ${tags.length} suggested tags. Click any tag to add it.`);
    } catch (err: unknown) {
      setAiActionMessage(`AI error: ${(err as Error)?.message || 'Failed to suggest tags'}`);
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleAddSuggestedTag = async (tag: string) => {
    if (!activeItem) return;
    const clean = tag.replace(/^#/, '').toLowerCase().trim();
    if (activeItem.tags.includes(clean)) return;
    const updatedTags = [...activeItem.tags, clean];
    await updateKnowledge(activeItem.id, { tags: updatedTags });
    setSuggestedTagsList((prev) => prev.filter((t) => t !== tag));
  };

  const handleDelete = async () => {
    if (confirm(`Are you sure you want to delete "${activeItem.title}"?`)) {
      try {
        await deleteKnowledge(activeItem.id);
      } catch (err: unknown) {
        alert((err as Error)?.message || 'Failed to delete knowledge note');
      }
    }
  };

  const handleDownloadFile = async () => {
    setDownloadError(null);
    setIsDownloading(true);
    try {
      let fId = linkedFileId;
      if (!fId) {
        const fileList = await listFiles({ knowledgeId: activeItem.id });
        if (fileList.items && fileList.items.length > 0) {
          fId = fileList.items[0].id;
          setLinkedFileId(fId);
        }
      }
      if (!fId) {
        throw new Error('No attached binary file found for this document.');
      }
      await downloadFile(fId, activeItem.fileName || `${activeItem.title}.pdf`);
    } catch (err: unknown) {
      console.error('Failed to download document:', err);
      setDownloadError((err as Error)?.message || 'Failed to download document.');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-8 animate-fade-in">
      {/* Top Navigation Bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => {
            setActiveItem(null);
            setActiveView('library');
          }}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors cursor-pointer"
        >
          <ArrowLeft size={16} /> Back to Knowledge Base
        </button>

        <div className="flex items-center gap-2">
          {/* Edit Button Toggle */}
          {!isEditing ? (
            <Button
              variant="outline"
              size="sm"
              onClick={handleStartEdit}
              leftIcon={<Edit3 size={14} />}
              className="text-xs"
            >
              Edit Note
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCancelEdit}
                disabled={isSaving}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSaveEdit}
                isLoading={isSaving}
                leftIcon={<Save size={14} />}
                className="text-xs"
              >
                Save
              </Button>
            </div>
          )}

          {/* Toggle Favorite */}
          <button
            onClick={() => toggleFavorite(activeItem.id)}
            className="p-2 rounded-lg text-zinc-400 hover:text-amber-400 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            title={activeItem.isFavorite ? 'Remove Favorite' : 'Mark as Favorite'}
          >
            <Star
              size={16}
              className={activeItem.isFavorite ? 'fill-amber-400 text-amber-400' : ''}
            />
          </button>

          {/* Toggle Archive */}
          <button
            onClick={() => toggleArchive(activeItem.id)}
            className={`p-2 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors ${
              activeItem.isArchived ? 'text-indigo-600 dark:text-indigo-400' : 'text-zinc-400 hover:text-zinc-900'
            }`}
            title={activeItem.isArchived ? 'Unarchive Note' : 'Archive Note'}
          >
            {activeItem.isArchived ? <ArchiveRestore size={16} /> : <Archive size={16} />}
          </button>

          {/* Copy Content */}
          <button
            onClick={handleCopy}
            className="p-2 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            title="Copy Content"
          >
            {copied ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
          </button>

          {/* Delete */}
          <button
            onClick={handleDelete}
            className="p-2 rounded-lg text-zinc-400 hover:text-red-500 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            title="Delete Knowledge Note"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* Edit Error Banner */}
      {editError && (
        <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 flex items-center justify-between text-xs text-red-700 dark:text-red-300 animate-fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-red-500 shrink-0" />
            <span>{editError}</span>
          </div>
          <button onClick={() => setEditError(null)}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* Header View vs Edit */}
      {!isEditing ? (
        <div className="space-y-3 border-b border-zinc-200 dark:border-zinc-800 pb-6">
          <div className="flex flex-wrap items-center gap-2.5">
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

            {activeItem.isArchived && (
              <Badge variant="danger" size="md">
                <Archive size={12} className="mr-1" /> Archived
              </Badge>
            )}

            <span className="text-xs text-zinc-400 font-medium" suppressHydrationWarning>
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
      ) : (
        /* Edit Header Form */
        <div className="p-6 rounded-2xl border border-indigo-200 dark:border-indigo-800/80 bg-indigo-50/20 dark:bg-indigo-950/10 space-y-4 animate-fade-in">
          <div className="space-y-1">
            <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
              Note Title <span className="text-red-500">*</span>
            </label>
            <Input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder="Enter note title..."
              className="text-base font-semibold"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                <FolderKanban size={13} className="text-zinc-400" /> Collection
              </label>
              <select
                value={editCollectionId}
                onChange={(e) => setEditCollectionId(e.target.value)}
                className="w-full bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 text-xs rounded-lg p-2.5 border border-zinc-200 dark:border-zinc-800 focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value="">No Collection (General)</option>
                {collections.map((col) => (
                  <option key={col.id} value={col.id}>
                    {col.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                <TagIcon size={13} className="text-zinc-400" /> Tags
              </label>
              <div className="flex items-center gap-2">
                <Input
                  value={newTagInput}
                  onChange={(e) => setNewTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddEditTag();
                    }
                  }}
                  placeholder="Add tag and press Enter..."
                />
                <Button type="button" variant="secondary" size="sm" onClick={handleAddEditTag}>
                  Add
                </Button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {editTags.map((t) => (
              <Badge
                key={t}
                variant="accent"
                size="sm"
                className="cursor-pointer hover:bg-red-100 dark:hover:bg-red-950"
                onClick={() => handleRemoveEditTag(t)}
              >
                #{t} <X size={10} className="ml-1" />
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: AI Summary + Main Content */}
        <div className="lg:col-span-2 space-y-8">
          {/* AI Intelligence Box / Summary Edit */}
          <div className="p-5 rounded-xl bg-gradient-to-br from-indigo-50/70 via-purple-50/40 to-white dark:from-indigo-950/40 dark:via-purple-950/20 dark:to-[#121215] border border-indigo-200/80 dark:border-indigo-800/50 space-y-4 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-300 font-bold text-xs uppercase tracking-wider">
                <Sparkles size={16} className="text-indigo-500" />
                Knowledge Summary
              </div>

              {!isEditing && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAiDrawerOpen(true)}
                  className="text-xs border-indigo-300 dark:border-indigo-700 text-indigo-600 dark:text-indigo-300"
                  leftIcon={<Brain size={13} />}
                >
                  Ask Assistant
                </Button>
              )}
            </div>

            {!isEditing ? (
              <p className="text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed font-medium">
                {activeItem.summary || 'No summary recorded for this knowledge note.'}
              </p>
            ) : (
              <textarea
                value={editSummary}
                onChange={(e) => setEditSummary(e.target.value)}
                rows={3}
                placeholder="Update summary or key takeaways..."
                className="w-full bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 text-xs rounded-lg p-3 border border-indigo-200 dark:border-indigo-800 focus:outline-none focus:border-indigo-500"
              />
            )}

            {!isEditing && (
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-indigo-100 dark:border-indigo-900/40">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRegenerateSummary}
                  isLoading={isAiLoading}
                  className="text-xs text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100/50"
                  leftIcon={<Sparkles size={12} />}
                >
                  Regenerate Summary
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleExtractConcepts}
                  isLoading={isAiLoading}
                  className="text-xs text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100/50"
                  leftIcon={<Brain size={12} />}
                >
                  Extract Concepts
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSuggestTags}
                  isLoading={isAiLoading}
                  className="text-xs text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100/50"
                  leftIcon={<TagIcon size={12} />}
                >
                  Suggest Tags
                </Button>
              </div>
            )}

            {suggestedTagsList.length > 0 && (
              <div className="p-3 rounded-lg bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-xs space-y-1.5">
                <div className="font-semibold text-indigo-900 dark:text-indigo-200 flex items-center justify-between">
                  <span>AI Suggested Tags (click to add):</span>
                  <button onClick={() => setSuggestedTagsList([])} className="text-zinc-400 hover:text-zinc-600">
                    <X size={13} />
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {suggestedTagsList.map((tag) => (
                    <button
                      key={tag}
                      onClick={() => handleAddSuggestedTag(tag)}
                      className="px-2 py-0.5 rounded-md bg-white dark:bg-zinc-800 border border-indigo-200 dark:border-indigo-700 text-indigo-600 dark:text-indigo-300 text-[11px] font-medium hover:bg-indigo-600 hover:text-white transition-colors"
                    >
                      + #{tag}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {aiActionMessage && (
              <div className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium animate-fade-in">
                {aiActionMessage}
              </div>
            )}

            {activeItem.keyConcepts && activeItem.keyConcepts.length > 0 && !isEditing && (
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

          {/* Web Article Source Card */}
          {(activeItem.type === 'LINK' || activeItem.originalUrl) && (
            <div className="p-4 rounded-xl border border-indigo-200/80 dark:border-indigo-800/50 bg-gradient-to-r from-indigo-50/50 via-white to-white dark:from-indigo-950/20 dark:via-[#121215] dark:to-[#121215] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 bg-indigo-500/10 text-indigo-500 dark:bg-indigo-950/40">
                  <Globe size={22} />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2 truncate">
                    <span>{getDomainName(activeItem.originalUrl) || 'Web Article'}</span>
                    <Badge variant="accent" size="sm">Web Article</Badge>
                  </div>
                  <div className="flex items-center gap-2 pt-0.5 text-[11px] text-zinc-400 truncate">
                    <span className="truncate max-w-xs sm:max-w-md" title={activeItem.originalUrl}>
                      {activeItem.originalUrl}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end shrink-0">
                <a
                  href={activeItem.originalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-xs transition-colors"
                >
                  Visit Source Webpage <ExternalLink size={13} />
                </a>
              </div>
            </div>
          )}

          {/* Document File Attachment Card */}
          {(activeItem.type === 'PDF' || activeItem.type === 'DOCUMENT' || activeItem.fileName) && (
            <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#121215] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
              <div className="flex items-center gap-3.5">
                <div
                  className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                    activeItem.type === 'PDF' || (activeItem.fileName && activeItem.fileName.toLowerCase().endsWith('.pdf'))
                      ? 'bg-rose-500/10 text-rose-500 dark:bg-rose-950/40'
                      : 'bg-blue-500/10 text-blue-500 dark:bg-blue-950/40'
                  }`}
                >
                  <FileText size={22} />
                </div>
                <div>
                  <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                    <span>{activeItem.fileName || activeItem.title}</span>
                    {activeItem.fileSize && (
                      <span className="text-[11px] font-normal text-zinc-400">({activeItem.fileSize})</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 pt-1 text-[11px]">
                    {activeItem.processingStatus === 'COMPLETED' ? (
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                        <CheckCircle2 size={13} /> Text Extracted
                      </span>
                    ) : activeItem.processingStatus === 'FAILED' ? (
                      <span className="text-rose-600 dark:text-rose-400 font-semibold flex items-center gap-1">
                        <AlertTriangle size={13} /> Extraction Failed
                      </span>
                    ) : (
                      <span className="text-indigo-600 dark:text-indigo-400 font-semibold flex items-center gap-1.5 animate-pulse">
                        <Loader2 size={13} className="animate-spin" /> Ingestion & Text Extraction...
                      </span>
                    )}
                    <span className="text-zinc-300 dark:text-zinc-700">•</span>
                    <span className="text-zinc-500">PostgreSQL Persistent File</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleDownloadFile}
                  isLoading={isDownloading}
                  leftIcon={<Download size={14} />}
                >
                  Download Original
                </Button>
              </div>
            </div>
          )}

          {downloadError && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 flex items-center gap-2 text-xs text-red-700 dark:text-red-300">
              <AlertCircle size={15} className="shrink-0" />
              <span>{downloadError}</span>
            </div>
          )}

          {/* Original Content Body / Markdown Editor */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">
                Full Content & Markdown Body
              </h2>
            </div>

            {!isEditing ? (
              <div className="p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#121215] prose prose-zinc dark:prose-invert max-w-none text-xs sm:text-sm leading-relaxed space-y-4 font-sans whitespace-pre-wrap">
                {activeItem.content}
              </div>
            ) : (
              <div className="space-y-2">
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  rows={14}
                  placeholder="Write or edit your markdown notes here..."
                  className="w-full bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 text-xs sm:text-sm rounded-xl p-4 border border-zinc-200 dark:border-zinc-800 focus:outline-none focus:border-indigo-500 font-mono leading-relaxed"
                />
                <div className="flex items-center justify-between text-[11px] text-zinc-400">
                  <span>Markdown formatting supported</span>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={handleCancelEdit} disabled={isSaving}>
                      Cancel
                    </Button>
                    <Button variant="primary" size="sm" onClick={handleSaveEdit} isLoading={isSaving} leftIcon={<Save size={13} />}>
                      Save Changes
                    </Button>
                  </div>
                </div>
              </div>
            )}
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
                <span className="text-zinc-400">Database ID</span>
                <span className="font-mono text-[11px] text-zinc-600 dark:text-zinc-300 truncate max-w-[150px]" title={activeItem.id}>
                  {activeItem.id}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-zinc-400">Persistence</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  PostgreSQL
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-zinc-400">Status</span>
                <span className="font-medium text-zinc-700 dark:text-zinc-300">
                  {activeItem.processingStatus || 'COMPLETED'}
                </span>
              </div>

              {activeItem.fileName && (
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">File Name</span>
                  <span className="font-medium text-zinc-700 dark:text-zinc-300 truncate max-w-[140px]" title={activeItem.fileName}>
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
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400">Website Domain</span>
                    <span className="font-medium text-zinc-700 dark:text-zinc-300">
                      {getDomainName(activeItem.originalUrl)}
                    </span>
                  </div>
                  <div className="pt-2">
                    <a
                      href={activeItem.originalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                    >
                      Open Source Link <ExternalLink size={12} />
                    </a>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Related Knowledge Connections */}
          <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#121215] space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider flex items-center gap-1.5">
                <Layers size={14} className="text-indigo-500" /> Related Connections
              </h3>
              <span className="text-[10px] text-zinc-400">{relatedItems.length} found</span>
            </div>

            <div className="space-y-2.5">
              {relatedItems.length === 0 ? (
                <p className="text-xs text-zinc-400 py-2 text-center">No related notes found yet.</p>
              ) : (
                relatedItems.map((rel) => (
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
                      <span className="text-[10px] font-medium text-indigo-500">Connected</span>
                    </div>
                    <h4 className="mt-1 text-xs font-bold text-zinc-800 dark:text-zinc-200 group-hover:text-indigo-500 transition-colors line-clamp-1">
                      {rel.title}
                    </h4>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
