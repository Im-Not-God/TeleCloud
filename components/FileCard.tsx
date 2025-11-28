import React, { useState, useRef, useEffect } from 'react';
import { Download, Loader2, Link as LinkIcon, Check, Trash2, Folder, MoveRight, Eye, MoreVertical } from 'lucide-react';
import { FileIcon, defaultStyles } from 'react-file-icon';
import { TelegramMessage, AppConfig } from '../types';
import { formatBytes, isFilePreviewable } from '../constants';
import { getFileDownloadUrl } from '../services/telegramService';

interface FileCardProps {
  message: TelegramMessage;
  config: AppConfig;
  onDeleteClick: (fileId: string, fileName: string) => void;
  onMoveClick: (fileId: string, currentParentId: number | null) => void;
  onNavigate: (folderId: number, folderName: string) => void;
  onPreview: (url: string, fileName: string, mimeType: string) => void;
  // New props for controlled menu state
  isMenuOpen: boolean;
  onMenuToggle: () => void;
}

export const FileCard: React.FC<FileCardProps> = ({ 
    message, config, onDeleteClick, onMoveClick, onNavigate, onPreview,
    isMenuOpen, onMenuToggle
}) => {
  const [isCopying, setIsCopying] = useState(false);
  const [copied, setCopied] = useState(false);

  const doc = message.document;
  const isFolder = doc?.is_folder;
  
  const photo = message.photo ? message.photo[message.photo.length - 1] : null;
  
  const fileName = doc?.file_name || (photo ? `Photo_${message.date}.jpg` : 'Unknown File');
  const fileSize = doc?.file_size || (photo ? photo.file_size : 0);
  const mimeType = doc?.mime_type || (photo ? 'image/jpeg' : 'application/octet-stream');
  const fileId = doc?.file_id || photo?.file_id;
  const uniqueId = doc?.file_unique_id || photo?.file_unique_id;

  const actionId = fileId || uniqueId; 

  // Updated to include text types
  const isPreviewable = !isFolder && fileId && isFilePreviewable(fileName, mimeType).ok;

  // Helper to extract extension
  const getExtension = (name: string) => {
      const parts = name.split('.');
      return parts.length > 1 ? parts.pop()?.toLowerCase() : '';
  };

  const extension = getExtension(fileName);
  
  // Safe access to styles to prevent crash if library import is partial/undefined
  const safeStyles = defaultStyles || {};
  // @ts-ignore
  const fileStyle = safeStyles[extension] || {};

  const handleDownload = (e: React.MouseEvent) => {
      e.stopPropagation();
      onMenuToggle(); // Close menu
      if (!fileId || isFolder) return;
      const url = getFileDownloadUrl(config, fileId, fileName);
      window.open(url, '_blank');
  };

  const handlePreview = (e: React.MouseEvent) => {
      e.stopPropagation();
      if(isMenuOpen) onMenuToggle(); // Close menu
      if (!fileId || !isPreviewable) return;
      const url = getFileDownloadUrl(config, fileId, fileName);
      onPreview(url, fileName, mimeType);
  };

  const handleCopyLink = async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (isCopying || isFolder) return;
      setIsCopying(true);
      try {
          if (!fileId) throw new Error("Missing file ID");
          const url = getFileDownloadUrl(config, fileId, fileName);
          if (url) {
               await navigator.clipboard.writeText(url);
               setCopied(true);
               setTimeout(() => {
                   setCopied(false);
                  //  onMenuToggle(); // Close menu after feedback
               }, 1000);
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

  const dateStr = new Date(message.date * 1000).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  const folderStats = doc?.stats || { files: 0, folders: 0 };
  const folderInfo = [];
  if (folderStats.folders > 0) folderInfo.push(`${folderStats.folders} folder${folderStats.folders !== 1 ? 's' : ''}`);
  if (folderStats.files > 0) folderInfo.push(`${folderStats.files} file${folderStats.files !== 1 ? 's' : ''}`);
  const folderInfoStr = folderInfo.length > 0 ? folderInfo.join(', ') : 'Empty';

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
    window.addEventListener('resize', checkWrap);
    // 使用 ResizeObserver 监听容器大小变化
    const resizeObserver = new ResizeObserver(checkWrap);
    if (metaContainerRef.current) {
      resizeObserver.observe(metaContainerRef.current);
    }
    
    return () => {
      window.removeEventListener('resize', checkWrap);
      resizeObserver.disconnect();
    };
  }, [isFolder, fileName, fileSize]);

  return (
    <div 
        className={`bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-md transition-all duration-200 group p-4 flex items-center justify-between relative ${isFolder ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-750' : ''}`}
    >
      {/* Left Side: Icon & Info */}
      <div className="flex items-center gap-4 overflow-hidden flex-1 mr-2">
        <div 
            onClick={isFolder ? undefined : handlePreview}
            className={`w-12 h-12 flex items-center justify-center shrink-0 relative ${isFolder ? 'rounded-lg bg-yellow-50 dark:bg-yellow-900/20 text-yellow-500' : ''} ${isPreviewable ? 'cursor-pointer hover:scale-105 transition-transform' : ''}`}
        >
          {isFolder ? (
             <Folder className="w-8 h-8 fill-yellow-100 dark:fill-yellow-900/40" />
          ) : (
             <div className="w-8 h-8 relative">
                 <FileIcon extension={extension} {...fileStyle} />
                 {/* Always show Eye icon if previewable, with better styling */}
                 {isPreviewable && (
                    <div className="absolute -bottom-1 -right-1 bg-white dark:bg-slate-700 rounded-full p-0.5 shadow-sm border border-slate-100 dark:border-slate-600 text-telegram-500 dark:text-telegram-400">
                        <Eye className="w-3 h-3" />
                    </div>
                 )}
             </div>
          )}
        </div>
        
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-medium text-slate-900 dark:text-slate-200 pr-2" title={fileName}>
            {fileName}
          </h3>
          <div ref={metaContainerRef} className="flex flex-wrap items-center gap-2 mt-1 min-w-0 text-xs text-slate-500 dark:text-slate-400 overflow-hidden">
            {isFolder ? (
                <span className="whitespace-nowrap">{folderInfoStr}</span>
            ) : (
                <span className="whitespace-nowrap">{formatBytes(fileSize || 0)}</span>
            )}

            {!isFolder && (
              <span className={`w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600 shrink-0 ${showDot ? 'visible' : 'invisible'}`}></span>
            )}
            
            <span className="text-slate-400 dark:text-slate-500 whitespace-nowrap">{dateStr}</span>
          </div>
        </div>
      </div>
      
      {/* Always show Menu Button */}
      <div className="relative shrink-0">
          <button 
            onClick={handleMenuButton}
            className={`p-2 rounded-lg transition-colors ${isMenuOpen ? 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300' : 'text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
          >
            <MoreVertical className="w-5 h-5" />
          </button>

          {/* Dropdown Menu */}
          {isMenuOpen && (
            <div className="absolute right-0 bottom-full mb-2 w-48 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-100 dark:border-slate-700 z-50 py-1 animate-in fade-in zoom-in-95 duration-100 origin-top-right" onClick={(e) => e.stopPropagation()}>
                {!isFolder && (
                    <>
                        {isPreviewable && (
                            <button onClick={handlePreview} className="w-full text-left px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-3">
                                <Eye className="w-4 h-4 text-slate-400" /> Preview
                            </button>
                        )}
                        <button onClick={handleCopyLink} className="w-full text-left px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-3">
                             {copied ? <Check className="w-4 h-4 text-green-500" /> : <LinkIcon className="w-4 h-4 text-slate-400" />}
                             Copy Link
                        </button>
                        <button onClick={handleDownload} className="w-full text-left px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-3">
                            <Download className="w-4 h-4 text-slate-400" /> Download
                        </button>
                        <div className="h-px bg-slate-100 dark:bg-slate-700 my-1"></div>
                    </>
                )}
                
                <button onClick={handleMoveClick} className="w-full text-left px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-3">
                    <MoveRight className="w-4 h-4 text-orange-400" /> Move to...
                </button>
                <button onClick={handleDeleteClick} className="w-full text-left px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-3">
                    <Trash2 className="w-4 h-4" /> Delete
                </button>
            </div>
          )}
      </div>
    </div>
  );
};