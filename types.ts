export interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  username?: string;
}

export interface TelegramDocument {
  file_id: string;
  file_unique_id: string;
  file_name?: string;
  original_name?: string;
  mime_type?: string;
  file_size?: number;
  thumbnail_file_id?: string;
  is_sliced?: boolean;
  chunks?: any;
  parent_id?: number | null; // ID of the folder from DB
  is_folder?: boolean;
  stats?: {
    files: number;
    folders: number;
  };
}

export interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  date: number;
  forward_date?: number;
  chat: {
    id: number;
    type: string;
  };
  document?: TelegramDocument;
  photo?: Array<{
    file_id: string;
    file_unique_id: string;
    file_size: number;
    width: number;
    height: number;
  }>;
  caption?: string;
  is_duplicate: boolean;
}

export interface TelegramUpdate {
  update_id: number; // In DB mode, this is the DB ID (primary key)
  message?: TelegramMessage;
  channel_post?: TelegramMessage;
}

export interface DownloadChunkProgress {
  name: string;
  progress: number;
  status: "pending" | "downloading" | "completed" | "error" | "aborted";
  errorMsg?: string;
}

export interface DownloadTask {
  id: string; // Unique ID for the download task
  fileName: string;
  fileSize: number;
  totalChunks: number;
  chunkProgresses: DownloadChunkProgress[];
  overallProgress: number;
  status: "pending" | "downloading" | "completed" | "error" | "aborted";
  errorMsg?: string;
  startTime: number;
  endTime?: number;
}

export interface AppConfig {
  botToken: string;
  chatId: string;
  workerUrl: string; // URL of your deployed Cloudflare Worker
  language?: string;
}

// Standard response from our Worker API
export interface WorkerResponse<T> {
  ok: boolean;
  result?: T;
  error?: string;
}

// Simple folder structure for Move Modal
export interface FolderItem {
  id: number;
  name: string;
  parent_id: number | null;
}

export interface UploadFileItem {
  file: File;
  sliceGroupId?: string;
  originalMimeType?: string;
}

export type SortField = "name" | "date" | "size";
export type SortOrder = "asc" | "desc";

export interface SortConfig {
  field: SortField;
  order: SortOrder;
}

export const DEFAULT_WORKER_URL = "/api"; // Assumes frontend and backend are on same domain

export interface FileUploadStatus {
  id: string; // Unique ID for the upload task
  name: string;
  progress: number;
  status: "pending" | "uploading" | "completed" | "error" | "aborted";
  errorMsg?: string;
}

export type FilterType =
  | "all"
  | "photo"
  | "video"
  | "document"
  | "audio"
  | "folder";
export type TimeFilter = "all" | "24h" | "7d" | "30d" | "custom";
