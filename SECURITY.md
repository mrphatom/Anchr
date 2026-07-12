# Security Policy

## Reporting a Vulnerability

If you find a security issue — especially anything related to:
- The Solana wallet secret key handling in `lib/sns.js`
- Storacha credential handling in `lib/storacha.js`
- Any way a malicious build/repo could exfiltrate secrets during `anchr deploy`

please **do not open a public issue**. Instead, report it privately via
GitHub's "Report a vulnerability" feature under this repo's Security tab, or
contact the maintainer directly (see repository profile).

We'll acknowledge reports within a few days and aim to patch confirmed issues
before public disclosure.

## Scope notes

Anchr is an early-stage MVP. It handles two categories of sensitive material:

1. **Storacha upload credentials** (`ANCHR_STORACHA_KEY` / `ANCHR_STORACHA_PROOF`) —
   scoped via UCAN delegation to upload-only permissions on one Space.
2. **A Solana wallet secret key** (`ANCHR_WALLET_SECRET_KEY`) — used to sign
   the SNS record-update transaction. This wallet should own the `.sol`
   domain and nothing else of value; **do not** reuse a wallet holding
   significant funds or other domains as the CLI's signing wallet.

Both are read from environment variables only — never committed, logged, or
transmitted anywhere except directly to Storacha's API / Solana RPC.
