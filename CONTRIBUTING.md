# Contributing

Thanks for wanting to help. This repository is the library. The live demo is
[react-map-annotate-demo.onrender.com](https://react-map-annotate-demo.onrender.com/).
The files in [`examples/`](./examples) are copy-paste snippets, not a project.

## Ground rules

- Read the [code of conduct](./CODE_OF_CONDUCT.md).
- Open an issue before a large API change. The session contract we try not to
  break is `Annotation[]`, `setTool`, `finish`, and `onChange`.
- Keep drawing logic in `src/core` and `src/session`. Map engines should only
  paint.
- Match the surrounding code. Do not add a new abstraction where a small hook
  change would do.

## Setup

Node 20 or 22. From the repo root:

```bash
npm install
npm run check
```

`check` is typecheck, lint, Prettier, and Vitest. That is what CI runs on
`main` and on pull requests.

## Pull requests

1. Branch from `main`.
2. Add or update tests next to the code you change (`*.test.ts` / `*.test.tsx`).
3. If you change behavior, update the README recipe or the matching file in
   `examples/`.
4. Run `npm run check`.
5. Use the pull request template. Say why, not only what.

## Releases

Version numbers live in `package.json`. Changelog entries go in
[`CHANGELOG.md`](./CHANGELOG.md). GitHub Releases should match that file.
