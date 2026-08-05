# AGENTS.md

## Scope

These instructions apply to the entire repository.

## Architecture

- `apps/frontend`: React/Vite UI. Keep screens, reusable components, domain logic, services, styles, and assets in separate feature folders.
- `apps/api`: Express API. It verifies Supabase bearer tokens and uses request-scoped clients so PostgreSQL RLS remains active.
- `supabase`: PostgreSQL migrations, Auth-related triggers, storage policies, CLI configuration, and seed entrypoint.
- `scripts`: Supabase administration helpers and repository checks.
- `docs`: current architecture, setup, API, UI, security, and product guardrails.

## Required Practices

- Derive identity only from a Supabase-verified access token. Never accept `user_id`, owner, role, or access scope from request bodies or custom headers.
- Add `user_id uuid not null default auth.uid()` to owned tables, reference `auth.users(id)`, enable and force RLS, and add `USING` plus `WITH CHECK` policies.
- Include `user_id` in parent/child foreign keys so cross-owner references fail at the database layer.
- Never expose `SUPABASE_SERVICE_ROLE_KEY` or any secret through `VITE_` variables, frontend code, logs, fixtures, or docs.
- Keep passwords and sessions in Supabase Auth. Do not create application password-hash or session tables.
- Keep audit events append-only to authenticated users and storage buckets private.
- Preserve human-in-the-loop language. Ghost may surface evidence for review but must not make hiring decisions or label misconduct as fact.
- Keep changes focused and preserve separation of concerns.

## Data Model Changes

When changing the schema, update all of:

- a new file under `supabase/migrations`;
- `docs/EER.md` and `docs/SUPABASE.md`;
- seed/verification scripts when affected;
- schema tests and relevant API/frontend tests.

Never edit a migration already applied to a shared project. Add a forward migration instead.

## Validation

Run:

```bash
npm run check
npm run build
```

For database changes, also run `npm run supabase:reset-local` with Docker available, or `npm run supabase:push` and `npm run supabase:verify` against a disposable linked project. Never run demo seed or destructive reset commands against production.
