'use client';

import React, { useState } from 'react';
import { useKnowledge } from '@/context/KnowledgeContext';
import { KnowledgeType } from '@/types';
import {
  X,
  FileText,
  Link2,
  FileUp,
  Mic,
  Plus,
  AlertCircle,
  Tag as TagIcon,
  FolderKanban,
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
  } = useKnowledge();

  const [activeTab, setActiveTab] = useState<'NOTE' | 'LINK' | 'FILE' | 'AUDIO'>('NOTE');

  // Form fields
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [summary, setSummary] = useState('');
  const [url, setUrl] = useState('');
  const [selectedCollection, setSelectedCollection] = useState<string>('');
  const [tagInput, setTagInput] = useState('');
  const [tagsList, setTagsList] = useState<string[]>(['engineering', 'notes']);

  // File placeholder state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Audio recording simulation state
  const [isRecording, setIsRecording] = useState(false);

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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const f = e.target.files[0];
      setSelectedFile(f);
      if (!title.trim()) {
        const nameWithoutExt = f.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
        setTitle(nameWithoutExt.charAt(0).toUpperCase() + nameWithoutExt.slice(1));
      }
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

    setIsProcessing(true);

    try {
      let kType: KnowledgeType = 'NOTE';
      let finalContent = content.trim();
      let finalSummary = summary.trim();

      if (activeTab === 'LINK') {
        kType = 'LINK';
        if (!finalContent) {
          finalContent = `# ${cleanTitle}\n\n**Bookmarked URL:** ${url.trim()}\n\nSaved webpage link entry in Second Brain.`;
        }
        if (!finalSummary) {
          finalSummary = `Web link bookmark for ${cleanTitle} (${url.trim()}).`;
        }
      } else if (activeTab === 'FILE') {
        const fName = selectedFile ? selectedFile.name : 'Uploaded Document';
        const fSize = selectedFile ? (selectedFile.size / 1024 / 1024).toFixed(2) + ' MB' : '0 MB';
        const isPdf = fName.toLowerCase().endsWith('.pdf');
        kType = isPdf ? 'PDF' : 'DOCUMENT';

        if (!finalContent) {
          finalContent = `# ${cleanTitle}\n\n**Attached File:** \`${fName}\` (${fSize})\n\nDocument ingested into PostgreSQL knowledge base. Full automated background text processing is scheduled for Day 2 pipeline.`;
        }
        if (!finalSummary) {
          finalSummary = `Document file ${fName} recorded in Second Brain.`;
        }
      } else if (activeTab === 'AUDIO') {
        kType = 'AUDIO';
        if (!finalContent) {
          finalContent = `# ${cleanTitle}\n\nAudio voice recording entry ingested into Second Brain. Speech-to-text transcription scheduled for Day 2 pipeline.`;
        }
        if (!finalSummary) {
          finalSummary = `Voice note recording: ${cleanTitle}.`;
        }
      } else {
        if (!finalContent) {
          finalContent = cleanTitle;
        }
        if (!finalSummary) {
          finalSummary = `Personal knowledge note on ${cleanTitle}.`;
        }
      }

      const created = await createKnowledge({
        title: cleanTitle,
        type: kType,
        summary: finalSummary,
        content: finalContent,
        originalUrl: activeTab === 'LINK' ? url.trim() : undefined,
        fileName: selectedFile ? selectedFile.name : undefined,
        fileSize: selectedFile ? (selectedFile.size / 1024 / 1024).toFixed(2) + ' MB' : undefined,
        fileType: selectedFile ? selectedFile.type : undefined,
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
        audioDuration: activeTab === 'AUDIO' ? '02:30' : undefined,
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
              Capture notes, web links, documents, or voice thoughts.
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

          <button
            type="button"
            onClick={() => {
              setActiveTab('AUDIO');
              setFormError(null);
            }}
            className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold border-b-2 transition-all ${
              activeTab === 'AUDIO'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            <Mic size={15} /> Voice Note
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

          {/* Website Link Field */}
          {activeTab === 'LINK' && (
            <div className="space-y-1">
              <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                URL / Web Address <span className="text-red-500">*</span>
              </label>
              <Input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://docs.postgresql.org/current/mvcc.html"
                leftIcon={<Link2 size={15} />}
                required
              />
            </div>
          )}

          {/* Upload File Section */}
          {activeTab === 'FILE' && (
            <div className="space-y-1">
              <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                File Attachment (Day 1 Metadata Ingestion)
              </label>
              <div className="border-2 border-dashed border-zinc-300 dark:border-zinc-700 hover:border-indigo-500 dark:hover:border-indigo-500 rounded-xl p-6 text-center bg-zinc-50/50 dark:bg-zinc-900/30 transition-colors">
                <input
                  type="file"
                  id="file-upload"
                  onChange={handleFileChange}
                  className="hidden"
                  accept=".pdf,.docx,.doc,.png,.jpg,.jpeg,.mp3"
                />
                <label htmlFor="file-upload" className="cursor-pointer space-y-2 inline-block">
                  <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center mx-auto text-indigo-500">
                    <FileUp size={20} />
                  </div>
                  <div className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                    {selectedFile ? (
                      <span className="text-indigo-600 dark:text-indigo-400">
                        Selected: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                      </span>
                    ) : (
                      'Click to attach PDF, Word Document, or Image'
                    )}
                  </div>
                  <p className="text-[11px] text-zinc-400">
                    Day 1 registers the document knowledge record in PostgreSQL. Deep binary OCR/parsing connects on Day 2.
                  </p>
                </label>
              </div>
            </div>
          )}

          {/* Voice Recording Section */}
          {activeTab === 'AUDIO' && (
            <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 space-y-3 text-center">
              <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto">
                <Mic size={24} className={isRecording ? 'animate-pulse text-red-500' : ''} />
              </div>
              <div className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                {isRecording ? 'Recording voice note...' : 'Voice Recorder Ready'}
              </div>
              <Button
                type="button"
                variant={isRecording ? 'danger' : 'secondary'}
                size="sm"
                onClick={() => setIsRecording(!isRecording)}
              >
                {isRecording ? 'Stop Recording' : 'Start Microphone Capture'}
              </Button>
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
            <Button type="submit" variant="primary" size="md" isLoading={isProcessing}>
              Save to PostgreSQL
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
