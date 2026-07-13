import { readdir, readFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { ObjectManager } from '@filebase/sdk';

/**
 * Recursively walks a directory and returns entries shaped for
 * @filebase/sdk's ObjectManager.upload() directory-upload form:
 *   [{ path: '/relative/virtual/path', content: Buffer }, ...]
 *
 * VERIFIED against Filebase's own docs (docs.filebase.com/ipfs-pinning/pinning-files,
 * filebase.github.io/filebase-sdk/ObjectManager.html) — passing an array of
 * { path, content } objects to upload() packs them into a directory/CAR upload.
 * We walk the filesystem ourselves (rather than pulling in their `recursive-fs`
 * example dependency) so the virtual path is a clean, predictable relative path
 * with no local folder-name prefix baked in.
 */
async function walkDirectory(rootDir, currentDir = rootDir, files = []) {
  const entries = await readdir(currentDir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(currentDir, entry.name);
    if (entry.isDirectory()) {
      await walkDirectory(rootDir, fullPath, files);
    } else {
      const virtualPath = '/' + relative(rootDir, fullPath).split(sep).join('/');
      const content = await readFile(fullPath);
      files.push({ path: virtualPath, content });
    }
  }
  return files;
}

/**
 * Uploads a build directory to Filebase and returns the resulting CID.
 *
 * This is an ALTERNATE pinning provider to Storacha (lib/storacha.js) — same
 * role, different service. Use it by setting "provider": "filebase" in
 * anchr.json. It exists specifically as a fallback for when Storacha's
 * upload endpoint is unreachable; it is not a "use both at once" abstraction
 * (that's explicitly deferred multi-provider scope, see docs/ROADMAP.md).
 *
 * NOT independently confirmed: the exact field name for the CID on the
 * object ObjectManager.upload() resolves to. Docs describe the return type
 * as an "objectHeadResult" but don't show its full field list in the
 * snippets available. Log the raw result and confirm `cid` is correct
 * before trusting this in a real deploy — same "verify before building on
 * top of it" caution as the SNS module.
 *
 * Requires env vars:
 *   ANCHR_FILEBASE_KEY    — S3 access key (Filebase Console → Access Keys)
 *   ANCHR_FILEBASE_SECRET — S3 secret key
 *   ANCHR_FILEBASE_BUCKET — name of an IPFS-enabled bucket in your Filebase account
 */
export async function uploadToFilebase(buildDir) {
  const key = process.env.ANCHR_FILEBASE_KEY;
  const secret = process.env.ANCHR_FILEBASE_SECRET;
  const bucket = process.env.ANCHR_FILEBASE_BUCKET;

  if (!key || !secret || !bucket) {
    throw new Error(
      'Missing ANCHR_FILEBASE_KEY / ANCHR_FILEBASE_SECRET / ANCHR_FILEBASE_BUCKET env vars. See README.md.'
    );
  }

  const objectManager = new ObjectManager(key, secret, { bucket });

  const files = await walkDirectory(buildDir);
  if (files.length === 0) {
    throw new Error(`No files found in build directory: ${buildDir}`);
  }

  const uploaded = await objectManager.upload('anchr-deploy', files);

  // See caution above — confirm this field name against a real response.
  const cid = uploaded?.cid;
  if (!cid) {
    throw new Error(
      `Upload completed but no CID was found on the result. Raw result: ${JSON.stringify(uploaded)}`
    );
  }

  return {
    cid: cid.toString(),
    gatewayUrl: `https://ipfs.filebase.io/ipfs/${cid}`
  };
}
