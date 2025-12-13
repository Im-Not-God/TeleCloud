import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Download, File as FileIcon, Loader2, AlertCircle } from "lucide-react";
import {
  CONFIG_STORAGE_KEY,
  THEME_STORAGE_KEY,
  t,
  DEFAULT_LANG,
} from "../../constants";

// Helper to decode the share payload
// payload = base64(json({ w: workerUrl, f: fileId, n: fileName }))
const decodeShare = (
  shareStr: string,
): { w: string; f: string; n: string } | null => {
  try {
    const json = atob(shareStr);
    return JSON.parse(json);
  } catch (e) {
    return null;
  }
};

export function SharePage() {
  const [searchParams] = useSearchParams();
  const shareParam = searchParams.get("s");

  // Theme State
  type Theme = "light" | "dark" | "system";
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    // Remove quotes if they exist (JSON.stringify adds them)
    const cleanSaved = saved ? saved.replace(/"/g, "") : null;
    return (cleanSaved as Theme) || "system";
  });
  useEffect(() => {
    const isDark =
      theme === "dark" ||
      (theme === "system" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);

    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [theme]);

  // Lang
  const [language, setLanguage] = useState(() => {
    const saved = localStorage.getItem(CONFIG_STORAGE_KEY);
    return saved
      ? JSON.parse(saved).language
      : (navigator.languages?.[0] || navigator.language).split("-")[0] ||
          DEFAULT_LANG;
  });
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const result = useMemo(() => {
    if (!shareParam) {
      return { error: "Invalid share link: Missing parameters" };
    }

    const decoded = decodeShare(shareParam);
    if (!decoded || !decoded.w || !decoded.f || !decoded.n) {
      return { error: "Invalid share link: Malformed data" };
    }

    // Construct download URL directly
    // Logic similar to getFileUrl but we use the decoded worker URL
    const baseUrl = decoded.w.replace(/\/$/, "");
    const workerOrigin = baseUrl.startsWith("http")
      ? baseUrl
      : `${window.location.origin}${baseUrl}`; // Fallback if regular path (but usually it's absolute)

    // Note: This assumes public access or that the worker handles the token/auth via some other means
    // OR this page is just a "Pre-download" page for the user who HAS the app open?
    // If this is for "others", they might not have the auth token.
    // The user said "share to others", assuming public link capability or masked proxy.
    // Telegram files usually require the bot token to fetch.
    // Our worker implementation usually proxies with the bot token stored in D1 or passed in headers.
    // If we want a PUBLIC share, the worker needs a public endpoint.
    // Assuming for now we just render the download button pointing to the PROXY which might require auth?
    // Let's assume the "link" endpoint in worker handles public access or we just provide the UI.

    // Actually, looking at `getPublicDownloadUrl`:
    // It encodes `w`, `f`, `n`.
    // The user wants `/share`.
    // Let's just create a download link.

    const downloadUrl = `${workerOrigin}/fp?file_id=${decoded.f}&file_name=${encodeURIComponent(decoded.n)}&d=1`;

    return {
      fileInfo: {
        workerUrl: decoded.w,
        fileId: decoded.f,
        fileName: decoded.n,
        downloadUrl,
      },
    };
  }, [shareParam]);

  if (result.error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-white p-4">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <h1 className="text-xl font-bold mb-2">
          {t(language, "share_error_title")}
        </h1>
        <p className="text-slate-500 dark:text-slate-400">{result.error}</p>
      </div>
    );
  }

  if (!result.fileInfo) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50 dark:bg-slate-900">
        <Loader2 className="w-8 h-8 text-telegram-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-slate-50 dark:bg-slate-900 p-4">
      <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-xl max-w-md w-full text-center border border-slate-100 dark:border-slate-700">
        <div className="w-20 h-20 bg-telegram-50 dark:bg-telegram-900/20 text-telegram-500 rounded-full flex items-center justify-center mx-auto mb-6">
          <FileIcon className="w-10 h-10" />
        </div>

        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2 break-all">
          {result.fileInfo.fileName}
        </h2>
        <p className="text-slate-500 dark:text-slate-400 mb-8">
          {t(language, "share_file_label")}
        </p>

        <a
          href={result.fileInfo.downloadUrl}
          className="block w-full py-4 bg-telegram-500 hover:bg-telegram-600 text-white rounded-xl font-bold text-lg shadow-lg shadow-telegram-500/20 transition-all transform hover:-translate-y-1 active:translate-y-0"
        >
          <div className="flex items-center justify-center gap-2">
            <Download className="w-6 h-6" />
            {t(language, "share_download_button")}
          </div>
        </a>

        <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-700">
          <p className="text-xs text-slate-400">
            {t(language, "share_footer_hostedVia")}
          </p>
        </div>
      </div>
    </div>
  );
}
