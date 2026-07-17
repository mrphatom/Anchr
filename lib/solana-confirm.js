/**
 * Sends and confirms a transaction WITHOUT relying on WebSocket signature
 * subscriptions (the default confirmation strategy in @solana/web3.js's
 * sendAndConfirmTransaction).
 *
 * CONFIRMED NEEDED via live devnet testing: some RPC providers (confirmed:
 * Alchemy's devnet endpoint) don't support the `signatureSubscribe` RPC
 * method, so the library's built-in confirmation hangs on repeated
 * "Method not found" errors and eventually times out with
 * TransactionExpiredBlockheightExceededError — even when the transaction
 * actually landed on-chain. Polling via getSignatureStatus works with any
 * RPC provider regardless of WebSocket support, so this is used everywhere
 * a transaction needs confirming (lib/sns.js and scripts/devnet-test.js)
 * instead of the library default.
 */
export async function sendAndConfirm(connection, transaction, signers) {
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
