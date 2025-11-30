/**
 * File Reassembly Service
 * Handles reconstruction of sliced files from chunks
 */

import { parseChunkFileName } from './fileSliceService';

/**
 * Interface for a file chunk in storage
 */
export interface StoredFileChunk {
  name: string;
  fileId: string;
  index: number;
  total: number;
  originalName: string;
}

/**
 * Groups files by their original name, identifying chunks
 * Returns map of original file name -> array of chunks
 */
export const groupFileChunks = (
  files: Array<{ name: string; file_id: string; [key: string]: any }>
): Map<string, StoredFileChunk[]> => {
  const chunkMap = new Map<string, StoredFileChunk[]>();

  files.forEach(file => {
    const chunkInfo = parseChunkFileName(file.name);
    
    if (chunkInfo) {
      const { originalName, index, total } = chunkInfo;
      
      if (!chunkMap.has(originalName)) {
        chunkMap.set(originalName, []);
      }

      chunkMap.get(originalName)!.push({
        name: file.name,
        fileId: file.file_id,
        index,
        total,
        originalName
      });
    }
  });

  return chunkMap;
};

/**
 * Checks if a chunk group is complete (has all chunks)
 */
export const isChunkGroupComplete = (chunks: StoredFileChunk[]): boolean => {
  if (chunks.length === 0) return false;
  
  const totalChunks = chunks[0].total;
  if (chunks.length !== totalChunks) return false;

  // Verify all chunk indices from 1 to total are present
  const indices = new Set(chunks.map(c => c.index));
  for (let i = 1; i <= totalChunks; i++) {
    if (!indices.has(i)) return false;
  }

  return true;
};

/**
 * Sorts chunks by index for proper reassembly
 */
export const sortChunks = (chunks: StoredFileChunk[]): StoredFileChunk[] => {
  return [...chunks].sort((a, b) => a.index - b.index);
};

/**
 * Detects incomplete chunk groups
 * Returns array of original file names that have incomplete chunks
 */
export const detectIncompleteChunks = (
  chunkMap: Map<string, StoredFileChunk[]>
): string[] => {
  const incomplete: string[] = [];

  chunkMap.forEach((chunks, originalName) => {
    if (!isChunkGroupComplete(chunks)) {
      incomplete.push(originalName);
    }
  });

  return incomplete;
};

/**
 * Gets display information for chunk groups
 * Shows original name, chunk count, and completion status
 */
export const getChunkGroupInfo = (
  chunks: StoredFileChunk[]
): {
  originalName: string;
  totalChunks: number;
  chunkCount: number;
  isComplete: boolean;
  displayName: string;
} => {
  const sortedChunks = sortChunks(chunks);
  const totalChunks = sortedChunks[0]?.total || 0;
  const isComplete = isChunkGroupComplete(chunks);
  
  return {
    originalName: chunks[0]?.originalName || 'Unknown',
    totalChunks,
    chunkCount: chunks.length,
    isComplete,
    displayName: isComplete 
      ? chunks[0]?.originalName 
      : `${chunks[0]?.originalName} (${chunks.length}/${totalChunks})`
  };
};

/**
 * Merges file blobs from chunks
 * Chunks should be sorted by index before calling
 */
export const mergeChunkBlobs = (blobs: Blob[]): Blob => {
  return new Blob(blobs);
};

/**
 * Creates a file from merged blob and original filename
 */
export const createFileFromChunks = (
  mergedBlob: Blob,
  originalName: string,
  mimeType: string = 'application/octet-stream'
): File => {
  return new File([mergedBlob], originalName, { type: mimeType });
};

/**
 * Downloads a file blob from a URL
 */
export const downloadBlobFromUrl = async (url: string): Promise<Blob> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download chunk: ${response.statusText}`);
  }
  return await response.blob();
};

/**
 * Downloads and reassembles a complete chunk group
 * Fetches all chunks in parallel and merges them
 */
export const downloadAndReassembleChunks = async (
  chunks: StoredFileChunk[],
  getDownloadUrl: (fileId: string, fileName: string) => string,
  onProgress?: (downloaded: number, total: number) => void
): Promise<File> => {
  // Verify chunks are complete
  if (!isChunkGroupComplete(chunks)) {
    throw new Error('Incomplete chunk group - cannot reassemble');
  }

  // Sort chunks for proper order
  const sortedChunks = sortChunks(chunks);
  const originalName = sortedChunks[0].originalName;
  
  // Download all chunks in parallel
  const downloadPromises = sortedChunks.map(chunk => 
    downloadBlobFromUrl(getDownloadUrl(chunk.fileId, chunk.name))
  );

  const blobs = await Promise.all(downloadPromises);
  
  // Update progress if provided
  if (onProgress) {
    onProgress(blobs.length, chunks.length);
  }

  // Merge blobs in correct order (they should already be sorted)
  const mergedBlob = mergeChunkBlobs(blobs);
  
  // Create file from merged blob
  const file = createFileFromChunks(mergedBlob, originalName, 'application/octet-stream');
  
  return file;
};
