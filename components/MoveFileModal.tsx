
import React, { useState, useEffect } from 'react';
import { FolderInput, X, Loader2, Folder, ArrowUp } from 'lucide-react';
import { AppConfig, FolderItem } from '../types';
import { getAllFolders } from '../services/telegramService';

interface MoveFileModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: AppConfig;
  fileId: string;
  currentParentId: number | null;
  onMove: (targetParentId: number | null) => Promise<void>;
}

export const MoveFileModal: React.FC<MoveFileModalProps> = ({ 
    isOpen, onClose, config, fileId, currentParentId, onMove 
}) => {
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isMoving, setIsMoving] = useState(false);

  useEffect(() => {
    if (isOpen) {
        setIsLoading(true);
        getAllFolders(config).then(data => {
            setFolders(data);
        }).finally(() => setIsLoading(false));
    }
  }, [isOpen, config]);

  const handleMove = async (targetId: number | null) => {
    if (targetId === currentParentId) return; // No change
    setIsMoving(true);
    try {
        await onMove(targetId);
        onClose();
    } catch (e) {
        console.error(e);
    } finally {
        setIsMoving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-6 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
          <div className="flex items-center gap-2 text-slate-800">
            <FolderInput className="w-5 h-5 text-telegram-500" />
            <h2 className="font-semibold text-lg">Move to...</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="max-h-[300px] overflow-y-auto custom-scrollbar p-2">
            {isLoading ? (
                <div className="py-8 flex justify-center text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin" />
                </div>
            ) : (
                <div className="space-y-1">
                    {/* Home / Root Option */}
                    <button 
                        onClick={() => handleMove(null)}
                        disabled={isMoving || currentParentId === null}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-left ${currentParentId === null ? 'bg-slate-100 text-slate-400 cursor-default' : 'hover:bg-slate-50 text-slate-700'}`}
                    >
                        <div className="w-8 h-8 rounded bg-slate-200 flex items-center justify-center text-slate-500">
                            <ArrowUp className="w-4 h-4" />
                        </div>
                        <span className="font-medium">Home Directory</span>
                    </button>

                    <div className="h-px bg-slate-100 my-1 mx-2"></div>

                    {folders.filter(f => f.parent_id === null).length === 0 && (
                        <p className="text-center text-xs text-slate-400 py-2">No other folders created</p>
                    )}

                    {folders.map(folder => {
                        // Don't show the folder itself if we are moving a folder (prevent self-nesting logic for now)
                        // This is a simple list. Ideally it's a tree.
                        // For now we just list all flat.
                        const isCurrent = folder.id === currentParentId;
                        return (
                            <button 
                                key={folder.id}
                                onClick={() => handleMove(folder.id)}
                                disabled={isMoving || isCurrent}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-left ${isCurrent ? 'bg-slate-100 text-slate-400 cursor-default' : 'hover:bg-slate-50 text-slate-700'}`}
                            >
                                <div className="w-8 h-8 rounded bg-yellow-100 flex items-center justify-center text-yellow-600">
                                    <Folder className="w-4 h-4" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <span className="font-medium truncate block">{folder.name}</span>
                                    {folder.parent_id && <span className="text-xs text-slate-400">Subfolder</span>}
                                </div>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
      </div>
    </div>
  );
};
