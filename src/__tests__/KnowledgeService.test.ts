import {
  KnowledgeService,
  listKnowledge,
  getKnowledge,
  createKnowledgeItem,
  updateKnowledgeItem,
  deleteKnowledgeItem,
  toggleKnowledgeFavorite,
} from '@/services/api/knowledge';
import { migrateKnowledgeIfNeeded } from '@/services/api/dataMigration';
import { apiClient, ApiClientError } from '@/services/api/client';
import { KnowledgeItem, Collection } from '@/types';

describe('Knowledge API Service and Migration', () => {
  const mockKnowledge: KnowledgeItem = {
    id: 'k-1',
    title: 'PostgreSQL MVCC Internals',
    type: 'NOTE',
    summary: 'Overview of multi-version concurrency control in Postgres.',
    content: 'Full markdown documentation of heap tuples and WAL.',
    tags: ['postgres', 'database'],
    collectionId: 'col-1',
    collectionName: 'Database Systems',
    isFavorite: true,
    isArchived: false,
    createdAt: '2026-11-20T10:00:00Z',
    updatedAt: '2026-11-20T10:00:00Z',
    processingStatus: 'COMPLETED',
    processingProgress: 100,
    keyConcepts: ['MVCC', 'WAL'],
    relatedKnowledgeIds: [],
  };

  beforeEach(() => {
    localStorage.clear();
    jest.restoreAllMocks();
  });

  describe('listKnowledge', () => {
    it('calls GET /api/v1/knowledge without filters by default', async () => {
      const getSpy = jest.spyOn(apiClient, 'get').mockResolvedValueOnce([mockKnowledge]);
      const result = await listKnowledge();
      expect(getSpy).toHaveBeenCalledWith('/api/v1/knowledge');
      expect(result).toEqual([mockKnowledge]);
    });

    it('passes search, type, collection, tag, and sort filters as query parameters', async () => {
      const getSpy = jest.spyOn(apiClient, 'get').mockResolvedValueOnce([mockKnowledge]);
      await listKnowledge({
        query: 'postgres',
        type: 'NOTE',
        collectionId: 'col-1',
        tag: '#database',
        favoritesOnly: true,
        sortBy: 'title',
      });
      expect(getSpy).toHaveBeenCalledWith(
        '/api/v1/knowledge?q=postgres&type=NOTE&collection_id=col-1&tag=database&favorites_only=true&sort_by=title'
      );
    });

    it('propagates ApiClientError when list request fails', async () => {
      jest.spyOn(apiClient, 'get').mockRejectedValueOnce(new ApiClientError('Unauthorized', 401));
      await expect(listKnowledge()).rejects.toThrow(ApiClientError);
    });
  });

  describe('getKnowledge', () => {
    it('calls GET /api/v1/knowledge/:id with encoded id', async () => {
      const getSpy = jest.spyOn(apiClient, 'get').mockResolvedValueOnce(mockKnowledge);
      const res = await getKnowledge('k-1');
      expect(getSpy).toHaveBeenCalledWith('/api/v1/knowledge/k-1');
      expect(res).toEqual(mockKnowledge);
    });
  });

  describe('createKnowledgeItem', () => {
    it('calls POST /api/v1/knowledge with payload and returns created item', async () => {
      const payload = {
        title: 'New Note',
        type: 'NOTE',
        content: 'Content here',
        tags: ['test'],
      };
      const postSpy = jest.spyOn(apiClient, 'post').mockResolvedValueOnce({
        ...mockKnowledge,
        ...payload,
        id: 'k-new',
      });

      const res = await createKnowledgeItem(payload);
      expect(postSpy).toHaveBeenCalledWith('/api/v1/knowledge', payload);
      expect(res.id).toBe('k-new');
      expect(res.title).toBe('New Note');
    });
  });

  describe('updateKnowledgeItem', () => {
    it('calls PATCH /api/v1/knowledge/:id with updates', async () => {
      const patchSpy = jest.spyOn(apiClient, 'patch').mockResolvedValueOnce({
        ...mockKnowledge,
        title: 'Updated Title',
      });

      const res = await updateKnowledgeItem('k-1', { title: 'Updated Title' });
      expect(patchSpy).toHaveBeenCalledWith('/api/v1/knowledge/k-1', { title: 'Updated Title' });
      expect(res.title).toBe('Updated Title');
    });
  });

  describe('deleteKnowledgeItem', () => {
    it('calls DELETE /api/v1/knowledge/:id', async () => {
      const delSpy = jest.spyOn(apiClient, 'delete').mockResolvedValueOnce(null);
      await deleteKnowledgeItem('k-1');
      expect(delSpy).toHaveBeenCalledWith('/api/v1/knowledge/k-1');
    });
  });

  describe('toggleKnowledgeFavorite', () => {
    it('calls POST /api/v1/knowledge/:id/favorite', async () => {
      const postSpy = jest.spyOn(apiClient, 'post').mockResolvedValueOnce({
        ...mockKnowledge,
        isFavorite: false,
      });

      const res = await toggleKnowledgeFavorite('k-1');
      expect(postSpy).toHaveBeenCalledWith('/api/v1/knowledge/k-1/favorite');
      expect(res.isFavorite).toBe(false);
    });
  });

  describe('KnowledgeService adapter methods', () => {
    it('getAll delegates to listKnowledge', async () => {
      jest.spyOn(apiClient, 'get').mockResolvedValueOnce([mockKnowledge]);
      const res = await KnowledgeService.getAll();
      expect(res).toEqual([mockKnowledge]);
    });

    it('create delegates to createKnowledgeItem', async () => {
      jest.spyOn(apiClient, 'post').mockResolvedValueOnce(mockKnowledge);
      const res = await KnowledgeService.create({
        title: 'Note',
        type: 'NOTE',
        content: 'Body',
        summary: '',
        tags: [],
        isFavorite: false,
        isArchived: false,
        keyConcepts: [],
        relatedKnowledgeIds: [],
        processingStatus: 'COMPLETED',
      });
      expect(res).toEqual(mockKnowledge);
    });

    it('delete delegates to deleteKnowledgeItem', async () => {
      jest.spyOn(apiClient, 'delete').mockResolvedValueOnce(null);
      const res = await KnowledgeService.delete('k-1');
      expect(res).toBe(true);
    });
  });

  describe('migrateKnowledgeIfNeeded', () => {
    it('does nothing if already migrated', async () => {
      localStorage.setItem('second_brain_knowledge_migrated_v1', 'true');
      const postSpy = jest.spyOn(apiClient, 'post');

      const result = await migrateKnowledgeIfNeeded([mockKnowledge]);
      expect(result).toEqual([mockKnowledge]);
      expect(postSpy).not.toHaveBeenCalled();
    });

    it('migrates unmigrated localStorage items and avoids creating duplicates', async () => {
      const localNotes = [
        {
          id: 'local-1',
          title: 'Existing Note',
          content: 'Already on backend',
          tags: ['db'],
        },
        {
          id: 'local-2',
          title: 'Unmigrated Legacy Note',
          content: 'Needs to be sent to backend',
          tags: ['legacy'],
          collectionName: 'Database Systems',
        },
      ];
      localStorage.setItem('second_brain_knowledge_v1', JSON.stringify(localNotes));

      const existingBackendNotes: KnowledgeItem[] = [
        {
          ...mockKnowledge,
          title: 'Existing Note',
        },
      ];

      const availableCols: Collection[] = [
        {
          id: 'col-1',
          name: 'Database Systems',
          description: '',
          icon: 'Folder',
          color: '#3B82F6',
          itemCount: 1,
          createdAt: '2026-11-20T10:00:00Z',
        },
      ];

      const postSpy = jest.spyOn(apiClient, 'post').mockResolvedValueOnce({
        ...mockKnowledge,
        title: 'Unmigrated Legacy Note',
        collectionId: 'col-1',
      });

      jest.spyOn(apiClient, 'get').mockResolvedValueOnce([
        existingBackendNotes[0],
        { ...mockKnowledge, title: 'Unmigrated Legacy Note' },
      ]);

      const res = await migrateKnowledgeIfNeeded(existingBackendNotes, availableCols);

      // Only 'Unmigrated Legacy Note' should be created
      expect(postSpy).toHaveBeenCalledTimes(1);
      expect(postSpy).toHaveBeenCalledWith(
        '/api/v1/knowledge',
        expect.objectContaining({
          title: 'Unmigrated Legacy Note',
          collectionId: 'col-1',
        })
      );

      // Migration marker is set
      expect(localStorage.getItem('second_brain_knowledge_migrated_v1')).toBe('true');
      expect(res.length).toBe(2);
    });
  });
});

