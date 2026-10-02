export type KnowledgeType = 'NOTE' | 'LINK' | 'PDF' | 'IMAGE' | 'AUDIO' | 'DOCUMENT';

export type ProcessingStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface KnowledgeItem {
  id: string;
  title: string;
  type: KnowledgeType;
  summary: string;
  content: string;
  originalUrl?: string;
  fileName?: string;
  fileSize?: string;
  fileType?: string;
  tags: string[];
  collectionId?: string;
  collectionName?: string;
  isFavorite: boolean;
  isArchived: boolean;
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
  lastAccessedAt?: string;
  processingStatus: ProcessingStatus;
  processingProgress?: number; // 0 to 100
  processingStep?: string;
  keyConcepts: string[];
  relatedKnowledgeIds: string[];
  aiInsights?: string[];
  audioDuration?: string;
}

export interface Collection {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  itemCount: number;
  createdAt: string;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
  itemCount: number;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
  role: string;
  storageUsedBytes: number;
  storageLimitBytes: number;
  aiCreditsRemaining: number;
  aiCreditsTotal: number;
}

export interface ActivityLog {
  id: string;
  action: 'CREATED' | 'UPDATED' | 'FAVORITED' | 'ACCESSED' | 'DELETED' | 'AI_PROCESSED';
  knowledgeId: string;
  knowledgeTitle: string;
  timestamp: string;
  type: KnowledgeType;
}

export interface SearchFilterOptions {
  query: string;
  type?: KnowledgeType | 'ALL';
  collectionId?: string;
  tag?: string;
  favoritesOnly?: boolean;
  sortBy?: 'newest' | 'oldest' | 'recently_accessed' | 'title';
}

// Response shape for paginated search results
export interface SearchResponse {
  items: KnowledgeItem[];
  page: number;
  pageSize: number;
  totalPages: number;
  total: number;
}

export interface ProcessingStep {
  name: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  message?: string;
}
