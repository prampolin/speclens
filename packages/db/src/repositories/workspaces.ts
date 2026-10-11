import { randomUUID } from 'node:crypto';
import type { Database } from 'better-sqlite3';
import type { WorkspaceEntity } from '../types.js';

export class WorkspaceRepository {
  constructor(private readonly db: Database) {}

  create(data: { id?: string; title: string; createdAt?: string; updatedAt?: string }): WorkspaceEntity {
    const id = data.id ?? randomUUID();
    const now = new Date().toISOString();
    const createdAt = data.createdAt ?? now;
    const updatedAt = data.updatedAt ?? now;

    const stmt = this.db.prepare(`
      INSERT INTO workspaces (id, title, created_at, updated_at)
      VALUES (?, ?, ?, ?)
    `);

    stmt.run(id, data.title, createdAt, updatedAt);

    return {
      id,
      title: data.title,
      createdAt,
      updatedAt,
    };
  }

  findById(id: string): WorkspaceEntity | null {
    const stmt = this.db.prepare(`
      SELECT id, title, created_at as createdAt, updated_at as updatedAt
      FROM workspaces
      WHERE id = ?
    `);

    const row = stmt.get(id) as WorkspaceEntity | undefined;
    return row ?? null;
  }

  list(): WorkspaceEntity[] {
    const stmt = this.db.prepare(`
      SELECT id, title, created_at as createdAt, updated_at as updatedAt
      FROM workspaces
      ORDER BY created_at DESC
    `);

    return stmt.all() as WorkspaceEntity[];
  }

  update(id: string, data: { title: string }): WorkspaceEntity | null {
    const updatedAt = new Date().toISOString();
    const stmt = this.db.prepare(`
      UPDATE workspaces
      SET title = ?, updated_at = ?
      WHERE id = ?
    `);

    const result = stmt.run(data.title, updatedAt, id);
    if (result.changes === 0) {
      return null;
    }

    return this.findById(id);
  }

  delete(id: string): boolean {
    const stmt = this.db.prepare(`
      DELETE FROM workspaces
      WHERE id = ?
    `);

    const result = stmt.run(id);
    return result.changes > 0;
  }
}
