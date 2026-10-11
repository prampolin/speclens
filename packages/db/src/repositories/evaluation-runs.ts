import { randomUUID } from 'node:crypto';
import type { Database } from 'better-sqlite3';
import type { EvaluationRunEntity } from '../types.js';

interface RawEvaluationRunRow {
  id: string;
  dataset_version: string;
  config_snapshot_json: string;
  metrics_json: string;
  created_at: string;
}

function mapRowToEntity(row: RawEvaluationRunRow): EvaluationRunEntity {
  return {
    id: row.id,
    datasetVersion: row.dataset_version,
    configSnapshotJson: row.config_snapshot_json,
    metricsJson: row.metrics_json,
    createdAt: row.created_at,
  };
}

export class EvaluationRunRepository {
  constructor(private readonly db: Database) {}

  create(data: {
    id?: string;
    datasetVersion: string;
    configSnapshotJson: string | object;
    metricsJson: string | object;
    createdAt?: string;
  }): EvaluationRunEntity {
    const id = data.id ?? randomUUID();
    const createdAt = data.createdAt ?? new Date().toISOString();
    const configSnapshotJson =
      typeof data.configSnapshotJson === 'string'
        ? data.configSnapshotJson
        : JSON.stringify(data.configSnapshotJson);
    const metricsJson =
      typeof data.metricsJson === 'string'
        ? data.metricsJson
        : JSON.stringify(data.metricsJson);

    const stmt = this.db.prepare(`
      INSERT INTO evaluation_runs (
        id, dataset_version, config_snapshot_json, metrics_json, created_at
      )
      VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(id, data.datasetVersion, configSnapshotJson, metricsJson, createdAt);

    return {
      id,
      datasetVersion: data.datasetVersion,
      configSnapshotJson,
      metricsJson,
      createdAt,
    };
  }

  findById(id: string): EvaluationRunEntity | null {
    const stmt = this.db.prepare(`
      SELECT *
      FROM evaluation_runs
      WHERE id = ?
    `);

    const row = stmt.get(id) as RawEvaluationRunRow | undefined;
    return row ? mapRowToEntity(row) : null;
  }

  list(): EvaluationRunEntity[] {
    const stmt = this.db.prepare(`
      SELECT *
      FROM evaluation_runs
      ORDER BY created_at DESC
    `);

    const rows = stmt.all() as RawEvaluationRunRow[];
    return rows.map(mapRowToEntity);
  }

  delete(id: string): boolean {
    const stmt = this.db.prepare(`
      DELETE FROM evaluation_runs
      WHERE id = ?
    `);

    const result = stmt.run(id);
    return result.changes > 0;
  }
}
