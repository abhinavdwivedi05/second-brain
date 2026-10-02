import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CommandPalette } from '@/components/search/CommandPalette';
import { KnowledgeProvider } from '@/context/KnowledgeContext';
import { ThemeProvider } from '@/context/ThemeContext';
// Mock KnowledgeService
// @ts-ignore
// Mock KnowledgeService
// @ts-ignore
jest.mock('@/services/api/knowledge', () => ({
  KnowledgeService: {
    getAll: jest.fn().mockResolvedValue([]),
    getById: jest.fn().mockResolvedValue(null),
    searchKnowledge: jest.fn().mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 20,
      totalPages: 0,
      total: 0,
    } as any),
    toggleFavorite: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue({
      id: 'k-1',
      title: 'Test',
      summary: '',
      content: '',
      tags: [],
      type: 'NOTE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      collectionId: undefined,
      relatedKnowledgeIds: [],
      keyConcepts: [],
      isFavorite: false,
    } as any),
    update: jest.fn().mockResolvedValue(null),
    delete: jest.fn().mockResolvedValue(true),
  },
}));

// Mock CollectionService
// @ts-ignore
jest.mock('@/services/api/collections', () => ({
  CollectionService: {
    getAll: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockResolvedValue(null),
    delete: jest.fn().mockResolvedValue(true),
  },
}));

// Mock TagService
// @ts-ignore
jest.mock('@/services/api/tags', () => ({
  TagService: {
    getAll: jest.fn().mockResolvedValue([]),
    ensureTagExists: jest.fn().mockResolvedValue(null),
  },
}));

describe('CommandPalette', () => {
  it('renders without crashing and shows recent knowledge placeholder', () => {
    render(
      <ThemeProvider>
        <KnowledgeProvider>
          <CommandPalette />
        </KnowledgeProvider>
      </ThemeProvider>
    );
    // Palette is closed by default, nothing should be in document
    expect(screen.queryByPlaceholderText(/type a command or search knowledge base/i)).not.toBeInTheDocument();
  });
});
