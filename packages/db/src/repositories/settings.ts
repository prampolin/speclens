import type { Database } from 'better-sqlite3';
import {
  workspaceSettingsSchema,
  createDefaultWorkspaceSettings,
  type WorkspaceSettings,
} from '../settings-schema.js';

interface RawSettingsRow {
  workspace_id: string;
  schema_version: number;
  settings_json: string;
  changed_at: string;
  updated_at: string;
}

export class SettingsRepository {
  constructor(private readonly db: Database) {}

  /**
   * Retrieves and validates workspace settings from the database.
   * Throws if persisted JSON is corrupted/invalid.
   */
  get(workspaceId: string): WorkspaceSettings | null {
    const stmt = this.db.prepare(`
      SELECT workspace_id, schema_version, settings_json, changed_at, updated_at
      FROM workspace_settings
      WHERE workspace_id = ?
    `);

    const row = stmt.get(workspaceId) as RawSettingsRow | undefined;
    if (!row) {
      return null;
    }

    const rawJson = JSON.parse(row.settings_json);
    // Validate on load / startup
    return workspaceSettingsSchema.parse(rawJson);
  }

  /**
   * Returns saved settings or creates and saves default settings for the workspace.
   */
  getOrDefault(workspaceId: string): WorkspaceSettings {
    const existing = this.get(workspaceId);
    if (existing) {
      return existing;
    }

    const defaultSettings = createDefaultWorkspaceSettings(workspaceId);
    return this.save(workspaceId, defaultSettings);
  }

  /**
   * Validates settings via Zod and atomically persists them.
   */
  save(workspaceId: string, settings: unknown): WorkspaceSettings {
    // Validate on write
    const validated = workspaceSettingsSchema.parse(settings);

    // Ensure workspaceId consistency
    if (validated.workspaceId !== workspaceId) {
      throw new Error(
        `Workspace ID mismatch: path has ${workspaceId}, payload has ${validated.workspaceId}`
      );
    }

    const now = new Date().toISOString();
    const settingsJson = JSON.stringify(validated);

    const stmt = this.db.prepare(`
      INSERT INTO workspace_settings (workspace_id, schema_version, settings_json, changed_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(workspace_id) DO UPDATE SET
        schema_version = excluded.schema_version,
        settings_json = excluded.settings_json,
        changed_at = excluded.changed_at,
        updated_at = excluded.updated_at
    `);

    stmt.run(workspaceId, validated.schemaVersion, settingsJson, now, now);

    return validated;
  }

  delete(workspaceId: string): boolean {
    const stmt = this.db.prepare(`
      DELETE FROM workspace_settings
      WHERE workspace_id = ?
    `);

    const result = stmt.run(workspaceId);
    return result.changes > 0;
  }
}
