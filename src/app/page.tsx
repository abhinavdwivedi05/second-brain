'use client';

import React from 'react';
import { ThemeProvider } from '@/context/ThemeContext';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { KnowledgeProvider, useKnowledge } from '@/context/KnowledgeContext';
import { AppShell } from '@/components/layout/AppShell';
import { DashboardView } from '@/components/dashboard/DashboardView';
import { KnowledgeLibrary } from '@/components/knowledge/KnowledgeLibrary';
import { KnowledgeDetail } from '@/components/knowledge/KnowledgeDetail';
import { CollectionsView } from '@/components/collections/CollectionsView';
import { TagsView } from '@/components/tags/TagsView';
import { SettingsView } from '@/components/settings/SettingsView';
import { LandingPage } from '@/components/landing/LandingPage';
import { AuthView } from '@/components/auth/AuthView';

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();
  const { activeView } = useKnowledge();

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-zinc-50 dark:bg-[#09090b]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
          <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">Loading Second Brain...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthView />;
  }

  return (
    <AppShell>
      <MainViewContent activeView={activeView} />
    </AppShell>
  );
}

function MainViewContent({ activeView }: { activeView: string }) {
  switch (activeView) {
    case 'dashboard':
      return <DashboardView />;
    case 'library':
      return <KnowledgeLibrary />;
    case 'detail':
      return <KnowledgeDetail />;
    case 'collections':
      return <CollectionsView />;
    case 'tags':
      return <TagsView />;
    case 'settings':
      return <SettingsView />;
    case 'landing':
      return <LandingPage />;
    default:
      return <DashboardView />;
  }
}

export default function Home() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <KnowledgeProvider>
          <AppContent />
        </KnowledgeProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
