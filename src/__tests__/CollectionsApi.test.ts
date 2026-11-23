import {
  listCollections,
  createCollection,
  getCollection,
  updateCollection,
  deleteCollection,
  CollectionService,
} from '@/services/api/collections';
import { apiClient, ApiClientError } from '@/services/api/client';
import { Collection } from '@/types';

describe('Collections API Service', () => {
  const mockCollection: Collection = {
    id: 'col-1',
    name: 'Distributed Systems',
    description: 'System design notes',
    icon: 'FolderKanban',
    color: '#3B82F6',
    itemCount: 5,
    createdAt: '2026-10-01T00:00:00Z',
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('listCollections', () => {
    it('calls GET /api/v1/collections and returns list of collections', async () => {
      const getSpy = jest.spyOn(apiClient, 'get').mockResolvedValueOnce([mockCollection]);

      const result = await listCollections();

      expect(getSpy).toHaveBeenCalledWith('/api/v1/collections');
      expect(result).toEqual([mockCollection]);
    });

    it('propagates ApiClientError when listCollections fails', async () => {
      jest.spyOn(apiClient, 'get').mockRejectedValueOnce(
        new ApiClientError('Unauthorized', 401)
      );

      await expect(listCollections()).rejects.toThrow(ApiClientError);
    });
  });

  describe('createCollection', () => {
    it('calls POST /api/v1/collections with data payload and returns created collection', async () => {
      const payload = {
        name: 'New Collection',
        description: 'Description here',
        icon: 'Folder',
        color: '#10B981',
      };
      const postSpy = jest.spyOn(apiClient, 'post').mockResolvedValueOnce({
        ...mockCollection,
        ...payload,
        id: 'col-new',
      });

      const result = await createCollection(payload);

      expect(postSpy).toHaveBeenCalledWith('/api/v1/collections', payload);
      expect(result.name).toBe('New Collection');
      expect(result.id).toBe('col-new');
    });

    it('propagates ApiClientError on 422 or 409', async () => {
      jest.spyOn(apiClient, 'post').mockRejectedValueOnce(
        new ApiClientError('Collection name cannot be empty', 422)
      );

      await expect(createCollection({ name: '' })).rejects.toThrow(ApiClientError);
    });
  });

  describe('getCollection', () => {
    it('calls GET /api/v1/collections/:id with encoded id', async () => {
      const getSpy = jest.spyOn(apiClient, 'get').mockResolvedValueOnce(mockCollection);

      const result = await getCollection('col-1');

      expect(getSpy).toHaveBeenCalledWith('/api/v1/collections/col-1');
      expect(result).toEqual(mockCollection);
    });

    it('propagates ApiClientError on 404', async () => {
      jest.spyOn(apiClient, 'get').mockRejectedValueOnce(
        new ApiClientError('Collection not found', 404)
      );

      await expect(getCollection('non-existent')).rejects.toThrow(ApiClientError);
    });
  });

  describe('updateCollection', () => {
    it('calls PATCH /api/v1/collections/:id with update payload', async () => {
      const updates = { name: 'Updated Name', color: '#EF4444' };
      const patchSpy = jest.spyOn(apiClient, 'patch').mockResolvedValueOnce({
        ...mockCollection,
        ...updates,
      });

      const result = await updateCollection('col-1', updates);

      expect(patchSpy).toHaveBeenCalledWith('/api/v1/collections/col-1', updates);
      expect(result.name).toBe('Updated Name');
      expect(result.color).toBe('#EF4444');
    });

    it('propagates ApiClientError on update failure', async () => {
      jest.spyOn(apiClient, 'patch').mockRejectedValueOnce(
        new ApiClientError('Collection not found', 404)
      );

      await expect(updateCollection('col-unknown', { name: 'Test' })).rejects.toThrow(ApiClientError);
    });
  });

  describe('deleteCollection', () => {
    it('calls DELETE /api/v1/collections/:id and returns void on 204', async () => {
      const deleteSpy = jest.spyOn(apiClient, 'delete').mockResolvedValueOnce(null);

      await expect(deleteCollection('col-1')).resolves.toBeUndefined();
      expect(deleteSpy).toHaveBeenCalledWith('/api/v1/collections/col-1');
    });

    it('propagates ApiClientError when delete fails', async () => {
      jest.spyOn(apiClient, 'delete').mockRejectedValueOnce(
        new ApiClientError('Cannot delete collection', 409)
      );

      await expect(deleteCollection('col-1')).rejects.toThrow(ApiClientError);
    });
  });

  describe('CollectionService backwards-compatibility adapter', () => {
    it('delegates getAll to listCollections', async () => {
      jest.spyOn(apiClient, 'get').mockResolvedValueOnce([mockCollection]);
      const res = await CollectionService.getAll();
      expect(res).toEqual([mockCollection]);
    });

    it('delegates create to createCollection', async () => {
      jest.spyOn(apiClient, 'post').mockResolvedValueOnce(mockCollection);
      const res = await CollectionService.create({ name: 'Test' });
      expect(res).toEqual(mockCollection);
    });

    it('delegates getById to getCollection', async () => {
      jest.spyOn(apiClient, 'get').mockResolvedValueOnce(mockCollection);
      const res = await CollectionService.getById('col-1');
      expect(res).toEqual(mockCollection);
    });

    it('delegates update to updateCollection', async () => {
      jest.spyOn(apiClient, 'patch').mockResolvedValueOnce(mockCollection);
      const res = await CollectionService.update('col-1', { name: 'Updated' });
      expect(res).toEqual(mockCollection);
    });

    it('delegates delete to deleteCollection and returns boolean', async () => {
      jest.spyOn(apiClient, 'delete').mockResolvedValueOnce(null);
      const res = await CollectionService.delete('col-1');
      expect(res).toBe(true);
    });
  });
});
