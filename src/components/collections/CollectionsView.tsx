'use client';

import React, { useState } from 'react';
import { useKnowledge } from '@/context/KnowledgeContext';
import { FolderKanban, Plus, ArrowRight, Trash2, Code2, Server, Cloud, GraduationCap, Brain } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export const CollectionsView: React.FC = () => {
  const { collections, createCollection, deleteCollection, selectCollectionFilter } = useKnowledge();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#3B82F6');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    await createCollection({
      name: name.trim(),
      description: description.trim() || 'Knowledge collection',
      icon: 'FolderKanban',
      color,
    });
    setName('');
    setDescription('');
    setIsModalOpen(false);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <FolderKanban className="text-indigo-500" size={22} /> Collections
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Intentional knowledge spaces for focused topics, projects, and domains.
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          leftIcon={<Plus size={14} />}
          onClick={() => setIsModalOpen(true)}
        >
          Create Collection
        </Button>
      </div>

      {/* Grid of collections */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {collections.map((col) => (
          <div
            key={col.id}
            onClick={() => selectCollectionFilter(col.id)}
            className="group relative flex flex-col justify-between p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#121215] hover:border-indigo-500/60 hover:shadow-lg transition-all cursor-pointer"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: col.color }}
                />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`Delete collection "${col.name}"?`)) {
                      deleteCollection(col.id);
                    }
                  }}
                  className="text-zinc-300 dark:text-zinc-700 hover:text-red-500 transition-colors p-1"
                >
                  <Trash2 size={15} />
                </button>
              </div>

              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                {col.name}
              </h2>

              <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2 leading-relaxed">
                {col.description}
              </p>
            </div>

            <div className="mt-6 pt-4 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between text-xs font-semibold">
              <span className="text-zinc-400">{col.itemCount} items stored</span>
              <span className="text-indigo-600 dark:text-indigo-400 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                Explore <ArrowRight size={13} />
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Create Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white dark:bg-[#121215] rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
              Create New Collection
            </h3>

            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Name</label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Distributed Systems"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Description</label>
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Notes on Kafka, Redis, Consensus algorithms..."
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Color Pill</label>
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-full h-9 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-transparent cursor-pointer p-1"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary">
                  Create Collection
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
