/**
 * File Slicing Service
 * Handles automatic splitting of large files (>50MB) into smaller chunks
 */
import { CHUNK_SIZE } from "../constants";
import { UploadFileItem } from "../types";

const CHUNK_SUFFIX = '.part';

/**
 * Represents a sliced chunk of a file
 */
export interface FileChunk {
  blob: Blob;
  fileName: string;
  index: number;
  total: number;
}

/**
 * Checks if a file needs to be sliced
 */
export const needsSlicing = (file: File): boolean => {
  return file.size > CHUNK_SIZE;
};

/**
 * Slices a file into multiple chunks
 * Returns an array of File objects with metadata in the name
 * 
 * Example: For a 120MB file "video.mp4"
 * - video.mp4.part1of3
 * - video.mp4.part2of3
 * - video.mp4.part3of3
 */
export const sliceFile = (file: File): UploadFileItem[] => {
  if (!needsSlicing(file)) {
    return [{file: file, sliceGroupId: null}];
  }

  const chunks: UploadFileItem[] = [];
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
  const sliceGroupId = crypto.randomUUID();
  
  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, file.size);
    const blob = file.slice(start, end);
    
    // Generate chunk filename with metadata
    // Example: "document.pdf.part1of3" for first chunk out of 3
    const chunkFileName = `${file.name}${CHUNK_SUFFIX}${i + 1}of${totalChunks}`;
    
    // Create a new File object from the blob
    const chunkFile = new File([blob], chunkFileName, {
      type: file.type,
      lastModified: file.lastModified
    });
    
    chunks.push({
      file: chunkFile,
      sliceGroupId: sliceGroupId
    });
  }
  
  return chunks;
};

export const getSliceFileMetaData = (file: File): File[] => {
  if (!needsSlicing(file)) {
    return [file];
  }

  const chunks = [];
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
  
  for (let i = 0; i < totalChunks; i++) {
    // Generate chunk filename with metadata
    // Example: "document.pdf.part1of3" for first chunk out of 3
    const chunkFileName = `${file.name}${CHUNK_SUFFIX}${i + 1}of${totalChunks}`;
    const chunkFileSize = file.size - (CHUNK_SIZE * (i + 1));
    chunks.push({
      name: chunkFileName,
      size: chunkFileSize
    });
  }
  
  return chunks;
};

/**
 * Checks if a file is a slice of a larger file
 */
export const isFileSlice = (fileName: string): boolean => {
  return fileName.includes(CHUNK_SUFFIX);
};

/**
 * Extracts the original filename from a sliced filename
 * Example: "document.pdf.part1of3" -> "document.pdf"
 */
export const getOriginalFileName = (slicedFileName: string): string => {
  const match = slicedFileName.match(/^(.+?)\.part\d+of\d+$/);
  return match ? match[1] : slicedFileName;
};

/**
 * Extracts chunk info from a sliced filename
 * Example: "document.pdf.part1of3" -> { index: 1, total: 3, originalName: "document.pdf" }
 */
export const parseChunkFileName = (
  fileName: string
): { index: number; total: number; originalName: string } | null => {
  const match = fileName.match(/^(.+?)\.part(\d+)of(\d+)$/);
  if (!match) return null;
  
  return {
    originalName: match[1],
    index: parseInt(match[2], 10),
    total: parseInt(match[3], 10)
  };
};

/**
 * Batch process files: slice any that are too large
 * Returns a flat array of files to upload (including sliced chunks)
 */
export const processFilesWithSlicing = (files: File[]): UploadFileItem[] => {
  const result: UploadFileItem[] = [];
  
  files.forEach(file => {
    const slicedFiles = sliceFile(file);
    result.push(...slicedFiles);
  });
  
  return result;
};

/**
 * Gets a human-readable description of file slicing
 * Used for UI feedback
 */
export const getSlicingDescription = (originalFile: File): string => {
  if (!needsSlicing(originalFile)) {
    return '';
  }
  
  const totalChunks = Math.ceil(originalFile.size / CHUNK_SIZE);
  const sizeMB = (originalFile.size / (1024 * 1024)).toFixed(2);
  
  return `File will be split into ${totalChunks} parts`;
};
