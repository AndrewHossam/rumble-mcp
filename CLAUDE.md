# Rumble MCP — AI Agent Rules

This file is loaded automatically by Claude Code and other AI coding tools. Follow all rules below without exception.

## TypeScript Quality Rules

- **No `any` types** — Always use proper TypeScript interfaces. If the API shape is unknown, define a minimal interface based on observed fields. The ESLint rule `@typescript-eslint/no-explicit-any` is set to `error`; the build will fail if you introduce `any`.
- **Type imports** — Use `import type` for type-only imports (e.g., `import type { Foo } from './foo.js'`).
- **No silent error swallowing** — Every `catch` block must either log the error or re-throw it. Empty `catch {}` blocks are forbidden.

## Testing Rules

- **Tests required for new code** — Every new function or module must have corresponding unit tests. Target 80%+ coverage on new code.
- **Run validation before committing** — Always run `npm run validate` (lint + format + typecheck + test) before any commit.

## Architecture Rules

- **Follow existing patterns** — New tools must follow the existing tool module pattern (schema + handler). Check `src/tools/fundamental.ts` as the reference implementation.
- **Prefer editing existing files** — Don't create new files unless the feature genuinely requires a new module.
- **No hardcoded secrets or API keys** — Use environment variables exclusively. Reference `.env.example` for required vars.

## Git Rules

- **Conventional commits** — All commits must use conventional commit format: `feat:`, `fix:`, `refactor:`, `chore:`, `docs:`, `test:`, etc.

## Project Commands Reference

| Command | Purpose |
|---|---|
| `npm run dev` | Run dev server |
| `npm run build` | Compile TypeScript |
| `npm run validate` | Full validation (lint + format + typecheck + test) |
| `npm run test:coverage` | Tests with coverage report |
| `npm run lint:fix` | Auto-fix lint issues |
