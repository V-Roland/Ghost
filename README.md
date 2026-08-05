# Ghost Interview Copilot

Ghost is a human-in-the-loop interview workspace prototype for preparing questions, organizing evidence, reviewing integrity signals, and archiving interview artifacts. It supports interviewer judgment; it does not make hiring decisions.

## Architecture

```text
React + Vite
  ├─ Supabase Auth (email/password session)
  └─ Express API (Supabase bearer token)
       └─ Supabase Postgres + Row Level Security
            └─ Private Supabase Storage bucket
```

- **Frontend:** React screens, bottom navigation, profile menu, workflow, and archive.
- **API:** Express validation and lifecycle endpoints. It verifies access tokens with Supabase Auth and executes requests through a user-scoped Supabase client.
- **Database:** PostgreSQL tables with foreign keys, ownership constraints, indexes, triggers, and RLS.
- **Authentication:** Supabase Auth owns credentials, password hashing, session issuance, and refresh tokens.
- **Storage:** `interview-files` is private; object paths must begin with the authenticated user's UUID.

## Requirements

- Node.js 20+
- npm 10+
- Supabase CLI for migrations
- Docker Desktop only when using the local Supabase stack
- A Supabase project for hosted development

## Quick Start

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env` and `apps/frontend/.env.example` to `apps/frontend/.env`.

3. Fill in:

   ```text
   SUPABASE_URL
   SUPABASE_PUBLISHABLE_KEY
   SUPABASE_SERVICE_ROLE_KEY
   VITE_SUPABASE_URL
   VITE_SUPABASE_PUBLISHABLE_KEY
   ```

   The two `VITE_` values are browser-visible. Never put `SUPABASE_SERVICE_ROLE_KEY` in a `VITE_` variable.

4. Link and migrate a hosted Supabase project:

   ```bash
   supabase login
   supabase link --project-ref <project-ref>
   npm run supabase:preflight
   npm run supabase:push
   npm run supabase:verify
   ```

5. Start both applications in separate terminals:

   ```bash
   npm run dev:api
   npm run dev
   ```

6. Open `http://localhost:5173` and sign in with a user created through Supabase Auth.

See `docs/SUPABASE.md` for local development, hosted configuration, optional demo seeding, password settings, and deployment checks.

## Data Isolation

Every application-owned row has a UUID `user_id` tied to `auth.users(id)`. RLS policies compare that owner with `(select auth.uid())` for reads and writes. Composite foreign keys include `user_id`, preventing a child record owned by Sally from referencing Nick's interview even when a UUID is known.

The API repeats owner predicates as defense in depth, but PostgreSQL RLS is the authorization boundary. The browser never receives a service-role key. Audit events are append-only to authenticated users and are written by database triggers.

## Database Lifecycle

The source of truth is `supabase/migrations/20260805000100_ghost_schema.sql`.

| Command | Purpose |
|---|---|
| `npm run supabase:preflight` | Validate the project URL and server-only admin credential. |
| `npm run supabase:push` | Apply pending migrations to the linked project. |
| `npm run supabase:seed` | Create isolated demo Auth users and records in an explicitly approved disposable project. |
| `npm run supabase:verify` | Verify tables and the private storage bucket. |
| `npm run supabase:verify-isolation` | Prove two-user table, foreign-key, and Storage isolation in a disposable project. |
| `npm run supabase:reset-local` | Rebuild the local database from migrations and `supabase/seed.sql`. |

Demo seeding requires `ALLOW_DEMO_SEED=true`, two 15+ character demo passwords, and `ALLOW_REMOTE_DEMO_SEED=true` for any non-local target. Isolation checks require their own `ALLOW_RLS_TESTS` flags. Never seed or run mutating checks against production.

## Repository Layout

```text
apps/
  api/
    src/lib/             API projections, validation, error mapping
    src/middleware/      Supabase access-token verification
    src/routes/          Archive, interview, and profile endpoints
    src/services/        Supabase client construction
  frontend/
    src/app/             Application composition
    src/assets/          Icons grouped by feature
    src/components/      Shared UI components
    src/domain/          Pure domain transformations
    src/hooks/           Profile/session hooks
    src/screens/         Home, archive, workflow, profile, settings
    src/services/        Auth, archive, and Supabase adapters
    src/styles/          Styles grouped by concern
docs/                    API, database, development, guardrails, UI
scripts/                 Setup, verification, repository checks
supabase/                CLI config, migrations, and seed entrypoint
```

## Quality Checks

```bash
npm run check
npm run build
```

`npm run check` verifies required project structure, security/product guardrails, API behavior, archive mapping, and Supabase schema invariants. A live database check additionally requires a running local stack or configured hosted project.

## Security and Product Boundaries

- Use only the publishable key in browser code; service-role keys bypass RLS.
- Treat interview content as sensitive hiring data.
- Keep object storage private and return controlled access rather than public URLs.
- Require human review of generated questions, summaries, reports, and integrity signals.
- Do not present automated conclusions, hiring recommendations, or candidate scores.
- Define retention, deletion, access review, incident response, and legal/privacy approval before pilot use.

Read `SECURITY.md` and `docs/GUARDRAILS.md` before implementing production integrations.

## Documentation

- `docs/SUPABASE.md` — Supabase setup, migrations, keys, Auth, seed, and verification
- `docs/EER.md` — relational model and ownership constraints
- `docs/API.md` — bearer-authenticated Express endpoints
- `docs/DEVELOPMENT.md` — development workflow and validation
- `docs/GUARDRAILS.md` — product, privacy, and AI safety requirements
- `docs/UI_SPEC.md` — navigation and interface behavior
- `CONTRIBUTING.md` — change and review expectations
