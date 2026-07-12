# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- Nothing yet.

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
