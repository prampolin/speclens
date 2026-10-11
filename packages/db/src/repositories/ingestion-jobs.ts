import { randomUUID } from 'node:crypto';
import type { Database } from 'better-sqlite3';
import type { IngestionJobEntity, JobStatus } from '../types.js';

interface RawIngestionJobRow {
  id: string;
  workspace_id: string;
  specification_id: string | null;
  state: string;
  progress: number;
  error_message: string | null;
  warnings_json: string;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

function mapRowToEntity(row: RawIngestionJobRow): IngestionJobEntity {
  let warnings: string[] = [];
  try {
    warnings = JSON.parse(row.warnings_json);
  } catch {
    warnings = [];
  }

  let status: JobStatus = 'pending';
  if (row.state === 'running' || row.state === 'processing') {
    status = 'processing';
  } else if (row.state === 'completed') {
    status = 'completed';
  } else if (row.state === 'failed') {
    status = 'failed';
  }

  return {
    id: row.id,
    workspaceId: row.workspace_id,
    specificationId: row.specification_id ?? '',
    status,
    progress: row.progress,
    errors: row.error_message ? [row.error_message] : undefined,
    warnings: warnings.length > 0 ? warnings : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class IngestionJobRepository {
  constructor(private readonly db: Database) {}

  create(data: {
    id?: string;
    workspaceId: string;
    specificationId?: string;
    state?: string;
    status?: JobStatus;
    progress?: number;
    warnings?: string[];
  }): IngestionJobEntity {
    const id = data.id ?? randomUUID();
    const now = new Date().toISOString();
    const state = data.state ?? (data.status === 'processing' ? 'running' : data.status ?? 'pending');
    const progress = data.progress ?? 0;
    const warningsJson = JSON.stringify(data.warnings ?? []);

    const stmt = this.db.prepare(`
      INSERT INTO ingestion_jobs (
        id, workspace_id, specification_id, state,
        progress, error_message, warnings_json, started_at,
        completed_at, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      data.workspaceId,
      data.specificationId ?? null,
      state,
      progress,
      null,
      warningsJson,
      state === 'running' ? now : null,
      null,
      now,
      now
    );

    return mapRowToEntity({
      id,
      workspace_id: data.workspaceId,
      specification_id: data.specificationId ?? null,
      state,
      progress,
      error_message: null,
      warnings_json: warningsJson,
      started_at: state === 'running' ? now : null,
      completed_at: null,
      created_at: now,
      updated_at: now,
    });
  }

  updateState(
    id: string,
    update: {
      state?: string;
      status?: JobStatus;
      progress?: number;
      errorMessage?: string;
      warnings?: string[];
      completedAt?: string;
    }
  ): IngestionJobEntity | null {
    const existing = this.findById(id);
    if (!existing) {
      return null;
    }

    const state =
      update.state ??
      (update.status === 'processing' ? 'running' : update.status ?? existing.status);

    const now = new Date().toISOString();
    const completedAt =
      update.completedAt ??
      (state === 'completed' || state === 'failed' ? now : null);

    const warningsJson = update.warnings
      ? JSON.stringify(update.warnings)
      : undefined;

    const stmt = this.db.prepare(`
      UPDATE ingestion_jobs
      SET
        state = COALESCE(?, state),
        progress = COALESCE(?, progress),
        error_message = COALESCE(?, error_message),
        warnings_json = COALESCE(?, warnings_json),
        completed_at = COALESCE(?, completed_at),
        updated_at = ?
      WHERE id = ?
    `);

    stmt.run(
      state,
      update.progress ?? null,
      update.errorMessage ?? null,
      warningsJson ?? null,
      completedAt,
      now,
      id
    );

    return this.findById(id);
  }

  findById(id: string): IngestionJobEntity | null {
    const stmt = this.db.prepare(`
      SELECT *
      FROM ingestion_jobs
      WHERE id = ?
    `);

    const row = stmt.get(id) as RawIngestionJobRow | undefined;
    return row ? mapRowToEntity(row) : null;
  }

  findByWorkspace(workspaceId: string): IngestionJobEntity[] {
    const stmt = this.db.prepare(`
      SELECT *
      FROM ingestion_jobs
      WHERE workspace_id = ?
      ORDER BY created_at DESC
    `);

    const rows = stmt.all(workspaceId) as RawIngestionJobRow[];
    return rows.map(mapRowToEntity);
  }
}
