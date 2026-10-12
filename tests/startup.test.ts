import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, chmodSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const repoRoot = path.resolve(import.meta.dirname, '..');
const tempDirs: string[] = [];

function makeHarness(options: {
  active?: boolean;
  models?: string[];
  includeOllama?: boolean;
  terminateOnDev?: boolean;
} = {}) {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'speclens-startup-'));
  tempDirs.push(dir);
  const bin = path.join(dir, 'bin');
  mkdirSync(bin);
  mkdirSync(path.join(dir, 'node_modules'));
  const state = path.join(dir, 'service-active');
  const calls = path.join(dir, 'calls.log');
  if (options.active) writeFileSync(state, 'preexisting');

  const addCommand = (name: string, contents: string) => {
    const file = path.join(bin, name);
    writeFileSync(file, `#!/bin/sh\n${contents}\n`);
    chmodSync(file, 0o755);
  };

  addCommand('curl', `printf '%s\\n' "$*" >> "$FAKE_CALLS"
if [ ! -f "$FAKE_STATE" ]; then exit 7; fi
if [ "$FAKE_NEVER_READY" = 1 ]; then exit 7; fi
printf '%s' "$FAKE_MODELS"`);
  if (options.includeOllama !== false) {
    addCommand('ollama', `printf '%s\\n' "$*" >> "$FAKE_CALLS"
if [ "$1" = serve ]; then
  echo owned > "$FAKE_STATE"
  trap 'rm -f "$FAKE_STATE"; exit 0' TERM INT
  while :; do /bin/sleep 0.1; done
fi
exit 0`);
  }
  addCommand('pnpm', `printf '%s\\n' "$*" >> "$FAKE_CALLS"
if [ "$1" = dev ] && [ "$FAKE_TERMINATE" = 1 ]; then kill -TERM "$PPID"; fi
exit 0`);

  const modelNames = options.models ?? ['llama3.2:3b'];
  const models = JSON.stringify({ models: modelNames.map((name) => ({ name })) });
  return {
    dir,
    state,
    calls,
    env: {
      ...process.env,
      PATH: `${bin}:/usr/bin:/bin:${path.dirname(process.execPath)}`,
      FAKE_STATE: state,
      FAKE_CALLS: calls,
      FAKE_MODELS: models,
      FAKE_NEVER_READY: '0',
      FAKE_TERMINATE: options.terminateOnDev ? '1' : '0',
      OLLAMA_BASE_URL: 'http://127.0.0.1:11434',
      OLLAMA_MODEL_ID: 'llama3.2:3b',
      SPECLENS_OLLAMA_STARTUP_ATTEMPTS: '3',
    },
  };
}

function run(harness: ReturnType<typeof makeHarness>, env: Record<string, string> = {}) {
  return spawnSync('/bin/bash', [path.join(repoRoot, 'start.sh')], {
    cwd: harness.dir,
    env: { ...harness.env, ...env },
    encoding: 'utf8',
    timeout: 5000,
  });
}

function callsOf(harness: ReturnType<typeof makeHarness>) {
  try {
    return readFileSync(harness.calls, 'utf8');
  } catch {
    return '';
  }
}

describe('start.sh', () => {
  beforeEach(() => {
    tempDirs.length = 0;
  });
  afterEach(() => {
    for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
  });

  it('preserves an already active service and starts with the exact bootstrap model', () => {
    const harness = makeHarness({ active: true, models: ['llama3.2:3b'] });
    const result = run(harness);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("modelo bootstrap 'llama3.2:3b'");
    expect(callsOf(harness)).not.toContain('serve');
    expect(callsOf(harness)).toMatch(/^dev$/m);
    expect(readFileSync(harness.state, 'utf8')).toBe('preexisting');
  });

  it('starts the local service once and waits for readiness when the CLI is available', () => {
    const harness = makeHarness({ includeOllama: true });
    const result = run(harness);
    expect(result.status).toBe(0);
    expect(callsOf(harness).match(/^serve$/gm)).toHaveLength(1);
    expect(result.stdout).toContain("modelo bootstrap 'llama3.2:3b'");
    expect(callsOf(harness)).toMatch(/^dev$/m);
  });

  it('bounds readiness waiting and continues in degraded mode when startup fails', () => {
    const harness = makeHarness({ includeOllama: true });
    const result = run(harness, {
      FAKE_NEVER_READY: '1',
      SPECLENS_OLLAMA_STARTUP_ATTEMPTS: '1',
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('não ficou pronto após 1s');
    expect(callsOf(harness)).toContain('serve');
    expect(callsOf(harness)).toMatch(/^dev$/m);
  });

  it('starts in degraded mode without Ollama or a model and never pulls', () => {
    const noCli = makeHarness({ includeOllama: false });
    const absent = run(noCli);
    expect(absent.status).toBe(0);
    expect(absent.stdout).toContain("CLI 'ollama' não está no PATH");
    expect(callsOf(noCli)).toMatch(/^dev$/m);
    expect(callsOf(noCli)).not.toMatch(/pull|registry/i);

    const noModel = makeHarness({ active: true, models: [] });
    const missing = run(noModel);
    expect(missing.status).toBe(0);
    expect(missing.stdout).toContain("modelo bootstrap 'llama3.2:3b' não está instalado");
    expect(callsOf(noModel)).not.toMatch(/pull|registry/i);
    expect(callsOf(noModel)).toMatch(/^dev$/m);
  });

  it('does not treat another tag from the same model family as installed', () => {
    const harness = makeHarness({ active: true, models: ['llama3.2:latest'] });
    const result = run(harness);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("modelo bootstrap 'llama3.2:3b' não está instalado");
  });

  it('kills only the service process started by this script on shutdown', () => {
    const owned = makeHarness({ includeOllama: true, terminateOnDev: true });
    const ownResult = run(owned);
    expect(ownResult.status).not.toBe(0);
    expect(callsOf(owned)).toContain('serve');
    expect(() => readFileSync(owned.state)).toThrow();

    const preexisting = makeHarness({ active: true, terminateOnDev: true });
    run(preexisting);
    expect(readFileSync(preexisting.state, 'utf8')).toBe('preexisting');
  });

  it('uses the effective bootstrap URL and rejects non-allowlisted destinations', () => {
    const local = makeHarness({ active: true });
    const accepted = run(local, { OLLAMA_BASE_URL: 'http://localhost:11434' });
    expect(accepted.status).toBe(0);
    expect(callsOf(local)).toContain('http://localhost:11434/api/tags');

    const remote = makeHarness({ active: true });
    const rejected = run(remote, { OLLAMA_BASE_URL: 'http://example.com:11434' });
    expect(rejected.status).toBe(1);
    expect(callsOf(remote)).toBe('');
  });
});
