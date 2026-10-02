'use client';

import React, { useState } from 'react';
import { useKnowledge } from '@/context/KnowledgeContext';
import { AIService } from '@/services/api/ai';
import { X, Sparkles, Send, Brain, Bot, User, CornerDownLeft, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
}

export const AIAssistantDrawer: React.FC = () => {
  const { isAiDrawerOpen, setIsAiDrawerOpen, activeItem } = useKnowledge();

  const [inputQuery, setInputQuery] = useState('');
  const [isThinking, setIsThinking] = useState(false);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'msg-0',
      sender: 'ai',
      text: activeItem
        ? `Hello Abhinav! I'm inspecting **"${activeItem.title}"**. How can I help you extract value or connect this to your other knowledge entries?`
        : `Hello Abhinav! I'm your Second Brain AI Assistant. Ask me anything about your saved notes, JWT auth, Docker, React RSC, or vector databases!`,
      timestamp: new Date().toISOString(),
    },
  ]);

  if (!isAiDrawerOpen) return null;

  const handleSend = async (queryText?: string) => {
    const textToSend = queryText || inputQuery;
    if (!textToSend.trim() || isThinking) return;

    const userMsg: Message = {
      id: `msg-${Date.now()}`,
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!queryText) setInputQuery('');
    setIsThinking(true);

    try {
      const responseText = await AIService.askAssistant(textToSend, activeItem);
      const aiMsg: Message = {
        id: `msg-${Date.now() + 1}`,
        sender: 'ai',
        text: responseText,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err) {
      console.error('AI assistant error', err);
    } finally {
      setIsThinking(false);
    }
  };

  const quickPrompts = [
    'Summarize this knowledge',
    'Extract key concepts',
    'Find related notes',
    'Explain in simple terms',
  ];

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
                Contextual AI trained on your Second Brain
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsAiDrawerOpen(false)}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200/50 dark:hover:bg-zinc-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Context Banner */}
        {activeItem && (
          <div className="px-4 py-2 bg-indigo-100/50 dark:bg-indigo-950/40 border-b border-indigo-200/60 dark:border-indigo-900/40 flex items-center gap-2 text-xs text-indigo-700 dark:text-indigo-300">
            <Brain size={14} className="shrink-0" />
            <span className="truncate">Active Context: <strong>{activeItem.title}</strong></span>
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
                <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                  <Bot size={14} />
                </div>
              )}

              <div
                className={`max-w-[85%] p-3 rounded-xl leading-relaxed whitespace-pre-wrap ${
                  msg.sender === 'user'
                    ? 'bg-indigo-600 text-white font-medium rounded-tr-xs'
                    : 'bg-zinc-100 dark:bg-zinc-800/80 text-zinc-800 dark:text-zinc-200 border border-zinc-200/60 dark:border-zinc-700/60 rounded-tl-xs'
                }`}
              >
                {msg.text}
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
                Thinking & searching vector embeddings...
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
