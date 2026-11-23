import {
  KnowledgeItem,
  ChatResponse,
  ChatSource,
  SummarizeResponse,
  ExtractConceptsResponse,
  SuggestTagsResponse,
} from '@/types';
import { apiClient } from './client';

export interface SummarizeOptions {
  content?: string;
  title?: string;
  knowledgeId?: string;
}

export interface ExtractConceptsOptions {
  content?: string;
  knowledgeId?: string;
}

export interface SuggestTagsOptions {
  content?: string;
  title?: string;
  knowledgeId?: string;
}

export class AIService {
  /**
   * Request an AI summary of a knowledge item or supplied content.
   */
  static async summarizeContent(
    content?: string,
    title?: string,
    knowledgeId?: string
  ): Promise<string> {
    const res = await apiClient.post<SummarizeResponse>('/api/v1/ai/summarize', {
      content: content || undefined,
      title: title || undefined,
      knowledge_id: knowledgeId || undefined,
    });
    return res.summary;
  }

  /**
   * Request key concepts extraction from a knowledge item or supplied content.
   */
  static async extractKeyConcepts(
    content?: string,
    knowledgeId?: string
  ): Promise<string[]> {
    const res = await apiClient.post<ExtractConceptsResponse>('/api/v1/ai/extract-concepts', {
      content: content || undefined,
      knowledge_id: knowledgeId || undefined,
    });
    return res.keyConcepts || res.concepts || [];
  }

  /**
   * Request AI suggested tags for a knowledge item or supplied content.
   */
  static async generateSuggestedTags(
    content?: string,
    title?: string,
    knowledgeId?: string
  ): Promise<string[]> {
    const res = await apiClient.post<SuggestTagsResponse>('/api/v1/ai/suggest-tags', {
      content: content || undefined,
      title: title || undefined,
      knowledge_id: knowledgeId || undefined,
    });
    return res.tags || res.suggestedTags || [];
  }

  /**
   * Chat with Second Brain knowledge base with cited source references.
   */
  static async chat(
    query: string,
    knowledgeId?: string
  ): Promise<ChatResponse> {
    const payload: { query: string; knowledge_id?: string } = {
      query: query.trim(),
    };
    if (knowledgeId && knowledgeId.trim()) {
      payload.knowledge_id = knowledgeId.trim();
    }
    return apiClient.post<ChatResponse>('/api/v1/ai/chat', payload);
  }

  /**
   * Helper method for the AI Assistant drawer.
   * If activeKnowledge is provided, restricts chat strictly to that item's ID.
   */
  static async askAssistant(
    query: string,
    activeKnowledge?: KnowledgeItem | null
  ): Promise<{ answer: string; sources: ChatSource[] }> {
    return this.chat(query, activeKnowledge?.id);
  }
}
