# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Changed
- `lib/sns.js` now uses **SNS V2 record functions** (`createRecordV2Instruction`
  / `updateRecordV2Instruction`) as the primary write path, replacing V1
  entirely. V1's `createNameRegistry` was abandoned after repeated
  unexplained "missing signature" errors across multiple devnet attempts.
  V2's signature was read directly from the installed package's source
  (not guessed) and confirmed working via a real devnet transaction whose
  program logs showed both the account-allocation ("Create") and the
  content write ("Update Data") succeeding — not just a passing
  transaction status. `readIpfsRecord` now uses the equivalent
  `getRecordV2`, which is well-documented on the read side (unlike V1's
  read path, which relied on a public-docs synthesis that was never
  independently confirmed).

### Milestone
- First successful live Anchr deploy: a Vite site built, pinned via
  Filebase, and confirmed fully rendering (including interactivity/HMR)
  at a real IPFS gateway URL.

### Fixed
- `detectFramework` now warns about the relative-asset-path requirement
  for IPFS hosting (`base: './'` for Vite, `"homepage": "."` for CRA) —
  discovered via the first real deploy, which rendered blank until this
  was set. Default absolute paths break because IPFS serves content from
  a `/ipfs/<CID>/` subpath, not domain root.
- `anchr deploy` no longer hard-requires a `domain` in `anchr.json`. You
  can now build + pin to IPFS and get a working gateway link without
  owning a `.sol` domain yet — the SNS record write is skipped (not
  errored) when no domain is set, and can be added later by re-deploying.
- `lib/sns.js` now uses a polling-based transaction confirmation
  (`lib/solana-confirm.js`) instead of `@solana/web3.js`'s default
  `sendAndConfirmTransaction`. That default relies on WebSocket
  `signatureSubscribe`, which some RPC providers don't support (confirmed:
  Alchemy's devnet endpoint) — causing false "expired" errors even when a
  transaction actually landed on-chain. Found via live devnet testing;
  affects any real `anchr deploy` run too, not just the test script.
- Removed an unused-variable lint warning in `lib/deploy.js` by actually
  printing the transaction signature instead of discarding it.

### Added
- Filebase as an alternate pinning provider (`lib/filebase.js`), selectable
  via `"provider": "filebase"` in `anchr.json`. Added as a fallback after
  Storacha's `up.storacha.network` upload endpoint was found unreachable
  from multiple independent networks (Codespaces, Replit, and direct
  mobile — confirmed via DNS_PROBE_FINISHED_NXDOMAIN), pointing to a
  provider-side issue rather than anything environment-specific.
- `scripts/devnet-test.js` — standalone devnet verification script for the
  SNS write path (see "Known gaps" below for current status).

### Known gaps
- The exact field name for the CID on `@filebase/sdk`'s upload result
  isn't independently confirmed from docs alone — verify against a real
  response before relying on it (see comment in `lib/filebase.js`).
- `writeIpfsRecord`'s update-fallback path (used when a record already
  exists) hasn't been independently tested end-to-end — only the
  create-a-fresh-record path has a confirmed successful transaction. If
  you hit the fallback, verify with `readIpfsRecord` before trusting it.

## [0.1.0] - 2026-07-12

### Added
- Initial MVP CLI: `anchr init` and `anchr deploy`
- Framework detection for Vite, Next.js (static export), and Create React App
- Storacha (IPFS) upload integration using the documented backend/CI pattern
- SNS `.sol` domain IPFS record write/read (V1 record format)
- Project scaffolding: CI workflow, issue/PR templates, docs

### Known limitations
- SNS V2 record write is not yet implemented — V1 only for now (see `lib/sns.js`)
- No automated deploy-on-push yet — `deploy` workflow is manual-trigger only
  pending devnet verification of the SNS write path
