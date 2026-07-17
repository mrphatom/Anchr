import {
  Connection,
  Keypair,
  Transaction
} from '@solana/web3.js';
import {
  getDomainKeySync,
  updateNameRegistryData,
  ROOT_DOMAIN_ACCOUNT,
  NameRegistryState
} from '@bonfida/spl-name-service';
import { sendAndConfirm } from './solana-confirm.js';

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
 *
 * KNOWN GAP FROM LIVE DEVNET TESTING (see scripts/devnet-test.js): this
 * function assumes the record account ALREADY EXISTS and only writes data
 * into it. On a genuinely fresh devnet domain with no prior record, this
 * fails with "AccountDoesNotExist" — the record account must be CREATED
 * first (via createNameRegistry), and that create step hit an unresolved
 * "missing signature" error during testing that was never fixed. It's
 * possible real domains registered through Bonfida's own UI/registrar
 * already have record slots pre-created (unlike our bare devnet test
 * registration), which would make this a non-issue in practice — but that
 * is NOT confirmed. TEST ON DEVNET before ever running this against a
 * mainnet domain you care about, and don't assume this succeeds on a
 * brand-new domain without checking.
 *
 * NOT YET WIRED: Records V2 write path. The SDK exposes V2 *read* helpers
 * (getRecordV2Key, getRecordV2, verifyStaleness) and devnet.bindings does
 * expose createRecordV2Instruction / updateRecordV2Instruction (confirmed
 * via runtime introspection during devnet testing), but these haven't been
 * tried yet. Per project scope, V1 write + V1 read is an acceptable MVP
 * starting point; V2 is the intended target format once verified.
 *
 * CONFIRMED FIX: uses sendAndConfirm from ./solana-confirm.js instead of
 * @solana/web3.js's sendAndConfirmTransaction, because that library
 * default relies on WebSocket signatureSubscribe, which some RPC
 * providers don't support — causing false "expired" errors even when the
 * transaction actually landed on-chain (confirmed via live testing).
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
  const signature = await sendAndConfirm(connection, tx, [wallet]);

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
