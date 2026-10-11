import Database, { type Database as DatabaseType } from 'better-sqlite3';
import { dirname } from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';
import { runMigrations } from './migrations.js';

export type { DatabaseType as Database };

export interface CreateDatabaseOptions {
  runMigrations?: boolean;
  timeout?: number;
}

export function createDatabase(
  dbPath: string = ':memory:',
  options: CreateDatabaseOptions = {}
): DatabaseType {
  const { runMigrations: autoMigrate = true, timeout = 5000 } = options;

  if (dbPath !== ':memory:') {
    const dir = dirname(dbPath);
    if (dir && !existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }

  const db = new Database(dbPath, { timeout });

  // Pragmas: WAL mode, foreign keys ON, busy timeout
  if (dbPath !== ':memory:') {
    db.pragma('journal_mode = WAL');
  }
  db.pragma('foreign_keys = ON');
  db.pragma(`busy_timeout = ${timeout}`);

  if (autoMigrate) {
    runMigrations(db);
  }

  return db;
}
