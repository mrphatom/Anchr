# Testing Anchr locally

This repo doesn't ship a pre-built example project (keeps the repo light) —
here's the fastest way to get a real static site to test against.

```bash
npm create vite@latest anchr-test-site -- --template vanilla
cd anchr-test-site
npm install

# adjust the path below to wherever you cloned this repo
node ../anchr-cli/bin/anchr.js init
```

Edit the generated `anchr.json` to set your `.sol` domain (no `.sol` suffix),
then:

```bash
node ../anchr-cli/bin/anchr.js deploy
```

Want a permanent example fixture committed to the repo instead? That'd make
a good first contribution — see `CONTRIBUTING.md`.
