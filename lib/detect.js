import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Detects the static site framework used in a project directory.
 * MVP scope (locked): Next.js static export, Vite, Create React App only.
 * Anything else should fail loudly rather than guess.
 */
export function detectFramework(cwd) {
  const pkgPath = join(cwd, 'package.json');
  if (!existsSync(pkgPath)) {
    throw new Error('No package.json found — run `anchr init` from your project root.');
  }

  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };

  if (deps.vite) {
    return {
      framework: 'vite',
      buildCommand: 'npm run build',
      outputDir: 'dist'
    };
  }

  if (deps.next) {
    return {
      framework: 'next',
      buildCommand: 'npm run build',
      outputDir: 'out',
      note:
        "Next.js detected — this only works with static export. Make sure next.config.js " +
        "has `output: 'export'` set, or the build won't produce a static 'out' directory."
    };
  }

  if (deps['react-scripts']) {
    return {
      framework: 'cra',
      buildCommand: 'npm run build',
      outputDir: 'build'
    };
  }

  throw new Error(
    'Could not detect a supported framework. MVP scope only covers Vite, Next.js (static export), and Create React App.'
  );
}
