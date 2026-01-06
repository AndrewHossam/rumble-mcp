# Contributing to Rumble MCP

This document covers the development workflow, code quality tools, and contribution guidelines.

## Development Setup

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build
```

## Code Quality Tools

### ESLint (Linting)

TypeScript linting with strict rules configured in `eslint.config.js`.

```bash
npm run lint        # Check for issues
npm run lint:fix    # Auto-fix issues
```

### Prettier (Formatting)

Code formatting configured in `.prettierrc`.

```bash
npm run format        # Format all files
npm run format:check  # Check formatting without changes
```

### Vitest (Testing)

Unit testing with 80% coverage thresholds configured in `vitest.config.ts`.

```bash
npm run test           # Run tests once
npm run test:watch     # Run tests in watch mode
npm run test:coverage  # Run with coverage report
npm run test:integration  # Run integration tests
```

### TypeScript

Type checking without emitting files.

```bash
npm run typecheck
```

### Full Validation

Run all checks in sequence:

```bash
npm run validate  # lint → format:check → typecheck → test
```

---

## Git Hooks (Husky)

### Pre-commit Hook

Runs automatically when you commit:
- **ESLint** - Auto-fixes linting issues on staged files
- **Prettier** - Auto-formats staged files

### Commit Message Hook

Enforces [Conventional Commits](https://www.conventionalcommits.org/) format.

#### Commit Message Format

```
<type>: <description>
```

#### Allowed Types

| Type | Description |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `style` | Formatting, no code change |
| `refactor` | Code restructure (no behavior change) |
| `perf` | Performance improvement |
| `test` | Adding tests |
| `build` | Build system changes |
| `ci` | CI configuration |
| `chore` | Maintenance tasks |
| `revert` | Revert changes |

#### Examples

```bash
# Good ✅
git commit -m "feat: add new portfolio analysis tool"
git commit -m "fix: handle null response from API"
git commit -m "docs: update installation instructions"

# Bad ❌
git commit -m "added stuff"
git commit -m "WIP"
git commit -m "Fix bug"  # Subject must be lowercase
```

---

## CI/CD Pipeline

### CI Workflow (`ci.yml`)

Runs on every PR and push to main:

1. Install dependencies
2. **Lint** - ESLint check
3. **Format** - Prettier check
4. **Type check** - TypeScript validation
5. **Tests** - Vitest with coverage
6. **Build** - Compile TypeScript
7. **Security audit** - npm audit

### Release Workflow (`release.yml`)

Runs on push to main branch:

1. All validation steps from CI
2. **Semantic Release** - Analyzes commits, determines version bump
3. **Publish** - Publishes to npm with provenance
4. **GitHub Release** - Creates release with changelog

#### Version Bumping

| Commit Type | Version Bump | Example |
|-------------|--------------|---------|
| `fix:` | Patch (1.0.X) | 1.4.2 → 1.4.3 |
| `feat:` | Minor (1.X.0) | 1.4.2 → 1.5.0 |
| `feat!:` or `BREAKING CHANGE:` | Major (X.0.0) | 1.4.2 → 2.0.0 |

#### Commits That Don't Trigger Release

`chore:`, `docs:`, `style:`, `refactor:`, `test:`, `ci:`

These are included in the next release's changelog but don't trigger a version bump on their own.

---

## Dependency Management (Renovate)

Configured in `renovate.json`:

| Update Type | Auto-merge | Notes |
|-------------|------------|-------|
| Patch | ✅ Yes | e.g., 1.0.1 → 1.0.2 |
| Minor (devDeps) | ✅ Yes | e.g., 1.0.0 → 1.1.0 |
| Major | ❌ Manual | Requires review |

Updates are grouped and run on a weekly schedule.

---

## Project Structure

```
rumble-mcp/
├── src/
│   ├── __tests__/       # Unit tests
│   ├── api/             # API client and token management
│   ├── tools/           # MCP tool implementations
│   ├── types/           # TypeScript type definitions
│   └── index.ts         # Main entry point
├── .github/
│   └── workflows/       # CI/CD workflows
├── .husky/              # Git hooks
├── dist/                # Compiled output (git-ignored)
└── coverage/            # Test coverage reports (git-ignored)
```

---

## Adding New Features

1. Create a branch: `git checkout -b feat/my-feature`
2. Make changes with proper commit messages
3. Push and create a PR
4. CI will validate automatically
5. Merge to main triggers automatic release (if `feat:` or `fix:` commits)
