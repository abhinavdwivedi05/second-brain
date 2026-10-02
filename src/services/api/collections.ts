import { Collection } from '@/types';
import { INITIAL_COLLECTIONS } from './mockData';

const COLLECTIONS_KEY = 'second_brain_collections_v1';

export class CollectionService {
  private static getStored(): Collection[] {
    if (typeof window === 'undefined') return INITIAL_COLLECTIONS;
    try {
      const stored = localStorage.getItem(COLLECTIONS_KEY);
      if (!stored) {
        localStorage.setItem(COLLECTIONS_KEY, JSON.stringify(INITIAL_COLLECTIONS));
        return INITIAL_COLLECTIONS;
      }
      return JSON.parse(stored);
    } catch {
      return INITIAL_COLLECTIONS;
    }
  }

  private static saveStored(items: Collection[]): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(COLLECTIONS_KEY, JSON.stringify(items));
    } catch (e) {
      console.error('Failed to save collections', e);
    }
  }

  static async getAll(): Promise<Collection[]> {
    return this.getStored();
  }

  static async create(collection: Omit<Collection, 'id' | 'createdAt' | 'itemCount'>): Promise<Collection> {
    const list = this.getStored();
    const created: Collection = {
      ...collection,
      id: `col-${Date.now()}`,
      itemCount: 0,
      createdAt: new Date().toISOString(),
    };
    const updated = [...list, created];
    this.saveStored(updated);
    return created;
  }

  static async delete(id: string): Promise<boolean> {
    const list = this.getStored();
    const filtered = list.filter((c) => c.id !== id);
    this.saveStored(filtered);
    return true;
  }
}
