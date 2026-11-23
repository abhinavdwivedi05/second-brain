'use client';

import React, { useState } from 'react';
import { useKnowledge } from '@/context/KnowledgeContext';
import { Tags as TagsIcon, Plus, Trash2, Edit2, AlertCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Tag } from '@/types';

export const TagsView: React.FC = () => {
  const {
    tags,
    selectTagFilter,
    createTag,
    updateTag,
    deleteTag,
    tagsError,
    clearTagsError,
    isLoading,
  } = useKnowledge();

  // Create Tag Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [tagName, setTagName] = useState('');
  const [tagColor, setTagColor] = useState('#3B82F6');
  const [actionError, setActionError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit Tag Modal
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('#3B82F6');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = tagName.trim().replace(/^#/, '');
    if (!clean) return;
    setIsSubmitting(true);
    setActionError(null);
    try {
      await createTag({ name: clean, color: tagColor });
      setTagName('');
      setIsCreateModalOpen(false);
    } catch (err: any) {
      setActionError(err?.message || 'Failed to create tag');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditModal = (t: Tag, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingTag(t);
    setEditName(t.name);
    setEditColor(t.color);
    setActionError(null);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTag) return;
    const clean = editName.trim().replace(/^#/, '');
    if (!clean) return;
    setIsSubmitting(true);
    setActionError(null);
    try {
      await updateTag(editingTag.id, { name: clean, color: editColor });
      setEditingTag(null);
    } catch (err: any) {
      setActionError(err?.message || 'Failed to update tag');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (t: Tag, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Delete tag "#${t.name}"?`)) {
      try {
        await deleteTag(t.id);
      } catch (err: any) {
        alert(err?.message || 'Failed to delete tag');
      }
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <TagsIcon className="text-indigo-500" size={22} /> Tag Cloud & Index
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Lightweight semantic tags assigned across your notes, links, and documents.
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          leftIcon={<Plus size={14} />}
          onClick={() => {
            setActionError(null);
            setIsCreateModalOpen(true);
          }}
        >
          Create Tag
        </Button>
      </div>

      {/* Error Banner */}
      {(tagsError || actionError) && (
        <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 rounded-xl flex items-center justify-between text-xs text-red-700 dark:text-red-300">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-red-500 shrink-0" />
            <span>{actionError || tagsError}</span>
          </div>
          <button
            onClick={() => {
              setActionError(null);
              clearTagsError();
            }}
            className="p-1 hover:bg-red-100 dark:hover:bg-red-900/40 rounded transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Loading State */}
      {isLoading && tags.length === 0 && (
        <div className="flex flex-wrap gap-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-10 w-28 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-800 animate-pulse"
            />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && tags.length === 0 && (
        <div className="text-center py-16 px-4 space-y-4 rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-800 bg-white/50 dark:bg-[#121215]/50">
          <div className="mx-auto w-12 h-12 rounded-full bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-500">
            <TagsIcon size={22} />
          </div>
          <div className="max-w-sm mx-auto space-y-1">
            <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-100">
              No tags found yet
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Create tags to categorize and filter knowledge entries across topics.
            </p>
          </div>
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Plus size={14} />}
            onClick={() => {
              setActionError(null);
              setIsCreateModalOpen(true);
            }}
          >
            Create Tag
          </Button>
        </div>
      )}

      {/* Cloud Grid */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {tags.map((t) => (
            <div
              key={t.id}
              onClick={() => selectTagFilter(t.name)}
              className="group relative flex items-center gap-2 px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#121215] hover:border-indigo-500/60 hover:shadow-md transition-all cursor-pointer"
            >
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: t.color }}
              />
              <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                #{t.name}
              </span>
              <span className="text-[10px] font-semibold text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
                {t.itemCount}
              </span>

              {/* Action buttons on hover */}
              <div className="flex items-center gap-1 ml-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => openEditModal(t, e)}
                  className="text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 p-0.5 rounded transition-colors"
                  title="Edit tag"
                >
                  <Edit2 size={12} />
                </button>
                <button
                  onClick={(e) => handleDelete(t, e)}
                  className="text-zinc-400 hover:text-red-500 p-0.5 rounded transition-colors"
                  title="Delete tag"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Tag Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white dark:bg-[#121215] rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
              Create New Tag
            </h3>

            {actionError && (
              <div className="p-2.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 rounded-lg text-xs text-red-700 dark:text-red-300">
                {actionError}
              </div>
            )}

            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Tag Name</label>
                <Input
                  value={tagName}
                  onChange={(e) => setTagName(e.target.value)}
                  placeholder="e.g. distributed-systems"
                  required
                  autoFocus
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Color</label>
                <input
                  type="color"
                  value={tagColor}
                  onChange={(e) => setTagColor(e.target.value)}
                  className="w-full h-9 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-transparent cursor-pointer p-1"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <Button type="button" variant="ghost" onClick={() => setIsCreateModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" isLoading={isSubmitting}>
                  Create Tag
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Tag Modal */}
      {editingTag && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white dark:bg-[#121215] rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
              Edit Tag
            </h3>

            {actionError && (
              <div className="p-2.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 rounded-lg text-xs text-red-700 dark:text-red-300">
                {actionError}
              </div>
            )}

            <form onSubmit={handleUpdate} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Tag Name</label>
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Color</label>
                <input
                  type="color"
                  value={editColor}
                  onChange={(e) => setEditColor(e.target.value)}
                  className="w-full h-9 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-transparent cursor-pointer p-1"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <Button type="button" variant="ghost" onClick={() => setEditingTag(null)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" isLoading={isSubmitting}>
                  Save Changes
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
