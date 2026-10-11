import { randomUUID } from 'node:crypto';
import type { Database } from 'better-sqlite3';
import type { VectorNamespaceEntity } from '../types.js';

interface RawVectorNamespaceRow {
  id: string;
  workspace_id: string;
  specification_id: string;
  provider_id: string;
  model_id: string;
  model_revision: string;
  dimensions: number;
  chunking_version: string;
  index_location: string;
  status: string;
  created_at: string;
}

function mapRowToEntity(row: RawVectorNamespaceRow): VectorNamespaceEntity {
  let status: 'pending' | 'ready' | 'stale' | 'failed' = 'pending';
  if (row.status === 'ready') status = 'ready';
  else if (row.status === 'failed') status = 'failed';
  else if (row.status === 'stale' || row.status === 'building') status = 'stale';

  return {
    id: row.id,
    workspaceId: row.workspace_id,
    specificationId: row.specification_id,
    providerId: row.provider_id,
    modelId: row.model_id,
    revision: row.model_revision,
    dimensions: row.dimensions,
    chunkingVersion: row.chunking_version,
    status,
    createdAt: row.created_at,
  };
}

export class VectorNamespaceRepository {
  constructor(private readonly db: Database) {}

  create(data: {
    id?: string;
    workspaceId: string;
    specificationId: string;
    providerId: string;
    modelId: string;
    revision: string;
    dimensions: number;
    chunkingVersion: string;
    indexLocation?: string;
    status?: 'pending' | 'ready' | 'stale' | 'failed' | string;
    createdAt?: string;
  }): VectorNamespaceEntity {
    const id = data.id ?? randomUUID();
    const createdAt = data.createdAt ?? new Date().toISOString();
    const indexLocation = data.indexLocation ?? `vectors/${id}.bin`;
    const status = data.status ?? 'pending';

    const stmt = this.db.prepare(`
      INSERT INTO vector_namespaces (
        id, workspace_id, specification_id, provider_id,
        model_id, model_revision, dimensions, chunking_version,
        index_location, status, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      data.workspaceId,
      data.specificationId,
      data.providerId,
      data.modelId,
      data.revision,
      data.dimensions,
      data.chunkingVersion,
      indexLocation,
      status,
      createdAt
    );

    return mapRowToEntity({
      id,
      workspace_id: data.workspaceId,
      specification_id: data.specificationId,
      provider_id: data.providerId,
      model_id: data.modelId,
      model_revision: data.revision,
      dimensions: data.dimensions,
      chunking_version: data.chunkingVersion,
      index_location: indexLocation,
      status,
      created_at: createdAt,
    });
  }

  findById(id: string): VectorNamespaceEntity | null {
    const stmt = this.db.prepare(`
      SELECT *
      FROM vector_namespaces
      WHERE id = ?
    `);

    const row = stmt.get(id) as RawVectorNamespaceRow | undefined;
    return row ? mapRowToEntity(row) : null;
  }

  listByWorkspace(workspaceId: string): VectorNamespaceEntity[] {
    const stmt = this.db.prepare(`
      SELECT *
      FROM vector_namespaces
      WHERE workspace_id = ?
      ORDER BY created_at DESC
    `);

    const rows = stmt.all(workspaceId) as RawVectorNamespaceRow[];
    return rows.map(mapRowToEntity);
  }

  findBySpecAndModel(
    workspaceId: string,
    specificationId: string,
    providerId: string,
    modelId: string,
    revision: string
  ): VectorNamespaceEntity | null {
    const stmt = this.db.prepare(`
      SELECT *
      FROM vector_namespaces
      WHERE workspace_id = ?
        AND specification_id = ?
        AND provider_id = ?
        AND model_id = ?
        AND model_revision = ?
      LIMIT 1
    `);

    const row = stmt.get(
      workspaceId,
      specificationId,
      providerId,
      modelId,
      revision
    ) as RawVectorNamespaceRow | undefined;

    return row ? mapRowToEntity(row) : null;
  }

  updateStatus(id: string, status: string): boolean {
    const stmt = this.db.prepare(`
      UPDATE vector_namespaces
      SET status = ?
      WHERE id = ?
    `);

    const result = stmt.run(status, id);
    return result.changes > 0;
  }

  delete(id: string): boolean {
    const stmt = this.db.prepare(`
      DELETE FROM vector_namespaces
      WHERE id = ?
    `);

    const result = stmt.run(id);
    return result.changes > 0;
  }
}
