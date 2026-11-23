import { apiClient, getStoredToken } from './client';
import { UploadedFile, FileListResponse, KnowledgeItem } from '@/types';
import { getKnowledge } from './knowledge';

export interface FileUploadProgressCallback {
  (progress: number, step: string): void;
}

export interface UploadFileOptions {
  knowledgeId?: string;
  title?: string;
  collectionId?: string;
  tags?: string[];
  createKnowledge?: boolean;
}

/**
 * Upload a PDF or DOCX file to the FastAPI backend.
 * Uses multipart/form-data and includes JWT auth headers automatically.
 */
export async function uploadFile(
  file: File,
  options: UploadFileOptions = {}
): Promise<UploadedFile> {
  const formData = new FormData();
  formData.append('file', file, file.name);

  if (options.knowledgeId) {
    formData.append('knowledge_id', options.knowledgeId);
  }
  if (options.title) {
    formData.append('title', options.title);
  }
  if (options.collectionId) {
    formData.append('collection_id', options.collectionId);
  }
  if (options.tags && options.tags.length > 0) {
    formData.append('tags', options.tags.join(','));
  }
  if (options.createKnowledge !== undefined) {
    formData.append('create_knowledge', String(options.createKnowledge));
  }

  return apiClient.post<UploadedFile>('/api/v1/files/upload', formData);
}

/**
 * Retrieve paginated list of files owned by the current user.
 */
export async function listFiles(params: {
  limit?: number;
  offset?: number;
  fileType?: string;
  knowledgeId?: string;
  q?: string;
} = {}): Promise<FileListResponse> {
  const searchParams = new URLSearchParams();
  if (params.limit !== undefined) searchParams.set('limit', String(params.limit));
  if (params.offset !== undefined) searchParams.set('offset', String(params.offset));
  if (params.fileType) searchParams.set('file_type', params.fileType);
  if (params.knowledgeId) searchParams.set('knowledge_id', params.knowledgeId);
  if (params.q) searchParams.set('q', params.q);

  const query = searchParams.toString();
  return apiClient.get<FileListResponse>(query ? `/api/v1/files?${query}` : '/api/v1/files');
}

/**
 * Retrieve single file metadata and extracted text.
 */
export async function getFile(fileId: string): Promise<UploadedFile> {
  return apiClient.get<UploadedFile>(`/api/v1/files/${fileId}`);
}

/**
 * Download the original document file from the server.
 */
export async function downloadFile(fileId: string, filename?: string): Promise<void> {
  const baseUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000').replace(/\/+$/, '');
  const url = `${baseUrl}/api/v1/files/${fileId}/download`;

  const token = getStoredToken();
  const headers: HeadersInit = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`Failed to download file (HTTP ${response.status})`);
  }

  const blob = await response.blob();
  const downloadUrl = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = filename || `file-${fileId}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(downloadUrl);
}

/**
 * Delete a file record and remove its binary from backend storage.
 */
export async function deleteFile(fileId: string): Promise<boolean> {
  await apiClient.delete(`/api/v1/files/${fileId}`);
  return true;
}

/**
 * Backwards-compatible FileService class.
 */
export class FileService {
  static formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  static async uploadAndProcessFile(
    file: File,
    collectionId?: string,
    tags: string[] = [],
    onProgress?: FileUploadProgressCallback
  ): Promise<KnowledgeItem> {
    onProgress?.(20, 'Uploading document to server...');
    const uploaded = await uploadFile(file, {
      collectionId,
      tags,
      createKnowledge: true,
    });

    onProgress?.(60, 'Server extracting text content...');

    // If an associated knowledge record was created, poll briefly for processing completion
    if (uploaded.knowledgeId) {
      let attempts = 0;
      let finalKnowledge: KnowledgeItem | null = null;
      while (attempts < 6) {
        attempts++;
        try {
          finalKnowledge = await getKnowledge(uploaded.knowledgeId);
          if (finalKnowledge && finalKnowledge.processingStatus === 'COMPLETED') {
            break;
          }
        } catch {
          // Retry
        }
        await new Promise((r) => setTimeout(r, 600));
      }

      onProgress?.(100, 'Document processing completed');
      if (finalKnowledge) return finalKnowledge;
    }

    onProgress?.(100, 'Upload completed');
    // Fallback: fetch created knowledge item
    if (uploaded.knowledgeId) {
      return await getKnowledge(uploaded.knowledgeId);
    }

    throw new Error('Upload succeeded but no knowledge item was returned.');
  }

  static async downloadFile(fileId: string, filename?: string): Promise<void> {
    return downloadFile(fileId, filename);
  }

  static async deleteFile(fileId: string): Promise<boolean> {
    return deleteFile(fileId);
  }

  static async listFiles(params?: {
    limit?: number;
    offset?: number;
    fileType?: string;
    q?: string;
    knowledgeId?: string;
  }): Promise<FileListResponse> {
    return listFiles(params);
  }

  static async getFile(fileId: string): Promise<UploadedFile> {
    return getFile(fileId);
  }
}
