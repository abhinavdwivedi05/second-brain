import { Tag } from '@/types';
import { INITIAL_TAGS } from './mockData';

const TAGS_KEY = 'second_brain_tags_v1';

export class TagService {
  private static getStored(): Tag[] {
    if (typeof window === 'undefined') return INITIAL_TAGS;
    try {
      const stored = localStorage.getItem(TAGS_KEY);
      if (!stored) {
        localStorage.setItem(TAGS_KEY, JSON.stringify(INITIAL_TAGS));
        return INITIAL_TAGS;
      }
      return JSON.parse(stored);
    } catch {
      return INITIAL_TAGS;
    }
  }

  private static saveStored(items: Tag[]): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(TAGS_KEY, JSON.stringify(items));
    } catch (e) {
      console.error('Failed to save tags', e);
    }
  }

  static async getAll(): Promise<Tag[]> {
    return this.getStored();
  }

  static async ensureTagExists(name: string): Promise<Tag> {
    const clean = name.replace(/^#/, '').trim().toLowerCase();
    const list = this.getStored();
    const existing = list.find((t) => t.name.toLowerCase() === clean);
    if (existing) return existing;

    const colors = ['#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EC4899', '#EF4444', '#06B6D4'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    const created: Tag = {
      id: `tag-${Date.now()}`,
      name: clean,
      color: randomColor,
      itemCount: 1,
    };

    const updated = [...list, created];
    this.saveStored(updated);
    return created;
  }
}
