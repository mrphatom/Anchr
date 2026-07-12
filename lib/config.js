import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const CONFIG_FILE = 'anchr.json';

export function writeConfig(cwd, config) {
  const path = join(cwd, CONFIG_FILE);
  writeFileSync(path, JSON.stringify(config, null, 2) + '\n');
  return path;
}

export function readConfig(cwd) {
  const path = join(cwd, CONFIG_FILE);
  if (!existsSync(path)) {
    throw new Error('No anchr.json found — run `anchr init` first.');
  }
  return JSON.parse(readFileSync(path, 'utf-8'));
}
