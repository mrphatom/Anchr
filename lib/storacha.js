import * as Client from '@storacha/client';
import { StoreMemory } from '@storacha/client/stores/memory';
import * as Proof from '@storacha/client/proof';
import { Signer } from '@storacha/client/principal/ed25519';
import { filesFromPaths } from 'files-from-path';

/**
 * Uploads a build directory to Storacha and returns the resulting CID.
 *
 * This follows Storacha's own documented "backend" integration pattern
 * (docs.storacha.network/concepts/architecture-options) — the CLI owns
 * the Space, and this agent holds a delegation to upload to it, so
 * `anchr deploy` can run non-interactively in CI without a login prompt.
 *
 * Requires env vars (generate these once via the Storacha CLI — see README):
 *   ANCHR_STORACHA_KEY   — agent's private key (from `storacha key create --json`)
 *   ANCHR_STORACHA_PROOF — base64 delegation proof (from `storacha delegation create`)
 */
export async function uploadToStoracha(buildDir) {
  const key = process.env.ANCHR_STORACHA_KEY;
  const proofStr = process.env.ANCHR_STORACHA_PROOF;

  if (!key || !proofStr) {
    throw new Error(
      'Missing ANCHR_STORACHA_KEY / ANCHR_STORACHA_PROOF env vars. See README.md for one-time setup steps.'
    );
  }

  const principal = Signer.parse(key);
  const store = new StoreMemory();
  const client = await Client.create({ principal, store });

  const proof = await Proof.parse(proofStr);
  const space = await client.addSpace(proof);
  await client.setCurrentSpace(space.did());

  const files = await filesFromPaths([buildDir]);
  const cid = await client.uploadDirectory(files);

  return {
    cid: cid.toString(),
    gatewayUrl: `https://${cid.toString()}.ipfs.storacha.link`
  };
}
