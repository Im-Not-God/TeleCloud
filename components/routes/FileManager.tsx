import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Settings,
  UploadCloud,
  RefreshCw,
  Shield,
  HardDrive,
  Import,
  Database,
  FolderPlus,
  Home,
  ChevronRight,
  Info,
  X,
  Trash2,
  Plus,
  Moon,
  Sun,
  Search,
  ArrowDownNarrowWide,
  ArrowUpNarrowWide,
  Check,
  Globe,
  Download,
  Menu,
  Monitor,
  Filter,
  Calendar,
} from "lucide-react";
import {
  AppConfig,
  TelegramUpdate,
  DEFAULT_WORKER_URL,
  SortConfig,
  SortField,
  SortOrder,
  DownloadTask,
  FileUploadStatus,
  FilterType,
  TimeFilter,
} from "../../types";
import {
  CONFIG_STORAGE_KEY,
  THEME_STORAGE_KEY,
  CHUNK_SIZE,
  formatBytes,
  t,
  DEFAULT_LANG,
  translations,
  stringToNumberHash,
} from "../../constants";
import { SettingsModal } from "../SettingsModal";
import { UploadSuccessModal } from "../UploadSuccessModal";
import { ImportModal } from "../ImportModal";
import { DeleteConfirmModal } from "../DeleteConfirmModal";
import { CreateFolderModal } from "../CreateFolderModal";
import { MoveFileModal } from "../MoveFileModal";
import { PreviewModal } from "../PreviewModal";
import { DownloadModal } from "../DownloadModal";
import { DownloadListModal } from "../DownloadListModal";
import {
  getStoredFiles,
  uploadDocument,
  getFileUrl,
  deleteFile,
  createFolder,
  moveFile,
  searchFiles,
} from "../../services/telegramService";
import { processFilesWithSlicing } from "../../services/fileSliceService";
import { FileCard } from "../FileCard";

import { UploadQueue } from "../UploadQueue";
import { PendingFileItem } from "../PendingFileItem";
import { FilterMenu } from "../FilterMenu";
import { SortMenu } from "../SortMenu";

// Breadcrumb item type
interface Breadcrumb {
  id: number | null;
  name: string;
}

export function FileManager() {
  const navigate = useNavigate();
  const { folderId } = useParams<{ folderId: string }>();
  // Load Config
  const [config, setConfig] = useState<AppConfig>(() => {
    const saved = localStorage.getItem(CONFIG_STORAGE_KEY);
    return saved
      ? JSON.parse(saved)
      : {
          botToken: "",
          chatId: "",
          workerUrl: DEFAULT_WORKER_URL,
          language:
            (navigator.languages?.[0] || navigator.language).split("-")[0] ||
            DEFAULT_LANG,
        };
  });

  const lang = config.language;

  // Theme State
  type Theme = "light" | "dark" | "system";
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    // Migration: if saved is boolean (old), convert to 'light'/'dark'
    if (saved === "true") return "dark";
    if (saved === "false") return "light";
    // Remove quotes if they exist (JSON.stringify adds them)
    const cleanSaved = saved ? saved.replace(/"/g, "") : null;
    return (cleanSaved as Theme) || "system";
  });

  useEffect(() => {
    const applyTheme = () => {
      const isDark =
        theme === "dark" ||
        (theme === "system" &&
          window.matchMedia("(prefers-color-scheme: dark)").matches);

      if (isDark) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    };

    applyTheme();
    localStorage.setItem(THEME_STORAGE_KEY, theme);

    if (theme === "system") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const handler = () => applyTheme();
      mediaQuery.addEventListener("change", handler);
      return () => mediaQuery.removeEventListener("change", handler);
    }
  }, [theme]);

  const [files, setFiles] = useState<TelegramUpdate[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Folder Navigation State
  // Sync with URL params
  const [currentFolderId, setCurrentFolderId] = useState<number | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<Breadcrumb[]>([
    { id: null, name: "Home" },
  ]);

  // Effect to sync URL params to state
  useEffect(() => {
    const newFolderId = folderId ? parseInt(folderId, 10) : null;
    setCurrentFolderId(newFolderId);

    // If navigating to root, reset breadcrumbs
    if (newFolderId === null) {
      setBreadcrumbs([{ id: null, name: "Home" }]);
    }
    // If navigating to a folder, we might need to handle breadcrumbs if they are missing
    // For now we trust handleNavigate maintains them, or we accept they might be partial on reload
  }, [folderId]);
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);

  // ...

  // In App function:
  // Filter State
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("all");
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);

  // Filter Logic
  const filteredFiles = files.filter((file) => {
    const msg = file.message || file.channel_post;
    if (!msg) return false;

    // 1. Type Filter
    let typeMatch = true;
    if (filterType !== "all") {
      const doc = msg.document;
      const isFolder = doc?.is_folder;
      const mime = doc?.mime_type || (msg.photo ? "image/jpeg" : "");

      if (filterType === "folder") {
        typeMatch = !!isFolder;
      } else if (isFolder) {
        // If specific type selected (e.g. Photo), hide folders?
        // Usually file managers hide folders when filtering by file type, or show them?
        // Let's hide folders if a specific file type is requested to reduce clutter.
        typeMatch = false;
      } else if (filterType === "photo") {
        typeMatch = !!msg.photo || mime.startsWith("image/");
      } else if (filterType === "video") {
        typeMatch = mime.startsWith("video/");
      } else if (filterType === "audio") {
        typeMatch = mime.startsWith("audio/");
      } else if (filterType === "document") {
        const isMedia =
          mime.startsWith("image/") ||
          mime.startsWith("video/") ||
          mime.startsWith("audio/");
        typeMatch = !isMedia;
      }
    }
    if (!typeMatch) return false;

    // 2. Time Filter
    let timeMatch = true;
    const date = msg.date * 1000;
    const now = Date.now();

    if (timeFilter !== "all") {
      if (timeFilter === "24h") {
        timeMatch = now - date <= 24 * 60 * 60 * 1000;
      } else if (timeFilter === "7d") {
        timeMatch = now - date <= 7 * 24 * 60 * 60 * 1000;
      } else if (timeFilter === "30d") {
        timeMatch = now - date <= 30 * 24 * 60 * 60 * 1000;
      } else if (timeFilter === "custom") {
        const fileDate = new Date(date);
        if (customStartDate) {
          const start = new Date(customStartDate);
          start.setHours(0, 0, 0, 0); // Start of day
          if (fileDate < start) timeMatch = false;
        }
        if (customEndDate && timeMatch) {
          const end = new Date(customEndDate);
          end.setHours(23, 59, 59, 999); // End of day
          if (fileDate > end) timeMatch = false;
        }
      }
    }

    return timeMatch;
  });

  // Search State
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  // Sort State
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    field: "date",
    order: "desc",
  });
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);

  // Language Menu State
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);

  // Theme Menu State
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);

  // Close menus on click outside
  useEffect(() => {
    const handleClickOutside = () => {
      setIsLangMenuOpen(false);
      setIsThemeMenuOpen(false);
      setIsSortMenuOpen(false);
      setIsFilterMenuOpen(false);
    };
    window.addEventListener("click", handleClickOutside);
    return () => window.removeEventListener("click", handleClickOutside);
  }, []);

  // Upload State
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [activeUploads, setActiveUploads] = useState<FileUploadStatus[]>([]);
  const [networkSpeed, setNetworkSpeed] = useState<string>("0 B/s");
  const smoothSpeedRef = useRef(0);

  // Drag and Drop State
  const [isDragging, setIsDragging] = useState(false);

  // Refs for tracking concurrent upload progress & cancellation
  // Maps uploadId -> { loaded, total }
  const filesProgressRef = useRef<
    Map<string, { loaded: number; total: number }>
  >(new Map());
  // Maps uploadId -> AbortController
  const uploadControllersRef = useRef<Map<string, AbortController>>(new Map());
  const lastLoadedBytesRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  const [notification, setNotification] = useState<{
    type: "success" | "error" | "warning" | "info";
    messageKey?: keyof (typeof translations)["en"]; // translation key
    message?: string; // raw message (fallback)
    links?: string[];
    linkOptions?: {
      linkText?: string;
      showIcon?: boolean;
      icon?: string;
    };
  } | null>(null);
  const notificationStyles = {
    info: "bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300",
    warning:
      "bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 text-yellow-700 dark:text-yellow-300",
    error:
      "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300",
  };

  const [uploadedResults, setUploadedResults] = useState<
    { url: string; name: string }[]
  >([]);

  // Download states
  const [activeDownloads, setActiveDownloads] = useState<DownloadTask[]>([]); // List of all active/recent downloads
  const [isDownloadListOpen, setIsDownloadListOpen] = useState(false); // Controls visibility of the download list modal
  const [currentDownloadId, setCurrentDownloadId] = useState<string | null>(
    null,
  ); // ID of the download currently shown in DownloadModal

  // Action states
  const [fileToDelete, setFileToDelete] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [fileToMove, setFileToMove] = useState<{
    id: string;
    parentId: number | null;
  } | null>(null);
  const [previewFile, setPreviewFile] = useState<{
    url: string;
    name: string;
    mime: string;
    chunks?: any[];
  } | null>(null);

  // Active Menu ID state to ensure only one menu is open at a time
  const [activeMenuId, setActiveMenuId] = useState<number | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const breadcrumbsRef = useRef<HTMLDivElement>(null);

  // Download progress update functions
  const addDownloadTask = useCallback((task: DownloadTask) => {
    setActiveDownloads((prev) => {
      // Ensure no duplicate tasks by ID
      if (prev.some((t) => t.id === task.id)) return prev;
      return [task, ...prev];
    });
    setCurrentDownloadId(task.id); // Automatically open the modal for the new download
  }, []);

  const updateDownloadTaskProgress = useCallback(
    (
      taskId: string,
      chunkIndex: number,
      name: string,
      progress: number,
      status: "pending" | "downloading" | "completed" | "error" | "aborted",
      errorMsg?: string,
    ) => {
      setActiveDownloads((prev) =>
        prev.map((task) => {
          if (task.id === taskId) {
            const newChunkProgresses = [...task.chunkProgresses];
            newChunkProgresses[chunkIndex] = {
              name,
              progress,
              status,
              errorMsg,
            };

            // Recalculate overall progress
            const totalChunks = newChunkProgresses.length;
            const completedChunks = newChunkProgresses.filter(
              (c) => c.status === "completed",
            ).length;
            const downloadingChunks = newChunkProgresses.filter(
              (c) => c.status === "downloading",
            ).length;
            const errorChunks = newChunkProgresses.filter(
              (c) => c.status === "error",
            ).length;
            const abortedChunks = newChunkProgresses.filter(
              (c) => c.status === "aborted",
            ).length;

            let newOverallProgress = 0;
            if (totalChunks > 0) {
              newOverallProgress =
                newChunkProgresses.reduce((sum, c) => sum + c.progress, 0) /
                totalChunks;
            }

            let newStatus: DownloadTask["status"] = "downloading";
            if (errorChunks > 0 || abortedChunks > 0) {
              newStatus = "error";
            } else if (completedChunks === totalChunks) {
              newStatus = "completed";
            } else if (downloadingChunks === 0 && completedChunks === 0) {
              newStatus = "pending";
            }

            return {
              ...task,
              chunkProgresses: newChunkProgresses,
              overallProgress: newOverallProgress,
              status: newStatus,
              endTime:
                newStatus === "completed" || newStatus === "error"
                  ? Date.now()
                  : undefined,
            };
          }
          return task;
        }),
      );
    },
    [],
  );

  const updateDownloadTaskOverallStatus = useCallback(
    (
      taskId: string,
      progress: number,
      isDownloading: boolean,
      explicitStatus?: DownloadTask["status"],
    ) => {
      setActiveDownloads((prev) =>
        prev.map((task) => {
          if (task.id === taskId) {
            let newStatus: DownloadTask["status"] = task.status;

            if (explicitStatus) {
              newStatus = explicitStatus;
            } else if (isDownloading && task.status === "pending") {
              newStatus = "downloading";
            } else if (!isDownloading && progress === 100) {
              newStatus = "completed";
            } else if (
              !isDownloading &&
              progress < 100 &&
              task.status === "downloading"
            ) {
              newStatus = "aborted";
            }

            return {
              ...task,
              overallProgress: progress,
              isDownloading: isDownloading,
              status: newStatus,
              endTime:
                newStatus === "completed" ||
                newStatus === "error" ||
                newStatus === "aborted"
                  ? Date.now()
                  : undefined,
            };
          }
          return task;
        }),
      );
    },
    [],
  );

  const removeDownloadTask = useCallback(
    (taskId: string) => {
      setActiveDownloads((prev) => prev.filter((task) => task.id !== taskId));
      if (currentDownloadId === taskId) {
        setCurrentDownloadId(null);
      }
    },
    [currentDownloadId],
  );

  const currentDownload = currentDownloadId
    ? activeDownloads.find((d) => d.id === currentDownloadId)
    : null;

  // dummy download
  // const dummyDownload: DownloadTask = {
  //   id: 'dummy',
  //   fileName: 'dummy',
  //   fileSize: 0,
  //   totalChunks: 0,
  //   chunkProgresses: [],
  //   overallProgress: 0,
  //   status: 'pending',
  //   errorMsg: undefined,
  //   startTime: Date.now()
  // };
  // addDownloadTask(dummyDownload);

  // Scroll breadcrumbs to the right on navigation
  useEffect(() => {
    if (breadcrumbsRef.current) {
      breadcrumbsRef.current.scrollLeft = breadcrumbsRef.current.scrollWidth;
    }
  }, [breadcrumbs]);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setActiveMenuId(null);
      setIsSortMenuOpen(false);
      setIsLangMenuOpen(false);
      setIsMobileMenuOpen(false);
    };
    window.addEventListener("click", handleClickOutside);
    return () => window.removeEventListener("click", handleClickOutside);
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
    if (searchQuery.trim() !== "") return;

    setIsLoading(true);
    setNotification(null);

    try {
      const dbFiles = await getStoredFiles(config, currentFolderId, sortConfig);
      setFiles(dbFiles);
    } catch (err: any) {
      console.error(err);
      setNotification({
        type: "error",
        messageKey: "fetch_failed",
      });
    } finally {
      setIsLoading(false);
    }
  }, [
    config.botToken,
    config.chatId,
    config.workerUrl,
    currentFolderId,
    searchQuery,
    sortConfig,
  ]);

  // Refresh when config or folder changes
  useEffect(() => {
    if (config.botToken && config.chatId) {
      fetchFiles();
      setActiveMenuId(null); // Close menus on navigation
    }
  }, [config.botToken, config.chatId, config.workerUrl, fetchFiles]);

  // Handle Search
  useEffect(() => {
    const delayDebounce = setTimeout(async () => {
      if (searchQuery.trim().length > 0) {
        setIsSearching(true);
        setIsLoading(true);
        try {
          const results = await searchFiles(config, searchQuery, sortConfig);
          setFiles(results);
        } catch (e) {
          console.error(e);
          setNotification({ type: "error", messageKey: "search_failed" });
        } finally {
          setIsSearching(false);
          setIsLoading(false);
        }
      } else if (searchQuery === "") {
        // Restore folder view when cleared
        fetchFiles();
      }
    }, 400);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery, config, fetchFiles]);

  // Speed Calculation & Progress Update Interval
  useEffect(() => {
    let interval: number;

    // Only run interval if there are uploads in 'uploading' state
    const hasActiveUploads = activeUploads.some(
      (u) => u.status === "uploading",
    );

    if (hasActiveUploads) {
      if (lastTimeRef.current === 0) {
        lastTimeRef.current = Date.now();
        lastLoadedBytesRef.current = 0;
      }

      interval = window.setInterval(() => {
        const currentTime = Date.now();
        // Sum current loaded bytes from all active files
        let currentTotalLoaded = 0;
        const currentProgressMap = filesProgressRef.current;

        currentProgressMap.forEach((val) => {
          currentTotalLoaded += val.loaded;
        });

        const timeDiff = (currentTime - lastTimeRef.current) / 1000; // seconds
        const bytesDiff = currentTotalLoaded - lastLoadedBytesRef.current;

        if (timeDiff > 0 && bytesDiff >= 0) {
          const speed = bytesDiff / timeDiff;
          smoothSpeedRef.current = smoothSpeedRef.current * 0.7 + speed * 0.3;
          setNetworkSpeed(`${formatBytes(smoothSpeedRef.current)}/s`);
        }

        // Update active uploads progress bars in UI
        setActiveUploads((prevStatuses) => {
          return prevStatuses.map((status) => {
            const rawData = filesProgressRef.current.get(status.id);
            if (rawData && rawData.total > 0 && status.status === "uploading") {
              const percent = (rawData.loaded / rawData.total) * 100;
              return { ...status, progress: Math.min(99, percent) };
            }
            return status;
          });
        });

        lastTimeRef.current = currentTime;
        lastLoadedBytesRef.current = currentTotalLoaded;
      }, 500);
    } else {
      setNetworkSpeed("0 B/s");
      lastTimeRef.current = 0;
      lastLoadedBytesRef.current = 0;
    }

    return () => {
      clearInterval(interval);
    };
  }, [activeUploads]);

  // Reusable file processor
  const addPendingFiles = (newFiles: File[]) => {
    if (newFiles.length === 0) return;
    // Filter duplicates
    const newUniqueFiles = newFiles.filter(
      (nf) =>
        !pendingFiles.some(
          (pf) =>
            pf.name === nf.name &&
            pf.size === nf.size &&
            pf.lastModified === nf.lastModified,
        ),
    );

    if (newUniqueFiles.length === 0) return;

    // Check for sliced files and provide feedback (notification)
    const slicedFiles = newUniqueFiles.filter((f) => f.size > CHUNK_SIZE);
    if (slicedFiles.length > 0) {
      const sliceDetails = slicedFiles
        .map((f) => {
          const totalChunks = Math.ceil(f.size / CHUNK_SIZE);
          return `${f.name} → ${totalChunks} parts`;
        })
        .join(", ");

      setNotification({
        type: "info",
        message: `Auto-sliced large files: ${sliceDetails}`,
      });
    } else {
      setNotification(null);
    }

    setPendingFiles((prev) => [...prev, ...newUniqueFiles]);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []) as File[];
    if (selectedFiles.length === 0) return;
    addPendingFiles(selectedFiles);
    e.target.value = ""; // Reset input
  };

  // Drag and Drop Handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!config.botToken) return;
    setIsDragging(true);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!config.botToken) return;
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
    if (!config.botToken) return;

    const files = Array.from(e.dataTransfer.files) as File[];
    if (files.length > 0) addPendingFiles(files);
  };

  const handleRemovePending = (index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleClearPending = () => {
    setPendingFiles([]);
    setNotification(null);
  };

  const handleCancelUpload = (id: string) => {
    const controller = uploadControllersRef.current.get(id);
    if (controller) {
      controller.abort();
      // Remove from controllers ref
      uploadControllersRef.current.delete(id);
      // Update status
      setActiveUploads((prev) =>
        prev.map((u) => (u.id === id ? { ...u, status: "aborted" } : u)),
      );
      // Clean up progress ref
      filesProgressRef.current.delete(id);
    }
  };

  const handleClearUpload = (id: string) => {
    // Remove from UI list
    setActiveUploads((prev) => prev.filter((u) => u.id !== id));
    // Cleanup refs just in case
    filesProgressRef.current.delete(id);
    uploadControllersRef.current.delete(id);
  };

  const startUploadProcess = async (filesToUpload: File[]) => {
    if (filesToUpload.length === 0) return;

    setUploadedResults([]);
    setNetworkSpeed("Calculating...");

    // Clear pending files that are about to be uploaded
    const filesToKeep = pendingFiles.filter((f) => !filesToUpload.includes(f));
    setPendingFiles(filesToKeep);
    // Process for Slicing & create UI status items
    let uploadItems = processFilesWithSlicing(filesToUpload);
    // Assign unique IDs to each upload task
    const newUploadsWithIds = uploadItems.map((item) => ({
      ...item,
      uploadId: crypto.randomUUID(),
    }));
    // Initialize UI status
    const newStatuses: FileUploadStatus[] = newUploadsWithIds.map((item) => ({
      id: item.uploadId,
      name: item.file.name,
      progress: 0,
      status: "pending",
    }));
    setActiveUploads((prev) => [...prev, ...newStatuses]);

    // Initialize progress tracking
    newUploadsWithIds.forEach((item) => {
      filesProgressRef.current.set(item.uploadId, {
        loaded: 0,
        total: item.file.size,
      });
    });

    try {
      // Concurrent Uploads using Promise.all
      const uploadPromises = newUploadsWithIds.map(async (item) => {
        const { uploadId, file, sliceGroupId } = item;
        // Create AbortController
        const controller = new AbortController();
        uploadControllersRef.current.set(uploadId, controller);
        // Mark as uploading
        setActiveUploads((prev) =>
          prev.map((s) =>
            s.id === uploadId ? { ...s, status: "uploading" } : s,
          ),
        );
        try {
          const message = await uploadDocument(
            config,
            file,
            file.type,
            (loaded, total) => {
              // Update Ref only (UI updates via interval)
              filesProgressRef.current.set(uploadId, { loaded, total });
            },
            currentFolderId,
            sliceGroupId,
            controller.signal, // Pass signal
            true,
          );

          // Mark complete in UI immediately for this file
          setActiveUploads((prev) =>
            prev.map((s) =>
              s.id === uploadId
                ? { ...s, progress: 100, status: "completed" }
                : s,
            ),
          );
          // Cleanup refs
          uploadControllersRef.current.delete(uploadId);
          // filesProgressRef.current.delete(uploadId); // Keep progress for "Done" state speed calc logic if needed, but cleaning up is fine

          const doc = message.document;
          const photo = message.photo
            ? message.photo[message.photo.length - 1]
            : null;
          const fileId = doc?.file_id || photo?.file_id;
          const fileName =
            doc?.file_name || (photo ? `Photo_${message.date}.jpg` : file.name);

          if (fileId) {
            const downloadUrl = getFileUrl(config, fileId, fileName);
            return { url: downloadUrl, name: fileName };
          }
          return null;
        } catch (err: any) {
          if (err.name === "AbortError") {
            console.log(`Upload aborted: ${file.name}`);
            // Status updated in handleCancelUpload already
          } else {
            console.error(`Failed to upload ${file.name}`, err);
            setActiveUploads((prev) =>
              prev.map((s) =>
                s.id === uploadId
                  ? { ...s, status: "error", errorMsg: err.message }
                  : s,
              ),
            );
          }
          uploadControllersRef.current.delete(uploadId);

          return null;
        }
      });

      const results = await Promise.all(uploadPromises);
      const successfulUploads = results.filter(
        (r): r is { url: string; name: string } => r !== null,
      );

      await fetchFiles();
      if (successfulUploads.length > 0) {
        // Add to results list (could be from previous concurrent batches too if we stored them globally)
        setUploadedResults((prev) => [...prev, ...successfulUploads]);
      } else {
        // if (activeUploads.some(s => s.status === 'error')) {
        //     setNotification({
        //       type: "error",
        //       messageKey: 'some_uploads_failed'
        //     });
        // }
      }
    } catch (err: any) {
      console.error("Batch upload error", err);
      setNotification({
        type: "error",
        message: err.message,
        messageKey: err.message ? undefined : "upload_failed",
      });
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
        if (searchQuery.trim() !== "") {
          const results = await searchFiles(config, searchQuery);
          setFiles(results);
        } else {
          fetchFiles();
          if (success.data?.msgLinks?.length) {
            setNotification({
              type: "warning",
              messageKey: "msg_older_than_48h",
              links: success.data.msgLinks,
              linkOptions: {
                showIcon: true,
                icon: "↗",
              },
            });
          }
        }
      } else {
        setNotification({ type: "error", messageKey: "delete_failed" });
      }
    } catch (err) {
      console.error(err);
      setNotification({ type: "error", messageKey: "delete_error" });
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
      setNotification({ type: "error", messageKey: "create_folder_failed" });
    }
  };

  const handleNavigate = (
    targetFolderId: number | null,
    folderName: string,
  ) => {
    // Clear search if navigating folders
    if (searchQuery) setSearchQuery("");

    // Update URL
    if (targetFolderId === null) {
      navigate("/");
    } else {
      navigate(`/folder/${targetFolderId}`);
    }

    // Update Breadcrumbs (Optimistic/State based)
    // We still update local state for immediate feedback, though useEffect will also fire
    if (targetFolderId === null) {
      setBreadcrumbs([{ id: null, name: t(lang, "home") as string }]);
    } else {
      const existingIndex = breadcrumbs.findIndex(
        (b) => b.id === targetFolderId,
      );
      if (existingIndex !== -1) {
        setBreadcrumbs(breadcrumbs.slice(0, existingIndex + 1));
      } else {
        setBreadcrumbs([
          ...breadcrumbs,
          { id: targetFolderId, name: folderName },
        ]);
      }
    }
  };

  const handleMoveConfirm = async (targetParentId: number | null) => {
    if (!fileToMove) return;
    try {
      await moveFile(config, fileToMove.id, targetParentId);
      if (searchQuery.trim() !== "") {
        const results = await searchFiles(config, searchQuery);
        setFiles(results);
      } else {
        fetchFiles();
      }
    } catch (e) {
      setNotification({ type: "error", messageKey: "move_file_failed" });
    } finally {
      setFileToMove(null);
    }
  };

  const handleSortChange = (field: SortField, order: SortOrder) => {
    setSortConfig({ field, order });
    setIsSortMenuOpen(false);
    // Fetch will automatically trigger due to dependency array
  };

  const handleLanguageChange = (l: string) => {
    setConfig((prev) => ({ ...prev, language: l }));
    setIsLangMenuOpen(false);
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
                <h1 className="font-bold text-xl text-slate-900 dark:text-white tracking-tight leading-none">
                  {t(lang, "app_title")}
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">
                  {t(lang, "app_subtitle")}
                </p>
              </div>
            </div>

            {/* Mobile Actions Right */}
            <div className="flex items-center gap-2 sm:hidden">
              {/* Download List Button */}
              {activeDownloads.length > 0 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsDownloadListOpen(true);
                  }}
                  className="p-2 text-slate-400 hover:text-telegram-500 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition-all relative"
                  title={t(lang, "download_list_button") as string}
                >
                  <Download className="w-5 h-5" />
                  {activeDownloads.some((d) => d.status === "downloading") && (
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-telegram-500 rounded-full animate-pulse"></span>
                  )}
                </button>
              )}

              {/* Burger Menu (Mobile Menu) */}
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsMobileMenuOpen(!isMobileMenuOpen);
                  }}
                  className="p-2 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-all"
                >
                  <Menu className="w-6 h-6" />
                </button>

                {isMobileMenuOpen && (
                  <div
                    className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-100 dark:border-slate-700 z-30 py-2 animate-in fade-in zoom-in-95 duration-100 origin-top-right"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Language Section */}
                    <div className="px-4 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      {t(lang, "language") as string}
                    </div>
                    <button
                      onClick={() => {
                        handleLanguageChange("en");
                        // setIsMobileMenuOpen(false);
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center justify-between"
                    >
                      English
                      {lang === "en" && (
                        <Check className="w-4 h-4 text-telegram-500" />
                      )}
                    </button>
                    <button
                      onClick={() => {
                        handleLanguageChange("zh");
                        // setIsMobileMenuOpen(false);
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center justify-between"
                    >
                      中文
                      {lang === "zh" && (
                        <Check className="w-4 h-4 text-telegram-500" />
                      )}
                    </button>

                    <div className="h-px bg-slate-100 dark:bg-slate-700 my-1"></div>

                    {/* Actions */}
                    {/* Theme Section */}
                    <div className="px-4 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider mt-2">
                      {t(lang, "theme")}
                    </div>
                    <button
                      onClick={() => setTheme("light")}
                      className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <Sun className="w-4 h-4" />
                        {t(lang, "theme_light")}
                      </div>
                      {theme === "light" && (
                        <Check className="w-4 h-4 text-telegram-500" />
                      )}
                    </button>
                    <button
                      onClick={() => setTheme("dark")}
                      className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <Moon className="w-4 h-4" />
                        {t(lang, "theme_dark")}
                      </div>
                      {theme === "dark" && (
                        <Check className="w-4 h-4 text-telegram-500" />
                      )}
                    </button>
                    <button
                      onClick={() => setTheme("system")}
                      className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <Monitor className="w-4 h-4" />
                        {t(lang, "theme_system")}
                      </div>
                      {theme === "system" && (
                        <Check className="w-4 h-4 text-telegram-500" />
                      )}
                    </button>

                    <div className="h-px bg-slate-100 dark:bg-slate-700 my-1"></div>

                    <button
                      onClick={() => {
                        fetchFiles();
                        setIsMobileMenuOpen(false);
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-3"
                    >
                      <RefreshCw
                        className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`}
                      />
                      {t(lang, "refresh")}
                    </button>

                    <button
                      onClick={() => {
                        setIsSettingsOpen(true);
                        setIsMobileMenuOpen(false);
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-3"
                    >
                      <Settings className="w-4 h-4" />
                      {t(lang, "settings")}
                    </button>
                  </div>
                )}
              </div>
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
              placeholder={t(lang, "search_placeholder") as string}
              className="block w-full pl-10 pr-10 py-2 border border-slate-200 dark:border-slate-600 rounded-xl leading-5 bg-slate-50 dark:bg-slate-700/50 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:bg-white dark:focus:bg-slate-800 focus:border-telegram-500 focus:ring-1 focus:ring-telegram-500 sm:text-sm transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="hidden sm:flex items-center gap-3">
            {/* Download List Button */}
            {activeDownloads.length > 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsDownloadListOpen(true);
                }}
                className="p-2 text-slate-400 hover:text-telegram-500 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition-all relative"
                title={t(lang, "downloads") as string}
              >
                <Download className="w-5 h-5" />
                {activeDownloads.some((d) => d.status === "downloading") && (
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-telegram-500 rounded-full animate-pulse"></span>
                )}
              </button>
            )}

            {/* Language Switcher Desktop */}
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsLangMenuOpen(!isLangMenuOpen);
                  setIsSortMenuOpen(false);
                }}
                className="p-2 text-slate-400 hover:text-telegram-500 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition-all"
                title={t(lang, "language") as string}
              >
                <Globe className="w-5 h-5" />
              </button>
              {isLangMenuOpen && (
                <div
                  className="absolute right-0 top-full mt-2 w-40 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-100 dark:border-slate-700 z-30 py-1 animate-in fade-in zoom-in-95 duration-100 origin-top-right"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => handleLanguageChange("en")}
                    className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center justify-between"
                  >
                    English
                    {lang === "en" && (
                      <Check className="w-4 h-4 text-telegram-500" />
                    )}
                  </button>
                  <button
                    onClick={() => handleLanguageChange("zh")}
                    className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center justify-between"
                  >
                    中文
                    {lang === "zh" && (
                      <Check className="w-4 h-4 text-telegram-500" />
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Theme Dropdown Desktop */}
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsThemeMenuOpen(!isThemeMenuOpen);
                  setIsLangMenuOpen(false);
                  setIsSortMenuOpen(false);
                }}
                className="p-2 text-slate-400 hover:text-telegram-500 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition-all"
                title={t(lang, "toggle_theme") as string}
              >
                {theme === "light" ? (
                  <Sun className="w-5 h-5" />
                ) : theme === "dark" ? (
                  <Moon className="w-5 h-5" />
                ) : (
                  <Monitor className="w-5 h-5" />
                )}
              </button>
              {isThemeMenuOpen && (
                <div
                  className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-100 dark:border-slate-700 z-30 py-1 animate-in fade-in zoom-in-95 duration-100 origin-top-right"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="px-3 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    {t(lang, "theme")}
                  </div>
                  <button
                    onClick={() => setTheme("light")}
                    className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <Sun className="w-4 h-4" />
                      {t(lang, "theme_light")}
                    </div>
                    {theme === "light" && (
                      <Check className="w-4 h-4 text-telegram-500" />
                    )}
                  </button>
                  <button
                    onClick={() => setTheme("dark")}
                    className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <Moon className="w-4 h-4" />
                      {t(lang, "theme_dark")}
                    </div>
                    {theme === "dark" && (
                      <Check className="w-4 h-4 text-telegram-500" />
                    )}
                  </button>
                  <button
                    onClick={() => setTheme("system")}
                    className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <Monitor className="w-4 h-4" />
                      {t(lang, "theme_system")}
                    </div>
                    {theme === "system" && (
                      <Check className="w-4 h-4 text-telegram-500" />
                    )}
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={fetchFiles}
              className="p-2 text-slate-400 hover:text-telegram-500 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition-all"
              title={t(lang, "refresh") as string}
            >
              <RefreshCw
                className={`w-5 h-5 ${isLoading ? "animate-spin" : ""}`}
              />
            </button>
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg font-medium text-sm transition-colors"
            >
              <Settings className="w-4 h-4" />
              <span className="whitespace-nowrap hidden min-[480px]:inline">
                {t(lang, "settings")}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 pb-20 custom-scrollbar">
        <div
          className="space-y-6"
          style={{ marginLeft: "3%", marginRight: "3%" }}
        >
          {notification && (
            <div
              className={`${notificationStyles[notification.type] ?? notificationStyles.error} px-4 py-3 rounded-xl flex items-center gap-3 text-sm animate-in slide-in-from-top-2 break-words`}
            >
              <Shield className="w-5 h-5 shrink-0" />
              <span className="flex-1">
                {notification.messageKey
                  ? t(lang, notification.messageKey)
                  : notification.message}

                {notification.links?.length && (
                  <span className="inline-flex gap-2">
                    {notification.links?.map((url, idx) => (
                      <a
                        key={idx}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-telegram-700 hover:text-telegram-500 underline"
                      >
                        {notification.linkOptions?.linkText?.replace(
                          "__idx__",
                          (idx + 1).toString(),
                        ) || url}
                        &nbsp;
                        {notification.linkOptions?.showIcon &&
                          notification.linkOptions.icon}
                      </a>
                    ))}
                  </span>
                )}
              </span>
            </div>
          )}

          {/* Upload & Preview Zone - Hide when searching */}
          {searchQuery === "" && (
            <div
              className="max-w-5xl mx-auto relative group"
              onDragEnter={handleDragEnter}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <div className="absolute -inset-1 bg-gradient-to-r from-telegram-500 to-purple-600 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-500"></div>
              <div className="relative bg-white dark:bg-slate-800 rounded-xl p-8 border border-slate-100 dark:border-slate-700 shadow-sm text-center space-y-4">
                {pendingFiles.length > 0 ? (
                  /* Pending Files Preview List */
                  <div className="text-left w-full max-w-xl mx-auto animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="flex justify-between items-center mb-4 border-b border-slate-100 dark:border-slate-700 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-800 dark:text-white text-lg">
                          {t(lang, "selected_files")}
                        </span>
                        <span className="bg-telegram-100 dark:bg-telegram-900/50 text-telegram-700 dark:text-telegram-300 px-2 py-0.5 rounded-full text-xs font-medium">
                          {pendingFiles.length}
                        </span>
                      </div>
                      <button
                        onClick={handleClearPending}
                        className="text-red-500 text-xs hover:bg-red-50 dark:hover:bg-red-900/20 px-2 py-1 rounded transition-colors flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" />
                        {t(lang, "remove_all")}
                      </button>
                    </div>

                    <div className="space-y-2 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar mb-6">
                      {pendingFiles.map((file, i) => (
                        <PendingFileItem
                          key={stringToNumberHash(
                            `${file.name}-${file.size}-${i}`,
                          )}
                          file={file}
                          onRemove={() => handleRemovePending(i)}
                          onUpload={() => startUploadProcess([file])}
                          onPreview={(url, name, mime) =>
                            setPreviewFile({ url, name, mime })
                          }
                          lang={lang}
                          isMenuOpen={
                            activeMenuId ===
                            stringToNumberHash(`${file.name}-${file.size}-${i}`)
                          }
                          onMenuToggle={() =>
                            setActiveMenuId((prev) =>
                              prev ===
                              stringToNumberHash(
                                `${file.name}-${file.size}-${i}`,
                              )
                                ? null
                                : stringToNumberHash(
                                    `${file.name}-${file.size}-${i}`,
                                  ),
                            )
                          }
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
                          {t(lang, "add_more")}
                        </div>
                      </label>
                      <button
                        onClick={() => startUploadProcess(pendingFiles)}
                        className="flex-[2] py-2.5 bg-telegram-500 hover:bg-telegram-600 text-white rounded-xl text-sm font-medium shadow-lg shadow-telegram-500/20 transition-all flex items-center justify-center gap-2"
                      >
                        <UploadCloud className="w-4 h-4" />
                        {t(lang, "upload_all")} ({pendingFiles.length})
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Empty / Drop Zone */
                  <>
                    <div className="w-16 h-16 bg-telegram-50 dark:bg-telegram-900/30 text-telegram-500 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
                      <UploadCloud className="w-8 h-8" />
                    </div>
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                      {t(lang, "upload_title")}
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto text-sm">
                      {t(lang, "upload_subtitle")}
                    </p>

                    <div className="flex items-center justify-center gap-4 text-xs text-slate-400 dark:text-slate-500 py-2">
                      <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-700/50 px-2 py-1 rounded border border-slate-100 dark:border-slate-700">
                        <Info className="w-3 h-3" />
                        <span>{t(lang, "max_upload")}</span>
                      </div>
                      <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-700/50 px-2 py-1 rounded border border-slate-100 dark:border-slate-700">
                        <Info className="w-3 h-3" />
                        <span>{t(lang, "max_download")}</span>
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
                        <span
                          className={`px-6 py-3 rounded-xl font-medium text-white shadow-lg shadow-telegram-500/25 transition-all transform hover:translate-y-[-2px] active:translate-y-0 ${!config.botToken ? "bg-slate-400 cursor-not-allowed" : "bg-telegram-500 hover:bg-telegram-600"}`}
                        >
                          {config.botToken
                            ? t(lang, "select_files")
                            : t(lang, "configure_first")}
                        </span>
                      </label>

                      <button
                        onClick={() => setIsImportOpen(true)}
                        disabled={!config.botToken}
                        className="px-6 py-3 rounded-xl font-medium text-telegram-600 dark:text-telegram-400 bg-telegram-50 dark:bg-telegram-900/30 hover:bg-telegram-100 dark:hover:bg-telegram-900/50 transition-colors flex items-center gap-2 disabled:opacity-50"
                      >
                        <Import className="w-5 h-5" />
                        <span>{t(lang, "import_id")}</span>
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
                  <h3 className="text-xl font-bold text-slate-800 dark:text-white">
                    {t(lang, "drop_title")}
                  </h3>
                  <p className="text-slate-500 dark:text-slate-400 mt-2">
                    {t(lang, "drop_subtitle")}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Controls: Navigation or Search Header */}
          {searchQuery !== "" ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-100 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <Search className="w-5 h-5 text-telegram-500" />
                <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
                  Search Results for "{searchQuery}"
                </h2>
                {isSearching && (
                  <span className="text-xs text-slate-400 animate-pulse ml-2">
                    Searching...
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <FilterMenu
                  filterType={filterType}
                  setFilterType={setFilterType}
                  timeFilter={timeFilter}
                  setTimeFilter={setTimeFilter}
                  customStartDate={customStartDate}
                  setCustomStartDate={setCustomStartDate}
                  customEndDate={customEndDate}
                  setCustomEndDate={setCustomEndDate}
                  isOpen={isFilterMenuOpen}
                  setIsOpen={(isOpen) => {
                    setIsFilterMenuOpen(isOpen);
                    if (isOpen) setIsSortMenuOpen(false);
                  }}
                  lang={lang}
                />
                <SortMenu
                  sortConfig={sortConfig}
                  setSortConfig={setSortConfig}
                  isOpen={isSortMenuOpen}
                  setIsOpen={(isOpen) => {
                    setIsSortMenuOpen(isOpen);
                    if (isOpen) setIsFilterMenuOpen(false);
                  }}
                  lang={lang}
                  onSortChange={handleSortChange}
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-8">
              <div
                ref={breadcrumbsRef}
                className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 overflow-x-auto pb-1 sm:pb-0 flex-nowrap custom-scrollbar-hide"
              >
                <button
                  onClick={() => handleNavigate(null, "")}
                  className={`p-1.5 rounded-lg transition-colors flex items-center gap-1 ${currentFolderId === null ? "bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200" : "hover:bg-slate-100 dark:hover:bg-slate-800"}`}
                >
                  <Home className="w-4 h-4" />
                </button>
                {breadcrumbs.slice(1).map((crumb, i) => (
                  <div key={crumb.id || i} className="flex items-center gap-2">
                    <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600" />
                    <button
                      onClick={() => handleNavigate(crumb.id, crumb.name)}
                      className={`font-medium px-2 py-1 rounded-lg transition-colors whitespace-nowrap ${currentFolderId === crumb.id ? "bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-slate-100" : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"}`}
                    >
                      {crumb.name}
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-3 justify-end">
                {/* Filter Dropdown */}
                <FilterMenu
                  filterType={filterType}
                  setFilterType={setFilterType}
                  timeFilter={timeFilter}
                  setTimeFilter={setTimeFilter}
                  customStartDate={customStartDate}
                  setCustomStartDate={setCustomStartDate}
                  customEndDate={customEndDate}
                  setCustomEndDate={setCustomEndDate}
                  isOpen={isFilterMenuOpen}
                  setIsOpen={(isOpen) => {
                    setIsFilterMenuOpen(isOpen);
                    if (isOpen) setIsSortMenuOpen(false);
                  }}
                  lang={lang}
                />

                {/* Sort Dropdown */}
                <SortMenu
                  sortConfig={sortConfig}
                  setSortConfig={setSortConfig}
                  isOpen={isSortMenuOpen}
                  setIsOpen={(isOpen) => {
                    setIsSortMenuOpen(isOpen);
                    if (isOpen) setIsFilterMenuOpen(false);
                  }}
                  lang={lang}
                  onSortChange={handleSortChange}
                />

                <button
                  onClick={() => setIsCreateFolderOpen(true)}
                  disabled={!config.workerUrl}
                  className="whitespace-nowrap flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-telegram-600 dark:hover:text-telegram-400 hover:border-telegram-200 dark:hover:border-telegram-700 rounded-lg text-sm font-medium transition-all shadow-sm"
                >
                  <FolderPlus className="w-4 h-4" />
                  <span className="hidden min-[480px]:inline">
                    {t(lang, "new_folder")}
                  </span>
                </button>
                <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-1 hidden sm:block"></div>
                <div className="flex items-center gap-3 text-slate-400 dark:text-slate-500">
                  <Database className="w-4 h-4" />
                  <span className="text-xs font-medium">
                    {files.length} {t(lang, "items")}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Files Grid */}
          {(files.length === 0 || filteredFiles.length === 0) && !isLoading ? (
            <div className="text-center py-20 opacity-50 bg-white dark:bg-slate-800 border border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
              {files.length === 0 ? (
                searchQuery !== "" ? (
                  <>
                    <Search className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-4" />
                    <p className="text-slate-500 dark:text-slate-400 font-medium">
                      {t(lang, "empty_search")}
                    </p>
                  </>
                ) : (
                  <>
                    <HardDrive className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-4" />
                    <p className="text-slate-500 dark:text-slate-400 font-medium">
                      {t(lang, "empty_folder")}
                    </p>
                  </>
                )
              ) : (
                <>
                  <Filter className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-4" />
                  <p className="text-slate-500 dark:text-slate-400 font-medium mb-2">
                    No files match the selected filters
                  </p>
                  <button
                    onClick={() => {
                      setFilterType("all");
                      setTimeFilter("all");
                    }}
                    className="text-telegram-500 hover:text-telegram-600 text-sm font-medium"
                  >
                    Clear Filters
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredFiles.map((update) => (
                <div
                  key={update.update_id}
                  onClick={() => {
                    const doc = update.message?.document;
                    if (doc?.is_folder) {
                      handleNavigate(
                        update.update_id,
                        doc.file_name || "Folder",
                      );
                    }
                  }}
                >
                  <FileCard
                    message={update.message || update.channel_post!}
                    config={config}
                    onDeleteClick={onRequestDelete}
                    highlightText={searchQuery}
                    onMoveClick={(id, parentId) =>
                      setFileToMove({ id, parentId })
                    }
                    onNavigate={(id, name) => handleNavigate(id, name)}
                    onPreview={(url, name, mime, chunks) =>
                      setPreviewFile({ url, name, mime, chunks })
                    }
                    isMenuOpen={activeMenuId === update.update_id}
                    onMenuToggle={() =>
                      setActiveMenuId((prev) =>
                        prev === update.update_id ? null : update.update_id,
                      )
                    }
                    // allFiles={files}
                    onDownloadStart={(
                      taskId,
                      fileName,
                      fileSize,
                      totalChunks,
                    ) => {
                      addDownloadTask({
                        id: taskId,
                        fileName,
                        fileSize,
                        totalChunks,
                        chunkProgresses: Array(totalChunks)
                          .fill(null)
                          .map((_, i) => ({
                            name: `${fileName}.part${i + 1}of${totalChunks}`,
                            progress: 0,
                            status: "pending" as const,
                          })),
                        overallProgress: 0,
                        status: "pending",
                        startTime: Date.now(),
                      });
                    }}
                    onChunkProgress={(
                      taskId,
                      index,
                      name,
                      progress,
                      status,
                      errorMsg,
                    ) => {
                      updateDownloadTaskProgress(
                        taskId,
                        index,
                        name,
                        progress,
                        status,
                        errorMsg,
                      );
                    }}
                    onOverallProgress={(taskId, progress, isDownloading) => {
                      updateDownloadTaskOverallStatus(
                        taskId,
                        progress,
                        isDownloading,
                      );
                    }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        config={config}
        onSave={setConfig}
      />

      <ImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        config={config}
        onImportComplete={fetchFiles}
      />

      <UploadSuccessModal
        isOpen={uploadedResults.length > 0}
        onClose={() => setUploadedResults([])}
        files={uploadedResults}
        config={config}
      />

      <DeleteConfirmModal
        isOpen={!!fileToDelete}
        onClose={() => setFileToDelete(null)}
        onConfirm={handleConfirmDelete}
        fileName={fileToDelete?.name || "File"}
        isDeleting={isDeleting}
        config={config}
      />

      <CreateFolderModal
        isOpen={isCreateFolderOpen}
        onClose={() => setIsCreateFolderOpen(false)}
        onCreate={handleCreateFolder}
        config={config}
      />

      <MoveFileModal
        isOpen={!!fileToMove}
        onClose={() => setFileToMove(null)}
        config={config}
        fileId={fileToMove?.id || ""}
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
          lang={lang}
          chunks={previewFile.chunks}
          config={config}
        />
      )}

      {/* Download Modal (for single active download) */}
      {currentDownload && (
        <DownloadModal
          isOpen={!!currentDownload}
          task={currentDownload}
          lang={lang}
          onClose={() => setCurrentDownloadId(null)}
          onCancel={(taskId) => {
            // TODO: Implement actual cancellation logic if needed
            updateDownloadTaskOverallStatus(
              taskId,
              currentDownload.overallProgress,
              false,
              "aborted",
            ); // Mark as aborted
            setCurrentDownloadId(null);
          }}
        />
      )}

      {/* Download List Modal (for all downloads) */}
      <DownloadListModal
        isOpen={isDownloadListOpen}
        onClose={() => setIsDownloadListOpen(false)}
        activeDownloads={activeDownloads}
        lang={lang}
        // onViewDetails={(taskId) => {
        //   setCurrentDownloadId(taskId);
        //   setIsDownloadListOpen(false); // Close list when viewing details
        // }}
        onClearCompleted={() => {
          setActiveDownloads(
            activeDownloads.filter((task) => task.status !== "completed"),
          );
          setCurrentDownloadId(null);
        }}
        onClearAll={() => {
          setActiveDownloads([]);
          setCurrentDownloadId(null);
        }}
        onCancelDownload={removeDownloadTask}
      />

      {/* Upload Queue Widget */}
      <UploadQueue
        pendingFiles={pendingFiles}
        activeUploads={activeUploads}
        onRemovePending={handleRemovePending}
        onUploadAll={() => startUploadProcess(pendingFiles)}
        onUploadFile={(file) => startUploadProcess([file])}
        onClearPending={handleClearPending}
        onAddMoreFiles={addPendingFiles}
        onCancelUpload={handleCancelUpload}
        onClearUpload={handleClearUpload}
        onClearCompleted={() => {
          setActiveUploads((prev) =>
            prev.filter(
              (u) => u.status === "uploading" || u.status === "pending",
            ),
          );
          // Cleanup refs for cleared items
          // const activeIds = new Set(activeUploads.filter(u => u.status === 'uploading' || u.status === 'pending').map(u => u.id));
          // We can iterate over the map keys and delete those not in activeIds,
          // but since we don't have the full list of IDs easily accessible here without iteration,
          // and the refs are cleaned up on completion/abort anyway, this is mostly a safety measure or for error states.
          // For now, relying on per-item cleanup is mostly fine, but let's be safe for error states that might linger.
          // Actually, simply filtering the state is enough as the refs for completed/aborted/error items should have been cleaned up
          // in their respective handlers or completion blocks.
        }}
        onPreview={(url, name, mime) => setPreviewFile({ url, name, mime })}
        lang={lang}
        networkSpeed={networkSpeed}
      />
    </div>
  );
}

export default FileManager;
