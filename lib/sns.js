import {
  Connection,
  Keypair,
  Transaction,
  sendAndConfirmTransaction
} from '@solana/web3.js';
import {
  getDomainKeySync,
  updateNameRegistryData,
  ROOT_DOMAIN_ACCOUNT,
  NameRegistryState
} from '@bonfida/spl-name-service';

const DEFAULT_RPC = 'https://api.mainnet-beta.solana.com';

function loadWallet() {
  const secret = process.env.ANCHR_WALLET_SECRET_KEY;
  if (!secret) {
    throw new Error(
      "Missing ANCHR_WALLET_SECRET_KEY env var — this must be the wallet that owns the .sol domain."
    );
  }
  let secretKey;
  try {
    secretKey = Uint8Array.from(JSON.parse(secret));
  } catch {
    throw new Error(
      'ANCHR_WALLET_SECRET_KEY must be a JSON array of numbers (e.g. the contents of a Solana CLI keypair file).'
    );
  }
  return Keypair.fromSecretKey(secretKey);
}

/**
 * Writes a CID to a domain's IPFS record.
 *
 * STATUS: V1 record format only, for now.
 *
 * VERIFIED against Bonfida's own SNS guide:
 *  - Record key derivation: getDomainKeySync("IPFS.<domain>", true)
 *    (guide.sns.id/domain-name/domain-direct-lookup.html)
 *  - Generic write function: updateNameRegistryData(connection, name, offset, data, undefined, ROOT_DOMAIN_ACCOUNT)
 *    (guide.sns.id/domain-name/edit-domain-content.html)
 *
 * NOT INDEPENDENTLY CONFIRMED: whether passing "IPFS.<domain>" directly as the
 * `name` argument to updateNameRegistryData correctly targets the IPFS record
 * account (vs. needing the derived pubkey passed some other way). This is a
 * reasonable synthesis of two separate doc pages, not a single verified example.
 * TEST ON DEVNET before ever running this against a mainnet domain you care about.
 *
 * NOT YET WIRED: Records V2 write path. The SDK exposes V2 *read* helpers
 * (getRecordV2Key, getRecordV2, verifyStaleness) but no V2 *write* helper
 * turned up in the docs. Before switching this to V2, inspect
 * node_modules/@bonfida/spl-name-service directly for the real export name —
 * don't guess it. Per project scope, V1 write + V1 read is an acceptable
 * MVP starting point; V2 is the intended target format once verified.
 */
export async function writeIpfsRecord(domain, cid, { rpcUrl = DEFAULT_RPC } = {}) {
  const connection = new Connection(rpcUrl, 'confirmed');
  const wallet = loadWallet();

  const recordName = `IPFS.${domain}`;
  const data = Buffer.from(cid, 'utf-8');

  const ix = await updateNameRegistryData(
    connection,
    recordName,
    0, // offset
    data,
    undefined,
    ROOT_DOMAIN_ACCOUNT
  );

  const tx = new Transaction().add(ix);
  const signature = await sendAndConfirmTransaction(connection, tx, [wallet]);

  return {
    signature,
    explorerUrl: `https://explorer.solana.com/tx/${signature}`
  };
}

/** Reads back the current IPFS record for a domain (V1 format). */
export async function readIpfsRecord(domain, { rpcUrl = DEFAULT_RPC } = {}) {
  const connection = new Connection(rpcUrl, 'confirmed');
  const recordName = `IPFS.${domain}`;
  const { pubkey } = getDomainKeySync(recordName, true);
  const { registry } = await NameRegistryState.retrieve(connection, pubkey);
  return registry.data ? registry.data.toString('utf-8').replace(/\0/g, '') : null;
}
