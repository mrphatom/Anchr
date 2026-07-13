# Contributing to Anchr

Thanks for your interest in Anchr! This project is currently in early MVP
stage — scope is intentionally locked down (see `docs/ROADMAP.md`), so the
most useful contributions right now are bug fixes, documentation, and tests
rather than new features.

## MVP scope (please read before proposing features)

The MVP is deliberately narrow:
- Frameworks: Vite, Next.js (static export), Create React App
- Pinning: Storacha only
- Domains: SNS (`.sol`) only, V1 record format

Multi-provider pinning, ENS/Unstoppable Domains, custom domains, and an
env-var/logs UI are all planned for later versions. Feature requests in these
areas are welcome as issues for discussion, but PRs implementing them before
the MVP is stable will likely be deferred.

## Development setup

```bash
git clone https://github.com/mrphatom/anchr.git
cd anchr
npm install
cp .env.example .env   # fill in your own credentials — see README.md
```

Run the linter and tests before opening a PR:

```bash
npm run lint
npm test
```

## Pull requests

1. Fork the repo and create a branch off `main`
2. Keep PRs small and focused — one logical change per PR
3. Update `CHANGELOG.md` under an "Unreleased" heading
4. Make sure `npm run lint` and `npm test` pass
5. Describe *what* changed and *why* in the PR description

## Reporting bugs

Use the bug report issue template. Include your Node version, OS, and the
exact command/output where possible.

## A note on on-chain and credential-touching code

Anything touching `lib/sns.js` (Solana transactions) or `lib/storacha.js`
(upload credentials) gets extra scrutiny before merging — mistakes here can
cost real funds or leak credentials. If you're touching those files, please
test against Solana **devnet** and a throwaway Storacha space first, and say
so explicitly in your PR description.
