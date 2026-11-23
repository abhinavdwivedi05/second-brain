'use client';

import React, { useState } from 'react';
import { useKnowledge } from '@/context/KnowledgeContext';
import { uploadFile } from '@/services/api/files';
import { getKnowledge, KnowledgeService } from '@/services/api/knowledge';
import {
  X,
  FileText,
  Link2,
  FileUp,
  Plus,
  AlertCircle,
  Tag as TagIcon,
  FolderKanban,
  Globe,
  Sparkles,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';

export const AddKnowledgeModal: React.FC = () => {
  const {
    isAddModalOpen,
    setIsAddModalOpen,
    collections,
    createKnowledge,
    openDetailView,
    refreshAllData,
  } = useKnowledge();

  const [activeTab, setActiveTab] = useState<'NOTE' | 'LINK' | 'FILE'>('NOTE');

  // Form fields
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [summary, setSummary] = useState('');
  const [url, setUrl] = useState('');
  const [selectedCollection, setSelectedCollection] = useState<string>('');
  const [tagInput, setTagInput] = useState('');
  const [tagsList, setTagsList] = useState<string[]>(['engineering', 'notes']);

  // File upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Web Clipper extraction state
  const [isExtractingUrl, setIsExtractingUrl] = useState(false);
  const [extractProgressStep, setExtractProgressStep] = useState<string>('');
  const [extractionSuccess, setExtractionSuccess] = useState<string | null>(null);

  if (!isAddModalOpen) return null;

  const handleAddTag = () => {
    const clean = tagInput.trim().replace(/^#/, '').toLowerCase();
    if (clean && !tagsList.includes(clean)) {
      setTagsList([...tagsList, clean]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTagsList(tagsList.filter((t) => t !== tagToRemove));
  };

  const validateAndSetFile = (f: File) => {
    const ext = f.name.substring(f.name.lastIndexOf('.')).toLowerCase();
    if (ext !== '.pdf' && ext !== '.docx') {
      setFormError(`Unsupported file format '${ext}'. Only PDF (.pdf) and Word (.docx) documents are accepted.`);
      setSelectedFile(null);
      return false;
    }
    if (f.size > 50 * 1024 * 1024) {
      setFormError('File size exceeds the 50MB maximum upload limit.');
      setSelectedFile(null);
      return false;
    }
    setFormError(null);
    setSelectedFile(f);
    if (!title.trim()) {
      const nameWithoutExt = f.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      setTitle(nameWithoutExt.charAt(0).toUpperCase() + nameWithoutExt.slice(1));
    }
    return true;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleFetchAndAnalyzeUrl = async () => {
    const targetUrl = url.trim();
    if (!targetUrl) {
      setFormError('Please enter a website URL before analyzing.');
      return;
    }
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      setFormError('URL must begin with http:// or https://');
      return;
    }

    setIsExtractingUrl(true);
    setFormError(null);
    setExtractionSuccess(null);
    setExtractProgressStep('Fetching webpage content...');

    const timer1 = setTimeout(() => setExtractProgressStep('Extracting readable article content...'), 700);
    const timer2 = setTimeout(() => setExtractProgressStep('Identifying technical keywords & concepts...'), 1700);
    const timer3 = setTimeout(() => setExtractProgressStep('Generating content-specific summary...'), 2700);

    try {
      const res = await KnowledgeService.extractUrl(targetUrl);
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      setExtractProgressStep('Preparing knowledge item...');

      // Auto-populate form fields
      if (res.title) setTitle(res.title);
      if (res.summary) setSummary(res.summary);
      if (res.content) setContent(res.content);
      if (res.canonicalUrl) setUrl(res.canonicalUrl);
      if (res.tags && res.tags.length > 0) {
        setTagsList((prev) => Array.from(new Set([...prev, ...res.tags])));
      }
      setExtractionSuccess(
        `Successfully extracted "${res.domain}" (${res.wordCount} words). Review or edit details below before saving.`
      );
    } catch (err: unknown) {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      console.error('Failed to extract URL:', err);
      setFormError((err as Error)?.message || 'Failed to extract content from the website. You can still enter details manually.');
    } finally {
      setIsExtractingUrl(false);
      setExtractProgressStep('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setFormError('Please provide a title for this knowledge item.');
      return;
    }

    if (activeTab === 'LINK' && !url.trim()) {
      setFormError('Please enter a valid URL for website bookmarking.');
      return;
    }

    if (activeTab === 'FILE') {
      if (!selectedFile) {
        setFormError('Please select a PDF or DOCX document to upload.');
        return;
      }

      setIsProcessing(true);
      try {
        const uploaded = await uploadFile(selectedFile, {
          title: cleanTitle,
          collectionId: selectedCollection || undefined,
          tags: tagsList,
          createKnowledge: true,
        });

        await refreshAllData();

        if (uploaded.knowledgeId) {
          const kItem = await getKnowledge(uploaded.knowledgeId);
          openDetailView(kItem);
        }

        setIsAddModalOpen(false);
        resetForm();
      } catch (err: unknown) {
        console.error('Failed to upload document:', err);
        setFormError((err as Error)?.message || 'Failed to upload and process document.');
      } finally {
        setIsProcessing(false);
      }
      return;
    }

    setIsProcessing(true);

    try {
      let finalContent = content.trim();
      let finalSummary = summary.trim();

      if (activeTab === 'LINK') {
        if (!finalContent) {
          finalContent = `# ${cleanTitle}\n\n**Bookmarked URL:** ${url.trim()}\n\nSaved webpage link entry in Second Brain.`;
        }
        if (!finalSummary) {
          finalSummary = `Web link bookmark for ${cleanTitle} (${url.trim()}).`;
        }

        const created = await KnowledgeService.importUrl({
          url: url.trim(),
          collectionId: selectedCollection || undefined,
          title: cleanTitle,
          summary: finalSummary,
          content: finalContent,
          tags: tagsList,
        });

        await refreshAllData();
        setIsAddModalOpen(false);
        resetForm();
        openDetailView(created);
        return;
      }

      if (!finalContent) {
        finalContent = cleanTitle;
      }
      if (!finalSummary) {
        finalSummary = `Personal knowledge note on ${cleanTitle}.`;
      }

      const created = await createKnowledge({
        title: cleanTitle,
        type: 'NOTE',
        summary: finalSummary,
        content: finalContent,
        tags: tagsList,
        collectionId: selectedCollection || undefined,
        isFavorite: false,
        isArchived: false,
        processingStatus: 'COMPLETED',
        processingProgress: 100,
        processingStep: 'Stored in PostgreSQL',
        keyConcepts: tagsList.map((t) => t.toUpperCase()),
        relatedKnowledgeIds: [],
        aiInsights: ['Successfully persisted in Second Brain database.'],
      });

      setIsAddModalOpen(false);
      resetForm();
      openDetailView(created);
    } catch (err: unknown) {
      console.error('Failed to create knowledge note:', err);
      setFormError((err as Error)?.message || 'Failed to save knowledge item to the server.');
    } finally {
      setIsProcessing(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    setContent('');
    setSummary('');
    setUrl('');
    setSelectedCollection('');
    setTagInput('');
    setTagsList(['engineering', 'notes']);
    setSelectedFile(null);
    setFormError(null);
    setExtractionSuccess(null);
    setIsExtractingUrl(false);
    setExtractProgressStep('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div className="relative w-full max-w-2xl bg-white dark:bg-[#121215] rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800/80">
          <div>
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <Plus size={18} className="text-indigo-500" /> Add Knowledge
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Capture notes, web links, or documents.
            </p>
          </div>
          <button
            onClick={() => {
              if (!isProcessing) setIsAddModalOpen(false);
            }}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Type Navigation Tabs */}
        <div className="flex items-center gap-1 px-6 pt-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40">
          <button
            type="button"
            onClick={() => {
              setActiveTab('NOTE');
              setFormError(null);
            }}
            className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold border-b-2 transition-all ${
              activeTab === 'NOTE'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            <FileText size={15} /> Note
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('LINK');
              setFormError(null);
            }}
            className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold border-b-2 transition-all ${
              activeTab === 'LINK'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            <Link2 size={15} /> Website Link
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('FILE');
              setFormError(null);
            }}
            className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold border-b-2 transition-all ${
              activeTab === 'FILE'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            <FileUp size={15} /> Document File
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 flex-1">
          {/* Error Banner */}
          {formError && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 flex items-center gap-2 text-xs text-red-700 dark:text-red-300 animate-fade-in">
              <AlertCircle size={16} className="text-red-500 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* Website Link Field & Intelligent Web Clipper */}
          {activeTab === 'LINK' && (
            <div className="p-4 rounded-xl border border-indigo-200 dark:border-indigo-800/60 bg-indigo-50/30 dark:bg-indigo-950/20 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                  <Globe size={14} className="text-indigo-500" />
                  Website URL <span className="text-red-500">*</span>
                </label>
                <span className="text-[10px] text-zinc-500">Public HTTP or HTTPS URL</span>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="flex-1">
                  <Input
                    type="url"
                    value={url}
                    onChange={(e) => {
                      setUrl(e.target.value);
                      if (extractionSuccess) setExtractionSuccess(null);
                    }}
                    placeholder="https://docs.postgresql.org/current/mvcc.html"
                    leftIcon={<Link2 size={15} />}
                    required
                  />
                </div>
                <Button
                  type="button"
                  variant="primary"
                  onClick={handleFetchAndAnalyzeUrl}
                  isLoading={isExtractingUrl}
                  disabled={isProcessing || isExtractingUrl}
                  leftIcon={<Sparkles size={14} />}
                  className="whitespace-nowrap shrink-0"
                >
                  Fetch & Analyze Website
                </Button>
              </div>

              {/* Progress message during extraction */}
              {isExtractingUrl && (
                <div className="flex items-center gap-2 text-xs font-medium text-indigo-600 dark:text-indigo-400 animate-pulse pt-1">
                  <Loader2 size={14} className="animate-spin" />
                  <span>{extractProgressStep || 'Analyzing webpage...'}</span>
                </div>
              )}

              {/* Success message banner */}
              {extractionSuccess && !isExtractingUrl && (
                <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2 animate-fade-in">
                  <CheckCircle2 size={15} className="text-emerald-500 shrink-0" />
                  <span>{extractionSuccess}</span>
                </div>
              )}
            </div>
          )}

          {/* Title Input */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
              Title <span className="text-red-500">*</span>
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. PostgreSQL MVCC and Storage Engine Internals"
              required
            />
          </div>

          {/* Upload File Section */}
          {activeTab === 'FILE' && (
            <div className="space-y-1">
              <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                Document File (.pdf or .docx)
              </label>
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${
                  isDragging
                    ? 'border-indigo-500 bg-indigo-50/40 dark:bg-indigo-950/40'
                    : 'border-zinc-300 dark:border-zinc-700 hover:border-indigo-500 dark:hover:border-indigo-500 bg-zinc-50/50 dark:bg-zinc-900/30'
                }`}
              >
                <input
                  type="file"
                  id="file-upload"
                  onChange={handleFileChange}
                  className="hidden"
                  accept=".pdf,.docx"
                />
                <label htmlFor="file-upload" className="cursor-pointer space-y-2 inline-block">
                  <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center mx-auto text-indigo-500">
                    <FileUp size={20} />
                  </div>
                  <div className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                    {selectedFile ? (
                      <span className="text-indigo-600 dark:text-indigo-400 font-bold">
                        Selected: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                      </span>
                    ) : (
                      'Click to browse or drag & drop PDF / Word (.docx) document'
                    )}
                  </div>
                  <p className="text-[11px] text-zinc-400">
                    Supported formats: PDF and DOCX (up to 50MB). Extracted text is saved directly to PostgreSQL.
                  </p>
                </label>
              </div>
            </div>
          )}

          {/* Summary Field */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
              Summary (Optional)
            </label>
            <Input
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Brief summary or core takeaway of this item..."
            />
          </div>

          {/* Content / Markdown Editor */}
          {activeTab !== 'FILE' && (
            <div className="space-y-1">
              <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                Content / Markdown Notes
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={4}
                placeholder="Write or paste your knowledge note here (supports Markdown formatting)..."
                className="w-full bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 text-xs rounded-lg p-3 border border-zinc-200 dark:border-zinc-800 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 font-mono"
              />
            </div>
          )}

          {/* Collection Assignment */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
              <FolderKanban size={13} className="text-zinc-400" /> Collection
            </label>
            <select
              value={selectedCollection}
              onChange={(e) => setSelectedCollection(e.target.value)}
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

          {/* Tags */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
              <TagIcon size={13} className="text-zinc-400" /> Tags
            </label>
            <div className="flex items-center gap-2">
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
                placeholder="Add tag and press Enter..."
              />
              <Button type="button" variant="secondary" size="sm" onClick={handleAddTag}>
                Add
              </Button>
            </div>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {tagsList.map((t) => (
                <Badge
                  key={t}
                  variant="accent"
                  size="sm"
                  className="cursor-pointer hover:bg-red-100 dark:hover:bg-red-950"
                  onClick={() => handleRemoveTag(t)}
                >
                  #{t} <X size={10} className="ml-1" />
                </Badge>
              ))}
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-200 dark:border-zinc-800">
            <Button
              type="button"
              variant="ghost"
              size="md"
              onClick={() => setIsAddModalOpen(false)}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={isProcessing}
              disabled={isProcessing || isExtractingUrl}
            >
              Save to Second Brain
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
