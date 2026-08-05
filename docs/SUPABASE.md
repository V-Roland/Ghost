# Supabase Setup and Operations

## Source of Truth

Ghost uses Supabase Auth, PostgreSQL, PostgREST, and private Storage. The checked-in source of truth is:

- `supabase/config.toml` for local service behavior;
- `supabase/migrations` for schema, triggers, grants, and RLS;
- `supabase/seed.sql` for local SQL seed entry;
- `scripts/seedSupabase.js` for optional Auth-aware demo data;
- `scripts/verifySupabase.js` for post-deployment checks.

Do not create production tables manually in the dashboard. Capture changes in forward migrations.

## Keys and Environment

Copy `.env.example` to `.env`:

```text
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_PUBLISHABLE_KEY=<publishable-key>
SUPABASE_SERVICE_ROLE_KEY=<server-only-secret>
```

Copy `apps/frontend/.env.example` to `apps/frontend/.env`:

```text
VITE_API_BASE_URL=http://localhost:7071
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<publishable-key>
```

The publishable key is designed for public clients when RLS is correctly enabled. The service-role key bypasses RLS and must never appear in browser code, `VITE_` variables, source control, logs, screenshots, or client-delivered configuration.

## Hosted Project Initialization

1. Create a Supabase project and retain its project reference.
2. Configure Auth URL settings:
   - Site URL: the deployed frontend URL.
   - Redirect URLs: only approved local, preview, and production origins.
3. Configure email/password Auth:
   - minimum password length of at least 15 for this prototype;
   - secure password change enabled;
   - leaked-password protection where the project plan supports it;
   - production SMTP, rate limits, email confirmation, and recovery flows before pilot use.
4. Link the CLI and validate credentials:

   ```bash
   supabase login
   supabase link --project-ref <project-ref>
   npm run supabase:preflight
   ```

5. Review pending SQL and apply migrations:

   ```bash
   supabase db diff --linked
   npm run supabase:push
   npm run supabase:verify
   ```

6. Create initial users through Supabase Auth or the guarded demo seed script.

## Local Development

Docker Desktop must be running:

```bash
supabase start
supabase status -o env
npm run supabase:reset-local
```

Map local CLI output to the environment variables in the examples. The local config uses port `5173` redirects, a 15-character password minimum, and secure password changes.

Stop the stack with `supabase stop`. A local reset is destructive to local data and rebuilds the database from migrations and `supabase/seed.sql`.

## Optional Demo Users

The JavaScript seed uses `auth.admin.createUser`, allowing Supabase Auth—not application code—to perform password hashing and credential storage. It then stamps every demo row with that Auth user's UUID.

Required controls:

```text
ALLOW_DEMO_SEED=true
DEMO_USER_PASSWORD=<15+ characters>
DEMO_SECONDARY_USER_PASSWORD=<15+ characters>
```

Non-local URLs are rejected unless `ALLOW_REMOTE_DEMO_SEED=true`. Enable that only for a disposable development project. Never run demo seeding against production or a shared environment containing real data.

```bash
npm run supabase:seed
npm run supabase:verify
```

To execute a real two-user boundary test, additionally set `ALLOW_RLS_TESTS=true` and run:

```bash
npm run supabase:verify-isolation
```

Non-local projects also require `ALLOW_REMOTE_RLS_TESTS=true`. The check proves Sally's row is invisible to Nick, owner spoofing is rejected, a cross-owner foreign key fails, and Sally's private Storage object cannot be downloaded by Nick. It creates temporary records and cleans them up; trigger-generated audit entries remain.

## RLS Design

- `profiles.id` equals `auth.users.id`.
- The migration backfills profiles for existing Auth users and creates future profiles with an Auth trigger.
- Every other owned table has `user_id uuid not null default auth.uid()`.
- RLS is enabled and forced on all `public` application tables.
- Policies compare owners with `(select auth.uid())`.
- `WITH CHECK` prevents inserting or moving rows to another user.
- Composite foreign keys include `user_id`, preventing cross-user parent references.
- Anonymous table grants are revoked.
- Audit events are append-only to users and written by triggers.
- API requests use the caller's JWT; they never use the service role.
- The profile `role` is display metadata and is not an authorization claim; authorization comes from Auth identity and RLS.

Adding a table to `public` without RLS is a release blocker. Add the table, index, grants, policy, schema test, EER entry, and seed/verification updates in the same change.

## Storage Design

`interview-files` is private with a 50 MB per-object limit. Allowed object names begin with:

```text
<auth-user-uuid>/<interview-uuid>/<filename>
```

Storage policies compare the first path segment to `auth.uid()`. Application metadata repeats this ownership prefix. Use signed URLs only for short, purpose-limited access and never persist them as database records.

## Production Checklist

- [ ] Migrations applied from CI/CD or a controlled release process
- [ ] RLS and grants reviewed for every exposed table
- [ ] Service-role key stored only in server-side secret management
- [ ] Auth URLs, email confirmation, SMTP, rate limits, password controls, and MFA reviewed
- [ ] Storage bucket private and object policies tested with two real users
- [ ] Sally cannot read, mutate, reference, or list Nick's rows or objects
- [ ] Access-token lifetime and global sign-out behavior reviewed
- [ ] Backups, point-in-time recovery, retention, deletion, and incident response configured
- [ ] API CORS, CSP, monitoring, and abuse controls configured
- [ ] No real sensitive hiring data used in development or logs

## Verification

`npm run supabase:verify` uses the service role only as an administrative smoke test. It checks that each expected table is queryable and that `interview-files` exists and is private. `npm run supabase:verify-isolation` is the two-user RLS integration check.

Run the complete repository checks as well:

```bash
npm run check
npm run build
```

References: [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [password security](https://supabase.com/docs/guides/auth/password-security), [API security](https://supabase.com/docs/guides/api/securing-your-api), and [Storage access control](https://supabase.com/docs/guides/storage/security/access-control).
