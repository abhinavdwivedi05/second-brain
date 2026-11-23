import { fetchDashboardStats, fetchActivities } from '@/services/api/dashboard';
import { apiClient, ApiClientError } from '@/services/api/client';
import { DashboardStats, ActivityLog } from '@/types';

describe('Dashboard & Activities API Service', () => {
  const mockStats: DashboardStats = {
    totalKnowledge: 5,
    totalNotes: 2,
    totalLinks: 2,
    totalDocuments: 1,
    totalCollections: 2,
    totalTags: 4,
    totalFavorites: 1,
    recentItems: [
      {
        id: 'k-1',
        title: 'PostgreSQL Architecture',
        type: 'NOTE',
        summary: 'Deep dive into WAL and MVCC',
        content: 'PostgreSQL storage internals',
        tags: ['postgres'],
        isFavorite: true,
        isArchived: false,
        createdAt: '2026-11-24T00:00:00Z',
        updatedAt: '2026-11-24T00:00:00Z',
        processingStatus: 'COMPLETED',
        keyConcepts: ['PostgreSQL', 'MVCC'],
        relatedKnowledgeIds: [],
      },
    ],
    recentAccessed: [],
    recentActivities: [
      {
        id: 'act-1',
        action: 'CREATED',
        knowledgeId: 'k-1',
        knowledgeTitle: 'PostgreSQL Architecture',
        timestamp: '2026-11-24T00:00:00Z',
        type: 'NOTE',
      },
    ],
  };

  const mockActivities: ActivityLog[] = [
    {
      id: 'act-1',
      action: 'CREATED',
      knowledgeId: 'k-1',
      knowledgeTitle: 'PostgreSQL Architecture',
      timestamp: '2026-11-24T00:00:00Z',
      type: 'NOTE',
    },
    {
      id: 'act-2',
      action: 'FAVORITED',
      knowledgeId: 'k-1',
      knowledgeTitle: 'PostgreSQL Architecture',
      timestamp: '2026-11-24T00:05:00Z',
      type: 'NOTE',
    },
  ];

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('fetchDashboardStats', () => {
    it('calls GET /api/v1/dashboard/stats and returns aggregated stats', async () => {
      const getSpy = jest.spyOn(apiClient, 'get').mockResolvedValueOnce(mockStats);

      const result = await fetchDashboardStats();

      expect(getSpy).toHaveBeenCalledWith('/api/v1/dashboard/stats');
      expect(result).toEqual(mockStats);
      expect(result.totalKnowledge).toBe(5);
      expect(result.totalNotes).toBe(2);
      expect(result.totalFavorites).toBe(1);
    });

    it('propagates error when API call fails', async () => {
      jest.spyOn(apiClient, 'get').mockRejectedValueOnce(
        new ApiClientError('Internal Server Error', 500)
      );

      await expect(fetchDashboardStats()).rejects.toThrow(ApiClientError);
    });
  });

  describe('fetchActivities', () => {
    it('calls GET /api/v1/activities with query params', async () => {
      const getSpy = jest.spyOn(apiClient, 'get').mockResolvedValueOnce(mockActivities);

      const result = await fetchActivities(25, 0);

      expect(getSpy).toHaveBeenCalledWith('/api/v1/activities?limit=25&offset=0');
      expect(result).toEqual(mockActivities);
      expect(result.length).toBe(2);
      expect(result[0].action).toBe('CREATED');
    });

    it('uses default limit and offset if none provided', async () => {
      const getSpy = jest.spyOn(apiClient, 'get').mockResolvedValueOnce(mockActivities);

      await fetchActivities();

      expect(getSpy).toHaveBeenCalledWith('/api/v1/activities?limit=50&offset=0');
    });
  });
});

