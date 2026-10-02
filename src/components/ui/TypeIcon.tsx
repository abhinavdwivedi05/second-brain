'use client';

import React from 'react';
import { KnowledgeType } from '@/types';
import { FileText, Link2, FileCode, Image, FileAudio, File } from 'lucide-react';

interface TypeIconProps {
  type: KnowledgeType;
  className?: string;
  size?: number;
}

export const TypeIcon: React.FC<TypeIconProps> = ({ type, className = '', size = 16 }) => {
  switch (type) {
    case 'NOTE':
      return <FileText size={size} className={`text-blue-500 dark:text-blue-400 ${className}`} />;
    case 'LINK':
      return <Link2 size={size} className={`text-emerald-500 dark:text-emerald-400 ${className}`} />;
    case 'PDF':
      return <FileCode size={size} className={`text-red-500 dark:text-red-400 ${className}`} />;
    case 'IMAGE':
      return <Image size={size} className={`text-purple-500 dark:text-purple-400 ${className}`} />;
    case 'AUDIO':
      return <FileAudio size={size} className={`text-amber-500 dark:text-amber-400 ${className}`} />;
    case 'DOCUMENT':
      return <File size={size} className={`text-indigo-500 dark:text-indigo-400 ${className}`} />;
    default:
      return <FileText size={size} className={`text-zinc-500 ${className}`} />;
  }
};
