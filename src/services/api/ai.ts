import { KnowledgeItem } from '@/types';

export class AIService {
  static async summarizeContent(content: string, title?: string): Promise<string> {
    // Simulate AI summary response delay
    await new Promise((resolve) => setTimeout(resolve, 800));

    if (!content || content.trim().length === 0) {
      return 'No content provided to summarize.';
    }

    const words = content.split(/\s+/);
    if (words.length < 30) {
      return `Quick summary for "${title || 'Knowledge Note'}": ${content.trim()}`;
    }

    return `This document on "${title || 'Knowledge'}" focuses on core architecture principles and operational standards. Key points include implementation patterns, performance tradeoffs, security safeguards, and structural recommendations for scalable microservices and frontend architectures.`;
  }

  static async extractKeyConcepts(content: string): Promise<string[]> {
    await new Promise((resolve) => setTimeout(resolve, 600));
    return [
      'Architectural Abstraction & Boundaries',
      'Performance Optimization & Latency',
      'Security Best Practices & Safeguards',
      'Scalable Microservice Design',
      'Data Consistency & Cache Invalidation',
    ];
  }

  static async generateSuggestedTags(content: string, title: string): Promise<string[]> {
    await new Promise((resolve) => setTimeout(resolve, 500));
    const text = (title + ' ' + content).toLowerCase();
    const suggested: string[] = [];

    if (text.includes('react') || text.includes('component')) suggested.push('react');
    if (text.includes('auth') || text.includes('jwt') || text.includes('security')) suggested.push('security');
    if (text.includes('backend') || text.includes('api') || text.includes('server')) suggested.push('backend');
    if (text.includes('docker') || text.includes('aws') || text.includes('cloud')) suggested.push('devops');
    if (text.includes('python') || text.includes('async')) suggested.push('python');
    if (text.includes('dsa') || text.includes('algorithm')) suggested.push('dsa');
    if (text.includes('ai') || text.includes('model') || text.includes('vector')) suggested.push('ai');

    if (suggested.length === 0) {
      suggested.push('general', 'notes');
    }

    return suggested;
  }

  static async askAssistant(query: string, activeKnowledge?: KnowledgeItem | null): Promise<string> {
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const q = query.toLowerCase();

    if (activeKnowledge) {
      if (q.includes('summarize') || q.includes('summary')) {
        return `**AI Summary for "${activeKnowledge.title}"**:\n\n${activeKnowledge.summary}\n\n**Core takeaways:**\n${activeKnowledge.keyConcepts.map((k) => `• ${k}`).join('\n')}`;
      }
      if (q.includes('related') || q.includes('connect')) {
        return `Based on vector embeddings and tagged topics, "${activeKnowledge.title}" is closely related to backend architecture, authorization boundaries, and distributed systems.`;
      }
      return `Regarding **"${activeKnowledge.title}"**: ${activeKnowledge.summary}\n\nIn addition, this knowledge entry is tagged with #${activeKnowledge.tags.join(', #')} and provides detailed insights into production design patterns.`;
    }

    if (q.includes('jwt') || q.includes('auth')) {
      return `In your Second Brain, you have **JWT Authentication & Secure Token Revocation Standard**. It recommends short-lived access tokens (15m in HttpOnly cookies) combined with refresh token rotation and Redis JTI blacklisting for immediate revocation.`;
    }
    if (q.includes('react') || q.includes('server components') || q.includes('rsc')) {
      return `You have saved **React Server Components Architecture & Hydration Model**. Key concept: Server Components reduce client bundle size by rendering exclusively on the server, while Client Components handle interactive state at the tree leaves.`;
    }
    if (q.includes('docker') || q.includes('container')) {
      return `Your knowledge base contains **Docker Container Networking & Overlay Bridge Drivers**. It details Bridge vs Host vs Overlay network drivers for container isolation.`;
    }

    return `I searched your Second Brain knowledge base for "${query}". Found 3 relevant notes across Web Development and Backend collections. Would you like me to extract key concepts or generate a summary graph?`;
  }
}
