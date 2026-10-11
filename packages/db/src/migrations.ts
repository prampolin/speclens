import type { Database } from 'better-sqlite3';
import {
  MIGRATIONS_TABLE_SQL,
  WORKSPACES_TABLE_SQL,
  SPECIFICATIONS_TABLE_SQL,
  OPERATIONS_TABLE_SQL,
  OPERATION_FTS_TABLE_SQL,
  OPERATION_FTS_TRIGGERS_SQL,
  VECTOR_NAMESPACES_TABLE_SQL,
  WORKSPACE_SETTINGS_TABLE_SQL,
  INGESTION_JOBS_TABLE_SQL,
  EVALUATION_RUNS_TABLE_SQL,
  INDEXES_SQL,
} from './schema.js';

export interface Migration {
  id: number;
  name: string;
  up: (db: Database) => void;
}

export interface MigrationResult {
  appliedCount: number;
  appliedMigrations: string[];
}

export const migrations: Migration[] = [
  {
    id: 1,
    name: '001_initial_schema',
    up: (db: Database) => {
      db.exec(WORKSPACES_TABLE_SQL);
      db.exec(SPECIFICATIONS_TABLE_SQL);
      db.exec(OPERATIONS_TABLE_SQL);
      db.exec(OPERATION_FTS_TABLE_SQL);
      db.exec(OPERATION_FTS_TRIGGERS_SQL);
      db.exec(VECTOR_NAMESPACES_TABLE_SQL);
      db.exec(WORKSPACE_SETTINGS_TABLE_SQL);
      db.exec(INGESTION_JOBS_TABLE_SQL);
      db.exec(EVALUATION_RUNS_TABLE_SQL);
      db.exec(INDEXES_SQL);
    },
  },
];

export function runMigrations(db: Database): MigrationResult {
  // Ensure _migrations table exists
  db.exec(MIGRATIONS_TABLE_SQL);

  const appliedRows = db.prepare('SELECT id, name FROM _migrations ORDER BY id ASC').all() as Array<{
    id: number;
    name: string;
  }>;

  const appliedIds = new Set(appliedRows.map((row) => row.id));
  const appliedMigrations: string[] = [];

  const pendingMigrations = migrations
    .filter((m) => !appliedIds.has(m.id))
    .sort((a, b) => a.id - b.id);

  if (pendingMigrations.length === 0) {
    return { appliedCount: 0, appliedMigrations: [] };
  }

  const insertMigration = db.prepare(
    'INSERT INTO _migrations (id, name, applied_at) VALUES (?, ?, ?)'
  );

  const executePending = db.transaction(() => {
    for (const migration of pendingMigrations) {
      migration.up(db);
      insertMigration.run(migration.id, migration.name, new Date().toISOString());
      appliedMigrations.push(migration.name);
    }
  });

  executePending();

  return {
    appliedCount: appliedMigrations.length,
    appliedMigrations,
  };
}
