import { readConfig } from './config.js';
import { runBuild } from './build.js';
import { uploadToStoracha } from './storacha.js';
import { writeIpfsRecord } from './sns.js';

export async function runDeploy() {
  const cwd = process.cwd();
  const config = readConfig(cwd);

  if (!config.domain) {
    throw new Error('No domain set in anchr.json — add your .sol domain (without ".sol") before deploying.');
  }

  runBuild(cwd, config.buildCommand);

  console.log('\n📤 Uploading build output to Storacha...');
  const buildPath = `${cwd}/${config.outputDir}`;
  const { cid, gatewayUrl } = await uploadToStoracha(buildPath);
  console.log(`✅ Pinned! CID: ${cid}`);
  console.log(`🌐 Gateway preview: ${gatewayUrl}`);

  console.log(`\n⛓️  Writing IPFS record to ${config.domain}.sol...`);
  const { signature, explorerUrl } = await writeIpfsRecord(config.domain, cid);
  console.log(`✅ SNS record updated. Tx: ${explorerUrl}`);

  console.log(
    `\n🚀 Live at: ${config.domain}.sol (resolvable via SNS-aware tools like Brave Browser or sol-domain.org)`
  );
}
