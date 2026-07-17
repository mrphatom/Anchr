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
      outputDir: 'dist',
      note:
        "IPFS content is served from a /ipfs/<CID>/ subpath, not domain root — Vite's " +
        "default absolute asset paths will cause a blank page until you set " +
        "`base: './'` in vite.config.js. CONFIRMED via a real deploy: this exact fix " +
        "was needed to go from a blank page to a fully working site."
    };
  }

  if (deps.next) {
    return {
      framework: 'next',
      buildCommand: 'npm run build',
      outputDir: 'out',
      note:
        "Next.js detected — this only works with static export. Make sure next.config.js " +
        "has `output: 'export'` set, or the build won't produce a static 'out' directory. " +
        "Likely also needs a relative asset path fix (e.g. `assetPrefix: './'`) for the " +
        "same reason Vite does — NOT independently confirmed via a real deploy yet, " +
        "verify before assuming it works out of the box."
    };
  }

  if (deps['react-scripts']) {
    return {
      framework: 'cra',
      buildCommand: 'npm run build',
      outputDir: 'build',
      note:
        "Add `\"homepage\": \".\"` to package.json so CRA builds with relative asset " +
        "paths — needed for IPFS hosting the same way Vite needs `base: './'` " +
        "(confirmed via a real deploy on Vite; CRA's fix is the standard documented " +
        "approach for deploying to a non-root subpath, but not independently tested here)."
    };
  }

  throw new Error(
    'Could not detect a supported framework. MVP scope only covers Vite, Next.js (static export), and Create React App.'
  );
}
