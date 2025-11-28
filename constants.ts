import languageMap from 'language-map';

export const TELEGRAM_API_BASE = "https://api.telegram.org";

export const formatBytes = (bytes: number, decimals = 2) => {
  if (!+bytes) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
};

export const isFilePreviewable = (fileName: string, mimeType: string) => {
  if (
    mimeType.startsWith("image/")
  ) return { ok: true, type: "image" };

  if (
    mimeType.startsWith("video/")
  ) return { ok: true, type: "video" };

  if (
    mimeType.startsWith('audio/')
  ) return { ok: true, type: "audio" };

  if (
    mimeType.includes('pdf')
  ) return { ok: true, type: "pdf" };

  if (
    mimeType === "application/json" ||
    mimeType === "application/javascript" ||
    mimeType === "application/xml"||
    mimeType.startsWith('text/')
  ) return { ok: true, type: "text" };
  
  // ---- 5. 代码文件检测（依赖 GitHub Linguist）----
  const ext = fileName.split(".").pop()?.toLowerCase();
  if (ext) {
    for (const lang of Object.values(languageMap)) {
      if (lang.extensions?.includes("." + ext)) 
        return { ok: true, type: "text" };
    }
  }
  
  return { ok: false, type: "unknown" };
}
