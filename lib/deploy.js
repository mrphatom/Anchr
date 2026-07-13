import { readConfig } from './config.js';
import { runBuild } from './build.js';
import { uploadToStoracha } from './storacha.js';
import { uploadToFilebase } from './filebase.js';
import { writeIpfsRecord } from './sns.js';

// Supported pinning providers. Storacha is the MVP default; Filebase is an
// alternate for when Storacha's upload endpoint is unavailable (see
// lib/filebase.js). This is a simple switch, not a multi-provider
// abstraction — that's explicitly deferred scope (docs/ROADMAP.md).
const PROVIDERS = {
  storacha: uploadToStoracha,
  filebase: uploadToFilebase
};

export async function runDeploy() {
  const cwd = process.cwd();
  const config = readConfig(cwd);

  if (!config.domain) {
    throw new Error('No domain set in anchr.json — add your .sol domain (without ".sol") before deploying.');
  }

  const providerName = config.provider || 'storacha';
  const upload = PROVIDERS[providerName];
  if (!upload) {
    throw new Error(
      `Unknown provider "${providerName}" in anchr.json. Supported: ${Object.keys(PROVIDERS).join(', ')}`
    );
  }

  runBuild(cwd, config.buildCommand);

  console.log(`\n📤 Uploading build output via ${providerName}...`);
  const buildPath = `${cwd}/${config.outputDir}`;
  const { cid, gatewayUrl } = await upload(buildPath);
  console.log(`✅ Pinned! CID: ${cid}`);
  console.log(`🌐 Gateway preview: ${gatewayUrl}`);

  console.log(`\n⛓️  Writing IPFS record to ${config.domain}.sol...`);
  const { signature, explorerUrl } = await writeIpfsRecord(config.domain, cid);
  console.log(`✅ SNS record updated. Tx: ${explorerUrl}`);

  console.log(
    `\n🚀 Live at: ${config.domain}.sol (resolvable via SNS-aware tools like Brave Browser or sol-domain.org)`
  );
}
  
