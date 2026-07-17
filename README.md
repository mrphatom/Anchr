# Anchr CLI (MVP)

[![CI](https://github.com/mrphatom/Anchr/actions/workflows/ci.yml/badge.svg)](https://github.com/mrphatom/Anchr/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Deploy static frontends to IPFS and resolve them via a Solana Name Service
(`.sol`) domain — `init` and `deploy`, nothing else, on purpose.

## Project structure

```
bin/anchr.js       CLI entry point
lib/               init/deploy orchestration, framework detection,
                    Storacha upload, SNS record read/write
tests/             unit tests (Node's built-in test runner)
docs/              architecture + roadmap (useful for grant write-ups)
example/           how to spin up a test site to deploy against
.github/           CI, issue/PR templates, dependabot
```

## Scope (locked for MVP)

- Frameworks: Vite, Next.js (static export only), Create React App
- Pinning: Storacha only
- Domains: SNS (`.sol`) only, **V1 record format** (see `lib/sns.js` for why —
  V2 write support needs one more verification pass before it's safe to wire in)
- No `logs`, no env-var UI, no multi-provider pinning — that's all v2+

## One-time setup

**1. Install the Storacha CLI and create a Space** (see project notes for
the full from-scratch walkthrough):

```bash
npm install -g @storacha/cli
storacha login your+anchr@gmail.com
storacha space create anchr-project
```

**2. Generate CI credentials** for this CLI to use non-interactively:

```bash
storacha key create --json
# copy the "key" value → ANCHR_STORACHA_KEY

storacha delegation create <did-from-above> --can 'space/blob/add' --can 'upload/add' --base64
# copy the output → ANCHR_STORACHA_PROOF
```

**3. Copy `.env.example` to `.env`** and fill in:
- `ANCHR_STORACHA_KEY` / `ANCHR_STORACHA_PROOF` (from step 2)
- `ANCHR_WALLET_SECRET_KEY` — the Solana wallet that owns your `.sol` domain,
  as a JSON array (paste the contents of a Solana CLI keypair file)

**4. Install dependencies:**

```bash
npm install
```

## Usage

```bash
anchr init      # detects your framework, writes anchr.json
anchr deploy    # builds + pins to IPFS; also writes the SNS record if
                # anchr.json has a "domain" set (optional — omit it to
                # just get a pinned CID + gateway link)
```

## ⚠️ Before running against a real domain

Test against a **devnet** domain first (set `ANCHR_SOLANA_RPC_URL` to
`https://api.devnet.solana.com` in `.env`). The SNS write path
(`lib/sns.js`) combines two separately-documented pieces of Bonfida's SDK
that weren't shown together in a single verified example — it should work,
but confirm it on devnet before pointing it at a mainnet domain you care
about. After deploying, use `readIpfsRecord()` to confirm the record
actually landed correctly before trusting the CLI's own success message.

## Relative asset paths (important)

IPFS serves your site from a `/ipfs/<CID>/` subpath, not domain root — so
default absolute asset paths will produce a **blank page**, even though
the deploy itself succeeds. Confirmed via a real deploy: Vite needs
`base: './'` in `vite.config.js` (`anchr init` prints this as a note
when it detects Vite). CRA needs `"homepage": "."` in `package.json`.
Next.js likely needs a similar `assetPrefix` fix but this hasn't been
confirmed with a real deploy yet.

## Alternate pinning provider (Filebase)

Storacha is the default, but if its upload endpoint is unreachable, set
`"provider": "filebase"` in `anchr.json` and fill in the Filebase env vars
in `.env` (see `.env.example`) instead. It uses Filebase's S3-compatible
upload path under the hood (`@filebase/sdk`'s `ObjectManager`), not their
IPFS Pinning Service API — that API is for re-pinning an *existing* CID,
not uploading new local content, so it doesn't fit Anchr's use case.

This is a fallback switch, not a "run both" setup — only one provider is
active per deploy, matching the MVP's "one pinning provider" scope.

## Known prior art

`Bonfida/sns-deploy` did something similar back in 2021 (Infura pinning +
raw wallet.json path, no CI integration, no framework detection). Anchr's
differentiation: modern pinning via Storacha/UCAN, automatic framework
detection, and a CI-friendly credential model — built for a GitHub-push
deploy flow rather than a one-off manual CLI run.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) — note that MVP scope is intentionally
locked, so check [docs/ROADMAP.md](docs/ROADMAP.md) before proposing new
features. This project follows the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md).

## Security

Handling a Solana wallet key and IPFS upload credentials — see
[SECURITY.md](SECURITY.md) before reporting anything sensitive, and for
guidance on keeping the signing wallet scoped to just this domain.

## License

MIT — see [LICENSE](LICENSE).
