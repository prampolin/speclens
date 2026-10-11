import { randomUUID } from 'node:crypto';
import type { Database } from 'better-sqlite3';
import type { OperationEntity } from '../types.js';

export interface OperationSearchResult {
  operation: OperationEntity;
  indexText: string;
  rank: number;
}

interface RawOperationRow {
  id: string;
  specification_id: string;
  method: string;
  path: string;
  operation_id: string | null;
  tags: string;
  normalized_json: string;
  source_pointer: string;
  index_text: string;
  created_at: string;
  rank?: number;
}

function mapRowToEntity(row: RawOperationRow): OperationEntity {
  let tags: string[] = [];
  try {
    tags = JSON.parse(row.tags);
  } catch {
    tags = [];
  }

  return {
    id: row.id,
    specificationId: row.specification_id,
    method: row.method,
    path: row.path,
    operationId: row.operation_id ?? undefined,
    tags,
    normalizedJson: row.normalized_json,
    sourcePointer: row.source_pointer,
    createdAt: row.created_at,
  };
}

const STOP_WORDS = new Set([
  'como', 'eu', 'faco', 'faço', 'para', 'de', 'do', 'da', 'dos', 'das',
  'o', 'a', 'os', 'as', 'por', 'em', 'no', 'na', 'nos', 'nas',
  'um', 'uma', 'uns', 'umas', 'que', 'qual', 'quais', 'se',
  'how', 'do', 'i', 'for', 'the', 'a', 'an', 'in', 'on', 'at', 'to', 'can', 'what', 'which',
]);

/**
 * Sanitizes input text into a safe FTS5 query.
 * Filters common natural language stop words and creates prefix matching tokens.
 */
export function sanitizeFtsQuery(query: string): string {
  // Extract alphanumeric sequences and tokens
  const rawTokens = query
    .replace(/[^\p{L}\p{N}_]+/gu, ' ')
    .trim()
    .split(/\s+/)
    .filter((t) => t.length > 0);

  if (rawTokens.length === 0) {
    return '';
  }

  // Filter conversational stop words
  const contentTokens = rawTokens.filter(
    (t) => !STOP_WORDS.has(t.toLowerCase()) && t.length > 1
  );

  const tokens = contentTokens.length > 0 ? contentTokens : rawTokens;

  // Format tokens with prefix wildcard: "token"*
  // If multiple terms, combine with OR to allow rank-ordered BM25 matching across descriptions & paths
  return tokens.map((token) => `"${token}"*`).join(' OR ');
}

export class OperationRepository {
  constructor(private readonly db: Database) {}

  create(data: {
    id?: string;
    specificationId: string;
    method: string;
    path: string;
    operationId?: string;
    tags?: string[];
    normalizedJson: string | object;
    sourcePointer: string;
    indexText: string;
    createdAt?: string;
  }): OperationEntity {
    const id = data.id ?? randomUUID();
    const createdAt = data.createdAt ?? new Date().toISOString();
    const tagsJson = JSON.stringify(data.tags ?? []);
    const normalizedJsonStr =
      typeof data.normalizedJson === 'string'
        ? data.normalizedJson
        : JSON.stringify(data.normalizedJson);

    const stmt = this.db.prepare(`
      INSERT INTO operations (
        id, specification_id, method, path, operation_id,
        tags, normalized_json, source_pointer, index_text, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      data.specificationId,
      data.method.toUpperCase(),
      data.path,
      data.operationId ?? null,
      tagsJson,
      normalizedJsonStr,
      data.sourcePointer,
      data.indexText,
      createdAt
    );

    return {
      id,
      specificationId: data.specificationId,
      method: data.method.toUpperCase(),
      path: data.path,
      operationId: data.operationId,
      tags: data.tags ?? [],
      normalizedJson: normalizedJsonStr,
      sourcePointer: data.sourcePointer,
      createdAt,
    };
  }

  createBatch(
    ops: Array<{
      id?: string;
      specificationId: string;
      method: string;
      path: string;
      operationId?: string;
      tags?: string[];
      normalizedJson: string | object;
      sourcePointer: string;
      indexText: string;
      createdAt?: string;
    }>
  ): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO operations (
        id, specification_id, method, path, operation_id,
        tags, normalized_json, source_pointer, index_text, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = this.db.transaction(() => {
      const defaultCreatedAt = new Date().toISOString();
      for (const data of ops) {
        const id = data.id ?? randomUUID();
        const createdAt = data.createdAt ?? defaultCreatedAt;
        const tagsJson = JSON.stringify(data.tags ?? []);
        const normalizedJsonStr =
          typeof data.normalizedJson === 'string'
            ? data.normalizedJson
            : JSON.stringify(data.normalizedJson);

        stmt.run(
          id,
          data.specificationId,
          data.method.toUpperCase(),
          data.path,
          data.operationId ?? null,
          tagsJson,
          normalizedJsonStr,
          data.sourcePointer,
          data.indexText,
          createdAt
        );
      }
    });

    insertMany();
  }

  findById(id: string): OperationEntity | null {
    const stmt = this.db.prepare(`
      SELECT *
      FROM operations
      WHERE id = ?
    `);

    const row = stmt.get(id) as RawOperationRow | undefined;
    return row ? mapRowToEntity(row) : null;
  }

  listBySpec(specificationId: string): OperationEntity[] {
    const stmt = this.db.prepare(`
      SELECT *
      FROM operations
      WHERE specification_id = ?
      ORDER BY path ASC, method ASC
    `);

    const rows = stmt.all(specificationId) as RawOperationRow[];
    return rows.map(mapRowToEntity);
  }

  fullTextSearch(
    query: string,
    options: {
      specificationId?: string;
      workspaceId?: string;
      limit?: number;
    } = {}
  ): OperationSearchResult[] {
    const { specificationId, workspaceId, limit = 20 } = options;
    const sanitized = sanitizeFtsQuery(query);

    if (!sanitized) {
      return [];
    }

    let sql = `
      SELECT
        o.id,
        o.specification_id,
        o.method,
        o.path,
        o.operation_id,
        o.tags,
        o.normalized_json,
        o.source_pointer,
        o.index_text,
        o.created_at,
        bm25(operation_fts) as rank
      FROM operation_fts
      JOIN operations o ON o.rowid = operation_fts.rowid
    `;

    const conditions: string[] = ['operation_fts MATCH ?'];
    const params: unknown[] = [sanitized];

    if (workspaceId) {
      sql += ' JOIN specifications s ON s.id = o.specification_id';
      conditions.push('s.workspace_id = ?');
      params.push(workspaceId);
    } else if (specificationId) {
      conditions.push('o.specification_id = ?');
      params.push(specificationId);
    }

    sql += ` WHERE ${conditions.join(' AND ')} ORDER BY rank ASC LIMIT ?`;
    params.push(limit);

    try {
      const stmt = this.db.prepare(sql);
      const rows = stmt.all(...params) as RawOperationRow[];

      return rows.map((row) => ({
        operation: mapRowToEntity(row),
        indexText: row.index_text,
        rank: row.rank ?? 0,
      }));
    } catch {
      // If FTS fails for unusual query syntax, fail safely by returning empty
      return [];
    }
  }

  delete(id: string): boolean {
    const stmt = this.db.prepare(`
      DELETE FROM operations
      WHERE id = ?
    `);

    const result = stmt.run(id);
    return result.changes > 0;
  }
}
