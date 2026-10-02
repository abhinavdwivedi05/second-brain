'use client';

import React from 'react';
import { useKnowledge } from '@/context/KnowledgeContext';
import { Brain, Sparkles, Search, Layers, Zap, ArrowRight, CheckCircle2, ShieldCheck, Compass } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export const LandingPage: React.FC = () => {
  const { setActiveView } = useKnowledge();

  return (
    <div className="min-h-full bg-zinc-950 text-white font-sans space-y-24 py-16 px-4 sm:px-8 border-t border-zinc-800 animate-fade-in">
      {/* Hero Section */}
      <section className="max-w-4xl mx-auto text-center space-y-8">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-semibold">
          <Sparkles size={14} className="text-indigo-400" />
          Second Brain v2.4 — Personal Knowledge Operating System
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-zinc-100 leading-tight">
          Your knowledge.<br />
          <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            Finally connected.
          </span>
        </h1>

        <p className="max-w-2xl mx-auto text-base sm:text-lg text-zinc-400 leading-relaxed font-normal">
          Capture everything you learn. Organize it automatically. Retrieve what matters based on what you remember, rather than where you stored it.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
          <Button
            variant="primary"
            size="lg"
            onClick={() => setActiveView('dashboard')}
            rightIcon={<ArrowRight size={16} />}
            className="px-6 py-3 text-base shadow-lg shadow-indigo-600/30"
          >
            Launch Your Second Brain
          </Button>

          <Button
            variant="outline"
            size="lg"
            onClick={() => setActiveView('library')}
            className="px-6 py-3 text-base border-zinc-700 text-zinc-300 hover:bg-zinc-900"
          >
            Explore Live Demo
          </Button>
        </div>
      </section>

      {/* Product Philosophy Statement */}
      <section className="max-w-3xl mx-auto p-8 rounded-2xl bg-zinc-900/60 border border-zinc-800 text-center space-y-4 shadow-xl">
        <p className="text-xs font-bold uppercase tracking-widest text-indigo-400">Core Philosophy</p>
        <blockquote className="text-xl sm:text-2xl font-bold text-zinc-100 italic">
          "Capture once. Organize intelligently. Retrieve when needed."
        </blockquote>
        <p className="text-sm text-zinc-400">
          I don't need to remember where I saved something. My Second Brain remembers it for me.
        </p>
      </section>

      {/* 4 Pillars Grid */}
      <section className="max-w-6xl mx-auto space-y-8">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold text-zinc-100">Designed as a Knowledge Operating System</h2>
          <p className="text-sm text-zinc-400">Built with technical discipline, calm visual restraint, and keyboard-first speed.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="p-6 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <Zap size={20} />
            </div>
            <h3 className="text-base font-bold text-zinc-100">1. Capture</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Unified capture for Notes, Web Links, PDFs, Documents, and Voice recordings with multi-step OCR and parsing.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <Layers size={20} />
            </div>
            <h3 className="text-base font-bold text-zinc-100">2. Organize</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Intentional topic collections, lightweight tag clouds, and metadata extraction without administrative overhead.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
              <Brain size={20} />
            </div>
            <h3 className="text-base font-bold text-zinc-100">3. Connect</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Discover non-obvious relationships between notes with vector embedding similarity and key concept extraction.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <Search size={20} />
            </div>
            <h3 className="text-base font-bold text-zinc-100">4. Retrieve</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Sub-millisecond keyboard command palette (Cmd+K) with hybrid BM25 and vector semantic search.
            </p>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="max-w-4xl mx-auto text-center space-y-6 pt-12 border-t border-zinc-900">
        <h2 className="text-2xl sm:text-3xl font-bold text-zinc-100">
          Ready to build your personal knowledge engine?
        </h2>
        <Button
          variant="primary"
          size="lg"
          onClick={() => setActiveView('dashboard')}
          rightIcon={<ArrowRight size={16} />}
          className="px-8 py-3 text-base shadow-xl"
        >
          Open Second Brain Dashboard
        </Button>
      </section>
    </div>
  );
};
