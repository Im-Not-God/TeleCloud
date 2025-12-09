PRAGMA defer_foreign_keys=TRUE;
CREATE TABLE config (key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE IF NOT EXISTS "files" (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id INTEGER,
    message_id INTEGER,
    file_id TEXT,
    file_unique_id TEXT,
    file_name TEXT,
    mime_type TEXT,
    file_size INTEGER,
    date INTEGER,
    thumbnail_file_id TEXT DEFAULT NULL,
    is_photo INTEGER,
    is_folder INTEGER DEFAULT 0,
    parent_id INTEGER DEFAULT NULL,
    original_name TEXT DEFAULT NULL,
    chunk_index INTEGER DEFAULT NULL,
    chunk_total INTEGER DEFAULT NULL,
    slice_group_id TEXT DEFAULT NULL
);
DELETE FROM sqlite_sequence;
CREATE UNIQUE INDEX unique_file_unique_id ON files (file_unique_id);
CREATE INDEX idx_files_parent_id ON files (parent_id);
CREATE INDEX idx_slice_group_id ON files (slice_group_id);
