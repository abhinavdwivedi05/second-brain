import { KnowledgeItem, SearchFilterOptions, KnowledgeType } from '@/types';
import { INITIAL_KNOWLEDGE } from './mockData';

const STORAGE_KEY = 'second_brain_knowledge_v1';

export class KnowledgeService {
  private static getStoredItems(): KnowledgeItem[] {
    if (typeof window === 'undefined') return INITIAL_KNOWLEDGE;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_KNOWLEDGE));
        return INITIAL_KNOWLEDGE;
      }
      return JSON.parse(stored);
    } catch {
      return INITIAL_KNOWLEDGE;
    }
  }

  private static saveStoredItems(items: KnowledgeItem[]): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (e) {
      console.error('Failed to persist knowledge items to localStorage', e);
    }
  }

  static async searchKnowledge(params: { q: string; page?: number; pageSize?: number }): Promise<{ items: KnowledgeItem[]; page: number; pageSize: number; totalPages: number; total: number }> {
    const { q, page = 1, pageSize = 20 } = params;
    // Reuse getAll with query filtering
    const allItems = await this.getAll({ query: q });
    const total = allItems.length;
    const totalPages = Math.ceil(total / pageSize);
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const items = allItems.slice(start, end);
    return { items, page, pageSize, totalPages, total };
  }

  static async getAll(options?: SearchFilterOptions): Promise<KnowledgeItem[]> {
    let items = this.getStoredItems();

    if (!options) return items;

    const { query, type, collectionId, tag, favoritesOnly, sortBy } = options;

    if (query && query.trim()) {
      const q = query.toLowerCase().trim();
      items = items.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.summary.toLowerCase().includes(q) ||
          item.content.toLowerCase().includes(q) ||
          item.tags.some((t) => t.toLowerCase().includes(q)) ||
          item.keyConcepts.some((kc) => kc.toLowerCase().includes(q))
      );
    }

    if (type && type !== 'ALL') {
      items = items.filter((item) => item.type === type);
    }

    if (collectionId) {
      items = items.filter((item) => item.collectionId === collectionId);
    }

    if (tag) {
      const cleanTag = tag.replace(/^#/, '').toLowerCase();
      items = items.filter((item) =>
        item.tags.some((t) => t.toLowerCase() === cleanTag)
      );
    }

    if (favoritesOnly) {
      items = items.filter((item) => item.isFavorite);
    }

    // Sorting
    items = [...items].sort((a, b) => {
      if (sortBy === 'oldest') {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      if (sortBy === 'title') {
        return a.title.localeCompare(b.title);
      }
      if (sortBy === 'recently_accessed') {
        const timeA = a.lastAccessedAt ? new Date(a.lastAccessedAt).getTime() : 0;
        const timeB = b.lastAccessedAt ? new Date(b.lastAccessedAt).getTime() : 0;
        return timeB - timeA;
      }
      // default: newest
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return items;
  }


  static async getById(id: string): Promise<KnowledgeItem | null> {
    const items = this.getStoredItems();
    const item = items.find((i) => i.id === id);
    if (!item) return null;

    // Update last accessed
    const updatedItems = items.map((i) =>
      i.id === id ? { ...i, lastAccessedAt: new Date().toISOString() } : i
    );
    this.saveStoredItems(updatedItems);
    return { ...item, lastAccessedAt: new Date().toISOString() };
  }

  static async toggleFavorite(id: string): Promise<KnowledgeItem | null> {
    const items = this.getStoredItems();
    let updatedItem: KnowledgeItem | null = null;

    const updatedItems = items.map((i) => {
      if (i.id === id) {
        updatedItem = { ...i, isFavorite: !i.isFavorite, updatedAt: new Date().toISOString() };
        return updatedItem;
      }
      return i;
    });

    this.saveStoredItems(updatedItems);
    return updatedItem;
  }

  static async create(newItem: Omit<KnowledgeItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<KnowledgeItem> {
    const items = this.getStoredItems();
    const created: KnowledgeItem = {
      ...newItem,
      id: `k-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastAccessedAt: new Date().toISOString(),
    };

    const updatedList = [created, ...items];
    this.saveStoredItems(updatedList);
    return created;
  }

  static async update(id: string, updates: Partial<KnowledgeItem>): Promise<KnowledgeItem | null> {
    const items = this.getStoredItems();
    let updatedItem: KnowledgeItem | null = null;

    const updatedItems = items.map((i) => {
      if (i.id === id) {
        updatedItem = { ...i, ...updates, updatedAt: new Date().toISOString() };
        return updatedItem;
      }
      return i;
    });

    this.saveStoredItems(updatedItems);
    return updatedItem;
  }

  static async delete(id: string): Promise<boolean> {
    const items = this.getStoredItems();
    const filtered = items.filter((i) => i.id !== id);
    this.saveStoredItems(filtered);
    return true;
  }

  static async getRelatedItems(item: KnowledgeItem): Promise<KnowledgeItem[]> {
    const all = this.getStoredItems();
    // Match by explicit related ids OR shared tags OR shared collection
    return all.filter((other) => {
      if (other.id === item.id) return false;
      if (item.relatedKnowledgeIds.includes(other.id)) return true;
      if (item.collectionId && other.collectionId === item.collectionId) return true;
      const sharedTags = other.tags.filter((t) => item.tags.includes(t));
      return sharedTags.length > 0;
    }).slice(0, 4);
  }
}
