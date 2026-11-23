import { Collection } from '@/types';
import { apiClient } from './client';

export interface CreateCollectionDto {
  name: string;
  description?: string;
  icon?: string;
  color?: string;
}

export interface UpdateCollectionDto {
  name?: string;
  description?: string;
  icon?: string;
  color?: string;
}

export async function listCollections(): Promise<Collection[]> {
  return apiClient.get<Collection[]>('/api/v1/collections');
}

export async function createCollection(data: CreateCollectionDto): Promise<Collection> {
  return apiClient.post<Collection>('/api/v1/collections', data);
}

export async function getCollection(id: string): Promise<Collection> {
  return apiClient.get<Collection>(`/api/v1/collections/${encodeURIComponent(id)}`);
}

export async function updateCollection(id: string, data: UpdateCollectionDto): Promise<Collection> {
  return apiClient.patch<Collection>(`/api/v1/collections/${encodeURIComponent(id)}`, data);
}

export async function deleteCollection(id: string): Promise<void> {
  await apiClient.delete<void>(`/api/v1/collections/${encodeURIComponent(id)}`);
}

// Backwards-compatible service adapter for existing code
export class CollectionService {
  static async getAll(): Promise<Collection[]> {
    return listCollections();
  }

  static async create(data: CreateCollectionDto): Promise<Collection> {
    return createCollection(data);
  }

  static async getById(id: string): Promise<Collection> {
    return getCollection(id);
  }

  static async update(id: string, data: UpdateCollectionDto): Promise<Collection> {
    return updateCollection(id, data);
  }

  static async delete(id: string): Promise<boolean> {
    await deleteCollection(id);
    return true;
  }
}
