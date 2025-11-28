import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Settings, UploadCloud, RefreshCw, Shield, HardDrive, Import, Database, FolderPlus, Home, ChevronRight, Info, FileText, CheckCircle2, AlertCircle, X, Trash2, Plus, Eye, Moon, Sun, Search, ListFilter, ArrowDownNarrowWide, ArrowUpNarrowWide, Check } from 'lucide-react';
import { FileIcon, defaultStyles } from 'react-file-icon';
import { AppConfig, TelegramUpdate, DEFAULT_WORKER_URL, SortConfig, SortField, SortOrder } from './types';
import { formatBytes, isFilePreviewable } from './constants';
import { SettingsModal } from './components/SettingsModal';
import { UploadSuccessModal } from './components/UploadSuccessModal';
import { ImportModal } from './components/ImportModal';
import { DeleteConfirmModal } from './components/DeleteConfirmModal';
import { CreateFolderModal } from './components/CreateFolderModal';
import { MoveFileModal } from './components/MoveFileModal';
import { PreviewModal } from './components/PreviewModal';
import { getStoredFiles, uploadDocument, getFileDownloadUrl, deleteFile, createFolder, moveFile, searchFiles } from './services/telegramService';
import { FileCard } from './components/FileCard';

const CONFIG_STORAGE_KEY = 'telecloud_config_v2';
const THEME_STORAGE_KEY = 'telecloud_theme';

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

  const isPreviewable = isFilePreviewable(file.name, file.type).ok;

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
    
    // Fallback (and for Audio/PDF/Text) show Icon
    return (
        <div className="w-8 h-8">
            <FileIcon extension={ext} {...iconStyle} />
        </div>
    );
  };

  return (
    <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-lg group/item hover:border-telegram-200 dark:hover:border-telegram-700 hover:shadow-sm transition-all">
        <div className="flex items-center gap-3 min-w-0">
            <div 
                onClick={previewUrl ? handlePreviewClick : undefined}
                className={`w-12 h-12 rounded-lg bg-white dark:bg-slate-700 flex items-center justify-center border border-slate-200 dark:border-slate-600 overflow-hidden shrink-0 relative group/thumb ${previewUrl ? 'cursor-pointer' : ''}`}
            >
                {renderThumbnail()}
                
                {/* Overlay Eye Icon for previewable items */}
                {previewUrl && (
                    <div className="absolute inset-0 bg-black/10 opacity-0 group-hover/thumb:opacity-100 flex items-center justify-center transition-opacity">
                        <div className="bg-white/90 dark:bg-slate-800/90 rounded-full p-1 shadow-sm">
                            <Eye className="w-3 h-3 text-telegram-600 dark:text-telegram-400" />
                        </div>
                    </div>
                )}
            </div>
            <div className="min-w-0 text-left">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate" title={file.name}>{file.name}</p>
                <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
                    <span>{formatBytes(file.size)}</span>
                    {previewUrl && (
                        <button 
                            onClick={handlePreviewClick}
                            className="text-telegram-600 dark:text-telegram-400 bg-telegram-50 dark:bg-telegram-900/30 hover:bg-telegram-100 dark:hover:bg-telegram-900/50 px-1.5 rounded text-[10px] font-medium transition-colors flex items-center gap-1"
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
                className="p-2 text-slate-400 hover:text-telegram-500 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-colors shadow-sm border border-transparent hover:border-slate-100 dark:hover:border-slate-600"
                title="Upload this file only"
            >
                <UploadCloud className="w-4 h-4" />
            </button>
            <button 
                onClick={onRemove}
                className="p-2 text-slate-400 hover:text-red-500 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-colors shadow-sm border border-transparent hover:border-slate-100 dark:hover:border-slate-600"
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

  // Dark Mode State
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    return saved ? JSON.parse(saved) : window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(isDarkMode));
  }, [isDarkMode]);

  const [files, setFiles] = useState<TelegramUpdate[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Folder Navigation State
  const [currentFolderId, setCurrentFolderId] = useState<number | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<Breadcrumb[]>([{ id: null, name: 'Home' }]);
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  
  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  
  // Sort State
  const [sortConfig, setSortConfig] = useState<SortConfig>({ field: 'date', order: 'desc' });
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);

  // Upload State
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatuses, setUploadStatuses] = useState<FileUploadStatus[]>([]);
  const [networkSpeed, setNetworkSpeed] = useState<string>('0 B/s');
  
  // Drag and Drop State
  const [isDragging, setIsDragging] = useState(false);

  // Refs for tracking concurrent upload progress
  // Maps index -> { loaded, total }
  const filesProgressRef = useRef<{ [key: number]: { loaded: number, total: number } }>({});
  const lastLoadedBytesRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  const [error, setError] = useState<{
    type: string,
    message: string,
    links?: string[];
    linkOptions?: {
      linkText?: string;
      showIcon?: boolean;
      icon?: string;
    }
  } | null>(null);
  const [uploadedResults, setUploadedResults] = useState<{url: string, name: string}[]>([]);
  
  // Action states
  const [fileToDelete, setFileToDelete] = useState<{id: string, name: string} | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const [fileToMove, setFileToMove] = useState<{id: string, parentId: number | null} | null>(null);
  const [previewFile, setPreviewFile] = useState<{url: string, name: string, mime: string} | null>(null);

  // Active Menu ID state to ensure only one menu is open at a time
  const [activeMenuId, setActiveMenuId] = useState<number | null>(null);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
        setActiveMenuId(null);
        setIsSortMenuOpen(false);
    };
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

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
    
    // Don't fetch folder content if we are actively searching
    if (searchQuery.trim() !== '') return;

    setIsLoading(true);
    setError(null);
    try {
        const dbFiles = await getStoredFiles(config, currentFolderId, sortConfig);
        setFiles(dbFiles);
    } catch (err: any) {
      console.error(err);
      setError({
        type: "error",
        message: "Failed to fetch files. Ensure Worker is deployed and configured."
      });
    } finally {
      setIsLoading(false);
    }
  }, [config, currentFolderId, searchQuery, sortConfig]);

  // Refresh when config or folder changes
  useEffect(() => {
    if (config.botToken && config.chatId) {
      fetchFiles();
      setActiveMenuId(null); // Close menus on navigation
    }
  }, [config, fetchFiles]);

  // Handle Search
  useEffect(() => {
    const delayDebounce = setTimeout(async () => {
        if (searchQuery.trim().length > 0) {
            setIsSearching(true);
            setIsLoading(true);
            try {
                const results = await searchFiles(config, searchQuery);
                setFiles(results);
            } catch (e) {
                console.error(e);
                setError("Search failed.");
            } finally {
                setIsSearching(false);
                setIsLoading(false);
            }
        } else if (searchQuery === '') {
            // Restore folder view when cleared
            fetchFiles();
        }
    }, 400);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery, config, fetchFiles]);

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

  // Reusable file processor
  const processFiles = (newFiles: File[]) => {
      const validFiles: File[] = [];
      let skippedCount = 0;

      newFiles.forEach(f => {
          if (f.size > 50 * 1024 * 1024) {
              skippedCount++;
          } else {
              validFiles.push(f);
          }
      });

      if (skippedCount > 0) {
          setError({
            type: "error",
            message: `Skipped ${skippedCount} files larger than 50MB.`
          });
      } else {
          setError(null);
      }
      
      if (validFiles.length > 0) {
          setPendingFiles(prev => {
             // Filter duplicates against existing pending files
             const uniqueNewFiles = validFiles.filter(nf => 
                 !prev.some(pf => pf.name === nf.name && pf.size === nf.size && pf.lastModified === nf.lastModified)
             );
             return [...prev, ...uniqueNewFiles];
          });
      }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = Array.from(e.target.files || []);
      if (selectedFiles.length === 0) return;
      processFiles(selectedFiles);
      e.target.value = ''; // Reset input
  };

  // Drag and Drop Handlers
  const handleDragEnter = (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!config.botToken || isUploading) return;
      setIsDragging(true);
  };

  const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!config.botToken || isUploading) return;
      setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      // Only disable if we actually leave the container (not entering a child)
      if (e.currentTarget.contains(e.relatedTarget as Node)) return;
      setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      if (!config.botToken || isUploading) return;
      
      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) processFiles(files);
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
              setError({
                type: "error",
                message: "Some uploads failed."
              });
          }
      }
      
    } catch (err: any) {
      console.error(err);
      setError({type: "error", message: err.message || "Upload failed."});
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
      if (success.ok) {
          // If searching, we re-search to update list, otherwise fetch folder
          if (searchQuery.trim() !== '') {
              const results = await searchFiles(config, searchQuery);
              setFiles(results);
          } else {
            fetchFiles();
            if(success.data?.msgLinks?.length){
              let errMsg = "This message is older than 48 hours and must be deleted manually: ";
              
              setError({
                type: "warning",
                message: errMsg,
                links: success.data.msgLinks,
                linkOptions: {
                  showIcon: true,
                  icon: "↗",
                }
              });
            }
          }
      } else {
          setError({type: "error", message: "Failed to delete file from database."});
      }
    } catch (err) {
      console.error(err);
      setError({type: "error", message: "An error occurred while deleting."});
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
          setError({type: "error", message: "Failed to create folder."});
      }
  };

  const handleNavigate = (folderId: number | null, folderName: string) => {
      // Clear search if navigating folders
      if (searchQuery) setSearchQuery('');

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
          if (searchQuery.trim() !== '') {
             const results = await searchFiles(config, searchQuery);
             setFiles(results);
          } else {
             fetchFiles();
          }
      } catch (e) {
          setError({type: "error", message: "Failed to move file."});
      } finally {
          setFileToMove(null);
      }
  };

  const handleSortChange = (field: SortField, order: SortOrder) => {
      setSortConfig({ field, order });
      setIsSortMenuOpen(false);
      // Fetch will automatically trigger due to dependency array
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-200">
      {/* Header */}
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 sm:px-6 py-4 sticky top-0 z-20 shadow-sm">
        <div className="mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center justify-between w-full sm:w-auto">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 min-w-10 bg-telegram-500 rounded-xl flex items-center justify-center shadow-lg shadow-telegram-500/20">
                  <UploadCloud className="text-white w-6 h-6" />
                </div>
                <div>
                <h1 className="font-bold text-xl text-slate-900 dark:text-white tracking-tight leading-none">TeleCloud</h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">Persistent Cloud Storage (CF Worker)</p>
                </div>
            </div>
            
            {/* Mobile Actions Right */}
            <div className="flex items-center gap-3 sm:hidden">
                <button
                    onClick={() => setIsDarkMode(!isDarkMode)}
                    className="p-2 text-slate-400 hover:text-telegram-500 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition-all"
                >
                    {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                </button>
                <button 
                  onClick={fetchFiles}
                  className="p-2 text-slate-400 hover:text-telegram-500 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition-all"
                  title="Refresh List"
                >
                  <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
                </button>
                <button 
                onClick={() => setIsSettingsOpen(true)}
                className="p-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg"
                >
                <Settings className="w-5 h-5" />
                </button>
            </div>
          </div>

          {/* Search Bar */}
          <div className="min-w-40 flex-1 w-full sm:max-w-md mx-4 relative group">
             <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-slate-400 group-focus-within:text-telegram-500 transition-colors" />
             </div>
             <input
               type="text"
               value={searchQuery}
               onChange={(e) => setSearchQuery(e.target.value)}
               placeholder="Search files..."
               className="block w-full pl-10 pr-10 py-2 border border-slate-200 dark:border-slate-600 rounded-xl leading-5 bg-slate-50 dark:bg-slate-700/50 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:bg-white dark:focus:bg-slate-800 focus:border-telegram-500 focus:ring-1 focus:ring-telegram-500 sm:text-sm transition-all"
             />
             {searchQuery && (
                <button 
                   onClick={() => setSearchQuery('')}
                   className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                   <X className="h-4 w-4" />
                </button>
             )}
          </div>
          
          <div className="hidden sm:flex items-center gap-3">
            {/* Dark Mode Toggle */}
            <button
                onClick={() => setIsDarkMode(!isDarkMode)}
                className="p-2 text-slate-400 hover:text-telegram-500 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition-all"
                title="Toggle Theme"
            >
                {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>

            <button 
              onClick={fetchFiles}
              className="p-2 text-slate-400 hover:text-telegram-500 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition-all"
              title="Refresh List"
            >
              <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button 
              onClick={() => setIsSettingsOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg font-medium text-sm transition-colors"
            >
              <Settings className="w-4 h-4" />
              <span className="hidden min-[480px]:inline">Settings</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 pb-20 custom-scrollbar">
        <div className="space-y-6" style={{ marginLeft: '3%', marginRight: '3%' }}>
          
          {error && (
            <div className={`${error.type == "warning" ? "bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 text-yellow-700 dark:text-yellow-300" : "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300" } px-4 py-3 rounded-xl flex items-center gap-3 text-sm animate-in slide-in-from-top-2 break-words`}>
              <Shield className="w-5 h-5 shrink-0" />
              <span className="flex-1">
                {error.message}

                {error.links?.length && (
                  <span className = "inline-flex gap-2">
                    {error.links?.map((url, idx) => (
                      <a
                        key={idx}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-telegram-700 hover:text-telegram-500 underline"
                      >
                        {error.linkOptions?.linkText?.replace("__idx__", (idx + 1).toString()) || url}
                        &nbsp;
                        {error.linkOptions?.showIcon && (
                          error.linkOptions.icon
                        )}
                      </a>
                    ))}
                  </span>
                )}
              </span>
            </div>
          )}

          {/* Upload & Preview Zone - Hide when searching to reduce clutter */}
          {searchQuery === '' && (
            <div 
                className="max-w-5xl mx-auto relative group"
                onDragEnter={handleDragEnter}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                {/* ... Upload UI content from previous step ... */}
                <div className="absolute -inset-1 bg-gradient-to-r from-telegram-500 to-purple-600 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-500"></div>
                <div className="relative bg-white dark:bg-slate-800 rounded-xl p-8 border border-slate-100 dark:border-slate-700 shadow-sm text-center space-y-4">
                
                {isUploading ? (
                    <div className="max-w-xl mx-auto space-y-3 py-2 text-left">
                        <div className="flex items-center justify-between text-sm mb-2 border-b border-slate-100 dark:border-slate-700 pb-2">
                            <span className="font-semibold text-slate-700 dark:text-slate-200">Uploading {uploadStatuses.length} files...</span>
                            <span className="text-telegram-600 dark:text-telegram-400 bg-telegram-50 dark:bg-telegram-900/30 px-2 py-0.5 rounded text-xs font-mono">{networkSpeed}</span>
                        </div>
                        
                        <div className="max-h-[200px] overflow-y-auto pr-2 custom-scrollbar space-y-3">
                            {uploadStatuses.map((file, idx) => (
                                <div key={idx} className="space-y-1">
                                    <div className="flex justify-between text-xs text-slate-600 dark:text-slate-300">
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
                                    <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
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
                    <div className="flex justify-between items-center mb-4 border-b border-slate-100 dark:border-slate-700 pb-2">
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-800 dark:text-white text-lg">Selected Files</span>
                            <span className="bg-telegram-100 dark:bg-telegram-900/50 text-telegram-700 dark:text-telegram-300 px-2 py-0.5 rounded-full text-xs font-medium">{pendingFiles.length}</span>
                        </div>
                        <button onClick={handleClearPending} className="text-red-500 text-xs hover:bg-red-50 dark:hover:bg-red-900/20 px-2 py-1 rounded transition-colors flex items-center gap-1">
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
                            <div className="w-full py-2.5 border border-dashed border-slate-300 dark:border-slate-600 rounded-xl text-slate-500 dark:text-slate-400 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 hover:border-slate-400 dark:hover:border-slate-500 transition-all flex items-center justify-center gap-2">
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
                    <div className="w-16 h-16 bg-telegram-50 dark:bg-telegram-900/30 text-telegram-500 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
                        <UploadCloud className="w-8 h-8" />
                    </div>
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Upload to Cloud</h2>
                    <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto text-sm">
                        Files are stored in Telegram and indexed in your Cloudflare Database.
                    </p>

                    <div className="flex items-center justify-center gap-4 text-xs text-slate-400 dark:text-slate-500 py-2">
                        <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-700/50 px-2 py-1 rounded border border-slate-100 dark:border-slate-700">
                            <Info className="w-3 h-3" />
                            <span>Max Upload: 50MB</span>
                        </div>
                        <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-700/50 px-2 py-1 rounded border border-slate-100 dark:border-slate-700">
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
                            className="px-6 py-3 rounded-xl font-medium text-telegram-600 dark:text-telegram-400 bg-telegram-50 dark:bg-telegram-900/30 hover:bg-telegram-100 dark:hover:bg-telegram-900/50 transition-colors flex items-center gap-2 disabled:opacity-50"
                        >
                            <Import className="w-5 h-5" />
                            <span>Import ID</span>
                        </button>
                    </div>
                    </>
                )}
                </div>

                {/* Drag & Drop Overlay */}
                {isDragging && (
                    <div className="absolute inset-0 z-50 bg-white/90 dark:bg-slate-800/95 backdrop-blur-sm border-2 border-dashed border-telegram-500 rounded-xl flex flex-col items-center justify-center animate-in fade-in duration-200 cursor-copy">
                        <div className="bg-telegram-50 dark:bg-telegram-900/30 p-6 rounded-full shadow-xl shadow-telegram-500/10 mb-4 animate-bounce">
                            <UploadCloud className="w-12 h-12 text-telegram-500" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 dark:text-white">Drop files to upload</h3>
                        <p className="text-slate-500 dark:text-slate-400 mt-2">Release to add to pending list</p>
                    </div>
                )}
            </div>
          )}

          {/* Controls: Navigation or Search Header */}
          {searchQuery !== '' ? (
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-700">
                <Search className="w-5 h-5 text-telegram-500" />
                <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
                    Search Results for "{searchQuery}"
                </h2>
                {isSearching && <span className="text-xs text-slate-400 animate-pulse ml-2">Searching...</span>}
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-8">
                <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 overflow-x-auto pb-1 sm:pb-0">
                <button 
                    onClick={() => handleNavigate(null, '')}
                    className={`p-1.5 rounded-lg transition-colors flex items-center gap-1 ${currentFolderId === null ? 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                >
                    <Home className="w-4 h-4" />
                </button>
                {breadcrumbs.slice(1).map((crumb, i) => (
                    <div key={crumb.id || i} className="flex items-center gap-2">
                        <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600" />
                        <button 
                            onClick={() => handleNavigate(crumb.id, crumb.name)}
                            className={`font-medium px-2 py-1 rounded-lg transition-colors whitespace-nowrap ${currentFolderId === crumb.id ? 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-slate-100' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'}`}
                        >
                            {crumb.name}
                        </button>
                    </div>
                ))}
                </div>

                <div className="flex items-center gap-3">
                    {/* Sort Dropdown */}
                    <div className="relative">
                        <button 
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsSortMenuOpen(!isSortMenuOpen);
                            }}
                            className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-telegram-600 dark:hover:text-telegram-400 hover:border-telegram-200 dark:hover:border-telegram-700 rounded-lg text-sm font-medium transition-all shadow-sm"
                        >
                            {sortConfig.order === 'asc' ? <ArrowUpNarrowWide className="w-4 h-4" /> : <ArrowDownNarrowWide className="w-4 h-4" />}
                            <span className="hidden min-[480px]:inline">Sort</span>
                        </button>
                        
                        {isSortMenuOpen && (
                            <div 
                                className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-100 dark:border-slate-700 z-30 py-1 animate-in fade-in zoom-in-95 duration-100 origin-top-right"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <div className="px-3 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">Sort By</div>
                                
                                {(['name', 'date', 'size'] as SortField[]).map(field => (
                                    <button
                                        key={field}
                                        onClick={() => handleSortChange(field, sortConfig.order)}
                                        className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center justify-between capitalize"
                                    >
                                        {field}
                                        {sortConfig.field === field && <Check className="w-4 h-4 text-telegram-500" />}
                                    </button>
                                ))}
                                
                                <div className="h-px bg-slate-100 dark:bg-slate-700 my-1"></div>
                                <div className="px-3 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">Order</div>

                                <button
                                    onClick={() => handleSortChange(sortConfig.field, 'asc')}
                                    className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center justify-between"
                                >
                                    Ascending
                                    {sortConfig.order === 'asc' && <Check className="w-4 h-4 text-telegram-500" />}
                                </button>
                                <button
                                    onClick={() => handleSortChange(sortConfig.field, 'desc')}
                                    className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center justify-between"
                                >
                                    Descending
                                    {sortConfig.order === 'desc' && <Check className="w-4 h-4 text-telegram-500" />}
                                </button>
                            </div>
                        )}
                    </div>

                    <button
                        onClick={() => setIsCreateFolderOpen(true)}
                        disabled={!config.workerUrl}
                        className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-telegram-600 dark:hover:text-telegram-400 hover:border-telegram-200 dark:hover:border-telegram-700 rounded-lg text-sm font-medium transition-all shadow-sm"
                    >
                        <FolderPlus className="w-4 h-4" />
                        <span className="hidden min-[480px]:inline">New Folder</span>
                    </button>
                    <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-1 hidden sm:block"></div>
                    <div className="flex items-center gap-3 text-slate-400 dark:text-slate-500">
                            <Database className="w-4 h-4" />
                            <span className="text-xs font-medium">{files.length} items</span>
                    </div>
                </div>
            </div>
          )}

          {/* Files Grid */}
          {files.length === 0 && !isLoading ? (
            <div className="text-center py-20 opacity-50 bg-white dark:bg-slate-800 border border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
                {searchQuery !== '' ? (
                    <>
                        <Search className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-4" />
                        <p className="text-slate-500 dark:text-slate-400 font-medium">No files matching your search.</p>
                    </>
                ) : (
                    <>
                        <HardDrive className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-4" />
                        <p className="text-slate-500 dark:text-slate-400 font-medium">This folder is empty.</p>
                    </>
                )}
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
                            isMenuOpen={activeMenuId === update.update_id}
                            onMenuToggle={() => setActiveMenuId(prev => prev === update.update_id ? null : update.update_id)}
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