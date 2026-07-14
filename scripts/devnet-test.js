/**
 * devnet-test.js — Standalone, throwaway verification script.
 *
 * NOT part of the Anchr CLI (MVP scope is locked to `init`/`deploy` only —
 * see docs/ROADMAP.md). This exists purely to verify the SNS write path
 * actually works before trusting lib/sns.js or turning deploy.yml's
 * auto-trigger on. Run manually with:
 *
 *   node scripts/devnet-test.js
 *
 * Uses Solana DEVNET only. Devnet SOL is free and worthless — this is
 * safe to run as many times as needed, unlike anything touching mainnet.
 *
 * STATUS OF WHAT'S VERIFIED vs GUESSED:
 *  - Devnet domain registration (devnet.bindings.registerDomainNameV2) —
 *    CONFIRMED against Bonfida's own docs.
 *  - Devnet program ID for the SNS Registrar — CONFIRMED against
 *    Bonfida/sns-registrar's own GitHub README.
 *  - Domain registration requires payment in WRAPPED SOL, not native SOL —
 *    CONFIRMED (stated explicitly in Bonfida's registration docs).
 *  - The exact function name for *writing* an IPFS record on devnet —
 *    CONFIRMED via a live run of this script: devnet.bindings.updateNameRegistryData
 *    exists (separate from the top-level mainnet function), and so does
 *    devnet.utils.getDomainKeySync for correctly deriving the devnet PDA.
 *  - BONUS FIND: devnet.bindings also exposes createRecordV2Instruction /
 *    updateRecordV2Instruction — meaning V2 record support (marked as an
 *    unresolved TODO in lib/sns.js) may genuinely exist. Not yet tested —
 *    this script only exercises the V1 path so far.
 *  - NOT YET CONFIRMED: whether an actual write+readback round-trip
 *    succeeds end-to-end (this run failed earlier at the airdrop step,
 *    before reaching the write). That's what running this script to
 *    completion will confirm.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import {
  Connection,
  Keypair,
  Transaction,
  sendAndConfirmTransaction,
  SystemProgram
} from '@solana/web3.js';
import {
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  createSyncNativeInstruction,
  NATIVE_MINT
} from '@solana/spl-token';
import {
  devnet,
  NameRegistryState
} from '@bonfida/spl-name-service';

const DEVNET_RPC = 'https://api.devnet.solana.com';
const TEST_DOMAIN = `anchr-test-${Date.now()}`; // unique per run, avoids domain collisions
const WRAP_AMOUNT_SOL = 0.05; // covers registration fee + rent; bump if it fails
const FAKE_CID = 'bafybeigdyrztestcidxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
const WALLET_FILE = '.devnet-test-wallet.json';

/**
 * The wallet is the thing that needs devnet SOL — unlike TEST_DOMAIN, it
 * must stay THE SAME across runs when the automated airdrop fails and
 * you're funding it manually via faucet.solana.com. Without this, every
 * re-run would generate a fresh throwaway address, abandoning whatever
 * you just funded. Delete this file if you ever want a clean new wallet.
 */
function loadOrCreateWallet() {
  if (existsSync(WALLET_FILE)) {
    const secretKey = Uint8Array.from(JSON.parse(readFileSync(WALLET_FILE, 'utf-8')));
    return { wallet: Keypair.fromSecretKey(secretKey), reused: true };
  }
  const wallet = Keypair.generate();
  writeFileSync(WALLET_FILE, JSON.stringify(Array.from(wallet.secretKey)));
  return { wallet, reused: false };
}

async function main() {
  const connection = new Connection(DEVNET_RPC, 'confirmed');

  console.log('Available devnet.bindings functions:', Object.keys(devnet.bindings));
  console.log('Available devnet.utils functions:', Object.keys(devnet.utils));
  console.log('');

  // 1. Reuse the same throwaway wallet across runs (see loadOrCreateWallet
  //    comment above) — never reuse a REAL wallet for this, only this
  //    disposable devnet-only one.
  const { wallet, reused } = loadOrCreateWallet();
  console.log(`Test wallet (${reused ? 'reused from last run' : 'newly generated'}):`, wallet.publicKey.toBase58());

  // 2. Airdrop devnet SOL — skip if this wallet already has enough
  const existingBalance = await connection.getBalance(wallet.publicKey);
  if (existingBalance >= 0.02 * 1_000_000_000) {
    console.log(`Wallet already funded (${existingBalance / 1_000_000_000} SOL) — skipping airdrop.`);
  } else {
    console.log('Requesting devnet airdrop (1 SOL)...');
    try {
      const airdropSig = await connection.requestAirdrop(wallet.publicKey, 1_000_000_000);
      await connection.confirmTransaction(airdropSig, 'confirmed');
      console.log('Airdrop confirmed.');
    } catch (err) {
      console.error(
        'Airdrop failed (devnet faucet is often rate-limited). Manually fund this address ' +
        `at https://faucet.solana.com, then re-run — this SAME wallet will be reused ` +
        `next time, so funding it once is enough.\nAddress: ${wallet.publicKey.toBase58()}`
      );
      throw err;
    }
  }

  // 3. Wrap SOL into wSOL — registration pays in wrapped SOL, not native SOL
  const ata = getAssociatedTokenAddressSync(NATIVE_MINT, wallet.publicKey);
  console.log(`Wrapping ${WRAP_AMOUNT_SOL} SOL...`);
  const wrapTx = new Transaction().add(
    createAssociatedTokenAccountInstruction(wallet.publicKey, ata, wallet.publicKey, NATIVE_MINT),
    SystemProgram.transfer({
      fromPubkey: wallet.publicKey,
      toPubkey: ata,
      lamports: Math.round(WRAP_AMOUNT_SOL * 1_000_000_000)
    }),
    createSyncNativeInstruction(ata)
  );
  await sendAndConfirmTransaction(connection, wrapTx, [wallet]);
  console.log('Wrapped.');

  // 4. Register a throwaway devnet domain — CONFIRMED pattern
  console.log(`\nRegistering devnet domain: ${TEST_DOMAIN}`);
  const registerIx = await devnet.bindings.registerDomainNameV2(
    connection,
    TEST_DOMAIN,
    1_000,
    wallet.publicKey,
    ata,
    NATIVE_MINT
  );
  const registerTx = new Transaction().add(registerIx);
  const registerSig = await sendAndConfirmTransaction(connection, registerTx, [wallet]);
  console.log('Domain registered. Tx:', `https://explorer.solana.com/tx/${registerSig}?cluster=devnet`);

  // 5. Write a fake IPFS record — THIS is the part we're actually verifying.
  //    CONFIRMED (from a live run of this script): devnet.bindings exposes
  //    its own updateNameRegistryData, separate from the top-level mainnet
  //    function — using that dedicated devnet binding rather than the
  //    mainnet one, since devnet runs its own program deployment.
  //
  //    Also confirmed from that same run: devnet.bindings also exposes
  //    createRecordV2Instruction / updateRecordV2Instruction — meaning the
  //    V2 write path marked as a TODO in lib/sns.js may actually exist
  //    after all. Worth testing that separately once this V1 devnet test
  //    passes cleanly.
  console.log('\nAttempting IPFS record write...');
  const recordName = `IPFS.${TEST_DOMAIN}`;
  const data = Buffer.from(FAKE_CID, 'utf-8');

  const writeIx = await devnet.bindings.updateNameRegistryData(
    connection,
    recordName,
    0,
    data,
    undefined,
    devnet.constants.ROOT_DOMAIN_ACCOUNT
  );
  const writeTx = new Transaction().add(writeIx);
  const writeSig = await sendAndConfirmTransaction(connection, writeTx, [wallet]);
  console.log('Write tx sent:', `https://explorer.solana.com/tx/${writeSig}?cluster=devnet`);

  // 6. Read it back to confirm the write actually landed correctly.
  //    Using devnet.utils.getDomainKeySync (confirmed to exist separately
  //    from the top-level version) so the derived pubkey actually matches
  //    devnet's program deployment.
  const { pubkey } = devnet.utils.getDomainKeySync(recordName, true);
  const { registry } = await NameRegistryState.retrieve(connection, pubkey);
  const readBack = registry.data ? registry.data.toString('utf-8').replace(/\0/g, '') : null;

  console.log('\n--- RESULT ---');
  console.log('Wrote:     ', FAKE_CID);
  console.log('Read back: ', readBack);
  console.log(
    readBack === FAKE_CID
      ? '✅ MATCH — the V1 write/read pattern works. lib/sns.js uses the ' +
        'mainnet-equivalent functions of the same names, so this validates ' +
        'the approach, though lib/sns.js itself should still get one live ' +
        'mainnet run before fully trusting it.'
      : '❌ MISMATCH — do not trust lib/sns.js yet. Check the devnet.bindings list above for the correct write function.'
  );
}

main().catch((err) => {
  console.error('\n❌ Devnet test failed:', err);
  process.exit(1);
});
