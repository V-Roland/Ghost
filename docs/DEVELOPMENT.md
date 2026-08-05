# Development Guide

## Runtime Topology

```text
Vite UI (5173) -------> Supabase Auth
      |
      +--------------> Express API (7071)
                            |
                            +--> Supabase Postgres/PostgREST under caller JWT + RLS

Private Supabase Storage <------ authenticated user path policies
```

## Setup

```bash
npm install
```

Copy `.env.example` to `.env` and `apps/frontend/.env.example` to `apps/frontend/.env`. The root file contains API and administrative settings. The frontend file contains only browser-safe values. Every `VITE_` variable is visible to users.

Use either:

- a hosted development Supabase project linked with `supabase link`; or
- the local Supabase stack with Docker Desktop and `supabase start`.

Apply migrations before starting the app. Detailed instructions are in `docs/SUPABASE.md`.

## Run

Terminal one:

```bash
npm run dev:api
```

Terminal two:

```bash
npm run dev
```

The API exits early when `SUPABASE_URL` or `SUPABASE_PUBLISHABLE_KEY` is missing. The UI presents a configuration error when its Supabase variables are missing.

## Validation

```bash
npm run check
npm run build
```

`npm run check` runs:

- repository structure validation;
- product/security wording checks;
- browser secret checks;
- API validation and authentication helpers;
- frontend archive transformations;
- static migration/RLS invariants.

For schema work, validate against real Postgres:

```bash
npm run supabase:reset-local
npm run supabase:verify
```

If Docker is unavailable, record that live migration validation was not run; static tests are not a replacement.

## Development Rules

- Keep each screen, component, service, domain module, asset, and style concern in its own path.
- Never add client-side profile switching as an authorization mechanism.
- Never accept owner identifiers from input.
- Never use a service-role client for an end-user API request.
- Add RLS, grants, ownership constraints, indexes, tests, and docs with every owned table.
- Use private Storage paths beginning with the authenticated user's UUID.
- Keep generated interview output review-only and human-in-the-loop.

## Schema Workflow

1. Create a new timestamped migration.
2. Apply it to a local disposable stack.
3. Run tests with two Auth users and attempt cross-user read, write, foreign-key, and Storage access.
4. Update `docs/EER.md`, `docs/SUPABASE.md`, scripts, and tests.
5. Review `supabase db diff --linked` before pushing to hosted development.

Do not rewrite shared migrations or use dashboard-only schema changes.

## Demo Seeding

The demo script is off by default and uses Supabase Auth admin APIs. It requires explicit flags and 15+ character passwords. Remote seeding requires a second explicit override. Do not use real people, candidate materials, or a production project.

## Troubleshooting

- **API startup fails:** verify root `SUPABASE_URL` and publishable key.
- **UI says Supabase is unconfigured:** verify `apps/frontend/.env` and restart Vite.
- **401 from API:** ensure the frontend and API point to the same Supabase project.
- **Empty archive:** verify the user owns rows and migration policies are applied.
- **403/RLS failure:** inspect policies and JWT identity; do not work around it with a service-role key.
- **Local CLI cannot inspect containers:** start Docker Desktop and ensure the daemon is accessible.
