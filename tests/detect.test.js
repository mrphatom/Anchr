import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { detectFramework } from '../lib/detect.js';

function makeProject(deps) {
  const dir = mkdtempSync(join(tmpdir(), 'anchr-test-'));
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ dependencies: deps }, null, 2));
  return dir;
}

test('detects vite projects', () => {
  const dir = makeProject({ vite: '^5.0.0' });
  const result = detectFramework(dir);
  assert.equal(result.framework, 'vite');
  assert.equal(result.outputDir, 'dist');
  rmSync(dir, { recursive: true, force: true });
});

test('detects next.js projects and flags static export requirement', () => {
  const dir = makeProject({ next: '^14.0.0' });
  const result = detectFramework(dir);
  assert.equal(result.framework, 'next');
  assert.equal(result.outputDir, 'out');
  assert.ok(result.note, 'expected a note about output: "export"');
  rmSync(dir, { recursive: true, force: true });
});

test('detects create-react-app projects', () => {
  const dir = makeProject({ 'react-scripts': '^5.0.0' });
  const result = detectFramework(dir);
  assert.equal(result.framework, 'cra');
  assert.equal(result.outputDir, 'build');
  rmSync(dir, { recursive: true, force: true });
});

test('throws on unsupported framework', () => {
  const dir = makeProject({ 'some-other-framework': '^1.0.0' });
  assert.throws(() => detectFramework(dir), /Could not detect a supported framework/);
  rmSync(dir, { recursive: true, force: true });
});

test('throws when no package.json exists', () => {
  const dir = mkdtempSync(join(tmpdir(), 'anchr-empty-'));
  assert.throws(() => detectFramework(dir), /No package\.json found/);
  rmSync(dir, { recursive: true, force: true });
});
