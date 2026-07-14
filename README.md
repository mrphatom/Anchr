# Scripts

Dev-only utilities — not part of the CLI itself.

## devnet-test.js

Verifies the SNS record-write path (`lib/sns.js`) actually works, using
Solana **devnet** (free, worthless SOL — safe to run repeatedly).

```bash
node scripts/devnet-test.js
```

It generates a throwaway wallet, requests a devnet airdrop, wraps some SOL
(domain registration pays in wrapped SOL, not native SOL), registers a
disposable test domain, attempts to write a fake CID to its IPFS record,
then reads it back to confirm the write actually landed.

If the airdrop fails (devnet's faucet is rate-limited), fund the printed
address manually at https://faucet.solana.com and re-run.

If the write step fails or the readback doesn't match, check the
`devnet.bindings` function list the script prints at the very top —
that's the real, live list of what's available, since the exact
devnet-specific write function isn't fully confirmed from docs alone (see
comments in the script and in `lib/sns.js`).
