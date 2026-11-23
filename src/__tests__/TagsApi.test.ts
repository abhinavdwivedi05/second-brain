import {
  listTags,
  createTag,
  getTag,
  updateTag,
  deleteTag,
  TagService,
} from '@/services/api/tags';
import { apiClient, ApiClientError } from '@/services/api/client';
import { Tag } from '@/types';

describe('Tags API Service', () => {
  const mockTag: Tag = {
    id: 'tag-1',
    name: 'react',
    color: '#61DAFB',
    itemCount: 3,
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('listTags', () => {
    it('calls GET /api/v1/tags and returns list of tags', async () => {
      const getSpy = jest.spyOn(apiClient, 'get').mockResolvedValueOnce([mockTag]);

      const result = await listTags();

      expect(getSpy).toHaveBeenCalledWith('/api/v1/tags');
      expect(result).toEqual([mockTag]);
    });

    it('propagates ApiClientError when listTags fails', async () => {
      jest.spyOn(apiClient, 'get').mockRejectedValueOnce(
        new ApiClientError('Unauthorized', 401)
      );

      await expect(listTags()).rejects.toThrow(ApiClientError);
    });
  });

  describe('createTag', () => {
    it('calls POST /api/v1/tags with data payload and returns created tag', async () => {
      const payload = {
        name: 'typescript',
        color: '#3178C6',
      };
      const postSpy = jest.spyOn(apiClient, 'post').mockResolvedValueOnce({
        ...mockTag,
        ...payload,
        id: 'tag-ts',
      });

      const result = await createTag(payload);

      expect(postSpy).toHaveBeenCalledWith('/api/v1/tags', payload);
      expect(result.name).toBe('typescript');
      expect(result.id).toBe('tag-ts');
    });

    it('propagates ApiClientError on duplicate 409 conflict', async () => {
      jest.spyOn(apiClient, 'post').mockRejectedValueOnce(
        new ApiClientError('A tag with this name already exists', 409)
      );

      await expect(createTag({ name: 'react' })).rejects.toThrow(ApiClientError);
    });
  });

  describe('getTag', () => {
    it('calls GET /api/v1/tags/:id with encoded id', async () => {
      const getSpy = jest.spyOn(apiClient, 'get').mockResolvedValueOnce(mockTag);

      const result = await getTag('tag-1');

      expect(getSpy).toHaveBeenCalledWith('/api/v1/tags/tag-1');
      expect(result).toEqual(mockTag);
    });

    it('propagates ApiClientError on 404', async () => {
      jest.spyOn(apiClient, 'get').mockRejectedValueOnce(
        new ApiClientError('Tag not found', 404)
      );

      await expect(getTag('non-existent')).rejects.toThrow(ApiClientError);
    });
  });

  describe('updateTag', () => {
    it('calls PATCH /api/v1/tags/:id with update payload', async () => {
      const updates = { name: 'react-next', color: '#000000' };
      const patchSpy = jest.spyOn(apiClient, 'patch').mockResolvedValueOnce({
        ...mockTag,
        ...updates,
      });

      const result = await updateTag('tag-1', updates);

      expect(patchSpy).toHaveBeenCalledWith('/api/v1/tags/tag-1', updates);
      expect(result.name).toBe('react-next');
      expect(result.color).toBe('#000000');
    });

    it('propagates ApiClientError on duplicate conflict during update', async () => {
      jest.spyOn(apiClient, 'patch').mockRejectedValueOnce(
        new ApiClientError('A tag with this name already exists', 409)
      );

      await expect(updateTag('tag-1', { name: 'existing-tag' })).rejects.toThrow(ApiClientError);
    });
  });

  describe('deleteTag', () => {
    it('calls DELETE /api/v1/tags/:id and returns void on 204', async () => {
      const deleteSpy = jest.spyOn(apiClient, 'delete').mockResolvedValueOnce(null);

      await expect(deleteTag('tag-1')).resolves.toBeUndefined();
      expect(deleteSpy).toHaveBeenCalledWith('/api/v1/tags/tag-1');
    });

    it('propagates ApiClientError when delete fails', async () => {
      jest.spyOn(apiClient, 'delete').mockRejectedValueOnce(
        new ApiClientError('Cannot delete tag because it is referenced by other resources', 409)
      );

      await expect(deleteTag('tag-1')).rejects.toThrow(ApiClientError);
    });
  });

  describe('TagService backwards-compatibility adapter', () => {
    it('delegates getAll to listTags', async () => {
      jest.spyOn(apiClient, 'get').mockResolvedValueOnce([mockTag]);
      const res = await TagService.getAll();
      expect(res).toEqual([mockTag]);
    });

    it('delegates create to createTag', async () => {
      jest.spyOn(apiClient, 'post').mockResolvedValueOnce(mockTag);
      const res = await TagService.create({ name: 'test' });
      expect(res).toEqual(mockTag);
    });

    it('delegates getById to getTag', async () => {
      jest.spyOn(apiClient, 'get').mockResolvedValueOnce(mockTag);
      const res = await TagService.getById('tag-1');
      expect(res).toEqual(mockTag);
    });

    it('delegates update to updateTag', async () => {
      jest.spyOn(apiClient, 'patch').mockResolvedValueOnce(mockTag);
      const res = await TagService.update('tag-1', { name: 'updated' });
      expect(res).toEqual(mockTag);
    });

    it('delegates delete to deleteTag and returns boolean', async () => {
      jest.spyOn(apiClient, 'delete').mockResolvedValueOnce(null);
      const res = await TagService.delete('tag-1');
      expect(res).toBe(true);
    });

    it('ensureTagExists returns created tag or existing tag on 409', async () => {
      jest.spyOn(apiClient, 'post').mockRejectedValueOnce(
        new ApiClientError('A tag with this name already exists', 409)
      );
      jest.spyOn(apiClient, 'get').mockResolvedValueOnce([mockTag]);

      const res = await TagService.ensureTagExists('react');
      expect(res).toEqual(mockTag);
    });
  });
});
