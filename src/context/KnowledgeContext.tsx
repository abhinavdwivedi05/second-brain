'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  KnowledgeItem,
  Collection,
  Tag,
  UserProfile,
  ActivityLog,
  KnowledgeType,
  SearchFilterOptions,
  DashboardStats,
} from '@/types';
import {
  KnowledgeService,
  listKnowledge,
  createKnowledgeItem,
  updateKnowledgeItem,
  deleteKnowledgeItem,
  toggleKnowledgeFavorite,
} from '@/services/api/knowledge';
import {
  listCollections,
  createCollection as apiCreateCollection,
  updateCollection as apiUpdateCollection,
  deleteCollection as apiDeleteCollection,
} from '@/services/api/collections';
import {
  listTags,
  createTag as apiCreateTag,
  updateTag as apiUpdateTag,
  deleteTag as apiDeleteTag,
} from '@/services/api/tags';
import { fetchDashboardStats, fetchActivities } from '@/services/api/dashboard';
import {
  migrateCollectionsIfNeeded,
  migrateTagsIfNeeded,
  migrateKnowledgeIfNeeded,
} from '@/services/api/dataMigration';
import { INITIAL_USER } from '@/services/api/mockData';
import { AuthContext } from '@/context/AuthContext';
import { ApiClientError } from '@/services/api/client';

export type ActiveView =
  | 'dashboard'
  | 'library'
  | 'detail'
  | 'collections'
  | 'tags'
  | 'settings'
  | 'landing';

export type ViewMode = 'grid' | 'list' | 'compact';

interface KnowledgeContextType {
  // Navigation & View
  activeView: ActiveView;
  setActiveView: (view: ActiveView) => void;
  activeItem: KnowledgeItem | null;
  setActiveItem: (item: KnowledgeItem | null) => void;
  openDetailView: (item: KnowledgeItem) => void;

  // Filter & Search State
  filterOptions: SearchFilterOptions;
  setFilterOptions: React.Dispatch<React.SetStateAction<SearchFilterOptions>>;
  resetFilters: () => void;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;

  // Data
  knowledgeItems: KnowledgeItem[];
  collections: Collection[];
  tags: Tag[];
  user: UserProfile;
  activities: ActivityLog[];
  dashboardStats: DashboardStats | null;
  refreshDashboard: () => Promise<void>;
  isLoading: boolean;

  // Error States
  knowledgeError: string | null;
  collectionsError: string | null;
  tagsError: string | null;
  clearKnowledgeError: () => void;
  clearCollectionsError: () => void;
  clearTagsError: () => void;

  // Modals & Drawers
  isAddModalOpen: boolean;
  setIsAddModalOpen: (open: boolean) => void;
  isCommandPaletteOpen: boolean;
  setIsCommandPaletteOpen: (open: boolean) => void;
  isAiDrawerOpen: boolean;
  setIsAiDrawerOpen: (open: boolean) => void;
  isSidebarCollapsed: boolean;
  setIsSidebarCollapsed: (collapsed: boolean) => void;

  // Actions
  toggleFavorite: (id: string) => Promise<void>;
  toggleArchive: (id: string) => Promise<void>;
  createKnowledge: (data: Partial<KnowledgeItem> & { title: string }) => Promise<KnowledgeItem>;
  updateKnowledge: (id: string, updates: Partial<KnowledgeItem>) => Promise<KnowledgeItem | null>;
  deleteKnowledge: (id: string) => Promise<void>;
  createCollection: (data: Omit<Collection, 'id' | 'createdAt' | 'itemCount'>) => Promise<Collection>;
  updateCollection: (id: string, data: Partial<Omit<Collection, 'id' | 'createdAt' | 'itemCount'>>) => Promise<Collection>;
  deleteCollection: (id: string) => Promise<void>;
  createTag: (data: { name: string; color?: string }) => Promise<Tag>;
  updateTag: (id: string, data: { name?: string; color?: string }) => Promise<Tag>;
  deleteTag: (id: string) => Promise<void>;
  refreshAllData: () => Promise<void>;
  
  // Helpers
  selectTagFilter: (tagName: string) => void;
  selectCollectionFilter: (collectionId: string) => void;
  selectTypeFilter: (type: KnowledgeType | 'ALL') => void;
}

const KnowledgeContext = createContext<KnowledgeContextType | undefined>(undefined);

export function KnowledgeProvider({ children }: { children: React.ReactNode }) {
  const [activeView, setActiveView] = useState<ActiveView>('dashboard');
  const [activeItem, setActiveItem] = useState<KnowledgeItem | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  const [filterOptions, setFilterOptions] = useState<SearchFilterOptions>({
    query: '',
    type: 'ALL',
    collectionId: undefined,
    tag: undefined,
    favoritesOnly: false,
    sortBy: 'newest',
  });

  const [knowledgeItems, setKnowledgeItems] = useState<KnowledgeItem[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const authContext = useContext(AuthContext);
  const user = authContext?.user || INITIAL_USER;
  const isAuthenticated = authContext?.isAuthenticated ?? false;
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [knowledgeError, setKnowledgeError] = useState<string | null>(null);
  const [collectionsError, setCollectionsError] = useState<string | null>(null);
  const [tagsError, setTagsError] = useState<string | null>(null);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState<boolean>(false);
  const [isAiDrawerOpen, setIsAiDrawerOpen] = useState<boolean>(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);

  const refreshDashboard = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const stats = await fetchDashboardStats();
      setDashboardStats(stats);
      if (stats.recentActivities) {
        setActivities(stats.recentActivities);
      }
    } catch (err) {
      console.error('Failed to refresh dashboard stats:', err);
    }
  }, [isAuthenticated]);

  const refreshAllData = useCallback(async () => {
    setIsLoading(true);
    try {
      if (isAuthenticated) {
        try {
          const [fetchedKnowledge, fetchedCols, fetchedTags, fetchedStats, fetchedActivities] = await Promise.all([
            listKnowledge(filterOptions),
            listCollections(),
            listTags(),
            fetchDashboardStats().catch(() => null),
            fetchActivities(20).catch(() => []),
          ]);

          // Safe one-time legacy migration if needed
          const cols = await migrateCollectionsIfNeeded(fetchedCols);
          const tgs = await migrateTagsIfNeeded(fetchedTags);
          const items = await migrateKnowledgeIfNeeded(fetchedKnowledge, cols);

          setKnowledgeItems(items);
          setCollections(cols);
          setTags(tgs);
          if (fetchedStats) setDashboardStats(fetchedStats);
          if (fetchedActivities && fetchedActivities.length > 0) {
            setActivities(fetchedActivities);
          } else if (fetchedStats && fetchedStats.recentActivities) {
            setActivities(fetchedStats.recentActivities);
          } else {
            setActivities([]);
          }
          setKnowledgeError(null);
          setCollectionsError(null);
          setTagsError(null);
        } catch (apiErr: unknown) {
          console.error('Failed to load data from API:', apiErr);
          if (apiErr instanceof ApiClientError && apiErr.status === 401) {
            setKnowledgeItems([]);
            setCollections([]);
            setTags([]);
            setActivities([]);
            setDashboardStats(null);
          } else {
            const errorMsg = (apiErr as Error)?.message || 'Failed to load knowledge records from server';
            setKnowledgeError(errorMsg);
            setCollectionsError(errorMsg);
            setTagsError(errorMsg);
          }
        }
      } else {
        setKnowledgeItems([]);
        setCollections([]);
        setTags([]);
        setActivities([]);
        setDashboardStats(null);
      }
    } catch (err: unknown) {
      console.error('Failed to load knowledge data:', err);
      setKnowledgeError((err as Error)?.message || 'Error synchronizing data');
    } finally {
      setIsLoading(false);
    }
  }, [filterOptions, isAuthenticated]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshAllData();
  }, [refreshAllData]);

  // Command palette keyboard listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const openDetailView = (item: KnowledgeItem) => {
    setActiveItem(item);
    setActiveView('detail');
    KnowledgeService.getById(item.id); // Trigger lastAccessedAt update
  };

  const toggleFavorite = async (id: string) => {
    try {
      const updated = await toggleKnowledgeFavorite(id);
      if (updated) {
        setKnowledgeItems((prev) => prev.map((k) => (k.id === id ? updated : k)));
        if (activeItem && activeItem.id === id) {
          setActiveItem(updated);
        }
      }
    } catch (err: unknown) {
      console.error('Failed to toggle favorite:', err);
      setKnowledgeError((err as Error)?.message || 'Failed to toggle favorite');
    }
  };

  const toggleArchive = async (id: string) => {
    const target = knowledgeItems.find((k) => k.id === id) || (activeItem?.id === id ? activeItem : null);
    if (!target) return;
    try {
      const updated = await updateKnowledgeItem(id, { isArchived: !target.isArchived });
      setKnowledgeItems((prev) => prev.map((k) => (k.id === id ? updated : k)));
      if (activeItem && activeItem.id === id) {
        setActiveItem(updated);
      }
    } catch (err: unknown) {
      console.error('Failed to toggle archive:', err);
      setKnowledgeError((err as Error)?.message || 'Failed to toggle archive');
    }
  };

  const createKnowledge = async (
    data: Partial<KnowledgeItem> & { title: string }
  ): Promise<KnowledgeItem> => {
    setKnowledgeError(null);
    try {
      const created = await createKnowledgeItem(data);

      // Re-fetch tags and collections to refresh accurate item counts
      if (isAuthenticated) {
        Promise.all([listCollections(), listTags()])
          .then(([cols, tgs]) => {
            setCollections(cols);
            setTags(tgs);
          })
          .catch(() => {});
      }

      // Add activity log
      const newActivity: ActivityLog = {
        id: `act-${Date.now()}`,
        action: 'CREATED',
        knowledgeId: created.id,
        knowledgeTitle: created.title,
        timestamp: new Date().toISOString(),
        type: created.type,
      };
      setActivities((prev) => [newActivity, ...prev]);

      // Optimistically prepend created item
      setKnowledgeItems((prev) => [created, ...prev.filter((k) => k.id !== created.id)]);
      return created;
    } catch (err: unknown) {
      console.error('Failed to create knowledge note:', err);
      const msg = (err as Error)?.message || 'Failed to create knowledge note';
      setKnowledgeError(msg);
      throw err;
    }
  };

  const updateKnowledge = async (id: string, updates: Partial<KnowledgeItem>): Promise<KnowledgeItem | null> => {
    setKnowledgeError(null);
    try {
      const updated = await updateKnowledgeItem(id, updates);
      setKnowledgeItems((prev) => prev.map((k) => (k.id === id ? updated : k)));
      if (activeItem && activeItem.id === id) {
        setActiveItem(updated);
      }

      // Refresh collections/tags counts if collectionId or tags changed
      if (updates.collectionId !== undefined || updates.tags !== undefined) {
        Promise.all([listCollections(), listTags()])
          .then(([cols, tgs]) => {
            setCollections(cols);
            setTags(tgs);
          })
          .catch(() => {});
      }

      return updated;
    } catch (err: unknown) {
      console.error('Failed to update knowledge note:', err);
      const msg = (err as Error)?.message || 'Failed to update knowledge note';
      setKnowledgeError(msg);
      throw err;
    }
  };

  const deleteKnowledge = async (id: string): Promise<void> => {
    setKnowledgeError(null);
    try {
      await deleteKnowledgeItem(id);
      setKnowledgeItems((prev) => prev.filter((k) => k.id !== id));
      if (activeItem?.id === id) {
        setActiveItem(null);
        setActiveView('library');
      }

      // Refresh collections and tags to reflect decremented item counts
      if (isAuthenticated) {
        Promise.all([listCollections(), listTags()])
          .then(([cols, tgs]) => {
            setCollections(cols);
            setTags(tgs);
          })
          .catch(() => {});
      }
    } catch (err: unknown) {
      console.error('Failed to delete knowledge note:', err);
      const msg = (err as Error)?.message || 'Failed to delete knowledge note';
      setKnowledgeError(msg);
      throw err;
    }
  };

  const createCollection = async (
    data: Omit<Collection, 'id' | 'createdAt' | 'itemCount'>
  ): Promise<Collection> => {
    try {
      setCollectionsError(null);
      const created = await apiCreateCollection({
        name: data.name,
        description: data.description,
        icon: data.icon,
        color: data.color,
      });
      setCollections((prev) => [created, ...prev]);
      return created;
    } catch (err: unknown) {
      console.error('Failed to create collection:', err);
      const msg = (err as Error)?.message || 'Failed to create collection';
      setCollectionsError(msg);
      throw err;
    }
  };

  const updateCollection = async (
    id: string,
    data: Partial<Omit<Collection, 'id' | 'createdAt' | 'itemCount'>>
  ): Promise<Collection> => {
    try {
      setCollectionsError(null);
      const updated = await apiUpdateCollection(id, data);
      setCollections((prev) => prev.map((c) => (c.id === id ? updated : c)));
      return updated;
    } catch (err: unknown) {
      console.error('Failed to update collection:', err);
      const msg = (err as Error)?.message || 'Failed to update collection';
      setCollectionsError(msg);
      throw err;
    }
  };

  const deleteCollection = async (id: string): Promise<void> => {
    try {
      setCollectionsError(null);
      await apiDeleteCollection(id);
      setCollections((prev) => prev.filter((c) => c.id !== id));
      if (filterOptions.collectionId === id) {
        setFilterOptions((prev) => ({ ...prev, collectionId: undefined }));
      }
      // Update in-memory knowledge items that belonged to this collection
      setKnowledgeItems((prev) =>
        prev.map((item) =>
          item.collectionId === id ? { ...item, collectionId: undefined, collection: undefined } : item
        )
      );
    } catch (err: unknown) {
      console.error('Failed to delete collection:', err);
      const msg = (err as Error)?.message || 'Failed to delete collection';
      setCollectionsError(msg);
      throw err;
    }
  };

  const createTag = async (data: { name: string; color?: string }): Promise<Tag> => {
    try {
      setTagsError(null);
      const created = await apiCreateTag(data);
      setTags((prev) => [...prev, created]);
      return created;
    } catch (err: unknown) {
      console.error('Failed to create tag:', err);
      const msg = (err as Error)?.message || 'Failed to create tag';
      setTagsError(msg);
      throw err;
    }
  };

  const updateTag = async (id: string, data: { name?: string; color?: string }): Promise<Tag> => {
    try {
      setTagsError(null);
      const updated = await apiUpdateTag(id, data);
      setTags((prev) => prev.map((t) => (t.id === id ? updated : t)));
      return updated;
    } catch (err: unknown) {
      console.error('Failed to update tag:', err);
      const msg = (err as Error)?.message || 'Failed to update tag';
      setTagsError(msg);
      throw err;
    }
  };

  const deleteTag = async (id: string): Promise<void> => {
    try {
      setTagsError(null);
      await apiDeleteTag(id);
      setTags((prev) => prev.filter((t) => t.id !== id));
      if (filterOptions.tag) {
        const deletedTag = tags.find((t) => t.id === id);
        if (deletedTag && filterOptions.tag === deletedTag.name) {
          setFilterOptions((prev) => ({ ...prev, tag: undefined }));
        }
      }
      refreshAllData();
    } catch (err: unknown) {
      console.error('Failed to delete tag:', err);
      const msg = (err as Error)?.message || 'Failed to delete tag';
      setTagsError(msg);
      throw err;
    }
  };

  const clearKnowledgeError = () => setKnowledgeError(null);
  const clearCollectionsError = () => setCollectionsError(null);
  const clearTagsError = () => setTagsError(null);

  const resetFilters = () => {
    setActiveItem(null);
    setFilterOptions({
      query: '',
      type: 'ALL',
      collectionId: undefined,
      tag: undefined,
      favoritesOnly: false,
      sortBy: 'newest',
    });
  };

  const selectTagFilter = (tagName: string) => {
    resetFilters();
    setActiveItem(null);
    setFilterOptions((prev) => ({ ...prev, tag: tagName }));
    setActiveView('library');
  };

  const selectCollectionFilter = (collectionId: string) => {
    resetFilters();
    setActiveItem(null);
    setFilterOptions((prev) => ({ ...prev, collectionId }));
    setActiveView('library');
  };

  const selectTypeFilter = (type: KnowledgeType | 'ALL') => {
    setActiveItem(null);
    setFilterOptions((prev) => ({ ...prev, type }));
    setActiveView('library');
  };

  return (
    <KnowledgeContext.Provider
      value={{
        activeView,
        setActiveView,
        activeItem,
        setActiveItem,
        openDetailView,
        filterOptions,
        setFilterOptions,
        resetFilters,
        viewMode,
        setViewMode,
        knowledgeItems,
        collections,
        tags,
        user,
        activities,
        dashboardStats,
        refreshDashboard,
        isLoading,
        knowledgeError,
        collectionsError,
        tagsError,
        clearKnowledgeError,
        clearCollectionsError,
        clearTagsError,
        isAddModalOpen,
        setIsAddModalOpen,
        isCommandPaletteOpen,
        setIsCommandPaletteOpen,
        isAiDrawerOpen,
        setIsAiDrawerOpen,
        isSidebarCollapsed,
        setIsSidebarCollapsed,
        toggleFavorite,
        toggleArchive,
        createKnowledge,
        updateKnowledge,
        deleteKnowledge,
        createCollection,
        updateCollection,
        deleteCollection,
        createTag,
        updateTag,
        deleteTag,
        refreshAllData,
        selectTagFilter,
        selectCollectionFilter,
        selectTypeFilter,
      }}
    >
      {children}
    </KnowledgeContext.Provider>
  );
}

export function useKnowledge() {
  const context = useContext(KnowledgeContext);
  if (!context) {
    throw new Error('useKnowledge must be used within a KnowledgeProvider');
  }
  return context;
}
