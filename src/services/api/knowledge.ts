import { KnowledgeItem, SearchFilterOptions, SearchResponse, UrlExtractResult } from '@/types';
import { apiClient } from './client';

export interface CreateKnowledgeDto {
  title: string;
  type?: string;
  summary?: string;
  content?: string;
  originalUrl?: string;
  fileName?: string;
  fileSize?: string;
  fileType?: string;
  tags?: string[];
  collectionId?: string;
  isFavorite?: boolean;
  isArchived?: boolean;
  keyConcepts?: string[];
  relatedKnowledgeIds?: string[];
  aiInsights?: string[];
  audioDuration?: string;
}

export interface UpdateKnowledgeDto {
  title?: string;
  type?: string;
  summary?: string;
  content?: string;
  originalUrl?: string;
  fileName?: string;
  fileSize?: string;
  fileType?: string;
  tags?: string[];
  collectionId?: string;
  isFavorite?: boolean;
  isArchived?: boolean;
  keyConcepts?: string[];
  relatedKnowledgeIds?: string[];
  aiInsights?: string[];
  audioDuration?: string;
}

export async function listKnowledge(options?: SearchFilterOptions): Promise<KnowledgeItem[]> {
  const params = new URLSearchParams();
  if (options?.query && options.query.trim()) {
    params.set('q', options.query.trim());
  }
  if (options?.type && options.type !== 'ALL') {
    params.set('type', options.type);
  }
  if (options?.collectionId) {
    params.set('collection_id', options.collectionId);
  }
  if (options?.tag) {
    params.set('tag', options.tag.replace(/^#/, '').trim());
  }
  if (options?.favoritesOnly) {
    params.set('favorites_only', 'true');
  }
  if (options?.sortBy) {
    params.set('sort_by', options.sortBy);
  }

  const queryStr = params.toString();
  const endpoint = `/api/v1/knowledge${queryStr ? `?${queryStr}` : ''}`;
  return apiClient.get<KnowledgeItem[]>(endpoint);
}

export async function getKnowledge(id: string): Promise<KnowledgeItem> {
  return apiClient.get<KnowledgeItem>(`/api/v1/knowledge/${encodeURIComponent(id)}`);
}

export async function createKnowledgeItem(data: CreateKnowledgeDto): Promise<KnowledgeItem> {
  return apiClient.post<KnowledgeItem>('/api/v1/knowledge', data);
}

export async function batchCreateKnowledge(items: CreateKnowledgeDto[]): Promise<KnowledgeItem[]> {
  return apiClient.post<KnowledgeItem[]>('/api/v1/knowledge/batch', items);
}

export async function updateKnowledgeItem(id: string, data: UpdateKnowledgeDto): Promise<KnowledgeItem> {
  return apiClient.patch<KnowledgeItem>(`/api/v1/knowledge/${encodeURIComponent(id)}`, data);
}

export async function deleteKnowledgeItem(id: string): Promise<void> {
  await apiClient.delete<void>(`/api/v1/knowledge/${encodeURIComponent(id)}`);
}

export async function toggleKnowledgeFavorite(id: string): Promise<KnowledgeItem> {
  return apiClient.post<KnowledgeItem>(`/api/v1/knowledge/${encodeURIComponent(id)}/favorite`);
}

export async function extractUrlContent(url: string): Promise<UrlExtractResult> {
  return apiClient.post<UrlExtractResult>('/api/v1/knowledge/extract-url', { url });
}

export async function importUrlKnowledge(data: {
  url: string;
  collectionId?: string;
  title?: string;
  summary?: string;
  content?: string;
  tags?: string[];
}): Promise<KnowledgeItem> {
  return apiClient.post<KnowledgeItem>('/api/v1/knowledge/import-url', {
    url: data.url,
    collection_id: data.collectionId,
    title: data.title,
    summary: data.summary,
    content: data.content,
    tags: data.tags,
  });
}

// Service class providing backwards compatibility and high-level methods
export class KnowledgeService {
  static async getAll(options?: SearchFilterOptions): Promise<KnowledgeItem[]> {
    return listKnowledge(options);
  }

  static async getById(id: string): Promise<KnowledgeItem | null> {
    try {
      return await getKnowledge(id);
    } catch {
      return null;
    }
  }

  static async create(newItem: Omit<KnowledgeItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<KnowledgeItem> {
    return createKnowledgeItem(newItem);
  }

  static async update(id: string, updates: Partial<KnowledgeItem>): Promise<KnowledgeItem | null> {
    try {
      return await updateKnowledgeItem(id, updates);
    } catch {
      return null;
    }
  }

  static async delete(id: string): Promise<boolean> {
    await deleteKnowledgeItem(id);
    return true;
  }

  static async toggleFavorite(id: string): Promise<KnowledgeItem | null> {
    try {
      return await toggleKnowledgeFavorite(id);
    } catch {
      return null;
    }
  }

  static async searchKnowledge(params: {
    q?: string;
    type?: string;
    collectionId?: string;
    tag?: string;
    isFavorite?: boolean;
    sortBy?: string;
    page?: number;
    pageSize?: number;
    signal?: AbortSignal;
  }): Promise<SearchResponse> {
    const {
      q,
      type,
      collectionId,
      tag,
      isFavorite,
      sortBy,
      page = 1,
      pageSize = 20,
      signal,
    } = params;

    const queryParams = new URLSearchParams();
    if (q && q.trim()) queryParams.set('q', q.trim());
    if (type && type !== 'ALL') queryParams.set('type', type);
    if (collectionId) queryParams.set('collection_id', collectionId);
    if (tag) queryParams.set('tag', tag.replace(/^#/, '').trim());
    if (isFavorite !== undefined) queryParams.set('is_favorite', String(isFavorite));
    if (sortBy) queryParams.set('sort_by', sortBy);
    queryParams.set('page', String(page));
    queryParams.set('page_size', String(pageSize));

    const queryStr = queryParams.toString();
    const endpoint = `/api/v1/search${queryStr ? `?${queryStr}` : ''}`;

    try {
      return await apiClient.get<SearchResponse>(endpoint, { signal });
    } catch (err: unknown) {
      if ((err as Error)?.name === 'AbortError') {
        throw err;
      }
      console.error('Search API request failed:', err);
      throw err;
    }
  }

  static async getRelatedItems(item: KnowledgeItem): Promise<KnowledgeItem[]> {
    try {
      const all = await this.getAll();
      return all
        .filter((other) => {
          if (other.id === item.id) return false;
          if (item.relatedKnowledgeIds && item.relatedKnowledgeIds.includes(other.id)) return true;
          if (item.collectionId && other.collectionId === item.collectionId) return true;
          if (item.tags && other.tags) {
            const sharedTags = other.tags.filter((t) => item.tags.includes(t));
            return sharedTags.length > 0;
          }
          return false;
        })
        .slice(0, 4);
    } catch {
      return [];
    }
  }

  static async extractUrl(url: string): Promise<UrlExtractResult> {
    return extractUrlContent(url);
  }

  static async importUrl(data: {
    url: string;
    collectionId?: string;
    title?: string;
    summary?: string;
    content?: string;
    tags?: string[];
  }): Promise<KnowledgeItem> {
    return importUrlKnowledge(data);
  }
}
