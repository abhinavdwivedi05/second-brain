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
} from '@/types';
import { KnowledgeService } from '@/services/api/knowledge';
import { CollectionService } from '@/services/api/collections';
import { TagService } from '@/services/api/tags';
import { INITIAL_USER, INITIAL_ACTIVITIES } from '@/services/api/mockData';
import { AuthContext } from '@/context/AuthContext';

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
  isLoading: boolean;

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
  createKnowledge: (data: Omit<KnowledgeItem, 'id' | 'createdAt' | 'updatedAt'>) => Promise<KnowledgeItem>;
  updateKnowledge: (id: string, updates: Partial<KnowledgeItem>) => Promise<void>;
  deleteKnowledge: (id: string) => Promise<void>;
  createCollection: (data: Omit<Collection, 'id' | 'createdAt' | 'itemCount'>) => Promise<void>;
  deleteCollection: (id: string) => Promise<void>;
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
  const [activities, setActivities] = useState<ActivityLog[]>(INITIAL_ACTIVITIES);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState<boolean>(false);
  const [isAiDrawerOpen, setIsAiDrawerOpen] = useState<boolean>(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);

  const refreshAllData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [items, cols, tgs] = await Promise.all([
        KnowledgeService.getAll(filterOptions),
        CollectionService.getAll(),
        TagService.getAll(),
      ]);
      setKnowledgeItems(items);
      setCollections(cols);
      setTags(tgs);
    } catch (err) {
      console.error('Failed to load knowledge data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [filterOptions]);

  useEffect(() => {
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
    const updated = await KnowledgeService.toggleFavorite(id);
    if (updated) {
      if (activeItem && activeItem.id === id) {
        setActiveItem(updated);
      }
      refreshAllData();
    }
  };

  const createKnowledge = async (
    data: Omit<KnowledgeItem, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<KnowledgeItem> => {
    const created = await KnowledgeService.create(data);

    // Ensure tags exist in system
    for (const tagName of created.tags) {
      await TagService.ensureTagExists(tagName);
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

    await refreshAllData();
    return created;
  };

  const updateKnowledge = async (id: string, updates: Partial<KnowledgeItem>) => {
    const updated = await KnowledgeService.update(id, updates);
    if (updated && activeItem?.id === id) {
      setActiveItem(updated);
    }
    await refreshAllData();
  };

  const deleteKnowledge = async (id: string) => {
    await KnowledgeService.delete(id);
    if (activeItem?.id === id) {
      setActiveItem(null);
      setActiveView('library');
    }
    await refreshAllData();
  };

  const createCollection = async (
    data: Omit<Collection, 'id' | 'createdAt' | 'itemCount'>
  ) => {
    await CollectionService.create(data);
    await refreshAllData();
  };

  const deleteCollection = async (id: string) => {
    await CollectionService.delete(id);
    await refreshAllData();
  };

  const resetFilters = () => {
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
    setFilterOptions((prev) => ({ ...prev, tag: tagName }));
    setActiveView('library');
  };

  const selectCollectionFilter = (collectionId: string) => {
    resetFilters();
    setFilterOptions((prev) => ({ ...prev, collectionId }));
    setActiveView('library');
  };

  const selectTypeFilter = (type: KnowledgeType | 'ALL') => {
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
        isLoading,
        isAddModalOpen,
        setIsAddModalOpen,
        isCommandPaletteOpen,
        setIsCommandPaletteOpen,
        isAiDrawerOpen,
        setIsAiDrawerOpen,
        isSidebarCollapsed,
        setIsSidebarCollapsed,
        toggleFavorite,
        createKnowledge,
        updateKnowledge,
        deleteKnowledge,
        createCollection,
        deleteCollection,
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
