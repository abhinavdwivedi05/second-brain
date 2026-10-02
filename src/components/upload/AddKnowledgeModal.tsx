'use client';

import React, { useState } from 'react';
import { useKnowledge } from '@/context/KnowledgeContext';
import { KnowledgeType } from '@/types';
import { FileService } from '@/services/api/files';
import {
  X,
  FileText,
  Link2,
  FileUp,
  Mic,
  Plus,
  CheckCircle2,
  Sparkles,
  Tag as TagIcon,
  FolderKanban,
  Square,
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
  const [url, setUrl] = useState('');
  const [selectedCollection, setSelectedCollection] = useState<string>('');
  const [tagInput, setTagInput] = useState('');
  const [tagsList, setTagsList] = useState<string[]>(['javascript', 'dev']);

  // File upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [processingStep, setProcessingStep] = useState('');

  // Audio recording simulation state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);

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
      if (!title) {
        const nameWithoutExt = f.name.replace(/\.[^/.]+$/, '');
        setTitle(nameWithoutExt.charAt(0).toUpperCase() + nameWithoutExt.slice(1));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);

    try {
      if (activeTab === 'FILE' && selectedFile) {
        const created = await FileService.uploadAndProcessFile(
          selectedFile,
          selectedCollection || undefined,
          tagsList,
          (progress, step) => {
            setUploadProgress(progress);
            setProcessingStep(step);
          }
        );
        setIsAddModalOpen(false);
        resetForm();
        openDetailView(created);
        return;
      }

      // Notes, Links, Audio creation simulation
      setUploadProgress(40);
      setProcessingStep('Generating AI summary...');
      await new Promise((res) => setTimeout(res, 400));

      setUploadProgress(85);
      setProcessingStep('Indexing search vectors...');
      await new Promise((res) => setTimeout(res, 400));

      let type: KnowledgeType = 'NOTE';
      if (activeTab === 'LINK') type = 'LINK';
      if (activeTab === 'AUDIO') type = 'AUDIO';

      const finalTitle = title.trim() || (type === 'LINK' ? 'Saved Web Link' : 'Quick Knowledge Note');
      const finalContent =
        type === 'LINK'
          ? `# ${finalTitle}\n\n**Bookmarked URL:** ${url}\n\n${content || 'Saved webpage bookmark.'}`
          : content || 'Knowledge entry body notes.';

      const created = await createKnowledge({
        title: finalTitle,
        type,
        summary: `Captured entry on ${finalTitle}. Contains user notes and indexed topic tags.`,
        content: finalContent,
        originalUrl: type === 'LINK' ? url : undefined,
        tags: tagsList,
        collectionId: selectedCollection || undefined,
        collectionName: collections.find((c) => c.id === selectedCollection)?.name,
        isFavorite: false,
        isArchived: false,
        processingStatus: 'COMPLETED',
        processingProgress: 100,
        keyConcepts: tagsList.map((t) => t.toUpperCase()),
        relatedKnowledgeIds: [],
        aiInsights: ['Successfully added to Second Brain.'],
      });

      setIsAddModalOpen(false);
      resetForm();
      openDetailView(created);
    } catch (err) {
      console.error('Failed to create knowledge item', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    setContent('');
    setUrl('');
    setSelectedCollection('');
    setTagInput('');
    setTagsList(['javascript', 'dev']);
    setSelectedFile(null);
    setUploadProgress(0);
    setProcessingStep('');
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
            onClick={() => setActiveTab('NOTE')}
            className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold border-b-2 transition-all ${
              activeTab === 'NOTE'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            <FileText size={15} /> Note
          </button>

          <button
            onClick={() => setActiveTab('LINK')}
            className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold border-b-2 transition-all ${
              activeTab === 'LINK'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            <Link2 size={15} /> Website Link
          </button>

          <button
            onClick={() => setActiveTab('FILE')}
            className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold border-b-2 transition-all ${
              activeTab === 'FILE'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            <FileUp size={15} /> Upload File
          </button>

          <button
            onClick={() => setActiveTab('AUDIO')}
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
          {/* Processing Progress Bar Overlay */}
          {isProcessing && (
            <div className="p-4 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/60 space-y-2 animate-fade-in">
              <div className="flex items-center justify-between text-xs font-bold text-indigo-700 dark:text-indigo-300">
                <span className="flex items-center gap-2">
                  <Sparkles size={15} className="animate-spin text-indigo-500" />
                  {processingStep || 'Processing Knowledge Entry...'}
                </span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="h-2 w-full bg-indigo-200 dark:bg-indigo-900 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-600 dark:bg-indigo-400 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
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
              placeholder="e.g. React Server Components Hydration Pipeline"
              required
            />
          </div>

          {/* Website Link Field */}
          {activeTab === 'LINK' && (
            <div className="space-y-1">
              <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                URL / Web Address
              </label>
              <Input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://docs.docker.com/network/drivers/"
                leftIcon={<Link2 size={15} />}
              />
            </div>
          )}

          {/* Upload File Dropzone */}
          {activeTab === 'FILE' && (
            <div className="space-y-1">
              <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                File Attachment
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
                      'Click to browse or drag & drop file here'
                    )}
                  </div>
                  <p className="text-[11px] text-zinc-400">
                    Supports PDF, DOCX, PNG, JPG, MP3 (Up to 50 MB)
                  </p>
                </label>
              </div>
            </div>
          )}

          {/* Voice Recording Simulator */}
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
                {isRecording ? 'Stop Recording' : 'Start Microphonic Capture'}
              </Button>
            </div>
          )}

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
              Save Knowledge
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
