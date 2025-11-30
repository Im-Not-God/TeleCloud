/**
 * Cloudflare Worker for TeleCloud
 * Handles Telegram Proxying and D1 Database Persistence
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, DELETE',
  'Access-Control-Allow-Headers': 'Content-Type, X-Bot-Token, X-Chat-Id',
};

let HEADER_CHAT_ID = null;

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const path = url.pathname.replace('/api', ''); // Support both /api/files and /files
    
    // For proxying, we prefer getting credentials from DB/Env to protect the link
    // For admin actions (upload/delete), we accept headers from the trusted client
    const headerToken = request.headers.get('X-Bot-Token');
    HEADER_CHAT_ID = request.headers.get('X-Chat-Id');

    try {
      // --- Public / Protected Endpoints (No Client Headers required) ---
      
      if (path === '/fp' && request.method === 'GET') {
        const fileId = url.searchParams.get('file_id');
        const fileName = url.searchParams.get('file_name');
        return await handleFileProxy(env.DB, env.BOT_TOKEN, fileId, fileName);
      }

      // --- Admin Endpoints (Require Headers or Setup) ---

      if (path === '/config' && request.method === 'POST') {
        return await handleSaveConfig(request, env.DB);
      }

      if (path === '/me') {
        return await handleGetMe(headerToken);
      }
      if (path === '/files' && request.method === 'GET') {
        const parentId = url.searchParams.get('parent_id');
        const sortBy = url.searchParams.get('sort_by');
        const order = url.searchParams.get('order');
        return await handleListFiles(env.DB, parentId, sortBy, order);
      }
      if (path === '/search' && request.method === 'GET') {
        const query = url.searchParams.get('q');
        return await handleSearchFiles(env.DB, query);
      }
      if (path === '/folders' && request.method === 'GET') {
        return await handleListFolders(env.DB);
      }
      if (path === '/create_folder' && request.method === 'POST') {
        return await handleCreateFolder(request, env.DB);
      }
      if (path === '/move' && request.method === 'POST') {
        return await handleMove(request, env.DB);
      }
      if (path === '/upload' && request.method === 'POST') {
        return await handleUpload(request, env.DB, headerToken);
      }
      if (path === '/import' && request.method === 'POST') {
        return await handleImport(request, env.DB, headerToken);
      }
      if (path === '/delete' && request.method === 'POST') {
        return await handleDelete(request, env.DB, headerToken);
      }
      if (path === '/file_link' && request.method === 'GET') {
        const fileId = url.searchParams.get('file_id');
        return await handleGetFileLink(headerToken, fileId);
      }
      
      return new Response('Not Found', { status: 404, headers: CORS_HEADERS });

    } catch (err) {
      return new Response(JSON.stringify({ ok: false, error: err.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
      });
    }
  }
};

// --- Helper: Get Credentials ---
async function getBotToken(db, envToken) {
  if (envToken) return envToken; // Environment variable takes precedence (safest)
  if (!db) return null;
  try {
    const res = await db.prepare("SELECT value FROM config WHERE key = 'bot_token'").first();
    return res ? res.value : null;
  } catch (e) { return null; }
}

// --- Handlers ---

async function handleSaveConfig(request, db) {
  const { botToken, chatId } = await request.json();
  if (!db) throw new Error("Database not configured");
  
  // Save to D1 so the proxy can use it later without client headers
  await db.prepare("INSERT OR REPLACE INTO config (key, value) VALUES ('bot_token', ?), ('chat_id', ?)")
    .bind(botToken, chatId)
    .run();
    
  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
  });
}

async function handleFileProxy(db, envToken, fileId, fileName) {
  if (!fileId) throw new Error("Missing file_id");

  const token = await getBotToken(db, envToken);
  if (!token) throw new Error("Server not configured. Bot Token missing in DB or Env.");

  // 1. Get File Path from Telegram
  const pathRes = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`);
  const pathData = await pathRes.json();
  
  if (!pathData.ok) throw new Error("Telegram Error: " + pathData.description);
  const filePath = pathData.result.file_path;

  // 2. Fetch the actual file stream
  const fileRes = await fetch(`https://api.telegram.org/file/bot${token}/${filePath}`);
  
  // 3. Proxy the headers and body
  const newHeaders = new Headers(fileRes.headers);
  newHeaders.set('Access-Control-Allow-Origin', '*');
  
  // Determine if it should be displayed inline (preview) or downloaded (attachment)
  // We added PDF, TXT, JSON, JS, HTML, etc. to the preview list
  let isPreview = false;
  let forcedMime = null;

  if (fileName) {
    const ext = fileName.split('.').pop().toLowerCase();
    
    // Media
    if (/^(jpg|jpeg|png|gif|webp|mp4|webm|svg)$/.test(ext)) isPreview = true;
    
    // Documents / Text
    if (/^(pdf|txt|json|js|css|html|xml|md|log|sql|ts|tsx|jsx)$/.test(ext)) {
        isPreview = true;
        // Fix Content-Type for correct browser rendering if Telegram sends generic stream
        if(ext === 'pdf') forcedMime = 'application/pdf';
        if(ext === 'json') forcedMime = 'application/json';
        if(ext === 'txt') forcedMime = 'text/plain';
        if(ext === 'html') forcedMime = 'text/html';
    }
  }

  // Override Content-Disposition
  newHeaders.set(
      'Content-Disposition', 
      `${isPreview ? 'inline' : 'attachment'}; filename="${fileName || 'file'}"`
  );

  // Override Content-Type if necessary (e.g. for PDF preview to work in iframe)
  if (forcedMime) {
      newHeaders.set('Content-Type', forcedMime);
  }

  return new Response(fileRes.body, {
    status: fileRes.status,
    headers: newHeaders
  });
}

async function handleGetMe(token) {
  if (!token) throw new Error("Missing Bot Token Header");
  const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
  const data = await res.json();
  return new Response(JSON.stringify({ ok: data.ok, result: data.result }), {
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
  });
}

async function handleListFiles(db, parentId, sortBy = 'date', order = 'desc') {
  if (!db) throw new Error("Database not configured");
  
  const isRoot = !parentId || parentId === "null" || parentId === "root";

  // Whitelist sort fields to prevent SQL injection
  const validSorts = {
    'name': 'f.file_name',
    'date': 'f.date',
    'size': 'f.file_size'
  };
  const validOrders = ['asc', 'desc'];

  const sortCol = validSorts[sortBy] || 'f.date';
  const sortOrder = validOrders.includes(order) ? order.toUpperCase() : 'DESC';
  
  // Always sort folders first (is_folder DESC means 1 first)
  const orderByClause = `ORDER BY f.is_folder DESC, ${sortCol} ${sortOrder}`;

  // Fetch all files including chunked ones
  let query = `
    SELECT 
      f.*,
      SUM(CASE WHEN c.is_folder = 0 THEN 1 ELSE 0 END) AS child_files,
      SUM(CASE WHEN c.is_folder = 1 THEN 1 ELSE 0 END) AS child_folders
    FROM files f
    LEFT JOIN files c ON c.parent_id = f.id
    WHERE f.chat_id = ?
      ${isRoot ? "AND f.parent_id IS NULL" : "AND f.parent_id = ?"}
    GROUP BY f.id
    ${orderByClause}
  `;
  
  let params = isRoot ? [HEADER_CHAT_ID] : [parseInt(HEADER_CHAT_ID), parseInt(parentId)];
  
  const { results } = await db.prepare(query).bind(...params).all();

  // Group sliced files: collect all chunks with the same slice_group_id
  const sliceGroups = new Map();
  const regularFiles = [];
  
  for (const row of results) {
    if (row.slice_group_id) {
      // This is a sliced file chunk
      if (!sliceGroups.has(row.slice_group_id)) {
        sliceGroups.set(row.slice_group_id, []);
      }
      sliceGroups.get(row.slice_group_id).push(row);
    } else {
      // Regular file or folder
      regularFiles.push(row);
    }
  }

  // Process sliced file groups
  // For each group, only show the first chunk (or we could create a virtual "super-file")
  const sliceFileRows = [];
  for (const [groupId, chunks] of sliceGroups) {
    // Sort chunks by index
    chunks.sort((a, b) => (a.chunk_index || 0) - (b.chunk_index || 0));
    
    // Calculate total size of all chunks
    const totalSize = chunks.reduce((sum, c) => sum + (c.file_size || 0), 0);
    
    // Use the first chunk as the representative, but update its metadata
    const representative = { ...chunks[0] };
    representative.file_name = representative.original_name; // Show original name
    representative.file_size = totalSize; // Show total size
    representative.chunk_index = null; // Not a chunk anymore, it's a group
    representative.is_sliced = true; // Mark as sliced file
    representative.total_chunks = chunks[0].chunk_total; // Store total chunks info
    representative.chunks = chunks.map(data => ({
      file_id: data.file_id, 
      name: data.file_name,
      size: data.file_size,
      index: data.chunk_index,
      slice_group_id: data.slice_group_id
    }));
    
    sliceFileRows.push(representative);
  }

  // Combine regular files and sliced file groups
  const allRows = [...regularFiles, ...sliceFileRows];
  
  // Re-sort combined results
  allRows.sort((a, b) => {
    // Folders first
    if ((a.is_folder || 0) !== (b.is_folder || 0)) {
      return (b.is_folder || 0) - (a.is_folder || 0);
    }
    
    // Then by selected sort column
    let aVal, bVal;
    if (sortCol.includes('file_name')) {
      aVal = (a.file_name || '').toLowerCase();
      bVal = (b.file_name || '').toLowerCase();
    } else if (sortCol.includes('file_size')) {
      aVal = a.file_size || 0;
      bVal = b.file_size || 0;
    } else {
      aVal = a.date || 0;
      bVal = b.date || 0;
    }
    
    const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
    return sortOrder === 'ASC' ? cmp : -cmp;
  });

  // Map DB rows back to TelegramUpdate structure for frontend compatibility
  const updates = allRows.map(row => mapRowToUpdate(row));

  return new Response(JSON.stringify({ ok: true, result: updates }), {
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
  });
}

async function handleSearchFiles(db, query) {
  if (!db) throw new Error("Database not configured");
  if (!query || query.trim() === '') {
      return new Response(JSON.stringify({ ok: true, result: [] }), {
          headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
      });
  }

  const searchQuery = `%${query.trim()}%`;
  
  // Search across all files for this chat_id
  // Search both file_name (for chunks) and original_name (for sliced files)
  const sql = `
    SELECT 
      f.*,
      SUM(CASE WHEN c.is_folder = 0 THEN 1 ELSE 0 END) AS child_files,
      SUM(CASE WHEN c.is_folder = 1 THEN 1 ELSE 0 END) AS child_folders
    FROM files f
    LEFT JOIN files c ON c.parent_id = f.id
    WHERE f.chat_id = ? AND (f.file_name LIKE ? OR f.original_name LIKE ?)
    GROUP BY f.id
    ORDER BY f.is_folder DESC, f.date DESC
    LIMIT 50
  `;
  
  const { results } = await db.prepare(sql).bind(HEADER_CHAT_ID, searchQuery, searchQuery).all();
  
  // Apply same slicing grouping logic as handleListFiles
  const sliceGroups = new Map();
  const regularFiles = [];
  
  for (const row of results) {
    if (row.slice_group_id) {
      if (!sliceGroups.has(row.slice_group_id)) {
        sliceGroups.set(row.slice_group_id, []);
      }
      sliceGroups.get(row.slice_group_id).push(row);
    } else {
      regularFiles.push(row);
    }
  }
  
  const sliceFileRows = [];
  for (const [groupId, chunks] of sliceGroups) {
    chunks.sort((a, b) => (a.chunk_index || 0) - (b.chunk_index || 0));
    const totalSize = chunks.reduce((sum, c) => sum + (c.file_size || 0), 0);
    
    const representative = { ...chunks[0] };
    representative.file_name = representative.original_name;
    representative.file_size = totalSize;
    representative.chunk_index = null;
    representative.is_sliced = true;
    representative.total_chunks = chunks[0].chunk_total;
    
    sliceFileRows.push(representative);
  }
  
  const allRows = [...regularFiles, ...sliceFileRows];
  const updates = allRows.map(row => mapRowToUpdate(row));

  return new Response(JSON.stringify({ ok: true, result: updates }), {
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
  });
}

function mapRowToUpdate(row) {
    return {
        update_id: row.id,
        message: {
          message_id: row.message_id,
          date: row.date,
          chat: { id: 0, type: 'channel' },
          [row.is_photo ? 'photo' : 'document']: row.is_photo ? [{
              file_id: row.file_id,
              file_unique_id: row.file_unique_id,
              file_size: row.file_size,
              width: 0, height: 0
          }] : {
              file_id: row.file_id,
              file_unique_id: row.file_unique_id,
              file_name: row.file_name,
              mime_type: row.mime_type,
              file_size: row.file_size,
              is_sliced: row.is_sliced || false,
              chunks: row.chunks || [],
              parent_id: row.parent_id,
              is_folder: !!row.is_folder,
              stats: row.is_folder ? {
                files: row.child_files || 0,
                folders: row.child_folders || 0
              } : undefined
          },
          is_duplicate: false
        }
    };
}

async function handleListFolders(db) {
  if (!db) throw new Error("Database not configured");
  const { results } = await db.prepare("SELECT id, file_name as name, parent_id FROM files WHERE chat_id = ? AND is_folder = 1 ORDER BY name ASC").bind(HEADER_CHAT_ID).all();
  return new Response(JSON.stringify({ ok: true, result: results }), {
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
  });
}

async function handleCreateFolder(request, db) {
  const { name, parent_id } = await request.json();
  const folderId = crypto.randomUUID(); // Unique ID for logic, though we use auto-inc ID for parent_id ref
  
  // We insert a "fake" file entry representing the folder
  await db.prepare(
      "INSERT INTO files (chat_id, file_unique_id, file_name, is_folder, parent_id, date, file_size) VALUES (?, ?, ?, 1, ?, ?, 0)"
  ).bind(HEADER_CHAT_ID, folderId, name, parent_id || null, Math.floor(Date.now()/1000)).run();

  return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
  });
}

async function handleMove(request, db) {
  const { file_id, parent_id } = await request.json();
  // We use file_id as the key, which is the 'file_id' column or 'file_unique_id' for folders usually.
  // However, our delete/move logic needs to identify the row. 
  // Ideally we pass the primary key ID, but the frontend currently uses file_id string.
  
  // Update by file_id (for files) OR file_unique_id (for folders/files)
  await db.prepare(
      "UPDATE files SET parent_id = ? WHERE chat_id = ? AND (file_id = ? OR file_unique_id = ?)"
  ).bind(HEADER_CHAT_ID, parent_id || null, file_id, file_id).run();

  return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
  });
}

async function handleUpload(request, db, token) {
  if (!token || !HEADER_CHAT_ID) throw new Error("Missing Credentials");

  const formData = await request.formData();
  const document = formData.get('document');
  const parentId = formData.get('parent_id'); // Get folder context
  const sliceGroupId = formData.get('slice_group_id');

  // Stream to Telegram
  const tgFormData = new FormData();
  tgFormData.append('chat_id', HEADER_CHAT_ID);
  tgFormData.append('document', document);

  const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
    method: 'POST',
    body: tgFormData
  });

  const tgData = await tgRes.json();

  if (!tgData.ok) {
    throw new Error(tgData.description || "Telegram API Error");
  }

  const msg = tgData.result;
  await saveMessageToDb(db, msg, parentId, sliceGroupId);

  return new Response(JSON.stringify({ ok: true, result: msg }), {
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
  });
}

async function handleImport(request, db, token) {
  const { message_id, parent_id } = await request.json();
  // Forward message to self to get details (similar to frontend logic but server side)
  const res = await fetch(`https://api.telegram.org/bot${token}/forwardMessage`, {
     method: 'POST',
     headers: {'Content-Type': 'application/json'},
     body: JSON.stringify({
        chat_id: HEADER_CHAT_ID,
        from_chat_id: HEADER_CHAT_ID,
        message_id: message_id
     })
  });
  
  const data = await res.json();
  if (!data.ok) throw new Error("Could not import message: " + data.description);
  
  const msg = data.result;
  // Delete the forward
  await fetch(`https://api.telegram.org/bot${token}/deleteMessage`, {
     method: 'POST',
     headers: {'Content-Type': 'application/json'},
     body: JSON.stringify({ chat_id: HEADER_CHAT_ID, message_id: msg.message_id })
  });

  // Use the forwarded message data to save (it contains the file info)
  // Note: msg.forward_date is original date, msg.date is now.
  const savedDate = msg.forward_date || msg.date;
  const originalMsg = { ...msg, date: savedDate };
  
  await saveMessageToDb(db, originalMsg, parent_id);

  return new Response(JSON.stringify({ ok: true, result: originalMsg }), {
     headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
  });
}

async function handleDelete(request, db, token) {
    const { file_id } = await request.json();

    // First, find the item to see if it's a folder or a sliced file
    const item = await db.prepare("SELECT id, message_id, is_folder, slice_group_id FROM files WHERE chat_id = ? AND (file_id = ? OR file_unique_id = ?)").bind(HEADER_CHAT_ID, file_id, file_id).first();
    let delResult = { msg: "not found" };
    
    if (item) {
        let itemsToDelete = [item];
        
        if (item.is_folder) {
            // Delete content recursively (simple 1-level depth for now, or just delete children)
            // D1 doesn't support recursive CTEs easily in simple mode, so we just delete where parent_id matches
            // Ideally, the frontend warns about non-empty folders.
            await db.prepare("DELETE FROM files WHERE chat_id = ? AND parent_id = ?").bind(HEADER_CHAT_ID, item.id).run();
        } else if (item.slice_group_id) {
            // This is a sliced file - delete all chunks in the group
            const allChunks = await db.prepare("SELECT id, message_id FROM files WHERE slice_group_id = ?").bind(item.slice_group_id).all();
            itemsToDelete = allChunks.results || [item];
        }
        
        // Delete from Telegram and database
        let failedDeletions = [];
        for (const fileItem of itemsToDelete) {
            const tgRes = await fetch(`https://api.telegram.org/bot${token}/deleteMessage`, {
              method: 'POST',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({ chat_id: HEADER_CHAT_ID, message_id: fileItem.message_id })
            });
            const data = await tgRes.json();
            
            if (!data.ok) {
              failedDeletions.push(fileItem.message_id);
            }
            
            await db.prepare("DELETE FROM files WHERE id = ?").bind(fileItem.id).run();
        }

        delResult = { msg: itemsToDelete.length > 1 ? `Deleted ${itemsToDelete.length} chunks` : "only db data deleted" };
        if (failedDeletions.length > 0) {
          const rawChatId = String(HEADER_CHAT_ID).replace(/^-100/, '');
          delResult.msgLinks = failedDeletions.map(mid => `https://t.me/c/${rawChatId}/${mid}`);
        }
    }
    
    return new Response(JSON.stringify({ ok: true, result: delResult}), {
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
    });
}

async function handleGetFileLink(token, fileId) {
  const res = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`);
  const data = await res.json();
  if (!data.ok) throw new Error("File not found");
  
  const url = `https://api.telegram.org/file/bot${token}/${data.result.file_path}`;
  return new Response(JSON.stringify({ ok: true, result: { url } }), {
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
  });
}

async function saveMessageToDb(db, msg, parentId = null, sliceGroupId = null) {
    const doc = msg.document;
    const photo = msg.photo ? msg.photo[msg.photo.length - 1] : null;
    
    if (!doc && !photo) return;

    const fileId = doc?.file_id || photo?.file_id;
    const uniqueId = doc?.file_unique_id || photo?.file_unique_id;
    const fileName = doc?.file_name || `photo_${msg.date}.jpg`;
    const mimeType = doc?.mime_type || 'application/octet-stream';
    const fileSize = doc?.file_size || photo?.file_size;
    const isPhoto = !!photo;
    // Convert parentId to null if "null" string or undefined
    const validParentId = (parentId && parentId !== 'null') ? parseInt(parentId) : null;

    // Detect if this is a sliced file
    const chunkInfo = parseChunkFileName(fileName);
    let originalName = fileName;
    let chunkIndex = null;
    let chunkTotal = null;

    if (chunkInfo) {
      originalName = chunkInfo.originalName;
      chunkIndex = chunkInfo.index;
      chunkTotal = chunkInfo.total;
    }

    try {
      await db.prepare(
          `INSERT INTO files (chat_id, message_id, file_id, file_unique_id, file_name, mime_type, file_size, date, is_photo, parent_id, original_name, chunk_index, chunk_total, slice_group_id) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
          HEADER_CHAT_ID, 
          msg.message_id, 
          fileId, 
          uniqueId, 
          fileName, 
          mimeType, 
          fileSize, 
          msg.date, 
          isPhoto ? 1 : 0, 
          validParentId,
          originalName,
          chunkIndex,
          chunkTotal,
          sliceGroupId
      ).run();
    } catch (err) {
      // 当 file_unique_id 重复时，这里捕获数据库 UNIQUE 约束报错
      if (err.message.includes("UNIQUE constraint failed")) {
          console.log("Duplicate file_unique_id, skipping insert:", uniqueId);
          msg.is_duplicate = true;
          return;
      }
      throw err;
  }
}

// Helper: Parse chunk filename to extract metadata
function parseChunkFileName(fileName) {
  const match = fileName.match(/^(.+?)\.part(\d+)of(\d+)$/);
  if (!match) return null;
  
  return {
    originalName: match[1],
    index: parseInt(match[2], 10),
    total: parseInt(match[3], 10)
  };
}