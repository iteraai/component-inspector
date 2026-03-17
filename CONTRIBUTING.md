# Contributing

Use the Node version from `.nvmrc` and install dependencies with `npm install`.

Before opening a change, run:

```bash
npm run build
npm run lint:ci
npm run type-check
npm run test
npm run test:pack
```

Keep changes scoped to the public SDK packages under `packages/`. This repository is intended to stay ready for future platform packages without changing the top-level layout.
