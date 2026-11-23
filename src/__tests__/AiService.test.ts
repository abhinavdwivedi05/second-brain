import { AIService } from '@/services/api/ai';
import { apiClient } from '@/services/api/client';
import { KnowledgeItem } from '@/types';

jest.mock('@/services/api/client', () => {
  return {
    apiClient: {
      get: jest.fn(),
      post: jest.fn(),
    },
    getStoredToken: jest.fn().mockReturnValue('mock-jwt-token'),
  };
});

describe('AIService Frontend Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockKnowledgeItem: KnowledgeItem = {
    id: 'k-ai-123',
    title: 'PostgreSQL Architecture',
    content: 'PostgreSQL uses MVCC for transaction isolation and WAL for durability.',
    summary: 'A guide to PostgreSQL internals.',
    type: 'NOTE',
    tags: ['postgresql', 'database'],
    isFavorite: false,
    isArchived: false,
    createdAt: '2026-11-23T10:00:00Z',
    updatedAt: '2026-11-23T10:00:00Z',
    processingStatus: 'COMPLETED',
    keyConcepts: ['MVCC', 'WAL'],
    relatedKnowledgeIds: [],
  };

  test('summarizeContent sends POST to /api/v1/ai/summarize', async () => {
    (apiClient.post as jest.Mock).mockResolvedValueOnce({
      summary: 'Generated summary of PostgreSQL MVCC.',
      knowledgeId: 'k-ai-123',
    });

    const result = await AIService.summarizeContent(
      mockKnowledgeItem.content,
      mockKnowledgeItem.title,
      mockKnowledgeItem.id
    );

    expect(apiClient.post).toHaveBeenCalledWith('/api/v1/ai/summarize', {
      content: mockKnowledgeItem.content,
      title: mockKnowledgeItem.title,
      knowledge_id: mockKnowledgeItem.id,
    });
    expect(result).toBe('Generated summary of PostgreSQL MVCC.');
  });

  test('extractKeyConcepts sends POST to /api/v1/ai/extract-concepts', async () => {
    (apiClient.post as jest.Mock).mockResolvedValueOnce({
      keyConcepts: ['MVCC', 'Write-Ahead Logging', 'ACID Transactions'],
    });

    const concepts = await AIService.extractKeyConcepts(mockKnowledgeItem.content, mockKnowledgeItem.id);

    expect(apiClient.post).toHaveBeenCalledWith('/api/v1/ai/extract-concepts', {
      content: mockKnowledgeItem.content,
      knowledge_id: mockKnowledgeItem.id,
    });
    expect(concepts).toEqual(['MVCC', 'Write-Ahead Logging', 'ACID Transactions']);
  });

  test('generateSuggestedTags sends POST to /api/v1/ai/suggest-tags', async () => {
    (apiClient.post as jest.Mock).mockResolvedValueOnce({
      tags: ['postgresql', 'database', 'acid', 'storage'],
    });

    const tags = await AIService.generateSuggestedTags(
      mockKnowledgeItem.content,
      mockKnowledgeItem.title,
      mockKnowledgeItem.id
    );

    expect(apiClient.post).toHaveBeenCalledWith('/api/v1/ai/suggest-tags', {
      content: mockKnowledgeItem.content,
      title: mockKnowledgeItem.title,
      knowledge_id: mockKnowledgeItem.id,
    });
    expect(tags).toEqual(['postgresql', 'database', 'acid', 'storage']);
  });

  test('chat sends POST to /api/v1/ai/chat and returns answer with sources', async () => {
    (apiClient.post as jest.Mock).mockResolvedValueOnce({
      answer: 'PostgreSQL implements MVCC by retaining old tuple versions until vacuuming.',
      sources: [{ id: 'k-ai-123', title: 'PostgreSQL Architecture' }],
    });

    const response = await AIService.chat('How does MVCC work?', 'k-ai-123');

    expect(apiClient.post).toHaveBeenCalledWith('/api/v1/ai/chat', {
      query: 'How does MVCC work?',
      knowledge_id: 'k-ai-123',
    });
    expect(response.answer).toContain('PostgreSQL implements MVCC');
    expect(response.sources).toHaveLength(1);
    expect(response.sources[0].title).toBe('PostgreSQL Architecture');
  });

  test('askAssistant invokes chat with active document context', async () => {
    (apiClient.post as jest.Mock).mockResolvedValueOnce({
      answer: 'Document details on PostgreSQL.',
      sources: [{ id: 'k-ai-123', title: 'PostgreSQL Architecture' }],
    });

    const response = await AIService.askAssistant('Explain WAL', mockKnowledgeItem);

    expect(apiClient.post).toHaveBeenCalledWith('/api/v1/ai/chat', {
      query: 'Explain WAL',
      knowledge_id: 'k-ai-123',
    });
    expect(response.answer).toBe('Document details on PostgreSQL.');
  });
});

