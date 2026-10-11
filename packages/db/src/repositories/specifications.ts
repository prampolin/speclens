import { randomUUID } from 'node:crypto';
import type { Database } from 'better-sqlite3';
import type { SpecificationEntity } from '../types.js';

interface RawSpecificationRow {
  id: string;
  workspace_id: string;
  title: string;
  version: string;
  dialect: string;
  source_checksum: string;
  source_content: string | null;
  is_active: number;
  imported_at: string;
  created_at: string;
  updated_at: string;
}

function mapRowToEntity(row: RawSpecificationRow): SpecificationEntity {
  let dialect: 'swagger_2' | 'openapi_3_0' | 'openapi_3_1' = 'openapi_3_0';
  if (row.dialect === 'swagger-2.0' || row.dialect === 'swagger_2') {
    dialect = 'swagger_2';
  } else if (row.dialect === 'openapi-3.1' || row.dialect === 'openapi_3_1') {
    dialect = 'openapi_3_1';
  }

  return {
    id: row.id,
    workspaceId: row.workspace_id,
    title: row.title,
    version: row.version,
    dialect,
    sourceChecksum: row.source_checksum,
    sourceContent: row.source_content ?? undefined,
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class SpecificationRepository {
  constructor(private readonly db: Database) {}

  create(data: {
    id?: string;
    workspaceId: string;
    title: string;
    version: string;
    dialect: string;
    sourceChecksum: string;
    sourceContent?: string;
    isActive?: boolean;
    importedAt?: string;
  }): SpecificationEntity {
    const id = data.id ?? randomUUID();
    const now = new Date().toISOString();
    const importedAt = data.importedAt ?? now;
    const createdAt = now;
    const updatedAt = now;
    const isActiveInt = data.isActive ? 1 : 0;

    const stmt = this.db.prepare(`
      INSERT INTO specifications (
        id, workspace_id, title, version, dialect,
        source_checksum, source_content, is_active,
        imported_at, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      data.workspaceId,
      data.title,
      data.version,
      data.dialect,
      data.sourceChecksum,
      data.sourceContent ?? null,
      isActiveInt,
      importedAt,
      createdAt,
      updatedAt
    );

    return mapRowToEntity({
      id,
      workspace_id: data.workspaceId,
      title: data.title,
      version: data.version,
      dialect: data.dialect,
      source_checksum: data.sourceChecksum,
      source_content: data.sourceContent ?? null,
      is_active: isActiveInt,
      imported_at: importedAt,
      created_at: createdAt,
      updated_at: updatedAt,
    });
  }

  findById(id: string): SpecificationEntity | null {
    const stmt = this.db.prepare(`
      SELECT *
      FROM specifications
      WHERE id = ?
    `);

    const row = stmt.get(id) as RawSpecificationRow | undefined;
    return row ? mapRowToEntity(row) : null;
  }

  listByWorkspace(workspaceId: string): SpecificationEntity[] {
    const stmt = this.db.prepare(`
      SELECT *
      FROM specifications
      WHERE workspace_id = ?
      ORDER BY imported_at DESC
    `);

    const rows = stmt.all(workspaceId) as RawSpecificationRow[];
    return rows.map(mapRowToEntity);
  }

  findByChecksum(workspaceId: string, checksum: string): SpecificationEntity | null {
    const stmt = this.db.prepare(`
      SELECT *
      FROM specifications
      WHERE workspace_id = ? AND source_checksum = ?
    `);

    const row = stmt.get(workspaceId, checksum) as RawSpecificationRow | undefined;
    return row ? mapRowToEntity(row) : null;
  }

  getActive(workspaceId: string): SpecificationEntity | null {
    const stmt = this.db.prepare(`
      SELECT *
      FROM specifications
      WHERE workspace_id = ? AND is_active = 1
      LIMIT 1
    `);

    const row = stmt.get(workspaceId) as RawSpecificationRow | undefined;
    return row ? mapRowToEntity(row) : null;
  }

  setActive(id: string, workspaceId: string): void {
    const updateAll = this.db.transaction(() => {
      // Deactivate all specifications in this workspace
      this.db
        .prepare(
          `
        UPDATE specifications
        SET is_active = 0, updated_at = ?
        WHERE workspace_id = ?
      `
        )
        .run(new Date().toISOString(), workspaceId);

      // Activate the targeted specification
      this.db
        .prepare(
          `
        UPDATE specifications
        SET is_active = 1, updated_at = ?
        WHERE id = ? AND workspace_id = ?
      `
        )
        .run(new Date().toISOString(), id, workspaceId);
    });

    updateAll();
  }

  delete(id: string): boolean {
    const stmt = this.db.prepare(`
      DELETE FROM specifications
      WHERE id = ?
    `);

    const result = stmt.run(id);
    return result.changes > 0;
  }
}
