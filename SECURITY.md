# Security Policy

## Reporting

Report suspected vulnerabilities privately to the project maintainers. Do not include real candidate records, credentials, tokens, or storage objects in an issue. Rotate any exposed key immediately and review Supabase Auth, database, storage, and API logs.

## Trust Boundaries

- The browser receives only `VITE_SUPABASE_URL` and a publishable key.
- Supabase Auth verifies credentials and issues access/refresh tokens.
- Express accepts only a `Bearer` access token and verifies it with `auth.getUser(token)`.
- The API creates a user-scoped Supabase client carrying that token; it does not use the service role for runtime user requests.
- PostgreSQL RLS is the data authorization boundary.
- `SUPABASE_SERVICE_ROLE_KEY` is restricted to trusted administration scripts because it bypasses RLS.

## Passwords and Sessions

Supabase Auth owns bcrypt password hashing with random salts, credential storage, session issuance, refresh-token rotation, and account recovery. Ghost does not store password hashes or session records in application tables. Local configuration requires 15-character passwords and secure password changes; hosted projects must configure equivalent or stronger Auth settings and enable leaked-password protection where available.

Password changes reauthenticate with Supabase Auth, update the credential through Supabase, and request global sign-out. Access tokens may remain valid until their short expiry, so production token lifetime, MFA, reauthentication, and revocation behavior require explicit review.

## Row-Level Security

Every exposed profile-owned table has RLS enabled and forced. Policies bind access to `(select auth.uid())`. Insert and update policies include `WITH CHECK`; reads, updates, and deletes include `USING`. Owned child relationships use composite foreign keys containing `user_id`, blocking cross-owner references independently of API code.

Profiles can read and update only their own row. Audit events are readable by their owner but are written through security-definer database triggers, not directly by authenticated clients. Anonymous table grants are revoked.

## Storage

The `interview-files` bucket is private. Storage RLS permits access only when the first object-path segment is the authenticated user's UUID. Database metadata also checks that `storage_object_path` begins with its row owner's UUID. Do not create public buckets or persist public object URLs for sensitive hiring data.

## Secret Handling

Never commit or expose:

- `SUPABASE_SERVICE_ROLE_KEY` or legacy service-role secrets;
- database passwords or direct connection strings;
- access tokens, refresh tokens, OAuth secrets, or MFA recovery data;
- candidate documents, transcripts, recordings, or reports;
- future Microsoft Graph, Microsoft Entra ID, or AI provider secrets.

Use environment-specific secret management, least privilege, rotation, and access logging. Any value prefixed `VITE_` is public to the browser bundle.

## API Controls

- Production CORS uses an explicit allowlist.
- JSON request bodies default to `256kb`; large files go to private object storage.
- Error responses avoid raw Supabase/Postgres details.
- Lifecycle transitions and accepted request properties are allowlisted.
- Owner fields are never accepted from request input.
- Rate limiting, abuse prevention, CSP, centralized monitoring, and distributed controls remain required before production.

## Hiring and AI Safety

Interview material is sensitive hiring data. Ghost is human-in-the-loop software and must not make hiring decisions, automatically reject candidates, infer protected characteristics, or present integrity signals as proven misconduct. Generated questions, summaries, reports, and signals require human review with traceable source evidence.

Before a pilot, complete a privacy/legal review, retention and deletion policy, role/access review, incident response plan, penetration test, model-risk review, bias/accessibility testing, and Microsoft Entra ID/MFA design where enterprise identity is required.

## References

- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase Password Security](https://supabase.com/docs/guides/auth/password-security)
- [Supabase API Security](https://supabase.com/docs/guides/api/securing-your-api)
- [Supabase Storage Access Control](https://supabase.com/docs/guides/storage/security/access-control)
- [NIST SP 800-63B](https://pages.nist.gov/800-63-4/sp800-63b.html)
