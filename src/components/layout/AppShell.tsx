'use client';

import React from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useKnowledge } from '@/context/KnowledgeContext';
import { AddKnowledgeModal } from '@/components/upload/AddKnowledgeModal';
import { CommandPalette } from '@/components/search/CommandPalette';
import { AIAssistantDrawer } from '@/components/ai/AIAssistantDrawer';

export const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-zinc-50 dark:bg-[#09090b]">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content Workspace */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto bg-zinc-50 dark:bg-[#09090b]">
          {children}
        </main>
      </div>

      {/* Global Modals & Overlay Drawers */}
      <AddKnowledgeModal />
      <CommandPalette />
      <AIAssistantDrawer />
    </div>
  );
};
