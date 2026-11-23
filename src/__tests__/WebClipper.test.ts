import {
  KnowledgeService,
  extractUrlContent,
  importUrlKnowledge,
} from '@/services/api/knowledge';
import { apiClient } from '@/services/api/client';
import { KnowledgeItem, UrlExtractResult } from '@/types';

describe('Web Clipper API Service', () => {
  const mockExtractResult: UrlExtractResult = {
    title: 'PostgreSQL MVCC Architecture',
    originalUrl: 'https://example.com/postgres-mvcc',
    canonicalUrl: 'https://example.com/postgres-mvcc',
    domain: 'example.com',
    description: 'A deep dive into transaction isolation and tuple visibility in PostgreSQL.',
    content: '# PostgreSQL MVCC\n\nPostgreSQL uses MVCC for high-concurrency performance.',
    summary: 'Overview of PostgreSQL MVCC architecture and tuple visibility.',
    tags: ['postgresql', 'database', 'mvcc'],
    keyConcepts: ['MVCC', 'PostgreSQL', 'Transactions'],
    wordCount: 120,
    extractionStatus: 'SUCCESS',
  };

  const mockImportedKnowledge: KnowledgeItem = {
    id: 'k-link-1',
    title: 'PostgreSQL MVCC Architecture',
    type: 'LINK',
    summary: 'Overview of PostgreSQL MVCC architecture and tuple visibility.',
    content: '# PostgreSQL MVCC\n\nPostgreSQL uses MVCC for high-concurrency performance.',
    originalUrl: 'https://example.com/postgres-mvcc',
    fileName: 'example.com',
    tags: ['postgresql', 'database', 'mvcc'],
    isFavorite: false,
    isArchived: false,
    createdAt: '2026-11-23T12:00:00Z',
    updatedAt: '2026-11-23T12:00:00Z',
    processingStatus: 'COMPLETED',
    processingProgress: 100,
    keyConcepts: ['MVCC', 'PostgreSQL', 'Transactions'],
    relatedKnowledgeIds: [],
  };

  beforeEach(() => {
    jest.restoreAllMocks();
  });

  describe('extractUrlContent', () => {
    it('calls POST /api/v1/knowledge/extract-url with the provided URL', async () => {
      const postSpy = jest.spyOn(apiClient, 'post').mockResolvedValueOnce(mockExtractResult);

      const result = await extractUrlContent('https://example.com/postgres-mvcc');

      expect(postSpy).toHaveBeenCalledWith('/api/v1/knowledge/extract-url', {
        url: 'https://example.com/postgres-mvcc',
      });
      expect(result).toEqual(mockExtractResult);
      expect(result.domain).toBe('example.com');
      expect(result.tags).toContain('postgresql');
    });

    it('propagates errors when extract URL fails', async () => {
      jest.spyOn(apiClient, 'post').mockRejectedValueOnce(new Error('Security rejection: Access prohibited'));

      await expect(extractUrlContent('http://localhost:8000')).rejects.toThrow(
        'Security rejection: Access prohibited'
      );
    });
  });

  describe('importUrlKnowledge', () => {
    it('calls POST /api/v1/knowledge/import-url with structured data and returns saved item', async () => {
      const postSpy = jest.spyOn(apiClient, 'post').mockResolvedValueOnce(mockImportedKnowledge);

      const result = await importUrlKnowledge({
        url: 'https://example.com/postgres-mvcc',
        title: 'PostgreSQL MVCC Architecture',
        summary: 'Overview of PostgreSQL MVCC architecture.',
        content: '# PostgreSQL MVCC\n\nFull text content.',
        collectionId: 'col-db-1',
        tags: ['postgresql', 'database'],
      });

      expect(postSpy).toHaveBeenCalledWith('/api/v1/knowledge/import-url', {
        url: 'https://example.com/postgres-mvcc',
        collection_id: 'col-db-1',
        title: 'PostgreSQL MVCC Architecture',
        summary: 'Overview of PostgreSQL MVCC architecture.',
        content: '# PostgreSQL MVCC\n\nFull text content.',
        tags: ['postgresql', 'database'],
      });
      expect(result.id).toBe('k-link-1');
      expect(result.type).toBe('LINK');
      expect(result.originalUrl).toBe('https://example.com/postgres-mvcc');
    });
  });

  describe('KnowledgeService static helper delegation', () => {
    it('delegates extractUrl to extractUrlContent', async () => {
      const postSpy = jest.spyOn(apiClient, 'post').mockResolvedValueOnce(mockExtractResult);

      const res = await KnowledgeService.extractUrl('https://example.com/postgres-mvcc');
      expect(postSpy).toHaveBeenCalledWith('/api/v1/knowledge/extract-url', {
        url: 'https://example.com/postgres-mvcc',
      });
      expect(res.title).toBe('PostgreSQL MVCC Architecture');
    });

    it('delegates importUrl to importUrlKnowledge', async () => {
      const postSpy = jest.spyOn(apiClient, 'post').mockResolvedValueOnce(mockImportedKnowledge);

      const res = await KnowledgeService.importUrl({
        url: 'https://example.com/postgres-mvcc',
      });
      expect(postSpy).toHaveBeenCalledWith('/api/v1/knowledge/import-url', expect.objectContaining({
        url: 'https://example.com/postgres-mvcc',
      }));
      expect(res.type).toBe('LINK');
    });
  });
});

