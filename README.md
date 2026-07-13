# Anchr CLI (MVP) 

[![CI](https://github.com/mrphatomanchr/actions/workflows/ci.yml/badge.svg)](https://github.com/mrphatom/anchr/actions/workflows/ci.yml)
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
examples/          how to spin up a test site to deploy against
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
# → edit anchr.json, set "domain" to your .sol domain (no ".sol" suffix)
anchr deploy    # builds, pins to Storacha, writes the SNS IPFS record
```

## ⚠️ Before running against a real domain

Test against a **devnet** domain first (set `ANCHR_SOLANA_RPC_URL` to
`https://api.devnet.solana.com` in `.env`). The SNS write path
(`lib/sns.js`) combines two separately-documented pieces of Bonfida's SDK
that weren't shown together in a single verified example — it should work,
but confirm it on devnet before pointing it at a mainnet domain you care
about. After deploying, use `readIpfsRecord()` to confirm the record
actually landed correctly before trusting the CLI's own success message.

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
