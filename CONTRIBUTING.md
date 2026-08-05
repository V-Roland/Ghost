# Contributing

## Before You Start

- Use Node.js 20+ and npm 10+.
- Read `AGENTS.md`, `SECURITY.md`, and `docs/GUARDRAILS.md`.
- Copy the environment examples, but never commit populated `.env` files.
- Use a local or disposable Supabase development project for schema work.

## Change Design

- Keep screens, components, assets, domain transformations, services, and styles separated by concern.
- Put runtime validation at trust boundaries.
- Treat PostgreSQL RLS as mandatory, not optional defense in depth.
- Keep API queries user-scoped even when RLS already applies.
- Use Supabase Auth for credential and session behavior; do not implement custom password storage.
- Use forward-only migrations. Do not rewrite migrations already applied to a shared environment.

## Database Changes

1. Create a timestamped SQL migration under `supabase/migrations`.
2. Add ownership columns, foreign keys, indexes, grants, and RLS policies.
3. Update `docs/EER.md`, `docs/SUPABASE.md`, seed logic, and verification logic.
4. Add or update schema tests.
5. Apply the migration locally with `npm run supabase:reset-local` when Docker is available.

`SUPABASE_SERVICE_ROLE_KEY` is server-only and bypasses RLS. Never place it in browser source or a `VITE_` variable. Demo seeding is blocked unless explicitly enabled and must never target production.

## Validation

Before requesting review, run:

```bash
npm run check
npm run build
```

If Supabase is available, also run:

```bash
npm run supabase:preflight
npm run supabase:verify
```

## Pull Requests

- Explain behavior and security-boundary changes.
- Identify migrations and rollback/forward-fix considerations.
- Include testing performed and any unavailable live checks.
- Confirm no secrets, real candidate data, or public storage URLs are included.
- Confirm generated content and integrity signals remain subject to human review.
