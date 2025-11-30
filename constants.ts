import languageMap from 'language-map';
import ReactHtmlParser from 'html-react-parser';

export const TELEGRAM_API_BASE = "https://api.telegram.org";

export const CHUNK_SIZE = 20 * 1024 * 1024; // 20mb

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
      if ((lang as any).extensions?.includes("." + ext)) 
        return { ok: true, type: "text" };
    }
  }
  
  return { ok: false, type: "unknown" };
}

export const translations = {
  en: {
    app_title: "TeleCloud",
    app_subtitle: "Persistent Cloud Storage (CF Worker)",
    toggle_theme: "Toggle Theme",
    settings: "Settings",
    refresh: "Refresh",
    search_placeholder: "Search files...",
    upload_title: "Upload to Cloud",
    upload_subtitle: "Files are stored in Telegram and indexed in your Cloudflare Database.",
    max_upload: "Max Upload: 50MB",
    max_download: "Max Download: 20MB",
    select_files: "Select Files",
    configure_first: "Configure Settings First",
    import_id: "Import ID",
    uploading: "Uploading",
    selected_files: "Selected Files",
    remove_all: "Remove All",
    add_more: "Add More",
    upload_all: "Upload All",
    drop_title: "Drop files to upload",
    drop_subtitle: "Release to add to pending list",
    home: "Home",
    new_folder: "New Folder",
    items: "items",
    empty: "Empty",
    folder: "folder(s)",
    file: "file(s)",
    empty_search: "No files matching your search.",
    empty_folder: "This folder is empty.",
    delete_confirm_title: "Delete File?",
    delete_confirm_text: "Are you sure you want to delete",
    delete_confirm_undone: "This action cannot be undone.",
    cancel: "Cancel",
    delete: "Delete",
    create: "Create",
    folder_name: "Folder Name",
    move_to: "Move to...",
    home_dir: "Home Directory",
    import_title: "Import Existing Files",
    import_desc: "Bot API cannot scan history. To add existing files, enter their <strong>Message Link</strong> or <strong>ID</strong>.",
    import_desc_2: "Tip: Right click a message in Telegram &gt; Copy Message Link.",
    import_input_label: "Message Link(s) or ID(s)",
    import_input_info: "Separate multiple IDs with commas. Use '100-110' for ranges.",
    import_btn: "Import Files",
    upload_success_title: "Upload Successful",
    upload_success_multi_title: "Uploads Successful",
    done: "Done",
    protected_link: "<strong>Protected:</strong> These links proxy traffic through your Worker.",
    copy_link: "Copy Link",
    preview: "Preview",
    download: "Download",
    move: "Move to Folder",
    sort: "Sort",
    sort_by: "Sort By",
    order: "Order",
    name: "Name",
    date: "Date",
    size: "Size",
    asc: "Ascending",
    desc: "Descending",
    config_title: "Configuration",
    bot_token: "Bot Token",
    info_bot_token: "From @BotFather",
    chat_id: "Chat ID",
    info_chat_id: "Channel ID where files are stored",
    worker_url: "Worker URL",
    info_worker_url: "URL of your Cloudflare Worker. Use '/api' if served from same domain.",
    test_conn: "Test",
    save_sync: "Save & Sync",
    conn_success: "Connected successfully!",
    conn_failed: "Connection failed.",
    language: "Language",
    files_uploaded: "File(s) Uploaded",
    no_folders: "No other folders created",
    subfolder: "Subfolder",
    move_file_failed: "Failed to move file.",
    create_folder_failed: "Failed to create folder.",
    delete_failed: "Failed to delete file from database.",
    delete_error: "An error occurred while deleting.",
    upload_failed: "Upload failed.",
    some_uploads_failed: "Some uploads failed.",
    search_failed: "Search failed.",
    fetch_failed: "Failed to fetch files. Ensure Worker is deployed and configured.",
    msg_older_than_48h: "This message is older than 48 hours and must be deleted manually: ",
    skipped_large_files: "Skipped __count__ files larger than 50MB.",
    chunks: "chunks",
    chunks_detail: "Chunks",
    slicing_message: "Auto-sliced large files: __msg__"
  },
  zh: {
    app_title: "TeleCloud",
    app_subtitle: "持久化云存储 (CF Worker)",
    toggle_theme: "切换主题",
    settings: "设置",
    refresh: "刷新",
    search_placeholder: "搜索文件...",
    upload_title: "上传到云端",
    upload_subtitle: "文件存储在 Telegram，索引存储在 Cloudflare 数据库。",
    max_upload: "最大上传: 50MB",
    max_download: "最大下载: 20MB",
    select_files: "选择文件",
    configure_first: "请先配置设置",
    import_id: "导入 ID",
    uploading: "正在上传",
    selected_files: "已选文件",
    remove_all: "全部移除",
    add_more: "添加更多",
    upload_all: "全部上传",
    drop_title: "拖拽文件到此处上传",
    drop_subtitle: "释放以添加到列表",
    home: "首页",
    new_folder: "新建文件夹",
    items: "项",
    empty: "空",
    folder: "个文件夹",
    file: "个文件",
    empty_search: "没有找到匹配的文件。",
    empty_folder: "此文件夹为空。",
    delete_confirm_title: "删除文件?",
    delete_confirm_text: "您确定要删除",
    delete_confirm_undone: "此操作无法撤销。",
    cancel: "取消",
    delete: "删除",
    create: "创建",
    folder_name: "文件夹名称",
    move_to: "移动到...",
    home_dir: "根目录",
    import_title: "导入现有文件",
    import_desc: "Bot API 无法扫描历史记录。要添加现有文件，请输入<strong>消息链接</strong>或<strong>ID</strong>。",
    import_desc_2: "提示：在Telegram中右键点击一条消息 &gt; 复制消息链接。",
    import_input_label: "消息链接或 ID",
    import_input_info: "使用逗号分隔多个 ID。使用“100-110”表示范围。",
    import_btn: "导入文件",
    upload_success_title: "上传成功",
    upload_success_multi_title: "批量上传成功",
    done: "完成",
    protected_link: "<strong>受保护：</strong>链接通过 Worker 代理传输流量。",
    copy_link: "复制链接",
    preview: "预览",
    download: "下载",
    move: "移动",
    sort: "排序",
    sort_by: "排序方式",
    order: "顺序",
    name: "名称",
    date: "日期",
    size: "大小",
    asc: "升序",
    desc: "降序",
    config_title: "配置",
    bot_token: "机器人Token",
    info_bot_token: "来自@BotFather",
    chat_id: "聊天 ID",
    info_chat_id: "文件存储的频道ID",
    worker_url: "Worker URL",
    info_worker_url: "这是您的 Cloudflare Worker 的 URL。如果从同一域名提供，请使用 '/api'。",
    test_conn: "测试",
    save_sync: "保存并同步",
    conn_success: "连接成功！",
    conn_failed: "连接失败。",
    language: "语言",
    files_uploaded: "个文件已上传",
    no_folders: "暂无其他文件夹",
    subfolder: "子文件夹",
    move_file_failed: "移动文件失败。",
    create_folder_failed: "创建文件夹失败。",
    delete_failed: "从数据库删除文件失败。",
    delete_error: "删除时发生错误。",
    upload_failed: "上传失败。",
    some_uploads_failed: "部分文件上传失败。",
    search_failed: "搜索失败。",
    fetch_failed: "获取文件失败。请确保 Worker 已部署并配置。",
    msg_older_than_48h: "此消息已超过 48 小时，必须手动删除：",
    skipped_large_files: "已跳过 __count__ 个大于 50MB 的文件。",
    chunks: "分块",
    chunks_detail: "分块详情",
    slicing_message: "自动切割大文件: __msg__"
  }
};

export type Language = keyof typeof translations;

export const t = (lang: string | undefined, key: keyof typeof translations['en']) => {
  const currentLang = (lang && translations[lang as Language]) ? lang as Language : 'en';
  return ReactHtmlParser(translations[currentLang][key]) || key;
};