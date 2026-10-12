import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDatabase, SettingsRepository, WorkspaceRepository } from '@speclens/db';
import { POST as chatPost } from '@/app/api/chat/route';
import { PATCH as settingsPatch } from '@/app/api/settings/route';
import { GET as providersGet } from '@/app/api/providers/route';
import { getSettingsRepo, setTestDatabase } from '@/lib/server/db';
import { createWorkspaceLLMProvider, resolveWorkspaceSettings } from '@/lib/server/providers';
import { NextRequest } from 'next/server';
import { OllamaLLMProvider } from '@speclens/ai-core';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('OLL-02 — effective workspace LLM configuration', () => {
  const originalModel = process.env.OLLAMA_MODEL_ID;

  afterEach(() => {
    if (originalModel === undefined) delete process.env.OLLAMA_MODEL_ID;
    else process.env.OLLAMA_MODEL_ID = originalModel;
    setTestDatabase(null);
    vi.restoreAllMocks();
  });

  it('applies selection > environment > product default and persists the initial environment default', () => {
    const db = createDatabase(':memory:');
    setTestDatabase(db);
    new SettingsRepository(db).delete('default');
    expect(new WorkspaceRepository(db).findById('default')).not.toBeNull();
    process.env.OLLAMA_MODEL_ID = 'qwen3:8b';

    expect(resolveWorkspaceSettings('default').llm.modelId).toBe('qwen3:8b');
    process.env.OLLAMA_MODEL_ID = 'other:tag';
    expect(resolveWorkspaceSettings('default').llm.modelId).toBe('qwen3:8b');
    new SettingsRepository(db).save('default', {
      ...resolveWorkspaceSettings('default'), llm: { providerId: 'ollama-local', modelId: 'llama3.2:3b' },
    });
    expect(resolveWorkspaceSettings('default').llm.modelId).toBe('llama3.2:3b');

    delete process.env.OLLAMA_MODEL_ID;
    new WorkspaceRepository(db).create({ id: 'fresh-workspace', title: 'Fresh' });
    expect(resolveWorkspaceSettings('fresh-workspace').llm.modelId).toBe('llama3.2:3b');
    db.close();
  });

  it('reopens file-backed settings and resolves distinct workspace snapshots concurrently', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'speclens-oll02-'));
    const path = join(dir, 'settings.db');
    const first = createDatabase(path);
    const workspaces = new WorkspaceRepository(first);
    const alpha = workspaces.create({ id: 'alpha', title: 'Alpha' });
    const beta = workspaces.create({ id: 'beta', title: 'Beta' });
    const repo = new SettingsRepository(first);
    repo.save(alpha.id, { ...repo.getOrDefault(alpha.id), llm: { providerId: 'ollama-local', modelId: 'qwen3:8b' } });
    repo.save(beta.id, { ...repo.getOrDefault(beta.id), llm: { providerId: 'ollama-local', modelId: 'llama3.2:3b' } });
    first.close();

    const reopened = createDatabase(path);
    setTestDatabase(reopened);
    const models = await Promise.all([alpha.id, beta.id].map(async (id) => {
      await Promise.resolve();
      return createWorkspaceLLMProvider(resolveWorkspaceSettings(id)).manifest.modelId;
    }));
    expect(models).toEqual(['qwen3:8b', 'llama3.2:3b']);
    reopened.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it('uses the effective workspace model for providers readiness and rejects unsafe configuration before generation', async () => {
    const db = createDatabase(':memory:');
    setTestDatabase(db);
    new SettingsRepository(db).delete('default');
    process.env.OLLAMA_MODEL_ID = 'qwen3:8b';
    expect(new WorkspaceRepository(db).findById('default')).not.toBeNull();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ models: [{ name: 'qwen3:8b' }] }));
    const status = await providersGet(new NextRequest('http://localhost/api/providers?workspaceId=default'));
    const statusJson = await status.json();
    expect(statusJson.providers.find((p: { kind: string }) => p.kind === 'llm').modelId).toBe('qwen3:8b');

    const patch = new NextRequest('http://localhost/api/settings', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ workspaceId: 'default', settings: { llm: { providerId: 'remote', modelId: 'cloud/model' } } }),
    });
    expect((await settingsPatch(patch)).status).toBe(400);
    expect(() => createWorkspaceLLMProvider({ ...resolveWorkspaceSettings('default'), llm: { providerId: 'remote', modelId: 'x' } })).toThrow();

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('must not call fetch'));
    const unsafeDbSettings = { ...resolveWorkspaceSettings('default'), privateMode: true, llm: { providerId: 'ollama-local', modelId: 'cloud/qwen' } };
    new SettingsRepository(db).save('default', unsafeDbSettings);
    const request = new NextRequest('http://localhost/api/chat', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ workspaceId: 'default', query: 'find endpoint' }),
    });
    const response = await chatPost(request);
    expect(response.status).toBe(200);
    expect((await response.text())).toContain('PRIVACY_POLICY_VIOLATION');
    expect(fetchMock).not.toHaveBeenCalled();
    db.close();
  });

  it('applies a saved model to the next chat request without restarting the server', async () => {
    const db = createDatabase(':memory:');
    setTestDatabase(db);
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      if (String(url).endsWith('/api/tags')) return Response.json({ models: [{ name: 'qwen3:8b' }] });
      return new Response('{"message":{"role":"assistant","content":"Resposta fictícia"},"done":true}\n');
    });
    const saved = new SettingsRepository(db).getOrDefault('default');
    const patched = await settingsPatch(new NextRequest('http://localhost/api/settings', {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ workspaceId: 'default', settings: { llm: { providerId: 'ollama-local', modelId: 'qwen3:8b' } } }),
    }));
    expect(patched.status).toBe(200);
    const provider = createWorkspaceLLMProvider(resolveWorkspaceSettings('default')) as OllamaLLMProvider;
    const result = provider.streamExplanation({ query: 'question', groundedOperations: [], locale: 'pt-BR' });
    const events = [];
    for await (const event of result) events.push(event);
    expect(events.at(-1)?.type).toBe('final');
    const post = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/api/chat'));
    expect(JSON.parse(String(post?.[1]?.body)).model).toBe('qwen3:8b');
    expect(provider.manifest.modelId).toBe('qwen3:8b');
    expect(saved.llm.modelId).toBe('llama3.2:3b');
    db.close();
  });
});
