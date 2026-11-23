'use client';

import React, { useState } from 'react';
import { useKnowledge } from '@/context/KnowledgeContext';
import { AIService } from '@/services/api/ai';
import { ChatSource } from '@/types';
import { X, Sparkles, Send, Brain, Bot, User, BookOpen, AlertCircle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  sources?: ChatSource[];
  timestamp: string;
  isError?: boolean;
}

let aiMsgCounter = 0;
function nextMsgId(): string {
  aiMsgCounter += 1;
  return `msg-${aiMsgCounter}`;
}

export const AIAssistantDrawer: React.FC = () => {
  const {
    isAiDrawerOpen,
    setIsAiDrawerOpen,
    activeItem,
    setActiveItem,
    openDetailView,
    knowledgeItems,
  } = useKnowledge();

  const [inputQuery, setInputQuery] = useState('');
  const [isThinking, setIsThinking] = useState(false);

  const getGreeting = (itemTitle?: string) =>
    itemTitle
      ? `Hello! I'm inspecting **"${itemTitle}"**. How can I help you summarize, extract concepts, or answer questions about this document?`
      : `Hello! I'm your Second Brain AI Knowledge Assistant. Ask me anything grounded in your saved notes and documents, or explore concepts across your library.`;

  const [messages, setMessages] = useState<Message[]>(() => [
    {
      id: nextMsgId(),
      sender: 'ai',
      text: getGreeting(activeItem?.title),
      timestamp: '',
    },
  ]);

  // Context isolation: Reset conversation whenever activeItem changes (document opened, switched, or closed)
  const [prevItemId, setPrevItemId] = useState(activeItem?.id);
  if (activeItem?.id !== prevItemId) {
    setPrevItemId(activeItem?.id);
    setMessages([
      {
        id: nextMsgId(),
        sender: 'ai',
        text: getGreeting(activeItem?.title),
        timestamp: '',
      },
    ]);
    setInputQuery('');
  }

  const handleClearChat = () => {
    setMessages([
      {
        id: nextMsgId(),
        sender: 'ai',
        text: getGreeting(activeItem?.title),
        timestamp: '',
      },
    ]);
    setInputQuery('');
  };

  if (!isAiDrawerOpen) return null;

  const handleSend = async (queryText?: string) => {
    const textToSend = queryText || inputQuery;
    if (!textToSend.trim() || isThinking) return;

    const userMsg: Message = {
      id: nextMsgId(),
      sender: 'user',
      text: textToSend,
      timestamp: '',
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!queryText) setInputQuery('');
    setIsThinking(true);

    try {
      let responseText = '';
      let sources: ChatSource[] = [];

      const lower = textToSend.toLowerCase().trim();

      if (lower === 'summarize this knowledge' && activeItem) {
        const summary = await AIService.summarizeContent(
          activeItem.content,
          activeItem.title,
          activeItem.id
        );
        responseText = `**AI Summary for "${activeItem.title}"**:\n\n${summary}`;
        sources = [{ id: activeItem.id, title: activeItem.title }];
      } else if (lower === 'extract key concepts' && activeItem) {
        const concepts = await AIService.extractKeyConcepts(activeItem.content, activeItem.id);
        responseText = `**Key Concepts for "${activeItem.title}"**:\n\n${concepts.map((c) => `• ${c}`).join('\n')}`;
        sources = [{ id: activeItem.id, title: activeItem.title }];
      } else if (lower === 'suggest tags' && activeItem) {
        const tags = await AIService.generateSuggestedTags(
          activeItem.content,
          activeItem.title,
          activeItem.id
        );
        responseText = `**Suggested Tags for "${activeItem.title}"**:\n\n${tags.map((t) => `#${t}`).join(', ')}`;
        sources = [{ id: activeItem.id, title: activeItem.title }];
      } else {
        const res = await AIService.askAssistant(textToSend, activeItem);
        responseText = res.answer;
        sources = res.sources || [];
      }

      const aiMsg: Message = {
        id: nextMsgId(),
        sender: 'ai',
        text: responseText,
        sources: sources.length > 0 ? sources : undefined,
        timestamp: '',
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: unknown) {
      console.error('AI assistant error', err);
      const errorMsg =
        (err as Error)?.message ||
        'Unable to reach AI service. Please verify backend service configuration or GEMINI_API_KEY.';
      const aiErrorMsg: Message = {
        id: nextMsgId(),
        sender: 'ai',
        text: `⚠️ **AI Service Error**: ${errorMsg}`,
        isError: true,
        timestamp: '',
      };
      setMessages((prev) => [...prev, aiErrorMsg]);
    } finally {
      setIsThinking(false);
    }
  };

  const quickPrompts = activeItem
    ? [
        'Summarize this knowledge',
        'Extract key concepts',
        'Suggest tags',
        'Explain in simple terms',
      ]
    : [
        'What are the key themes in my notes?',
        'Summarize recent knowledge entries',
        'Find notes about backend architecture',
      ];

  const handleSourceClick = (sourceId: string) => {
    const item = knowledgeItems.find((k) => k.id === sourceId);
    if (item) {
      openDetailView(item);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs animate-fade-in">
      <div className="w-full max-w-md bg-white dark:bg-[#121215] border-l border-zinc-200 dark:border-zinc-800 h-full flex flex-col shadow-2xl">
        {/* Header */}
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-indigo-50/30 dark:bg-indigo-950/20">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <Sparkles size={16} />
            </div>
            <div>
              <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                AI Knowledge Assistant
              </h3>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Grounded in your Second Brain knowledge base
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={handleClearChat}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200/50 dark:hover:bg-zinc-800 transition-colors"
              title="Clear conversation"
              aria-label="Clear conversation"
            >
              <RotateCcw size={15} />
            </button>
            <button
              onClick={() => setIsAiDrawerOpen(false)}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200/50 dark:hover:bg-zinc-800 transition-colors"
              title="Close drawer"
              aria-label="Close drawer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Context Mode Banner */}
        {activeItem ? (
          <div className="px-4 py-2 bg-indigo-50 dark:bg-indigo-950/40 border-b border-indigo-200/60 dark:border-indigo-900/40 flex items-center justify-between text-xs text-indigo-700 dark:text-indigo-300">
            <div className="flex items-center gap-2 min-w-0">
              <Brain size={14} className="shrink-0 text-indigo-600 dark:text-indigo-400" />
              <span className="truncate">
                Document Context: <strong>{activeItem.title}</strong>
              </span>
            </div>
            <button
              onClick={() => setActiveItem(null)}
              className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-200 hover:underline shrink-0 ml-2 cursor-pointer transition-colors"
              title="Switch to searching across all documents"
            >
              Switch to Global
            </button>
          </div>
        ) : (
          <div className="px-4 py-2 bg-zinc-100/70 dark:bg-zinc-800/40 border-b border-zinc-200/60 dark:border-zinc-700/60 flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
            <Sparkles size={14} className="shrink-0 text-indigo-500" />
            <span className="truncate">
              Global Knowledge Mode: Searching across all saved notes and documents
            </span>
          </div>
        )}

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 text-xs ${
                msg.sender === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              {msg.sender === 'ai' && (
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                    msg.isError
                      ? 'bg-rose-500 text-white'
                      : 'bg-indigo-600 text-white'
                  }`}
                >
                  {msg.isError ? <AlertCircle size={14} /> : <Bot size={14} />}
                </div>
              )}

              <div
                className={`max-w-[85%] p-3 rounded-xl leading-relaxed whitespace-pre-wrap ${
                  msg.sender === 'user'
                    ? 'bg-indigo-600 text-white font-medium rounded-tr-xs'
                    : msg.isError
                    ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 border border-rose-200 dark:border-rose-900 rounded-tl-xs'
                    : 'bg-zinc-100 dark:bg-zinc-800/80 text-zinc-800 dark:text-zinc-200 border border-zinc-200/60 dark:border-zinc-700/60 rounded-tl-xs'
                }`}
              >
                <div>{msg.text}</div>

                {/* Grounded Sources */}
                {msg.sources && msg.sources.length > 0 && (
                  <div className="mt-2.5 pt-2 border-t border-zinc-200/60 dark:border-zinc-700/60">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1 flex items-center gap-1">
                      <BookOpen size={11} /> Grounded Sources:
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {msg.sources.map((src) => (
                        <button
                          key={src.id}
                          onClick={() => handleSourceClick(src.id)}
                          className="px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-[11px] text-indigo-700 dark:text-indigo-300 font-medium hover:underline text-left"
                          title="Click to view document"
                        >
                          {src.title}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {msg.sender === 'user' && (
                <div className="w-6 h-6 rounded-full bg-zinc-300 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200 flex items-center justify-center shrink-0 mt-0.5">
                  <User size={13} />
                </div>
              )}
            </div>
          ))}

          {isThinking && (
            <div className="flex gap-3 text-xs justify-start">
              <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0">
                <Bot size={14} />
              </div>
              <div className="p-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-500 flex items-center gap-2">
                <Sparkles size={14} className="animate-spin text-indigo-500" />
                Querying Second Brain & generating answer...
              </div>
            </div>
          )}
        </div>

        {/* Quick Suggestion Pills */}
        <div className="px-4 py-2 border-t border-zinc-200 dark:border-zinc-800/80 flex flex-wrap gap-1.5 bg-zinc-50/50 dark:bg-zinc-900/30">
          {quickPrompts.map((prompt) => (
            <button
              key={prompt}
              onClick={() => handleSend(prompt)}
              className="text-[11px] font-medium px-2.5 py-1 rounded-md bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:border-indigo-500 hover:text-indigo-600 transition-colors"
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <div className="p-3 border-t border-zinc-200 dark:border-zinc-800 flex items-center gap-2">
          <input
            type="text"
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSend();
            }}
            placeholder="Ask AI about your knowledge..."
            className="flex-1 bg-zinc-100 dark:bg-zinc-900 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 focus:outline-none focus:border-indigo-500"
          />
          <Button
            variant="primary"
            size="sm"
            onClick={() => handleSend()}
            disabled={!inputQuery.trim() || isThinking}
            className="p-2.5 aspect-square"
          >
            <Send size={14} />
          </Button>
        </div>
      </div>
    </div>
  );
};
