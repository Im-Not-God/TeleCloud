import React, { useState, useRef, useEffect } from "react";
import {
  Download,
  Link as LinkIcon,
  Check,
  Trash2,
  Folder,
  MoveRight,
  Eye,
  MoreVertical,
} from "lucide-react";
import { FileIcon, defaultStyles } from "react-file-icon";
import { TelegramMessage, AppConfig } from "../types";
import { formatBytes, isFilePreviewable, t } from "../constants";
import { getFileUrl, getPublicDownloadUrl } from "../services/telegramService";
import { downloadAndReassembleChunksWithProgress } from "../services/fileReassemblyService";
import { Layers } from "lucide-react";

interface FileCardProps {
  message: TelegramMessage;
  config: AppConfig;
  onDeleteClick: (fileId: string, fileName: string) => void;
  onMoveClick: (fileId: string, currentParentId: number | null) => void;
  onNavigate: (folderId: number, folderName: string) => void;
  onPreview: (
    url: string,
    fileName: string,
    mimeType: string,
    chunks?: any[],
  ) => void;
  // New props for controlled menu state
  isMenuOpen: boolean;
  onMenuToggle: () => void;
  // Optional: all files for detecting chunks
  allFiles?: TelegramMessage[];
  // Highlight text for search
  highlightText?: string;
  // Download modal callbacks
  onDownloadStart?: (
    taskId: string,
    fileName: string,
    fileSize: number,
    totalChunks: number,
  ) => void;
  onChunkProgress?: (
    taskId: string,
    chunkIndex: number,
    name: string,
    progress: number,
    status: "pending" | "downloading" | "completed" | "error",
    errorMsg?: string,
  ) => void;
  onOverallProgress?: (
    taskId: string,
    progress: number,
    isDownloading: boolean,
  ) => void;
}

export const FileCard: React.FC<FileCardProps> = ({
  message,
  config,
  onDeleteClick,
  onMoveClick,
  onNavigate,
  onPreview,
  isMenuOpen,
  onMenuToggle,
  allFiles = [],
  highlightText = "",
  onDownloadStart,
  onChunkProgress,
  onOverallProgress,
}) => {
  const [isCopying, setIsCopying] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const doc = message.document;
  const isFolder = doc?.is_folder;

  const photo = message.photo ? message.photo[message.photo.length - 1] : null;

  const fileName =
    doc?.file_name || (photo ? `Photo_${message.date}.jpg` : "Unknown File");
  const fileSize = doc?.file_size || (photo ? photo.file_size : 0);
  const mimeType =
    doc?.mime_type || (photo ? "image/jpeg" : "application/octet-stream");
  const fileId = doc?.file_id || photo?.file_id;
  const uniqueId = doc?.file_unique_id || photo?.file_unique_id;
  const thumbnailFileId = doc?.thumbnail_file_id;
  const isSliced = doc?.is_sliced;
  const totalChunks = doc?.chunks?.length;

  const actionId = fileId || uniqueId;
  const lang = config?.language;

  // Updated to include text types
  const isPreviewable =
    !isFolder && fileId && isFilePreviewable(fileName, mimeType).ok;

  // Helper to extract extension
  const getExtension = (name: string) => {
    const parts = name.split(".");
    return parts.length > 1 ? parts.pop()?.toLowerCase() : "";
  };

  const extension = getExtension(fileName);

  // Helper to highlight text
  const renderHighlightedName = (name: string, highlight: string) => {
    if (!highlight || !highlight.trim()) {
      return name;
    }
    const parts = name.split(new RegExp(`(${highlight})`, "gi"));
    return (
      <>
        {parts.map((part, i) =>
          part.toLowerCase() === highlight.toLowerCase() ? (
            <span
              key={i}
              className="bg-yellow-200 text-slate-900 rounded-[2px]"
            >
              {part}
            </span>
          ) : (
            part
          ),
        )}
      </>
    );
  };

  // Safe access to styles to prevent crash if library import is partial/undefined
  const safeStyles = defaultStyles || {};
  const fileStyle = safeStyles[extension] || {};

  const renderThumbnail = () => {
    // For visual media, show the actual content in thumbnail
    let previewUrl;
    if (thumbnailFileId) {
      previewUrl = getFileUrl(config, thumbnailFileId, fileName);
    } else {
      previewUrl = getFileUrl(config, fileId, fileName);
    }

    if (previewUrl) {
      if (
        mimeType.startsWith("image/") ||
        (mimeType.startsWith("video/") && thumbnailFileId)
      ) {
        return (
          <>
            <img
              loading="lazy"
              src={previewUrl}
              alt="preview"
              className="w-full h-full object-cover"
            />
            {isPreviewable && (
              <div className="absolute bottom-0 right-0 bg-white dark:bg-slate-700 rounded-full p-0.5 shadow-sm border border-slate-100 dark:border-slate-600 text-telegram-500 dark:text-telegram-400">
                <Eye className="w-3 h-3" />
              </div>
            )}
          </>
        );
      }
      if (mimeType.startsWith("video/") && !thumbnailFileId) {
        return (
          <>
            <video
              preload="metadata"
              src={previewUrl}
              className="w-full h-full object-cover"
              muted
            />
            {isPreviewable && (
              <div className="absolute bottom-0 right-0 bg-white dark:bg-slate-700 rounded-full p-0.5 shadow-sm border border-slate-100 dark:border-slate-600 text-telegram-500 dark:text-telegram-400">
                <Eye className="w-3 h-3" />
              </div>
            )}
          </>
        );
      }
    }

    // Fallback (and for Audio/PDF/Text) show Icon
    return (
      <>
        <div className="w-8 h-8 m-auto">
          <FileIcon extension={extension} {...fileStyle} />
        </div>
        {isPreviewable && (
          <div className="absolute bottom-3 right-0 bg-white dark:bg-slate-700 rounded-full p-0.5 shadow-sm border border-slate-100 dark:border-slate-600 text-telegram-500 dark:text-telegram-400">
            <Eye className="w-3 h-3" />
          </div>
        )}
      </>
    );
  };

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    onMenuToggle(); // Close menu
    if (!fileId || isFolder || isDownloading) return;

    setIsDownloading(true);
    try {
      // Check if this is a chunk file
      if (isSliced && (doc?.chunks?.length || 0) > 1) {
        // Multiple chunks - use modal for progress tracking
        const chunks = doc?.chunks || [];
        console.log("Detected chunks for reassembly:", chunks);
        const originalName =
          doc?.original_name || fileName.replace(/\.part\d+of\d+$/, "");
        const totalFileSize = fileSize;

        // Start download modal
        const taskId = fileId || uniqueId || originalName;
        onDownloadStart?.(taskId, originalName, totalFileSize, chunks.length);
        onOverallProgress?.(taskId, 5, true);

        const convertedChunks = chunks.map((chunk: any) => ({
          name: chunk.name,
          fileId: chunk.file_id,
          index: chunk.index,
          total: totalChunks,
          originalName: originalName,
        }));
        // Download and reassemble with progress
        const blob = await downloadAndReassembleChunksWithProgress(
          convertedChunks,
          (fileId, fileName) => getFileUrl(config, fileId, fileName, true),
          (index, name, progress, status, errorMsg) => {
            onChunkProgress?.(taskId, index, name, progress, status, errorMsg);
          },
          (progress) => {
            onOverallProgress?.(taskId, progress, true);
          },
        );

        // Create download link from reassembled blob
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = originalName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        onOverallProgress?.(taskId, 100, false);
        return;
      }

      // Single file - use direct download
      const url = getFileUrl(config, fileId, fileName, true);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Download error:", error);
      alert(
        `Download failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    } finally {
      setIsDownloading(false);
    }
  };

  const handlePreview = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isMenuOpen) onMenuToggle(); // Close menu
    if (!fileId || !isPreviewable) return;
    const url = getFileUrl(config, fileId, fileName);
    onPreview(url, fileName, mimeType, doc?.chunks);
  };

  const handleCopyLink = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isCopying || isFolder) return;
    setIsCopying(true);
    try {
      if (!fileId) throw new Error("Missing file ID");
      const url = getPublicDownloadUrl(config, fileId, fileName);
      if (url) {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => {
          setCopied(false);
          //  onMenuToggle(); // Close menu after feedback
        }, 3000);
      }
    } catch (error) {
      console.error(error);
      setIsCopying(false);
    } finally {
      setIsCopying(false);
    }
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onMenuToggle(); // Close menu
    if (!actionId) return;
    onDeleteClick(actionId, fileName);
  };

  const handleMoveClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onMenuToggle(); // Close menu
    if (!actionId) return;
    onMoveClick(actionId, doc?.parent_id || null);
  };

  const handleMenuButton = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent parent click
    onMenuToggle();
  };

  let dateStrLang = undefined;
  if (lang == "en") dateStrLang = "en-US";
  if (lang == "zh") dateStrLang = "zh-CN";
  const dateStr = new Date(message.date * 1000).toLocaleDateString(
    dateStrLang,
    {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    },
  );

  const folderStats = doc?.stats || { files: 0, folders: 0 };
  const folderInfo = [];
  if (folderStats.folders > 0)
    folderInfo.push(`${folderStats.folders} ${t(lang, "folder")}`);
  if (folderStats.files > 0)
    folderInfo.push(`${folderStats.files} ${t(lang, "file")}`);
  const folderInfoStr =
    folderInfo.length > 0 ? folderInfo.join(", ") : t(lang, "empty");

  const [showDot, setShowDot] = useState(true);
  const metaContainerRef = useRef<HTMLDivElement>(null);

  // 检测是否换行
  useEffect(() => {
    const checkWrap = () => {
      if (metaContainerRef.current && !isFolder) {
        const children = Array.from(metaContainerRef.current.children);
        if (children.length >= 2) {
          const firstChild = children[0] as HTMLElement;
          const lastChild = children[children.length - 1] as HTMLElement;
          const firstTop = firstChild.getBoundingClientRect().top;
          const lastTop = lastChild.getBoundingClientRect().top;
          // 如果 top 位置差异超过 5px，说明换行了
          setShowDot(Math.abs(firstTop - lastTop) < 5);
        }
      }
    };

    checkWrap();
    window.addEventListener("resize", checkWrap);
    // 使用 ResizeObserver 监听容器大小变化
    const resizeObserver = new ResizeObserver(checkWrap);
    if (metaContainerRef.current) {
      resizeObserver.observe(metaContainerRef.current);
    }

    return () => {
      window.removeEventListener("resize", checkWrap);
      resizeObserver.disconnect();
    };
  }, [isFolder, fileName, fileSize]);

  return (
    <div
      className={`bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-md transition-all duration-200 group p-4 flex items-center justify-between relative ${isFolder ? "cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700" : ""}`}
    >
      {/* Left Side: Icon & Info */}
      <div className="flex items-center gap-4 overflow-hidden flex-1 mr-2">
        <div
          onClick={isFolder ? undefined : handlePreview}
          className={`w-12 h-12 flex items-center justify-center shrink-0 relative ${isFolder ? "rounded-lg bg-yellow-50 dark:bg-yellow-900/20 text-yellow-500" : ""} ${isPreviewable ? "cursor-pointer hover:scale-105 transition-transform" : ""}`}
        >
          {isFolder ? (
            <Folder className="w-8 h-8 fill-yellow-100 dark:fill-yellow-900/40" />
          ) : (
            <div className="relative w-full h-full">
              {renderThumbnail()}
              {/* Always show Eye icon if previewable, with better styling */}
              {/* {isPreviewable && (
                <div className="absolute bottom-1 right-1 bg-white dark:bg-slate-700 rounded-full p-0.5 shadow-sm border border-slate-100 dark:border-slate-600 text-telegram-500 dark:text-telegram-400">
                  <Eye className="w-3 h-3" />
                </div>
              )} */}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <h3
            className="text-sm font-medium text-slate-900 dark:text-slate-200 pr-2 break-all"
            title={fileName}
          >
            {renderHighlightedName(fileName, highlightText)}
          </h3>
          <div
            ref={metaContainerRef}
            className="flex flex-wrap items-center gap-2 mt-1 min-w-0 text-xs text-slate-500 dark:text-slate-400 overflow-hidden"
          >
            {isFolder ? (
              <span className="whitespace-nowrap">{folderInfoStr}</span>
            ) : (
              <>
                <span className="whitespace-nowrap">
                  {formatBytes(fileSize || 0)}
                </span>
                {isSliced && (
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      alert(JSON.stringify(doc?.chunks, null, 2));
                    }}
                    className="flex items-center text-xs bg-blue-500/20 text-blue-500 dark:text-blue-300 px-1.5 py-0.5 rounded-md"
                  >
                    <Layers className="w-3 h-3 mr-1" />
                    {totalChunks}
                  </span>
                )}
              </>
            )}

            {!isFolder && (
              <span
                className={`w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600 shrink-0 ${showDot ? "visible" : "invisible"}`}
              ></span>
            )}

            <span className="text-slate-400 dark:text-slate-500 whitespace-nowrap">
              {dateStr}
            </span>
          </div>
        </div>
      </div>

      {/* Always show Menu Button */}
      <div className="relative shrink-0">
        <button
          onClick={handleMenuButton}
          className={`p-2 rounded-lg transition-colors ${isMenuOpen ? "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300" : "text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-600"}`}
        >
          <MoreVertical className="w-5 h-5" />
        </button>

        {/* Dropdown Menu */}
        {isMenuOpen && (
          <div
            className="absolute right-0 bottom-full mb-2 w-48 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-100 dark:border-slate-700 z-50 py-1 animate-in fade-in zoom-in-95 duration-100 origin-top-right"
            onClick={(e) => e.stopPropagation()}
          >
            {!isFolder && (
              <>
                {isPreviewable && (
                  <button
                    onClick={handlePreview}
                    className="w-full text-left px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-3"
                  >
                    <Eye className="w-4 h-4 text-slate-400" />{" "}
                    {t(lang, "preview")}
                  </button>
                )}
                <button
                  onClick={handleCopyLink}
                  className="w-full text-left px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-3"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-green-500" />
                  ) : (
                    <LinkIcon className="w-4 h-4 text-slate-400" />
                  )}
                  {t(lang, "copy_link")}
                </button>
                <button
                  onClick={handleDownload}
                  className="w-full text-left px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-3"
                >
                  <Download className="w-4 h-4 text-slate-400" />{" "}
                  {t(lang, "download")}
                </button>
                <div className="h-px bg-slate-100 dark:bg-slate-700 my-1"></div>
              </>
            )}

            <button
              onClick={handleMoveClick}
              className="w-full text-left px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-3"
            >
              <MoveRight className="w-4 h-4 text-orange-400" />{" "}
              {t(lang, "move_to")}
            </button>
            <button
              onClick={handleDeleteClick}
              className="w-full text-left px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-3"
            >
              <Trash2 className="w-4 h-4" /> {t(lang, "delete")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
