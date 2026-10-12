import { afterEach, describe, expect, it } from 'vitest';
import { chmodSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const dirs: string[] = [];
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });

function run(failure = '') {
  const dir = mkdtempSync(join(tmpdir(), 'oll06-harness-'));
  dirs.push(dir);
  mkdirSync(join(dir, 'source'));
  mkdirSync(join(dir, 'bin'));
  writeFileSync(join(dir, 'source', 'sentinel'), 'preserve');
  const docker = join(dir, 'bin', 'docker');
  writeFileSync(docker, `#!/bin/bash
printf '%s|%s|%s|%s|%s\\n' "$*" "$SPECLENS_WEB_IMAGE" "$SPECLENS_WEB_PORT" "$SPECLENS_DATA_PATH" "$SPECLENS_OLLAMA_MODELS_PATH" >> "$CALLS"
case "$*" in
  'image inspect '* ) [ "$FAILURE" != image ]; exit $? ;;
  *'up --detach'* ) [ "$FAILURE" != up ]; exit $? ;;
  *'ps --quiet web' ) echo test-web ;;
  *'network=private'* ) echo test-network ;;
  'network inspect '* ) echo true ;;
  *'down --volumes'* ) [ "$FAILURE" != down ]; exit $? ;;
  exec* ) [ "$FAILURE" != exec ]; exit $? ;;
esac
`);
  chmodSync(docker, 0o755);
  const result = spawnSync('/bin/bash', [resolve('scripts/test-ollama-docker.sh')], {
    env: { ...process.env, PATH: `${join(dir, 'bin')}:/usr/bin:/bin`, TMPDIR: dir, CALLS: join(dir, 'calls'), FAILURE: failure,
      OLLAMA_SOURCE_DIR: join(dir, 'source'), SPECLENS_WEB_IMAGE: 'local-web:test', OLLAMA_IMAGE: 'local-ollama:test' },
    encoding: 'utf8', timeout: 10000,
  });
  return { result, calls: readFileSync(join(dir, 'calls'), 'utf8'), dir };
}

describe('OLL-06 smoke orchestration (fake Docker; does not prove runtime isolation)', () => {
  it('isolates project/mounts/port, forbids pulls/builds and verifies teardown', () => {
    const { result, calls, dir } = run();
    expect(result.status).toBe(0);
    expect(calls).toContain('up --detach --pull never --no-build');
    expect(calls).toContain('|local-web:test|0|');
    const projects = [...calls.matchAll(/--project-name (\S+)/g)].map((m) => m[1]);
    expect(new Set(projects).size).toBe(1);
    expect(projects[0]).toMatch(/^speclens-oll06-\d+-\d+$/);
    expect(calls).toContain('down --volumes --remove-orphans');
    expect(calls).toContain('ps --all --quiet --filter label=com.docker.compose.project=');
    expect(readFileSync(join(dir, 'source', 'sentinel'), 'utf8')).toBe('preserve');
  });
  it.each(['up', 'exec'])('tears down only its project after %s fails', (failure) => {
    const { result, calls } = run(failure);
    expect(result.status).toBe(1);
    expect(calls).toContain('down --volumes --remove-orphans');
    expect(result.stdout).not.toContain('smoke: PASS');
  });
  it('does not touch Compose resources when an image is absent', () => {
    const { result, calls } = run('image');
    expect(result.status).toBe(1);
    expect(calls).not.toContain('compose');
    expect(result.stderr).toContain('não está local');
  });
  it('reports teardown failure instead of false success or deleting live mounts', () => {
    const { result, calls } = run('down');
    expect(result.status).toBe(1);
    expect(result.stdout).not.toContain('smoke: PASS');
    expect(result.stderr).toContain('mounts preservados');
    const modelPath = calls.split('\n')[0].split('|')[4];
    expect(readFileSync(join(modelPath, 'sentinel'), 'utf8')).toBe('preserve');
  });
});
