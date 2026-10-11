/**
 * SQL DDL statements for SpecLens SQLite database.
 * Based on §7.1 and §7.2 of spec.md.
 */

export const MIGRATIONS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS _migrations (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  applied_at TEXT NOT NULL
);
`;

export const WORKSPACES_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`;

export const SPECIFICATIONS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS specifications (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  version TEXT NOT NULL,
  dialect TEXT NOT NULL, -- 'openapi-3.0'|'openapi-3.1'|'swagger-2.0'
  source_checksum TEXT NOT NULL,
  source_content TEXT,
  is_active INTEGER NOT NULL DEFAULT 0,
  imported_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`;

export const OPERATIONS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS operations (
  id TEXT PRIMARY KEY,
  specification_id TEXT NOT NULL REFERENCES specifications(id) ON DELETE CASCADE,
  method TEXT NOT NULL,
  path TEXT NOT NULL,
  operation_id TEXT,
  tags TEXT NOT NULL DEFAULT '[]', -- JSON array
  normalized_json TEXT NOT NULL,   -- JSON da NormalizedOperation
  source_pointer TEXT NOT NULL,
  index_text TEXT NOT NULL,         -- texto compacto para FTS
  created_at TEXT NOT NULL
);
`;

export const OPERATION_FTS_TABLE_SQL = `
CREATE VIRTUAL TABLE IF NOT EXISTS operation_fts USING fts5(
  content=operations,
  content_rowid=rowid,
  operation_id,
  method,
  path,
  tags,
  index_text
);
`;

export const OPERATION_FTS_TRIGGERS_SQL = `
CREATE TRIGGER IF NOT EXISTS operations_ai AFTER INSERT ON operations BEGIN
  INSERT INTO operation_fts(rowid, operation_id, method, path, tags, index_text)
  VALUES (new.rowid, new.operation_id, new.method, new.path, new.tags, new.index_text);
END;

CREATE TRIGGER IF NOT EXISTS operations_ad AFTER DELETE ON operations BEGIN
  INSERT INTO operation_fts(operation_fts, rowid, operation_id, method, path, tags, index_text)
  VALUES ('delete', old.rowid, old.operation_id, old.method, old.path, old.tags, old.index_text);
END;

CREATE TRIGGER IF NOT EXISTS operations_au AFTER UPDATE ON operations BEGIN
  INSERT INTO operation_fts(operation_fts, rowid, operation_id, method, path, tags, index_text)
  VALUES ('delete', old.rowid, old.operation_id, old.method, old.path, old.tags, old.index_text);
  INSERT INTO operation_fts(rowid, operation_id, method, path, tags, index_text)
  VALUES (new.rowid, new.operation_id, new.method, new.path, new.tags, new.index_text);
END;
`;

export const VECTOR_NAMESPACES_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS vector_namespaces (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  specification_id TEXT NOT NULL REFERENCES specifications(id) ON DELETE CASCADE,
  provider_id TEXT NOT NULL,
  model_id TEXT NOT NULL,
  model_revision TEXT NOT NULL,
  dimensions INTEGER NOT NULL,
  chunking_version TEXT NOT NULL,
  index_location TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending|building|ready|failed
  created_at TEXT NOT NULL
);
`;

export const WORKSPACE_SETTINGS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS workspace_settings (
  workspace_id TEXT PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
  schema_version INTEGER NOT NULL DEFAULT 1,
  settings_json TEXT NOT NULL,
  changed_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`;

export const INGESTION_JOBS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS ingestion_jobs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  specification_id TEXT,
  state TEXT NOT NULL DEFAULT 'pending', -- pending|running|completed|failed
  progress INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  warnings_json TEXT NOT NULL DEFAULT '[]',
  started_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`;

export const EVALUATION_RUNS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS evaluation_runs (
  id TEXT PRIMARY KEY,
  dataset_version TEXT NOT NULL,
  config_snapshot_json TEXT NOT NULL,
  metrics_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
`;

export const INDEXES_SQL = `
CREATE INDEX IF NOT EXISTS idx_specifications_workspace ON specifications(workspace_id);
CREATE INDEX IF NOT EXISTS idx_specifications_checksum ON specifications(workspace_id, source_checksum);
CREATE INDEX IF NOT EXISTS idx_operations_spec ON operations(specification_id);
CREATE INDEX IF NOT EXISTS idx_operations_method_path ON operations(method, path);
CREATE INDEX IF NOT EXISTS idx_vector_namespaces_lookup ON vector_namespaces(workspace_id, specification_id, provider_id, model_id, model_revision);
CREATE INDEX IF NOT EXISTS idx_ingestion_jobs_workspace ON ingestion_jobs(workspace_id);
`;
