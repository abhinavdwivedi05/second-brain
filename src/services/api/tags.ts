import { Tag } from '@/types';
import { apiClient, ApiClientError } from './client';

export interface CreateTagDto {
  name: string;
  color?: string;
}

export interface UpdateTagDto {
  name?: string;
  color?: string;
}

export async function listTags(): Promise<Tag[]> {
  return apiClient.get<Tag[]>('/api/v1/tags');
}

export async function createTag(data: CreateTagDto): Promise<Tag> {
  return apiClient.post<Tag>('/api/v1/tags', data);
}

export async function getTag(id: string): Promise<Tag> {
  return apiClient.get<Tag>(`/api/v1/tags/${encodeURIComponent(id)}`);
}

export async function updateTag(id: string, data: UpdateTagDto): Promise<Tag> {
  return apiClient.patch<Tag>(`/api/v1/tags/${encodeURIComponent(id)}`, data);
}

export async function deleteTag(id: string): Promise<void> {
  await apiClient.delete<void>(`/api/v1/tags/${encodeURIComponent(id)}`);
}

// Backwards-compatible service adapter for existing code
export class TagService {
  static async getAll(): Promise<Tag[]> {
    return listTags();
  }

  static async create(data: CreateTagDto): Promise<Tag> {
    return createTag(data);
  }

  static async getById(id: string): Promise<Tag> {
    return getTag(id);
  }

  static async update(id: string, data: UpdateTagDto): Promise<Tag> {
    return updateTag(id, data);
  }

  static async delete(id: string): Promise<boolean> {
    await deleteTag(id);
    return true;
  }

  static async ensureTagExists(name: string): Promise<Tag | null> {
    const clean = name.replace(/^#/, '').trim();
    if (!clean) return null;

    try {
      return await createTag({ name: clean });
    } catch (err: any) {
      if (err instanceof ApiClientError && err.status === 409) {
        try {
          const tags = await listTags();
          return tags.find((t) => t.name.toLowerCase() === clean.toLowerCase()) || null;
        } catch {
          return null;
        }
      }
      if (err instanceof ApiClientError && err.status === 401) {
        return null;
      }
      throw err;
    }
  }
}
