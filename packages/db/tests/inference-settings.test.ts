import { it, expect } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createDatabase, WorkspaceRepository, SettingsRepository, createDefaultWorkspaceSettings, workspaceSettingsSchema, migrateLegacyWorkspaceSettings } from '../src/index.js';

it('keeps legacy settings compatible and preserves explicit switches during migration', () => {
  const { inference: _inference, ...legacy } = createDefaultWorkspaceSettings('default');
  const parsed = workspaceSettingsSchema.parse(legacy);
  expect(parsed.inference?.layaEnabled ?? true).toBe(true);
  expect(parsed.inference?.llmEnabled ?? true).toBe(true);
  const inference = { layaEnabled: true, llmEnabled: false };
  expect(migrateLegacyWorkspaceSettings({ ...legacy, inference }).settings.inference).toEqual(inference);
  expect(workspaceSettingsSchema.safeParse({ ...legacy, inference: { layaEnabled: 'false', llmEnabled: true } }).success).toBe(false);
});

it('persists inference selection across a database reopen', () => {
  const dir = mkdtempSync(join(tmpdir(), 'speclens-inference-'));
  const path = join(dir, 'settings.sqlite');
  const first = createDatabase(path);
  const inference = { layaEnabled: false, llmEnabled: true };
  try {
    new WorkspaceRepository(first).create({ id: 'default', title: 'Test workspace' });
    new SettingsRepository(first).save('default', { ...createDefaultWorkspaceSettings('default'), inference });
  } finally {
    first.close();
  }
  const reopened = createDatabase(path);
  try {
    expect(new SettingsRepository(reopened).get('default')?.inference).toEqual(inference);
    expect(new SettingsRepository(reopened).get('default')?.privateMode).toBe(true);
  } finally {
    reopened.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
