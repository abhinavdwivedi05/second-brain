import { KnowledgeService } from '@/services/api/knowledge';
import { apiClient } from '@/services/api/client';
import { SearchResponse } from '@/types';

jest.mock('@/services/api/client', () => {
  return {
    apiClient: {
      get: jest.fn(),
      post: jest.fn(),
    },
    getStoredToken: jest.fn().mockReturnValue('mock-jwt-token'),
  };
});

describe('SearchService & KnowledgeService.searchKnowledge', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockSearchResult: SearchResponse = {
    items: [
      {
        id: 'k-1',
        title: 'Kubernetes Architecture',
        snippet: 'Deep dive into <em>Kubernetes</em> control plane and kubelet.',
        type: 'NOTE',
        summary: 'K8s overview',
        content: 'Kubernetes manages containerized workloads.',
        tags: ['k8s', 'devops'],
        isFavorite: true,
        isArchived: false,
        createdAt: '2026-11-23T10:00:00Z',
        updatedAt: '2026-11-23T10:00:00Z',
        processingStatus: 'COMPLETED',
        keyConcepts: ['Control Plane', 'Kubelet'],
        relatedKnowledgeIds: [],
        relevanceScore: 17.0,
      },
    ],
    total: 1,
    page: 1,
    pageSize: 20,
    totalPages: 1,
  };

  test('searchKnowledge queries /api/v1/search with all search params', async () => {
    (apiClient.get as jest.Mock).mockResolvedValueOnce(mockSearchResult);

    const result = await KnowledgeService.searchKnowledge({
      q: 'Kubernetes',
      type: 'NOTE',
      collectionId: 'col-456',
      tag: 'k8s',
      isFavorite: true,
      sortBy: 'relevance',
      page: 1,
      pageSize: 10,
    });

    expect(apiClient.get).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/search?'),
      expect.any(Object)
    );

    const callUrl = (apiClient.get as jest.Mock).mock.calls[0][0];
    expect(callUrl).toContain('q=Kubernetes');
    expect(callUrl).toContain('type=NOTE');
    expect(callUrl).toContain('collection_id=col-456');
    expect(callUrl).toContain('tag=k8s');
    expect(callUrl).toContain('is_favorite=true');
    expect(callUrl).toContain('sort_by=relevance');
    expect(callUrl).toContain('page=1');
    expect(callUrl).toContain('page_size=10');

    expect(result.items).toHaveLength(1);
    expect(result.items[0].snippet).toContain('Kubernetes');
    expect(result.items[0].relevanceScore).toBe(17.0);
  });

  test('searchKnowledge propagates backend errors without local fallback', async () => {
    (apiClient.get as jest.Mock).mockRejectedValueOnce(new Error('Search service offline'));

    await expect(
      KnowledgeService.searchKnowledge({
        q: 'Failed query',
        page: 1,
        pageSize: 10,
      })
    ).rejects.toThrow('Search service offline');
  });
});
