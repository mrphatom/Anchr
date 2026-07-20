/**
 * devnet-update-test.js — verifies the UPDATE fallback in lib/sns.js's
 * writeIpfsRecord, which has never been independently tested. The main
 * devnet-test.js always registers a fresh, uniquely-named domain, so it
 * only ever exercises the CREATE path. This script uses one FIXED domain
 * name and calls the real production writeIpfsRecord() TWICE — the
 * second call is the one that actually hits the untested branch, since
 * the record will already exist from the first call.
 *
 * Reuses the same persisted wallet as devnet-test.js (.devnet-test-wallet.json)
 * — run devnet-test.js at least once first so that wallet exists and is
 * funded/wrapped.
 */

import { readFileSync, existsSync } from 'node:fs';
import { Connection, Keypair, Transaction, SystemProgram } from '@solana/web3.js';
import { getAssociatedTokenAddressSync, NATIVE_MINT } from '@solana/spl-token';
import { devnet } from '@bonfida/spl-name-service';
import { sendAndConfirm } from '../lib/solana-confirm.js';
import { writeIpfsRecord } from '../lib/sns.js';

const DEVNET_RPC = process.env.ANCHR_DEVNET_RPC_URL || 'https://api.devnet.solana.com';
const WALLET_FILE = '.devnet-test-wallet.json';
const FIXED_DOMAIN = 'anchr-update-fallback-test'; // NOT timestamped — reused every run, on purpose

async function main() {
  const connection = new Connection(DEVNET_RPC, 'confirmed');
  console.log('Using RPC:', DEVNET_RPC);

  if (!existsSync(WALLET_FILE)) {
    throw new Error(`No ${WALLET_FILE} found — run devnet-test.js at least once first to create a funded wallet.`);
  }
  const secretKey = Uint8Array.from(JSON.parse(readFileSync(WALLET_FILE, 'utf-8')));
  const wallet = Keypair.fromSecretKey(secretKey);
  console.log('Wallet:', wallet.publicKey.toBase58());

  // Bridge this wallet into the REAL production code path — lib/sns.js's
  // loadWallet() reads this exact env var.
  process.env.ANCHR_WALLET_SECRET_KEY = JSON.stringify(Array.from(secretKey));

  // Register the fixed domain if it doesn't already exist (skip if it does
  // — same reused-across-runs pattern as devnet-test.js).
  const { pubkey: domainKey } = devnet.utils.getDomainKeySync(FIXED_DOMAIN);
  const domainInfo = await connection.getAccountInfo(domainKey);

  if (domainInfo) {
    console.log(`Domain "${FIXED_DOMAIN}" already registered — skipping registration.`);
  } else {
    console.log(`Registering "${FIXED_DOMAIN}" for the first time...`);
    const ata = getAssociatedTokenAddressSync(NATIVE_MINT, wallet.publicKey);
    const registerIx = await devnet.bindings.registerDomainNameV2(
      connection,
      FIXED_DOMAIN,
      1_000,
      wallet.publicKey,
      ata,
      NATIVE_MINT
    );
    const registerTx = new Transaction();
    if (Array.isArray(registerIx)) {
      registerTx.add(...registerIx);
    } else {
      registerTx.add(registerIx);
    }
    const registerSig = await sendAndConfirm(connection, registerTx, [wallet]);
    console.log('Registered. Tx:', `https://explorer.solana.com/tx/${registerSig}?cluster=devnet`);
  }

  // First call — likely CREATE (if no record exists yet) or already the
  // fallback if a previous run of THIS script got partway through.
  console.log('\n--- First writeIpfsRecord call ---');
  const first = await writeIpfsRecord(FIXED_DOMAIN, 'bafyfirstcall000000000000000000000000000000000000000000000', {
    rpcUrl: DEVNET_RPC
  });
  console.log('Success. Tx:', `${first.explorerUrl}?cluster=devnet`);

  // Second call — the record now DEFINITELY exists from the first call,
  // so this MUST hit the update fallback. This is the actual test.
  console.log('\n--- Second writeIpfsRecord call (should trigger the update fallback) ---');
  const second = await writeIpfsRecord(FIXED_DOMAIN, 'bafysecondcall00000000000000000000000000000000000000000000', {
    rpcUrl: DEVNET_RPC
  });
  console.log('Success. Tx:', `${second.explorerUrl}?cluster=devnet`);

  console.log('\n--- RESULT ---');
  console.log(
    '✅ Both calls succeeded. If you saw the "falling back to update" log ' +
    'line above the second call, the update path is confirmed working — ' +
    'not just theoretically reachable, but actually exercised successfully.'
  );
}

main().catch((err) => {
  console.error('\n❌ Update-fallback test failed:', err);
  process.exit(1);
});
