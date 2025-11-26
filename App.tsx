
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Settings, UploadCloud, RefreshCw, Shield, HardDrive, Import, Database, FolderPlus, Home, ChevronRight, Info, FileText, CheckCircle2, AlertCircle, X, Trash2, Plus, FileImage, FileVideo, FileAudio, Eye } from 'lucide-react';
import { FileIcon, defaultStyles } from 'react-file-icon';
import { AppConfig, TelegramUpdate, DEFAULT_WORKER_URL } from './types';
import { formatBytes } from './constants';
import { SettingsModal } from './components/SettingsModal';
import { UploadSuccessModal } from './components/UploadSuccessModal';
import { ImportModal } from './components/ImportModal';
import { DeleteConfirmModal } from './components/DeleteConfirmModal';
import { CreateFolderModal } from './components/CreateFolderModal';
import { MoveFileModal } from './components/MoveFileModal';
import { PreviewModal } from './components/PreviewModal';
import { getStoredFiles, uploadDocument, getFileDownloadUrl, deleteFile, createFolder, moveFile } from './services/telegramService';
import { FileCard } from './components/FileCard';

const CONFIG_STORAGE_KEY = 'telecloud_config_v2';

// Breadcrumb item type
interface Breadcrumb {
    id: number | null;
    name: string;
}

interface FileUploadStatus {
    name: string;
    progress: number;
    status: 'pending' | 'uploading' | 'completed' | 'error';
    errorMsg?: string;
}

// Helper component for Pending Files to handle Object URL lifecycle
const PendingFileItem = ({ 
  file, 
  onRemove, 
  onUpload,
  onPreview
}: { 
  file: File, 
  onRemove: () => void, 
  onUpload: () => void,
  onPreview: (url: string, name: string, mime: string) => void
}) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const isPreviewable = file.type.startsWith('image/') || 
                        file.type.startsWith('video/') || 
                        file.type.startsWith('audio/') || 
                        file.type === 'application/pdf';

  useEffect(() => {
    // Create preview for supported media types
    if (isPreviewable) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      
      // Cleanup to prevent memory leaks
      return () => URL.revokeObjectURL(url);
    }
  }, [file, isPreviewable]);

  const getExtension = (name: string) => {
      const parts = name.split('.');
      return parts.length > 1 ? parts.pop()?.toLowerCase() : '';
  };
  const ext = getExtension(file.name);
  // Safe style access
  const safeStyles = defaultStyles || {};
  // @ts-ignore
  const iconStyle = safeStyles[ext] || {};

  const handlePreviewClick = () => {
      if (previewUrl) {
          onPreview(previewUrl, file.name, file.type);
      }
  };

  const renderThumbnail = () => {
    // For visual media, show the actual content in thumbnail
    if (previewUrl) {
      if (file.type.startsWith('image/')) {
         return <img src={previewUrl} alt="preview" className="w-full h-full object-cover" />;
      }
      if (file.type.startsWith('video/')) {
        return <video src={previewUrl} className="w-full h-full object-cover" muted />;
      }
    }
    
    // Fallback (and for Audio/PDF) show Icon
    return (
        <div className="w-8 h-8">
            <FileIcon extension={ext} {...iconStyle} />
        </div>
    );
  };

  return (
    <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-lg group/item hover:border-telegram-200 hover:shadow-sm transition-all">
        <div className="flex items-center gap-3 min-w-0">
            <div 
                onClick={previewUrl ? handlePreviewClick : undefined}
                className={`w-12 h-12 rounded-lg bg-white flex items-center justify-center border border-slate-200 overflow-hidden shrink-0 relative group/thumb ${previewUrl ? 'cursor-pointer' : ''}`}
            >
                {renderThumbnail()}
                
                {/* Overlay Eye Icon for previewable items */}
                {previewUrl && (
                    <div className="absolute inset-0 bg-black/10 opacity-0 group-hover/thumb:opacity-100 flex items-center justify-center transition-opacity">
                        <div className="bg-white/90 rounded-full p-1 shadow-sm">
                            <Eye className="w-3 h-3 text-telegram-600" />
                        </div>
                    </div>
                )}
            </div>
            <div className="min-w-0 text-left">
                <p className="text-sm font-medium text-slate-700 truncate" title={file.name}>{file.name}</p>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span>{formatBytes(file.size)}</span>
                    {previewUrl && (
                        <button 
                            onClick={handlePreviewClick}
                            className="text-telegram-600 bg-telegram-50 hover:bg-telegram-100 px-1.5 rounded text-[10px] font-medium transition-colors flex items-center gap-1"
                        >
                            <Eye className="w-3 h-3" />
                            Preview
                        </button>
                    )}
                </div>
            </div>
        </div>
        <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover/item:opacity-100 transition-opacity">
            <button 
                onClick={onUpload}
                className="p-2 text-slate-400 hover:text-telegram-500 hover:bg-white rounded-lg transition-colors shadow-sm border border-transparent hover:border-slate-100"
                title="Upload this file only"
            >
                <UploadCloud className="w-4 h-4" />
            </button>
            <button 
                onClick={onRemove}
                className="p-2 text-slate-400 hover:text-red-500 hover:bg-white rounded-lg transition-colors shadow-sm border border-transparent hover:border-slate-100"
                title="Remove from list"
            >
                <X className="w-4 h-4" />
            </button>
        </div>
    </div>
  );
};

function App() {
  // Load Config
  const [config, setConfig] = useState<AppConfig>(() => {
    const saved = localStorage.getItem(CONFIG_STORAGE_KEY);
    return saved ? JSON.parse(saved) : {
      botToken: '',
      chatId: '',
      workerUrl: DEFAULT_WORKER_URL
    };
  });

  const [files, setFiles] = useState<TelegramUpdate[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Folder Navigation State
  const [currentFolderId, setCurrentFolderId] = useState<number | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<Breadcrumb[]>([{ id: null, name: 'Home' }]);
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  
  // Upload State
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatuses, setUploadStatuses] = useState<FileUploadStatus[]>([]);
  const [networkSpeed, setNetworkSpeed] = useState<string>('0 B/s');
  
  // Refs for tracking concurrent upload progress
  // Maps index -> { loaded, total }
  const filesProgressRef = useRef<{ [key: number]: { loaded: number, total: number } }>({});
  const lastLoadedBytesRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  const [error, setError] = useState<string | null>(null);
  const [uploadedResults, setUploadedResults] = useState<{url: string, name: string}[]>([]);
  
  // Action states
  const [fileToDelete, setFileToDelete] = useState<{id: string, name: string} | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const [fileToMove, setFileToMove] = useState<{id: string, parentId: number | null} | null>(null);
  const [previewFile, setPreviewFile] = useState<{url: string, name: string, mime: string} | null>(null);

  // Save config on change
  useEffect(() => {
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
  }, [config]);

  // Initial open settings if empty
  useEffect(() => {
    if (!config.botToken) setIsSettingsOpen(true);
  }, []);

  const fetchFiles = useCallback(async () => {
    if (!config.botToken || !config.chatId) return;
    
    setIsLoading(true);
    setError(null);
    try {
        const dbFiles = await getStoredFiles(config, currentFolderId);
        setFiles(dbFiles);
    } catch (err: any) {
      console.error(err);
      setError("Failed to fetch files. Ensure Worker is deployed and configured.");
    } finally {
      setIsLoading(false);
    }
  }, [config, currentFolderId]);

  // Refresh when config or folder changes
  useEffect(() => {
    if (config.botToken && config.chatId) {
      fetchFiles();
    }
  }, [config, fetchFiles]);

  // Speed Calculation & Progress Update Interval
  useEffect(() => {
    let interval: number;

    if (isUploading) {
      lastTimeRef.current = Date.now();
      lastLoadedBytesRef.current = 0;

      interval = window.setInterval(() => {
        const currentTime = Date.now();
        // Sum current loaded bytes from all active files
        let currentTotalLoaded = 0;
        const currentProgressMap = filesProgressRef.current;
        
        Object.values(currentProgressMap).forEach(val => {
            currentTotalLoaded += val.loaded;
        });
        
        const timeDiff = (currentTime - lastTimeRef.current) / 1000; // seconds
        const bytesDiff = currentTotalLoaded - lastLoadedBytesRef.current;

        if (timeDiff > 0 && bytesDiff >= 0) {
            const speed = bytesDiff / timeDiff;
            setNetworkSpeed(`${formatBytes(speed)}/s`);
        }

        // Update individual file progress bars in UI
        setUploadStatuses(prevStatuses => {
            return prevStatuses.map((status, index) => {
                const rawData = currentProgressMap[index];
                if (rawData && rawData.total > 0 && status.status !== 'completed' && status.status !== 'error') {
                    const percent = (rawData.loaded / rawData.total) * 100;
                    return { ...status, progress: Math.min(99, percent), status: 'uploading' };
                }
                return status;
            });
        });

        lastTimeRef.current = currentTime;
        lastLoadedBytesRef.current = currentTotalLoaded;
      }, 500);
    }

    return () => {
      clearInterval(interval);
      setNetworkSpeed('0 B/s');
    };
  }, [isUploading]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = Array.from(e.target.files || []);
      if (selectedFiles.length === 0) return;

      const validFiles: File[] = [];
      let skippedCount = 0;

      selectedFiles.forEach(f => {
          if (f.size > 50 * 1024 * 1024) {
              skippedCount++;
          } else {
              // Avoid exact duplicates in pending list
              const exists = pendingFiles.some(pf => pf.name === f.name && pf.size === f.size && pf.lastModified === f.lastModified);
              if (!exists) validFiles.push(f);
          }
      });

      if (skippedCount > 0) {
          setError(`Skipped ${skippedCount} files larger than 50MB.`);
      } else {
          setError(null);
      }

      setPendingFiles(prev => [...prev, ...validFiles]);
      e.target.value = ''; // Reset input
  };

  const handleRemovePending = (index: number) => {
      setPendingFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleClearPending = () => {
      setPendingFiles([]);
      setError(null);
  };

  const startUploadProcess = async (filesToUpload: File[]) => {
    if (filesToUpload.length === 0) return;

    setIsUploading(true);
    setUploadedResults([]);
    setNetworkSpeed('Calculating...');
    
    // Clear pending files that are about to be uploaded
    const filesToKeep = pendingFiles.filter(f => !filesToUpload.includes(f));
    setPendingFiles(filesToKeep); 

    // Initialize UI status
    const initialStatuses: FileUploadStatus[] = filesToUpload.map(f => ({
        name: f.name,
        progress: 0,
        status: 'pending'
    }));
    setUploadStatuses(initialStatuses);

    // Reset progress tracking ref
    filesProgressRef.current = {};
    filesToUpload.forEach((f, i) => {
        filesProgressRef.current[i] = { loaded: 0, total: f.size };
    });

    try {
      // Concurrent Uploads using Promise.all
      const uploadPromises = filesToUpload.map(async (file, index) => {
          try {
              const message = await uploadDocument(
                  config, 
                  file, 
                  (loaded, total) => {
                      // Update Ref only (UI updates via interval)
                      filesProgressRef.current[index] = { loaded, total };
                  }, 
                  currentFolderId
              );

              // Mark complete in UI immediately for this file
              setUploadStatuses(prev => {
                  const newArr = [...prev];
                  newArr[index] = { ...newArr[index], progress: 100, status: 'completed' };
                  return newArr;
              });

              const doc = message.document;
              const photo = message.photo ? message.photo[message.photo.length - 1] : null;
              const fileId = doc?.file_id || photo?.file_id;
              const fileName = doc?.file_name || (photo ? `Photo_${message.date}.jpg` : file.name);

              if (fileId) {
                  const downloadUrl = getFileDownloadUrl(config, fileId, fileName);
                  return { url: downloadUrl, name: fileName };
              }
              return null;
          } catch (err: any) {
              console.error(`Failed to upload ${file.name}`, err);
               setUploadStatuses(prev => {
                  const newArr = [...prev];
                  newArr[index] = { ...newArr[index], status: 'error', errorMsg: err.message };
                  return newArr;
              });
              return null;
          }
      });

      const results = await Promise.all(uploadPromises);
      const successfulUploads = results.filter((r): r is {url: string, name: string} => r !== null);
      
      await fetchFiles();
      if (successfulUploads.length > 0) {
          setTimeout(() => {
              setUploadedResults(successfulUploads);
          }, 800);
      } else {
          if (uploadStatuses.some(s => s.status === 'error')) {
              setError("Some uploads failed.");
          }
      }
      
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Upload failed.");
    } finally {
      setTimeout(() => {
          setIsUploading(false);
          filesProgressRef.current = {};
      }, 1000);
    }
  };

  const onRequestDelete = (fileId: string, fileName: string) => {
      setFileToDelete({ id: fileId, name: fileName });
  };

  const handleConfirmDelete = async () => {
    if (!fileToDelete) return;
    setIsDeleting(true);
    try {
      const success = await deleteFile(config, fileToDelete.id);
      if (success) {
          fetchFiles();
      } else {
          setError("Failed to delete file from database.");
      }
    } catch (err) {
      console.error(err);
      setError("An error occurred while deleting.");
    } finally {
      setIsDeleting(false);
      setFileToDelete(null);
    }
  };

  const handleCreateFolder = async (name: string) => {
      try {
          await createFolder(config, name, currentFolderId);
          fetchFiles();
      } catch (e) {
          setError("Failed to create folder.");
      }
  };

  const handleNavigate = (folderId: number | null, folderName: string) => {
      if (folderId === null) {
          setBreadcrumbs([{ id: null, name: 'Home' }]);
          setCurrentFolderId(null);
      } else {
          const existingIndex = breadcrumbs.findIndex(b => b.id === folderId);
          if (existingIndex !== -1) {
              setBreadcrumbs(breadcrumbs.slice(0, existingIndex + 1));
          } else {
              setBreadcrumbs([...breadcrumbs, { id: folderId, name: folderName }]);
          }
          setCurrentFolderId(folderId);
      }
  };

  const handleMoveConfirm = async (targetParentId: number | null) => {
      if (!fileToMove) return;
      try {
          await moveFile(config, fileToMove.id, targetParentId);
          fetchFiles();
      } catch (e) {
          setError("Failed to move file.");
      } finally {
          setFileToMove(null);
      }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-20 shadow-sm">
        <div className="mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-telegram-500 rounded-xl flex items-center justify-center shadow-lg shadow-telegram-500/20">
              <UploadCloud className="text-white w-6 h-6" />
            </div>
            <div>
              <h1 className="font-bold text-xl text-slate-900 tracking-tight">TeleCloud</h1>
              <p className="text-xs text-slate-500 font-medium">Persistent Cloud Storage (CF Worker)</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button 
              onClick={fetchFiles}
              className="p-2 text-slate-400 hover:text-telegram-500 hover:bg-slate-50 rounded-lg transition-all"
              title="Refresh List"
            >
              <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button 
              onClick={() => setIsSettingsOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium text-sm transition-colors"
            >
              <Settings className="w-4 h-4" />
              <span>Settings</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="mx-10 space-y-6">
          
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-3 text-sm animate-in slide-in-from-top-2 break-words">
              <Shield className="w-5 h-5 shrink-0" />
              <span className="flex-1">{error}</span>
            </div>
          )}

          {/* Upload & Preview Zone */}
          <div className="max-w-5xl mx-auto relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-telegram-500 to-purple-600 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-500"></div>
            <div className="relative bg-white rounded-xl p-8 border border-slate-100 shadow-sm text-center space-y-4">
              
              {isUploading ? (
                 <div className="max-w-xl mx-auto space-y-3 py-2 text-left">
                    <div className="flex items-center justify-between text-sm mb-2 border-b border-slate-100 pb-2">
                        <span className="font-semibold text-slate-700">Uploading {uploadStatuses.length} files...</span>
                        <span className="text-telegram-600 bg-telegram-50 px-2 py-0.5 rounded text-xs font-mono">{networkSpeed}</span>
                    </div>
                    
                    <div className="max-h-[200px] overflow-y-auto pr-2 custom-scrollbar space-y-3">
                        {uploadStatuses.map((file, idx) => (
                            <div key={idx} className="space-y-1">
                                <div className="flex justify-between text-xs text-slate-600">
                                    <div className="flex items-center gap-1.5 truncate max-w-[70%]">
                                        <FileText className="w-3 h-3" />
                                        <span className="truncate">{file.name}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        {file.status === 'completed' && <CheckCircle2 className="w-3 h-3 text-green-500" />}
                                        {file.status === 'error' && <AlertCircle className="w-3 h-3 text-red-500" />}
                                        <span>{Math.round(file.progress)}%</span>
                                    </div>
                                </div>
                                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                    <div 
                                        className={`h-full transition-all duration-300 ease-out ${
                                            file.status === 'error' ? 'bg-red-500' :
                                            file.status === 'completed' ? 'bg-green-500' :
                                            'bg-gradient-to-r from-telegram-500 to-purple-500'
                                        }`}
                                        style={{ width: `${file.progress}%` }}
                                    ></div>
                                </div>
                                {file.errorMsg && <p className="text-[10px] text-red-500">{file.errorMsg}</p>}
                            </div>
                        ))}
                    </div>
                 </div>
              ) : pendingFiles.length > 0 ? (
                /* Pending Files Preview List */
                <div className="text-left w-full max-w-xl mx-auto animate-in fade-in slide-in-from-bottom-2 duration-300">
                   <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-800 text-lg">Selected Files</span>
                        <span className="bg-telegram-100 text-telegram-700 px-2 py-0.5 rounded-full text-xs font-medium">{pendingFiles.length}</span>
                      </div>
                      <button onClick={handleClearPending} className="text-red-500 text-xs hover:bg-red-50 px-2 py-1 rounded transition-colors flex items-center gap-1">
                         <Trash2 className="w-3 h-3" />
                         Remove All
                      </button>
                   </div>

                   <div className="space-y-2 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar mb-6">
                      {pendingFiles.map((file, i) => (
                         <PendingFileItem 
                            key={`${file.name}-${i}`} 
                            file={file} 
                            onRemove={() => handleRemovePending(i)} 
                            onUpload={() => startUploadProcess([file])}
                            onPreview={(url, name, mime) => setPreviewFile({url, name, mime})}
                         />
                      ))}
                   </div>

                   <div className="flex gap-3 pt-2">
                      <label className="flex-1 cursor-pointer">
                          <input 
                              type="file" 
                              multiple
                              className="sr-only" 
                              onChange={handleFileSelect}
                          />
                          <div className="w-full py-2.5 border border-dashed border-slate-300 rounded-xl text-slate-500 text-sm font-medium hover:bg-slate-50 hover:border-slate-400 transition-all flex items-center justify-center gap-2">
                              <Plus className="w-4 h-4" />
                              Add More
                          </div>
                      </label>
                      <button 
                          onClick={() => startUploadProcess(pendingFiles)}
                          className="flex-[2] py-2.5 bg-telegram-500 hover:bg-telegram-600 text-white rounded-xl text-sm font-medium shadow-lg shadow-telegram-500/20 transition-all flex items-center justify-center gap-2"
                      >
                          <UploadCloud className="w-4 h-4" />
                          Upload All ({pendingFiles.length})
                      </button>
                   </div>
                </div>
              ) : (
                /* Empty / Drop Zone */
                <>
                  <div className="w-16 h-16 bg-telegram-50 text-telegram-500 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
                    <UploadCloud className="w-8 h-8" />
                  </div>
                  <h2 className="text-lg font-semibold text-slate-900">Upload to Cloud</h2>
                  <p className="text-slate-500 max-w-sm mx-auto text-sm">
                    Files are stored in Telegram and indexed in your Cloudflare Database.
                  </p>

                  <div className="flex items-center justify-center gap-4 text-xs text-slate-400 py-2">
                      <div className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded border border-slate-100">
                          <Info className="w-3 h-3" />
                          <span>Max Upload: 50MB</span>
                      </div>
                      <div className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded border border-slate-100">
                          <Info className="w-3 h-3" />
                          <span>Max Download: 20MB</span>
                      </div>
                  </div>
                  
                  <div className="pt-2 flex justify-center gap-4 flex-wrap">
                     <label className="inline-flex relative cursor-pointer">
                        <input 
                            type="file" 
                            multiple
                            className="sr-only" 
                            onChange={handleFileSelect}
                            disabled={!config.botToken}
                        />
                        <span className={`px-6 py-3 rounded-xl font-medium text-white shadow-lg shadow-telegram-500/25 transition-all transform hover:translate-y-[-2px] active:translate-y-0 ${!config.botToken ? 'bg-slate-400 cursor-not-allowed' : 'bg-telegram-500 hover:bg-telegram-600'}`}>
                            {config.botToken ? 'Select Files' : 'Configure Settings First'}
                        </span>
                     </label>
                     
                     <button 
                        onClick={() => setIsImportOpen(true)}
                        disabled={!config.botToken}
                        className="px-6 py-3 rounded-xl font-medium text-telegram-600 bg-telegram-50 hover:bg-telegram-100 transition-colors flex items-center gap-2 disabled:opacity-50"
                     >
                        <Import className="w-5 h-5" />
                        <span>Import ID</span>
                     </button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Breadcrumbs & Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-8">
            <div className="flex items-center gap-2 text-sm text-slate-600 overflow-x-auto pb-1 sm:pb-0">
               <button 
                 onClick={() => handleNavigate(null, '')}
                 className={`p-1.5 rounded-lg transition-colors flex items-center gap-1 ${currentFolderId === null ? 'bg-slate-200 text-slate-800' : 'hover:bg-slate-100'}`}
               >
                 <Home className="w-4 h-4" />
               </button>
               {breadcrumbs.slice(1).map((crumb, i) => (
                  <div key={crumb.id || i} className="flex items-center gap-2">
                     <ChevronRight className="w-4 h-4 text-slate-300" />
                     <button 
                        onClick={() => handleNavigate(crumb.id, crumb.name)}
                        className={`font-medium px-2 py-1 rounded-lg transition-colors whitespace-nowrap ${currentFolderId === crumb.id ? 'bg-slate-200 text-slate-900' : 'hover:bg-slate-100 text-slate-600'}`}
                     >
                        {crumb.name}
                     </button>
                  </div>
               ))}
            </div>

            <div className="flex items-center gap-3">
               <button
                 onClick={() => setIsCreateFolderOpen(true)}
                 className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 text-slate-700 hover:text-telegram-600 hover:border-telegram-200 rounded-lg text-sm font-medium transition-all shadow-sm"
               >
                 <FolderPlus className="w-4 h-4" />
                 <span>New Folder</span>
               </button>
               <div className="h-4 w-px bg-slate-200 mx-1 hidden sm:block"></div>
               <div className="flex items-center gap-3 text-slate-400">
                    <Database className="w-4 h-4" />
                    <span className="text-xs font-medium">{files.length} items</span>
               </div>
            </div>
          </div>

          {/* Files Grid */}
          {files.length === 0 ? (
            <div className="text-center py-20 opacity-50 bg-white border border-dashed border-slate-200 rounded-xl">
                <HardDrive className="w-12 h-12 mx-auto text-slate-300 mb-4" />
                <p className="text-slate-500 font-medium">This folder is empty.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {files.map((update) => (
                    <div 
                        key={update.update_id} 
                        onClick={() => {
                            const doc = update.message?.document;
                            if (doc?.is_folder) {
                                handleNavigate(update.update_id, doc.file_name || 'Folder');
                            }
                        }}
                    >
                        <FileCard 
                            message={update.message || update.channel_post!} 
                            config={config}
                            onDeleteClick={onRequestDelete}
                            onMoveClick={(id, parentId) => setFileToMove({id, parentId})}
                            onNavigate={(id, name) => handleNavigate(id, name)}
                            onPreview={(url, name, mime) => setPreviewFile({url, name, mime})}
                        />
                    </div>
                ))}
            </div>
          )}
        </div>
      </main>

      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} config={config} onSave={setConfig} />
      <ImportModal isOpen={isImportOpen} onClose={() => setIsImportOpen(false)} config={config} onImportComplete={fetchFiles} />
      <UploadSuccessModal isOpen={uploadedResults.length > 0} onClose={() => setUploadedResults([])} files={uploadedResults} />
      <DeleteConfirmModal isOpen={!!fileToDelete} onClose={() => setFileToDelete(null)} onConfirm={handleConfirmDelete} fileName={fileToDelete?.name || 'File'} isDeleting={isDeleting} />
      
      <CreateFolderModal 
        isOpen={isCreateFolderOpen} 
        onClose={() => setIsCreateFolderOpen(false)} 
        onCreate={handleCreateFolder} 
      />
      
      <MoveFileModal 
        isOpen={!!fileToMove}
        onClose={() => setFileToMove(null)}
        config={config}
        fileId={fileToMove?.id || ''}
        currentParentId={fileToMove?.parentId || null}
        onMove={handleMoveConfirm}
      />
      
      {previewFile && (
        <PreviewModal 
           isOpen={!!previewFile} 
           onClose={() => setPreviewFile(null)} 
           url={previewFile.url} 
           fileName={previewFile.name} 
           mimeType={previewFile.mime} 
        />
      )}
    </div>
  );
}

export default App;
