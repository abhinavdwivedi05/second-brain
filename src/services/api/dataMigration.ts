import { Collection, Tag, KnowledgeItem } from '@/types';
import { listCollections, createCollection } from './collections';
import { listTags, createTag } from './tags';
import { listKnowledge, createKnowledgeItem } from './knowledge';

const COLLECTIONS_KEY = 'second_brain_collections_v1';
const TAGS_KEY = 'second_brain_tags_v1';
const KNOWLEDGE_KEY = 'second_brain_knowledge_v1';

const COLLECTIONS_MIGRATED_KEY = 'second_brain_collections_migrated_v1';
const TAGS_MIGRATED_KEY = 'second_brain_tags_migrated_v1';
const KNOWLEDGE_MIGRATED_KEY = 'second_brain_knowledge_migrated_v1';

/**
 * Safely migrate legacy LocalStorage collections to PostgreSQL via API if not yet migrated.
 * Does NOT delete the local storage key prematurely, ensuring zero data loss.
 */
export async function migrateCollectionsIfNeeded(currentBackendCols: Collection[]): Promise<Collection[]> {
  if (typeof window === 'undefined') return currentBackendCols;

  if (localStorage.getItem(COLLECTIONS_MIGRATED_KEY) === 'true') {
    return currentBackendCols;
  }

  const stored = localStorage.getItem(COLLECTIONS_KEY);
  if (!stored) {
    localStorage.setItem(COLLECTIONS_MIGRATED_KEY, 'true');
    return currentBackendCols;
  }

  try {
    const localCols: Collection[] = JSON.parse(stored);
    if (!Array.isArray(localCols) || localCols.length === 0) {
      localStorage.setItem(COLLECTIONS_MIGRATED_KEY, 'true');
      return currentBackendCols;
    }

    const existingNames = new Set(currentBackendCols.map((c) => c.name.trim().toLowerCase()));
    let migratedCount = 0;

    for (const col of localCols) {
      if (col && col.name && !existingNames.has(col.name.trim().toLowerCase())) {
        try {
          await createCollection({
            name: col.name.trim(),
            description: col.description || '',
            icon: col.icon || 'Folder',
            color: col.color || '#3B82F6',
          });
          existingNames.add(col.name.trim().toLowerCase());
          migratedCount++;
        } catch (err) {
          console.warn(`Could not migrate local collection "${col.name}":`, err);
        }
      }
    }

    localStorage.setItem(COLLECTIONS_MIGRATED_KEY, 'true');

    if (migratedCount > 0) {
      return await listCollections();
    }
  } catch (e) {
    console.error('Failed to parse or migrate local collections:', e);
  }

  return currentBackendCols;
}

/**
 * Safely migrate legacy LocalStorage tags to PostgreSQL via API if not yet migrated.
 * Does NOT delete the local storage key prematurely, ensuring zero data loss.
 */
export async function migrateTagsIfNeeded(currentBackendTags: Tag[]): Promise<Tag[]> {
  if (typeof window === 'undefined') return currentBackendTags;

  if (localStorage.getItem(TAGS_MIGRATED_KEY) === 'true') {
    return currentBackendTags;
  }

  const stored = localStorage.getItem(TAGS_KEY);
  if (!stored) {
    localStorage.setItem(TAGS_MIGRATED_KEY, 'true');
    return currentBackendTags;
  }

  try {
    const localTags: Tag[] = JSON.parse(stored);
    if (!Array.isArray(localTags) || localTags.length === 0) {
      localStorage.setItem(TAGS_MIGRATED_KEY, 'true');
      return currentBackendTags;
    }

    const existingNames = new Set(currentBackendTags.map((t) => t.name.trim().toLowerCase()));
    let migratedCount = 0;

    for (const tag of localTags) {
      const cleanName = tag?.name ? tag.name.replace(/^#/, '').trim() : '';
      if (cleanName && !existingNames.has(cleanName.toLowerCase())) {
        try {
          await createTag({
            name: cleanName,
            color: tag.color || '#3B82F6',
          });
          existingNames.add(cleanName.toLowerCase());
          migratedCount++;
        } catch (err) {
          console.warn(`Could not migrate local tag "${cleanName}":`, err);
        }
      }
    }

    localStorage.setItem(TAGS_MIGRATED_KEY, 'true');

    if (migratedCount > 0) {
      return await listTags();
    }
  } catch (e) {
    console.error('Failed to parse or migrate local tags:', e);
  }

  return currentBackendTags;
}

/**
 * Safely migrate legacy LocalStorage knowledge items to PostgreSQL via API.
 * Idempotent: checks existing titles to prevent duplication.
 * Does NOT delete the local storage key prematurely, ensuring zero data loss.
 */
export async function migrateKnowledgeIfNeeded(
  currentBackendKnowledge: KnowledgeItem[],
  availableCollections: Collection[] = []
): Promise<KnowledgeItem[]> {
  if (typeof window === 'undefined') return currentBackendKnowledge;

  if (localStorage.getItem(KNOWLEDGE_MIGRATED_KEY) === 'true') {
    return currentBackendKnowledge;
  }

  const stored = localStorage.getItem(KNOWLEDGE_KEY);
  if (!stored) {
    localStorage.setItem(KNOWLEDGE_MIGRATED_KEY, 'true');
    return currentBackendKnowledge;
  }

  try {
    const localItems: KnowledgeItem[] = JSON.parse(stored);
    if (!Array.isArray(localItems) || localItems.length === 0) {
      localStorage.setItem(KNOWLEDGE_MIGRATED_KEY, 'true');
      return currentBackendKnowledge;
    }

    const existingTitles = new Set(
      currentBackendKnowledge.map((k) => k.title.trim().toLowerCase())
    );

    // Map collection names to valid backend collection IDs
    const colNameToId = new Map<string, string>();
    for (const col of availableCollections) {
      colNameToId.set(col.name.trim().toLowerCase(), col.id);
    }

    let migratedCount = 0;

    for (const item of localItems) {
      const cleanTitle = item?.title ? item.title.trim() : '';
      if (cleanTitle && !existingTitles.has(cleanTitle.toLowerCase())) {
        // Resolve collection ID if valid
        let targetColId: string | undefined = undefined;
        if (item.collectionId && availableCollections.some((c) => c.id === item.collectionId)) {
          targetColId = item.collectionId;
        } else if (item.collectionName && colNameToId.has(item.collectionName.trim().toLowerCase())) {
          targetColId = colNameToId.get(item.collectionName.trim().toLowerCase());
        }

        try {
          await createKnowledgeItem({
            title: cleanTitle,
            type: item.type || 'NOTE',
            summary: item.summary || '',
            content: item.content || '',
            originalUrl: item.originalUrl,
            fileName: item.fileName,
            fileSize: item.fileSize,
            fileType: item.fileType,
            tags: item.tags || [],
            collectionId: targetColId,
            isFavorite: item.isFavorite || false,
            isArchived: item.isArchived || false,
            keyConcepts: item.keyConcepts || [],
            relatedKnowledgeIds: item.relatedKnowledgeIds || [],
            aiInsights: item.aiInsights || [],
            audioDuration: item.audioDuration,
          });
          existingTitles.add(cleanTitle.toLowerCase());
          migratedCount++;
        } catch (err) {
          console.warn(`Could not migrate local knowledge note "${cleanTitle}":`, err);
        }
      }
    }

    localStorage.setItem(KNOWLEDGE_MIGRATED_KEY, 'true');

    if (migratedCount > 0) {
      return await listKnowledge();
    }
  } catch (e) {
    console.error('Failed to parse or migrate local knowledge items:', e);
  }

  return currentBackendKnowledge;
}
