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
    // Optional — add the .sol domain you own (no ".sol" suffix) once you
    // have one, e.g. "myproject". Leave blank to just build + pin to IPFS
    // without a domain write; add this later and re-deploy to go live at
    // yourdomain.sol.
    domain: '',
    // Pinning provider: "storacha" (default) or "filebase" as a fallback —
    // see README.md's "Alternate pinning provider" section
    provider: 'storacha'
  };

  const path = writeConfig(cwd, config);

  console.log(`✅ Detected: ${detected.framework}`);
  if (detected.note) console.log(`⚠️  ${detected.note}`);
  console.log(`✅ Wrote config to ${path}`);
  console.log(
    '\nNext: run `anchr deploy` to build + pin to IPFS. Add a "domain" in ' +
    'anchr.json once you own a .sol domain to also resolve it there.'
  );
}
