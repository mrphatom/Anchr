import { detectFramework } from './detect.js';
import { writeConfig } from './config.js';

export async function runInit() {
  const cwd = process.cwd();

  console.log('🔍 Detecting your project...');
  const detected = detectFramework(cwd);

  const config = {
    framework: detected.framework,
    buildCommand: detected.buildCommand,
    outputDir: detected.outputDir,
    // Fill this in with the .sol domain you already own (no ".sol" suffix), e.g. "myproject"
    domain: ''
  };

  const path = writeConfig(cwd, config);

  console.log(`✅ Detected: ${detected.framework}`);
  if (detected.note) console.log(`⚠️  ${detected.note}`);
  console.log(`✅ Wrote config to ${path}`);
  console.log(
    '\nNext: edit anchr.json and set "domain" to the .sol domain you already own, then run `anchr deploy`.'
  );
}
