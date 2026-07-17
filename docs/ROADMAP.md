# Roadmap

## Week 1 — Research (done)
- SNS resolver research — confirmed `@bonfida/spl-name-service`, `Record.IPFS`;
  V1 write path verified, V2 write pending SDK source-level verification
- Pinning provider comparison — picked Storacha over Filebase (more IPFS-native,
  UCAN auth, pre-built GitHub Action integration)

## Week 2 — CLI (done)
- `anchr init` / `anchr deploy` — implemented, this repo
- Wire against one real test repo end-to-end and confirm a first live deploy

## Week 3 — Dashboard + automation (In progress)
- Single dashboard page: deploy status + live preview link
- GitHub webhook trigger (turns `deploy.yml` from manual into automatic)
- Devnet verification of the SNS write path; decide on the SNS V2 write function

## Week 4 — Polish + submission
- Demo recording
- Grant submission write-up (AllianceDAO and/or Solana Foundation)

## Explicitly deferred (v2+)

Resist adding these before the MVP above is solid:

- Multi-provider pinning (e.g. Filebase via the IPFS Pinning Service API standard)
- ENS support
- Unstoppable Domains support
- Custom domains
- Analytics
- Env var / logs UI
