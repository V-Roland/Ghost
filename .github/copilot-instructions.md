# GitHub Copilot Instructions

Ghost is a human-in-the-loop interview workspace built with React/Vite, Express, and Supabase.

## Architecture

- Frontend concerns are separated under `apps/frontend/src`: app, screens, components, domain, hooks, services, assets, and styles.
- API routes use `authenticateRequest`, verified Supabase bearer tokens, and `req.supabase` user-scoped clients.
- PostgreSQL schema, RLS, triggers, and private Storage policies live under `supabase/migrations`.
- Supabase Auth owns password hashing and sessions.

## Security Requirements

- Never trust body/header `user_id`, role, tenant, or ownership claims.
- Never expose or use `SUPABASE_SERVICE_ROLE_KEY` in browser code or ordinary user traffic.
- Every owned table needs `user_id`, composite ownership foreign keys, indexes, grants, forced RLS, and `auth.uid()` policies.
- Keep Storage private with the user UUID as the first object-path segment.
- Do not implement custom password hashes, credential tables, or session tables.
- Do not include real candidate or interview data in code, prompts, logs, or tests.

## Product Requirements

- Ghost supports human review; it does not make hiring decisions.
- Integrity signals are review-only observations, not accusations.
- Avoid candidate ranking, automated rejection, protected-trait inference, or final scores.

## Validation

Run `npm run check` and `npm run build`. Apply database migrations to a disposable Supabase stack and test with two users when database behavior changes.
