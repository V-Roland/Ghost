# AI Agent Working Prompts

Use these scoped prompts when delegating implementation work. `AGENTS.md`, `SECURITY.md`, and `docs/GUARDRAILS.md` remain authoritative.

## Shared Context

```text
Ghost is a human-in-the-loop interview workspace.
Frontend: React + Vite.
API: Express with verified Supabase bearer tokens.
Database: Supabase PostgreSQL with native row-level security.
Authentication/password hashing: Supabase Auth.
Files: private Supabase Storage.

Never accept ownership from request input. Never expose a service-role key. Never make hiring decisions or state integrity conclusions as fact. Keep every feature separated into screen, component, domain, service, asset, and style paths as appropriate.
```

## Frontend Agent

```text
Modify only the React/Vite surface needed for the task.

- Keep page screens under src/screens and reusable UI under src/components.
- Keep API/Auth adapters under src/services and pure transformations under src/domain.
- Keep icons and other assets in feature-specific folders under src/assets.
- Use the existing bottom navigation and profile menu patterns.
- Use Supabase Auth for session behavior.
- Do not add profile switching or client filters as authorization controls.
- Show loading, empty, error, focus, and disabled states.
- Preserve review-only hiring language.

Run frontend tests and npm run build.
```

## API Agent

```text
Modify the Express API without weakening the Supabase trust boundary.

- Require authenticateRequest for every /api route.
- Derive userId only from auth.getUser(accessToken).
- Execute data calls with req.supabase, which carries the caller JWT.
- Repeat .eq('user_id', req.auth.userId) for defense in depth.
- Allowlist body properties and normalize inputs.
- Map database errors to safe HTTP errors.
- Do not use SUPABASE_SERVICE_ROLE_KEY for user traffic.
- Do not add password or session tables/endpoints.

Run API tests and update docs/API.md.
```

## Supabase Agent

```text
Implement changes as forward PostgreSQL migrations.

- Owned tables use user_id uuid not null default auth.uid().
- Reference auth.users(id) and include user_id in composite parent/child foreign keys.
- Add indexes for ownership and foreign-key query paths.
- Enable and force RLS.
- Add authenticated USING and WITH CHECK policies based on (select auth.uid()).
- Revoke anonymous grants.
- Keep audit logs append-only and storage private.
- Never put service-role secrets in frontend configuration.

Update docs/EER.md, docs/SUPABASE.md, verification/seed scripts, and schema tests. Apply locally and perform two-user isolation checks when Docker is available.
```

## Security Review Agent

```text
Review authentication, authorization, data exposure, storage, validation, audit, and hiring-safety changes.

Look for:
- missing or permissive RLS;
- service-role use in browser or user requests;
- owner IDs accepted from clients;
- cross-owner foreign keys;
- public buckets or durable signed URLs;
- credential/token logging;
- unsafe file handling;
- unbounded input or raw database errors;
- automated hiring or misconduct conclusions;
- missing retention, deletion, accessibility, and human-review controls.

Report findings by severity with file paths and concrete remediation. Do not claim live verification unless it was run.
```
