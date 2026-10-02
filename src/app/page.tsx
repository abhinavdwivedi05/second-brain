'use client';

import React from 'react';
import { ThemeProvider } from '@/context/ThemeContext';
import { KnowledgeProvider, useKnowledge } from '@/context/KnowledgeContext';
import { AppShell } from '@/components/layout/AppShell';
import { DashboardView } from '@/components/dashboard/DashboardView';
import { KnowledgeLibrary } from '@/components/knowledge/KnowledgeLibrary';
import { KnowledgeDetail } from '@/components/knowledge/KnowledgeDetail';
import { CollectionsView } from '@/components/collections/CollectionsView';
import { TagsView } from '@/components/tags/TagsView';
import { SettingsView } from '@/components/settings/SettingsView';
import { LandingPage } from '@/components/landing/LandingPage';

function MainViewContent() {
  const { activeView } = useKnowledge();

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
      <KnowledgeProvider>
        <AppShell>
          <MainViewContent />
        </AppShell>
      </KnowledgeProvider>
    </ThemeProvider>
  );
}
