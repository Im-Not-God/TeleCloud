import {
  AppConfig,
  TelegramUpdate,
  TelegramMessage,
  WorkerResponse,
  FolderItem,
  SortConfig,
} from "../types";

// Helper to call our Worker API
const callWorker = async <T>(
  config: AppConfig,
  endpoint: string,
  method: string = "GET",
  body: any = null,
): Promise<T> => {
  const headers: HeadersInit = {
    "X-Bot-Token": config.botToken,
    "X-Chat-Id": config.chatId,
  };

  if (body && !(body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(body);
  }

  // Remove trailing slash from workerUrl if present
  const baseUrl = config.workerUrl.replace(/\/$/, "");

  // Check if we are in development (localhost) or production relative path
  const url = baseUrl.startsWith("http")
    ? `${baseUrl}${endpoint}`
    : `${window.location.origin}${endpoint}`;

  const res = await fetch(url, {
    method,
    headers,
    body,
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `Worker Error: ${res.statusText}`);
  }

  const data = (await res.json()) as WorkerResponse<T>;
  if (!data.ok) {
    throw new Error(data.error || "Unknown Worker Error");
  }
  return data.result as T;
};

export const validateBotToken = async (config: AppConfig): Promise<boolean> => {
  try {
    // We use a specific 'me' endpoint or just try to list files to validate
    await callWorker(config, "/me");
    return true;
  } catch (error) {
    console.error("Validation failed", error);
    return false;
  }
};

// Save config to Backend so the Proxy can use it
export const saveBackendConfig = async (config: AppConfig): Promise<void> => {
  try {
    await callWorker(config, "/config", "POST", {
      botToken: config.botToken,
      chatId: config.chatId,
    });
  } catch (error) {
    console.error("Failed to save config to backend", error);
    // We don't throw here to avoid blocking the UI, but functionality might be limited
  }
};

export const getStoredFiles = async (
  config: AppConfig,
  parentId: number | null = null,
  sort?: SortConfig,
): Promise<TelegramUpdate[]> => {
  try {
    const endpoint = `/files`;

    // Build URL with params
    const params = new URLSearchParams();
    if (parentId) params.append("parent_id", parentId.toString());

    if (sort) {
      params.append("sort_by", sort.field);
      params.append("order", sort.order);
    }

    const queryString = params.toString();
    const fullEndpoint = queryString ? `${endpoint}?${queryString}` : endpoint;

    return await callWorker<TelegramUpdate[]>(config, fullEndpoint);
  } catch (error) {
    console.error("Failed to fetch files from Worker", error);
    throw error;
  }
};

export const searchFiles = async (
  config: AppConfig,
  query: string,
  sort?: SortConfig,
): Promise<TelegramUpdate[]> => {
  try {
    const endpoint = `/search`;

    // Build URL with params
    const params = new URLSearchParams();
    params.append("q", query);

    if (sort) {
      params.append("sort_by", sort.field);
      params.append("order", sort.order);
    }

    const queryString = params.toString();
    const fullEndpoint = queryString ? `${endpoint}?${queryString}` : endpoint;

    return await callWorker<TelegramUpdate[]>(config, fullEndpoint);
  } catch (error) {
    console.error("Search failed", error);
    return [];
  }
};

export const getAllFolders = async (
  config: AppConfig,
): Promise<FolderItem[]> => {
  try {
    return await callWorker<FolderItem[]>(config, "/folders");
  } catch (error) {
    console.error("Failed to fetch folders", error);
    return [];
  }
};

export const createFolder = async (
  config: AppConfig,
  name: string,
  parentId: number | null,
): Promise<boolean> => {
  try {
    await callWorker(config, "/create_folder", "POST", {
      name,
      parent_id: parentId,
    });
    return true;
  } catch (error) {
    console.error("Create folder failed", error);
    throw error;
  }
};

export const moveFile = async (
  config: AppConfig,
  fileId: string,
  targetParentId: number | null,
): Promise<boolean> => {
  try {
    await callWorker(config, "/move", "POST", {
      file_id: fileId,
      parent_id: targetParentId,
    });
    return true;
  } catch (error) {
    console.error("Move file failed", error);
    throw error;
  }
};

// Generates a safe PROXY link to the Worker.
// The worker handles the authentication with Telegram using the token stored in D1.
export const getFileUrl = (
  config: AppConfig,
  fileId: string,
  fileName?: string,
  isDownload?: boolean,
): string => {
  const baseUrl = config.workerUrl.replace(/\/$/, "");
  const workerOrigin = baseUrl.startsWith("http")
    ? baseUrl
    : `${window.location.origin}${baseUrl}`;
  const encodedName = fileName ? encodeURIComponent(fileName) : "";
  const downloadFlag = isDownload ? "&d=1" : "";
  return `${workerOrigin}/fp?file_id=${fileId}&file_name=${encodedName}${downloadFlag}`;
};

// Generates a masked shareable link using the App's base URL
// Encodes the worker URL and file info into a base64 parameter
export const getPublicDownloadUrl = (
  config: AppConfig,
  fileId: string,
  fileName?: string,
): string => {
  const payload = {
    w: config.workerUrl,
    f: fileId,
    n: fileName || "file",
  };
  const b64 = btoa(JSON.stringify(payload));
  return `${window.location.origin}/share?s=${b64}`;
};

export const getDirectUrl = async (
  config: AppConfig,
  fileId: string,
): Promise<string | null> => {
  try {
    return await callWorker<string>(config, `/file_link?file_id=${fileId}`);
  } catch (error) {
    console.error("Failed to fetch link", error);
    return null;
  }
};

export const uploadDocument = (
  config: AppConfig,
  file: File,
  originalMimeType: string,
  onProgress: (loaded: number, total: number) => void,
  parentId: number | null = null,
  sliceGroupId: string | null = null,
  signal?: AbortSignal,
  isDirectUpload?: boolean | false,
): Promise<TelegramMessage> => {
  const promise = new Promise<TelegramMessage>((resolve, reject) => {
    let uploadEndpoint = "sendDocument";

    const formData = new FormData();
    if (file.type.startsWith("video/")) {
      formData.append("video", file);
      uploadEndpoint = "sendVideo";
    } else {
      formData.append("document", file);
    }

    if (isDirectUpload) {
      formData.append("chat_id", config.chatId);
    } else {
      if (parentId) {
        formData.append("parent_id", parentId.toString());
      }
      if (sliceGroupId) {
        formData.append("slice_group_id", sliceGroupId);
      }
      formData.append("is_direct_upload", isDirectUpload.toString());
    }

    const xhr = new XMLHttpRequest();
    const baseUrl = config.workerUrl.replace(/\/$/, "");
    const url = isDirectUpload
      ? `https://api.telegram.org/bot${config.botToken}/${uploadEndpoint}`
      : baseUrl.startsWith("http")
        ? `${baseUrl}/upload`
        : `${window.location.origin}/api/upload`;

    xhr.open("POST", url, true);

    // Headers for the Worker to authenticate with Telegram (for upload only)
    if (!isDirectUpload) {
      xhr.setRequestHeader("X-Bot-Token", config.botToken);
      xhr.setRequestHeader("X-Chat-Id", config.chatId);
    }

    if (signal) {
      signal.addEventListener("abort", () => {
        xhr.abort();
        reject(new DOMException("Upload aborted", "AbortError"));
      });
    }

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress(e.loaded, e.total);
      }
    };

    xhr.onload = () => {
      if (xhr.status === 200) {
        try {
          const response = JSON.parse(
            xhr.responseText,
          ) as WorkerResponse<TelegramMessage>;
          if (response.ok && response.result) {
            resolve(response.result);
          } else {
            reject(new Error(response.error || "Upload failed"));
          }
        } catch (e) {
          reject(new Error("Invalid JSON response from Worker"));
        }
      } else {
        reject(new Error(`Upload failed: ${xhr.statusText}`));
      }
    };

    xhr.onerror = () => {
      reject(new Error("Network error during upload"));
    };

    xhr.send(formData);
  });

  if (isDirectUpload) {
    return promise.then((tgResult) => {
      const formData = new FormData();
      if (parentId) formData.append("parent_id", parentId.toString());
      if (sliceGroupId) formData.append("slice_group_id", sliceGroupId);
      if (originalMimeType)
        formData.append("original_mime_type", originalMimeType);
      formData.append("tg_result_data", JSON.stringify(tgResult));
      formData.append("is_direct_upload", isDirectUpload.toString());

      return callWorker<TelegramMessage>(config, "/upload", "POST", formData);
    });
  }

  return promise;
};

/**
 * Imports an existing message by ID.
 * The Worker will handle fetching the message details from Telegram and saving to D1.
 */
export const importFile = async (
  config: AppConfig,
  messageId: number,
  parentId: number | null = null,
): Promise<TelegramMessage | null> => {
  try {
    return await callWorker<TelegramMessage>(config, "/import", "POST", {
      message_id: messageId,
      parent_id: parentId,
    });
  } catch (e) {
    console.error("Import error", e);
    return null;
  }
};

export const deleteFile = async (
  config: AppConfig,
  fileId: string,
): Promise<{ ok: boolean; data?: any; error?: any }> => {
  try {
    const res = await callWorker(config, "/delete", "POST", {
      file_id: fileId,
    });
    return { ok: true, data: res };
  } catch (e) {
    console.error("Delete error", e);
    return { ok: false, error: e };
  }
};

/**
 * Downloads a file from Telegram via the Worker proxy
 */
export const downloadFile = async (
  config: AppConfig,
  fileId: string,
  fileName: string,
  onProgress?: (loaded: number, total: number) => void,
): Promise<Blob> => {
  const url = getFileUrl(config, fileId, fileName);

  const response = await fetch(url, {
    headers: {
      "X-Bot-Token": config.botToken,
      "X-Chat-Id": config.chatId,
    },
  });

  if (!response.ok) {
    throw new Error(`Download failed: ${response.statusText}`);
  }

  return await response.blob();
};

/**
 * Downloads and reassembles a complete chunk group
 * Handles multiple chunk downloads in parallel and merges them
 */
export const downloadAndReassembleChunks = async (
  config: AppConfig,
  chunks: Array<{ file_id: string; name: string; index?: number }>,
  originalFileName: string,
  onProgress?: (downloaded: number, total: number) => void,
): Promise<Blob> => {
  // Sort chunks by index if available
  const sortedChunks = [...chunks].sort(
    (a, b) => (a.index || 0) - (b.index || 0),
  );

  const totalChunks = sortedChunks.length;
  let downloadedCount = 0;

  // Download all chunks in parallel
  const downloadPromises = sortedChunks.map((chunk) =>
    downloadFile(config, chunk.file_id, chunk.name).then((blob) => {
      downloadedCount++;
      if (onProgress) {
        onProgress(downloadedCount, totalChunks);
      }
      return blob;
    }),
  );

  const blobs = await Promise.all(downloadPromises);

  // Merge all blobs in correct order
  return new Blob(blobs);
};
