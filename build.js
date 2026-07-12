import { execSync } from 'node:child_process';

export function runBuild(cwd, buildCommand) {
  console.log(`\n📦 Running build: ${buildCommand}\n`);
  execSync(buildCommand, { cwd, stdio: 'inherit' });
}
