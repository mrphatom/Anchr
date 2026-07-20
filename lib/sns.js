import { Connection, Keypair, Transaction } from '@solana/web3.js';
import {
  createRecordV2Instruction,
  updateRecordV2Instruction,
  getRecordV2,
  Record
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
 * Writes a CID to a domain's IPFS record using the V2 record format.
 *
 * STATUS: V2 is now the primary path (V1 is abandoned — see CHANGELOG /
 * project history: devnet.bindings.createNameRegistry repeatedly failed
 * with an unexplained second-signer requirement across multiple attempts).
 *
 * VERIFIED signature directly from source, not guessed
 * (node_modules/@bonfida/spl-name-service/dist/esm/bindings/createRecordV2Instruction.d.ts,
 * and confirmed exported at the top level via dist/esm/index.d.ts):
 *   createRecordV2Instruction(domain, record, content, owner, payer) => TransactionInstruction
 *   updateRecordV2Instruction(domain, record, content, owner, payer) => TransactionInstruction
 * Both are synchronous (no Promise wrapper), unlike every V1 function.
 *
 * CONFIRMED WORKING on devnet via a real transaction whose program logs
 * showed both "Instruction: Create" (allocates the record account) and
 * "Instruction: Update Data" (writes the content) succeeding — not just
 * a successful top-level transaction status. createRecordV2Instruction
 * bundles account creation AND the content write into one instruction.
 *
 * That confirmed run only covered a domain with NO existing record yet.
 * If a record already exists, re-running "create" would likely fail
 * (same as any Solana account creation on an already-initialized
 * account) — so this function tries create first and falls back to
 * update on failure. The update fallback path itself has NOT been
 * independently tested end-to-end; if you hit it, verify the result
 * with readIpfsRecord before trusting it blindly.
 */
export async function writeIpfsRecord(domain, cid, { rpcUrl = DEFAULT_RPC } = {}) {
  const connection = new Connection(rpcUrl, 'confirmed');
  const wallet = loadWallet();

  try {
    const ix = createRecordV2Instruction(domain, Record.IPFS, cid, wallet.publicKey, wallet.publicKey);
    const tx = new Transaction().add(ix);
    const signature = await sendAndConfirm(connection, tx, [wallet]);
    return { signature, explorerUrl: `https://explorer.solana.com/tx/${signature}` };
  } catch (createErr) {
    try {
      const ix = updateRecordV2Instruction(domain, Record.IPFS, cid, wallet.publicKey, wallet.publicKey);
      const tx = new Transaction().add(ix);
      const signature = await sendAndConfirm(connection, tx, [wallet]);
      return { signature, explorerUrl: `https://explorer.solana.com/tx/${signature}` };
    } catch (updateErr) {
      throw new Error(
        `Both create and update attempts failed for ${domain}.\n` +
        `Create error: ${createErr.message}\n` +
        `Update error: ${updateErr.message}`
      );
    }
  }
}

/**
 * Reads back the current IPFS record for a domain (V2 format).
 *
 * Uses the top-level getRecordV2 — this is well-documented on the read
 * side (docs.sns.id/dev/sns-sdk/domain-record-methods/v2-records),
 * unlike the write side which has no public docs at all. A devnet-only
 * SDK gap was found during testing (GetRecordV2Options only has a
 * `deserialize` boolean, no cluster/program override — confirmed by
 * reading the actual .d.ts), but that only affects devnet testing; this
 * targets mainnet by default, where getRecordV2 is the documented,
 * intended way to read V2 records.
 */
export async function readIpfsRecord(domain, { rpcUrl = DEFAULT_RPC } = {}) {
  const connection = new Connection(rpcUrl, 'confirmed');
  const result = await getRecordV2(connection, domain, Record.IPFS, { deserialize: true });
  return result?.deserializedContent ?? null;
}
