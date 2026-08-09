# Product and Engineering Guardrails

## Product Boundary

Ghost is a human-in-the-loop interview aid. It may organize approved evidence, draft role-relevant questions, summarize interviewer-provided material, and surface review-only integrity signals. It must not make hiring decisions, rank candidates, issue a final hiring score, automatically reject anyone, or present misconduct as established fact.

Every generated question, summary, report, and signal requires human review. Interfaces must make uncertainty, source evidence, and reviewer control visible.

## Sensitive Data

Interview records, resumes, transcripts, recordings, notes, reports, and identity information are sensitive hiring data.

- Collect only what the approved workflow requires.
- Do not use real candidate data in development, tests, screenshots, prompts, or logs.
- Keep files in private access-controlled storage.
- Require an explicit user-selected destination for local exports and treat exported copies as sensitive hiring data.
- Never grant web content unrestricted filesystem access; executable wrappers must mediate downloads and require an explicit user-selected save destination.
- Never publish raw object URLs, tokens, API keys, database credentials, or service-role secrets.
- Define retention, deletion, export, legal hold, and subject-request procedures before pilot use.
- Redact or minimize prompt payloads sent to future AI providers.

## Authentication and Password Hashing

Supabase Auth is the only password and session authority. It performs password hashing and credential storage. Application tables must never contain passwords, password hashes, recovery tokens, or refresh tokens. Hosted Auth settings must enforce strong passwords, secure change/recovery flows, rate limits, and leaked-password protection where available. Microsoft Entra ID and MFA remain recommended for enterprise deployment.

## Row-Level Security

All exposed owned tables require PostgreSQL row-level security tied to `(select auth.uid())`. Read/update/delete policies use `USING`; insert/update policies use `WITH CHECK`. RLS must be enabled and forced. Anonymous grants are revoked.

Every parent/child ownership relationship includes `user_id` in its foreign key. API queries repeat the verified user predicate, but client filtering and API predicates never replace RLS. Service-role credentials bypass RLS and are prohibited from browser code and normal end-user request handling.

## Storage Security

The `interview-files` bucket stays private. The first object path segment equals the authenticated user UUID. Upload, read, update, and delete policies enforce that path. Downloads must use short-lived, purpose-limited access. File type, size, malware scanning, quarantine, and content-disposition controls are required before production uploads.

## AI and Integrity Signals

- Signals are observations for review, not accusations or truth claims.
- Display the underlying evidence and method limitations.
- Require a reviewer to confirm, dismiss, or annotate a signal.
- Do not infer protected characteristics, emotion, disability, health, or personality.
- Do not use face analysis, voice analysis, or behavioral biometrics without separate legal, ethical, security, and accessibility approval.
- Preserve original evidence and an audit trail for material edits.

## Engineering Gates

A change cannot ship when it:

- adds a public table without RLS and tests;
- accepts an owner ID from request input;
- uses a service-role client for user traffic;
- creates public storage for interview artifacts;
- weakens authentication, CORS, validation, or error redaction;
- introduces automated candidate scoring or decision language;
- bypasses human review;
- omits retention/privacy impact for a new data type.

Run `npm run check` and `npm run build`. Database changes additionally require migration execution against disposable Postgres and a two-user isolation test.
