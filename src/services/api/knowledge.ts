import { KnowledgeItem, SearchFilterOptions, SearchResponse } from '@/types';
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
    q: string;
    page?: number;
    pageSize?: number;
  }): Promise<SearchResponse> {
    const { q, page = 1, pageSize = 20 } = params;
    const items = await this.getAll({ query: q });
    const total = items.length;
    const totalPages = Math.ceil(total / pageSize) || 1;
    const start = (page - 1) * pageSize;
    const paginatedItems = items.slice(start, start + pageSize);
    return {
      items: paginatedItems,
      page,
      pageSize,
      totalPages,
      total,
    };
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
}
