
import React, { useState } from 'react';
import { Download, Loader2, Link as LinkIcon, Check, Trash2, Folder, MoveRight, Eye } from 'lucide-react';
import { FileIcon, defaultStyles } from 'react-file-icon';
import { TelegramMessage, AppConfig } from '../types';
import { formatBytes } from '../constants';
import { getFileDownloadUrl } from '../services/telegramService';

interface FileCardProps {
  message: TelegramMessage;
  config: AppConfig;
  onDeleteClick: (fileId: string, fileName: string) => void;
  onMoveClick: (fileId: string, currentParentId: number | null) => void;
  onNavigate: (folderId: number, folderName: string) => void;
  onPreview: (url: string, fileName: string, mimeType: string) => void;
}

export const FileCard: React.FC<FileCardProps> = ({ 
    message, config, onDeleteClick, onMoveClick, onNavigate, onPreview 
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

  const isPreviewable = !isFolder && fileId && (
      mimeType.startsWith('image/') || 
      mimeType.startsWith('video/') || 
      mimeType.startsWith('audio/') || 
      mimeType.includes('pdf')
  );

  // Helper to extract extension
  const getExtension = (name: string) => {
      const parts = name.split('.');
      return parts.length > 1 ? parts.pop()?.toLowerCase() : '';
  };

  const extension = getExtension(fileName);
  // Safe access to styles to prevent crash if library import is partial/undefined
  const safeStyles = defaultStyles || {};
  // @ts-ignore - defaultStyles is an object where keys are extensions
  const fileStyle = safeStyles[extension] || {};

  const handleDownload = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!fileId || isFolder) return;
      const url = getFileDownloadUrl(config, fileId, fileName);
      window.open(url, '_blank');
  };

  const handlePreview = (e: React.MouseEvent) => {
      e.stopPropagation();
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
               setTimeout(() => setCopied(false), 2000);
          }
      } catch (error) {
          console.error(error);
      } finally {
          setIsCopying(false);
      }
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!actionId) return;
      onDeleteClick(actionId, fileName);
  };

  const handleMoveClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!actionId) return;
      onMoveClick(actionId, doc?.parent_id || null);
  };

  const dateStr = new Date(message.date * 1000).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  const folderStats = doc?.stats || { files: 0, folders: 0 };
  const folderInfo = [];
  if (folderStats.folders > 0) folderInfo.push(`${folderStats.folders} folder${folderStats.folders !== 1 ? 's' : ''}`);
  if (folderStats.files > 0) folderInfo.push(`${folderStats.files} file${folderStats.files !== 1 ? 's' : ''}`);
  const folderInfoStr = folderInfo.length > 0 ? folderInfo.join(', ') : 'Empty';

  return (
    <div 
        className={`bg-white rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-all duration-200 group p-4 flex items-center justify-between ${isFolder ? 'cursor-pointer hover:bg-slate-50' : ''}`}
    >
      <div className="flex items-center gap-4 overflow-hidden flex-1">
        <div 
            onClick={isFolder ? undefined : handlePreview}
            className={`w-12 h-12 flex items-center justify-center shrink-0 relative ${isFolder ? 'rounded-lg bg-yellow-50 text-yellow-500' : ''} ${isPreviewable ? 'cursor-pointer hover:scale-105 transition-transform' : ''}`}
        >
          {isFolder ? (
             <Folder className="w-8 h-8 fill-yellow-100" />
          ) : (
             <div className="w-8 h-8 relative">
                 <FileIcon extension={extension} {...fileStyle} />
                 {/* Tiny Play/Eye overlay on icon for previewable items */}
                 {isPreviewable && (
                    <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity">
                        <Eye className="w-3 h-3 text-telegram-500" />
                    </div>
                 )}
             </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-medium text-slate-900 truncate" title={fileName}>
            {fileName}
          </h3>
          {/* <div className="flex items-center gap-2 mt-1">
            {isFolder && <span className="text-xs text-slate-500">{folderInfoStr}</span>}
            {!isFolder && <span className="text-xs text-slate-500">{formatBytes(fileSize || 0)}</span>}
            {!isFolder && <span className="w-1 h-1 rounded-full bg-slate-300"></span>}
            <span className="text-xs text-slate-400">{dateStr}</span> */}
          <div className="flex items-center gap-2 mt-1 min-w-0">
            {isFolder && <span className="text-xs text-slate-500 truncate">{folderInfoStr}</span>}
            {!isFolder && <span className="text-xs text-slate-500 whitespace-nowrap">{formatBytes(fileSize || 0)}</span>}
            {!isFolder && <span className="w-1 h-1 rounded-full bg-slate-300 shrink-0"></span>}
            <span className="text-xs text-slate-400 truncate">{dateStr}</span>
          </div>
        </div>
      </div>
      
      <div className="flex items-center gap-1 pl-2 shrink-0">
        {!isFolder && (
            <>
                {isPreviewable && (
                    <button 
                        onClick={handlePreview}
                        className="p-2 rounded-lg text-slate-400 hover:text-telegram-500 hover:bg-telegram-50 transition-all relative"
                        title="Preview"
                    >
                        <Eye className="w-5 h-5" />
                    </button>
                )}

                <button 
                  onClick={handleCopyLink}
                  disabled={isCopying}
                  className="p-2 rounded-lg text-slate-400 hover:text-telegram-500 hover:bg-telegram-50 transition-all relative"
                  title="Copy Direct Proxy Link"
                >
                  {isCopying ? (
                    <Loader2 className="w-5 h-5 animate-spin text-telegram-500" />
                  ) : copied ? (
                    <Check className="w-5 h-5 text-green-500" />
                  ) : (
                    <LinkIcon className="w-5 h-5" />
                  )}
                </button>

                <button 
                    onClick={handleDownload}
                    className="p-2 rounded-lg text-slate-400 hover:text-telegram-500 hover:bg-telegram-50 transition-all relative"
                    title="Download"
                >
                    <Download className="w-5 h-5" />
                </button>
            </>
        )}

        <button 
            onClick={handleMoveClick}
            className="p-2 rounded-lg text-slate-400 hover:text-orange-500 hover:bg-orange-50 transition-all relative"
            title="Move to Folder"
        >
            <MoveRight className="w-5 h-5" />
        </button>

        <button 
            onClick={handleDeleteClick}
            className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all relative"
            title="Delete"
        >
            <Trash2 className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
