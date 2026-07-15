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
import { inspect } from 'node:util';
import {
  Connection,
  Keypair,
  Transaction,
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

// Defaults to the public devnet RPC, but that's shared across every Replit
// user (and everyone else) hitting it at once, so it's prone to sustained
// 429s that have nothing to do with your own request volume. Set
// ANCHR_DEVNET_RPC_URL to a free dedicated endpoint (Helius, QuickNode,
// Syndica, Alchemy, etc.) to get a quota that's actually yours alone.
const DEVNET_RPC = process.env.ANCHR_DEVNET_RPC_URL || 'https://api.devnet.solana.com';
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

/**
 * Sends and confirms a transaction WITHOUT relying on WebSocket signature
 * subscriptions (the default confirmation strategy in @solana/web3.js).
 *
 * CONFIRMED NEEDED via a live run: Alchemy's endpoint here doesn't support
 * the `signatureSubscribe` RPC method, so the library's built-in
 * sendAndConfirmTransaction hangs on repeated "Method not found" errors
 * and eventually times out with TransactionExpiredBlockheightExceededError
 * — even when the transaction actually landed on-chain. Polling via
 * getSignatureStatus works with any RPC provider regardless of WS support.
 */
async function sendAndConfirm(connection, transaction, signers) {
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = signers[0].publicKey;
  transaction.sign(...signers);

  const signature = await connection.sendRawTransaction(transaction.serialize());

  const start = Date.now();
  while (Date.now() - start < 60_000) {
    const { value } = await connection.getSignatureStatus(signature);
    if (value?.err) {
      throw new Error(`Transaction failed: ${JSON.stringify(value.err)}`);
    }
    if (value?.confirmationStatus === 'confirmed' || value?.confirmationStatus === 'finalized') {
      return signature;
    }
    const blockHeight = await connection.getBlockHeight();
    if (blockHeight > lastValidBlockHeight) {
      throw new Error(`Transaction expired before confirmation: ${signature}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error(`Confirmation timed out after 60s: ${signature}`);
}

async function main() {
  const connection = new Connection(DEVNET_RPC, 'confirmed');
  console.log('Using RPC:', DEVNET_RPC);
  console.log('');

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
      const start = Date.now();
      let confirmed = false;
      while (Date.now() - start < 30_000) {
        const { value } = await connection.getSignatureStatus(airdropSig);
        if (value?.confirmationStatus === 'confirmed' || value?.confirmationStatus === 'finalized') {
          confirmed = true;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
      if (!confirmed) throw new Error('Airdrop confirmation timed out');
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

  // 3. Wrap SOL into wSOL — but only if this wallet doesn't already have a
  //    wrapped-SOL account from a previous run. Re-running the create
  //    instruction on an already-existing account fails with "Provided
  //    owner is not allowed" — same reused-wallet issue as the airdrop
  //    check above, just one step later.
  const ata = getAssociatedTokenAddressSync(NATIVE_MINT, wallet.publicKey);
  const ataInfo = await connection.getAccountInfo(ata);
  if (ataInfo) {
    console.log('Wrapped SOL account already exists from a previous run — skipping wrap step.');
  } else {
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
    await sendAndConfirm(connection, wrapTx, [wallet]);
    console.log('Wrapped.');
  }

  // 4. Register a throwaway devnet domain — CONFIRMED pattern for the call
  //    itself, but the exact SHAPE of what it returns (single instruction
  //    vs an array of instructions) wasn't independently verified. Logging
  //    it and handling both shapes rather than guessing.
  console.log(`\nRegistering devnet domain: ${TEST_DOMAIN}`);
  const registerIx = await devnet.bindings.registerDomainNameV2(
    connection,
    TEST_DOMAIN,
    1_000,
    wallet.publicKey,
    ata,
    NATIVE_MINT
  );
  console.log('registerDomainNameV2 returned:', Array.isArray(registerIx) ? `array of ${registerIx.length}` : typeof registerIx);

  const registerTx = new Transaction();
  if (Array.isArray(registerIx)) {
    registerTx.add(...registerIx);
  } else {
    registerTx.add(registerIx);
  }
  const registerSig = await sendAndConfirm(connection, registerTx, [wallet]);
  console.log('Domain registered. Tx:', `https://explorer.solana.com/tx/${registerSig}?cluster=devnet`);

  // 5. Write a fake IPFS record — THIS is the part we're actually verifying.
  //    CONFIRMED via a live run: the record account must be CREATED before
  //    it can be UPDATED — updateNameRegistryData alone fails with
  //    "AccountDoesNotExist" on a brand-new domain's record. Attempting
  //    devnet.bindings.createNameRegistry first, based on the standard
  //    SPL Name Service Create instruction shape (name, space, payer,
  //    nameOwner, nameClass, nameParent) — NOT independently confirmed
  //    for this exact JS wrapper's parameter order, so if this throws,
  //    the error message is the next real signal to go on.
  console.log('\nCreating record account (if it does not already exist)...');
  const recordName = `IPFS.${TEST_DOMAIN}`;
  const data = Buffer.from(FAKE_CID, 'utf-8');
  const RECORD_SPACE = 1_000; // bytes to allocate — generous for a CID string

  try {
    const createIx = await devnet.bindings.createNameRegistry(
      connection,
      recordName,
      RECORD_SPACE,
      wallet.publicKey, // payer
      wallet.publicKey, // name owner
      undefined,        // lamports (let it compute rent-exemption automatically)
      undefined,        // nameClass
      devnet.constants.ROOT_DOMAIN_ACCOUNT // nameParent
    );
    console.log(
      'createNameRegistry returned:',
      Array.isArray(createIx)
        ? `array of ${createIx.length}`
        : `object with keys: ${Object.keys(createIx || {}).join(', ')}`
    );
    if (!Array.isArray(createIx) && !createIx?.programId) {
      // Doesn't look like a plain TransactionInstruction — likely a
      // compound object (e.g. instruction + a generated signer). Full
      // dump to see exactly what's actually in it.
      console.log('Full structure:', inspect(createIx, { depth: 4 }));
    }
    const createTx = new Transaction();
    if (Array.isArray(createIx)) {
      createTx.add(...createIx);
    } else {
      createTx.add(createIx);
    }
    const createSig = await sendAndConfirm(connection, createTx, [wallet]);
    console.log('Record account created. Tx:', `https://explorer.solana.com/tx/${createSig}?cluster=devnet`);
  } catch (err) {
    console.log('createNameRegistry failed (may already exist, or the guessed params above are wrong):');
    console.log(err.message || err);
    console.log('Proceeding to the update step regardless — if that also fails, this create step needs fixing first.');
  }

  console.log('\nAttempting IPFS record write...');
  const writeIx = await devnet.bindings.updateNameRegistryData(
    connection,
    recordName,
    0,
    data,
    undefined,
    devnet.constants.ROOT_DOMAIN_ACCOUNT
  );
  console.log('updateNameRegistryData returned:', Array.isArray(writeIx) ? `array of ${writeIx.length}` : typeof writeIx);

  const writeTx = new Transaction();
  if (Array.isArray(writeIx)) {
    writeTx.add(...writeIx);
  } else {
    writeTx.add(writeIx);
  }
  const writeSig = await sendAndConfirm(connection, writeTx, [wallet]);
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
