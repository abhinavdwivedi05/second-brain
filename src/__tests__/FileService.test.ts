import {
  uploadFile,
  listFiles,
  getFile,
  deleteFile,
  downloadFile,
  FileService,
} from '@/services/api/files';
import { apiClient } from '@/services/api/client';
import { UploadedFile } from '@/types';

jest.mock('@/services/api/client', () => {
  const actual = jest.requireActual('@/services/api/client');
  return {
    ...actual,
    apiClient: {
      get: jest.fn(),
      post: jest.fn(),
      delete: jest.fn(),
      patch: jest.fn(),
    },
    getStoredToken: jest.fn().mockReturnValue('mock-jwt-token'),
  };
});

describe('FileService and File API Client', () => {
  const mockUploadedFile: UploadedFile = {
    id: 'file-123',
    userId: 'user-abc',
    knowledgeId: 'k-999',
    originalFilename: 'architecture.pdf',
    storedFilename: 'arch-uuid.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 1048576, // 1 MB
    processingStatus: 'completed',
    createdAt: '2026-11-23T10:00:00Z',
    updatedAt: '2026-11-23T10:00:05Z',
    downloadUrl: '/api/v1/files/file-123/download',
    fileSizeFormatted: '1.00 MB',
    extractedText: 'Extracted PDF architecture diagram text',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('formatBytes helper', () => {
    it('formats 0 bytes correctly', () => {
      expect(FileService.formatBytes(0)).toBe('0 Bytes');
    });

    it('formats kilobytes correctly', () => {
      expect(FileService.formatBytes(1024)).toBe('1 KB');
    });

    it('formats megabytes correctly', () => {
      expect(FileService.formatBytes(1572864)).toBe('1.5 MB');
    });

    it('formats gigabytes correctly', () => {
      expect(FileService.formatBytes(1073741824)).toBe('1 GB');
    });
  });

  describe('uploadFile', () => {
    it('submits multipart/form-data to /api/v1/files/upload with correct parameters', async () => {
      (apiClient.post as jest.Mock).mockResolvedValueOnce(mockUploadedFile);

      const fakeFile = new File(['%PDF-1.4 dummy content'], 'architecture.pdf', {
        type: 'application/pdf',
      });

      const result = await uploadFile(fakeFile, {
        title: 'Architecture Blueprint',
        collectionId: 'col-1',
        tags: ['backend', 'infra'],
        createKnowledge: true,
      });

      expect(apiClient.post).toHaveBeenCalledWith(
        '/api/v1/files/upload',
        expect.any(FormData)
      );

      const sentFormData: FormData = (apiClient.post as jest.Mock).mock.calls[0][1];
      expect(sentFormData.get('title')).toBe('Architecture Blueprint');
      expect(sentFormData.get('collection_id')).toBe('col-1');
      expect(sentFormData.get('tags')).toBe('backend,infra');
      expect(sentFormData.get('create_knowledge')).toBe('true');
      expect(result).toEqual(mockUploadedFile);
    });
  });

  describe('listFiles', () => {
    it('requests files with query parameters', async () => {
      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        items: [mockUploadedFile],
        total: 1,
        limit: 20,
        offset: 0,
      });

      const res = await listFiles({ limit: 20, offset: 0, fileType: 'pdf', q: 'arch' });

      expect(apiClient.get).toHaveBeenCalledWith(
        '/api/v1/files?limit=20&offset=0&file_type=pdf&q=arch'
      );
      expect(res.items).toHaveLength(1);
      expect(res.total).toBe(1);
    });
  });

  describe('getFile', () => {
    it('retrieves single file metadata by id', async () => {
      (apiClient.get as jest.Mock).mockResolvedValueOnce(mockUploadedFile);

      const res = await getFile('file-123');

      expect(apiClient.get).toHaveBeenCalledWith('/api/v1/files/file-123');
      expect(res.id).toBe('file-123');
      expect(res.originalFilename).toBe('architecture.pdf');
    });
  });

  describe('deleteFile', () => {
    it('calls DELETE /api/v1/files/:id', async () => {
      (apiClient.delete as jest.Mock).mockResolvedValueOnce(null);

      const res = await deleteFile('file-123');

      expect(apiClient.delete).toHaveBeenCalledWith('/api/v1/files/file-123');
      expect(res).toBe(true);
    });
  });

  describe('downloadFile', () => {
    it('fetches blob with auth and triggers browser download anchor', async () => {
      const mockBlob = new Blob(['%PDF-1.4 binary content'], { type: 'application/pdf' });
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        blob: jest.fn().mockResolvedValueOnce(mockBlob),
      });

      const mockCreateObjectURL = jest.fn().mockReturnValue('blob:http://localhost/mock-url');
      const mockRevokeObjectURL = jest.fn();
      window.URL.createObjectURL = mockCreateObjectURL;
      window.URL.revokeObjectURL = mockRevokeObjectURL;

      const realAnchor = document.createElement('a');
      const clickSpy = jest.spyOn(realAnchor, 'click').mockImplementation(() => {});
      const createElementSpy = jest.spyOn(document, 'createElement').mockReturnValue(realAnchor);

      await downloadFile('file-123', 'downloaded-spec.pdf');

      expect(global.fetch).toHaveBeenCalledWith(
        'http://127.0.0.1:8000/api/v1/files/file-123/download',
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: 'Bearer mock-jwt-token' }),
        })
      );
      expect(mockCreateObjectURL).toHaveBeenCalledWith(mockBlob);
      expect(clickSpy).toHaveBeenCalled();
      expect(realAnchor.download).toBe('downloaded-spec.pdf');

      createElementSpy.mockRestore();
      clickSpy.mockRestore();
    });
  });
});

