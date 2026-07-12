# Architecture (v1 / MVP)

```
GitHub push
     |
     v
Build runner (manual CLI run today; GitHub webhook trigger is a Week 3 item)
     |  detect framework -> run build command
     v
Storacha (IPFS pinning)
     |  uploadDirectory(buildOutput) -> CID
     v
SNS record write
     |  IPFS.<domain> record <- CID   (V1 format; see lib/sns.js for V2 status)
     v
Resolution
     yourdomain.sol -> CID -> IPFS gateway
     (resolved by Brave Browser, sol-domain.org, etc. — Anchr doesn't run its own resolver)
```

## Components

| Piece | Status | Notes |
|---|---|---|
| Framework detection | Done (MVP) | Vite, Next.js (static export), CRA |
| Build execution | Done (MVP) | Runs the detected `npm run build` |
| IPFS pinning | Done (MVP) | Storacha only; multi-provider deferred |
| SNS record write | Done (MVP, V1) | V2 write pending SDK source verification |
| Dashboard (status + preview link) | Planned — Week 3 | Not yet built |
| GitHub webhook trigger | Planned — Week 3 | `deploy.yml` is manual-trigger only until then |
| ENS / Unstoppable Domains | Deferred (v2+) | Not started |
| Multi-provider pinning | Deferred (v2+) | Not started |

## Why SNS-first

Spheron Network — the obvious "this already exists" competitor — retired its
storage/hosting product in May 2024 to pivot into GPU/DePIN compute, leaving
a real gap. Fleek remains the main active multi-chain competitor. Anchr's
wedge is narrower and deeper: SNS-first, Solana-native, rather than trying to
match Fleek's full chain breadth on day one.

## Prior art

`Bonfida/sns-deploy` (2021) did something similar — Infura pinning, raw
wallet.json path, no CI integration, no framework detection. Anchr's
differentiation is a modern pinning provider (Storacha/UCAN), automatic
framework detection, and a CI-friendly credential model built around a
GitHub-push deploy flow.
