# @fictjs/hooks

Official hooks package for Fict.

## Requirements

- Node.js >= 18

## Setup

```bash
npm install
```

## Scripts

- `npm run dev`: watch mode build with tsup
- `npm run build`: build ESM + CJS + d.ts to `dist`
- `npm run typecheck`: TypeScript type checking
- `npm run lint`: ESLint check
- `npm run test`: run unit tests with Vitest
- `npm run format`: format files with Prettier

## Publish safety

`prepublishOnly` runs:

1. `npm run lint`
2. `npm run typecheck`
3. `npm run test`
4. `npm run build`

## Entry

Current package entry is `src/index.ts`. Add and export official Fict hooks from this file.
