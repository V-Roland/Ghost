# API Reference

Base URL: `http://localhost:7071`

## Authentication

All `/api/*` routes require:

```http
Authorization: Bearer <supabase-access-token>
```

The middleware verifies the token through Supabase Auth `getUser(token)`, derives `userId` from the verified user, and creates a request-scoped Supabase client carrying the token. Custom identity headers, tenant parameters, cookies, service-role runtime access, and body-supplied ownership are not supported.

Authentication, signup, recovery, refresh, logout, and password changes use Supabase Auth directly from the frontend. The Express API does not expose password endpoints and never handles password hashes.

## Endpoints

### `GET /health`

Unauthenticated service health check:

```json
{ "status": "ok", "service": "ghost-api" }
```

### `GET /api/profile/me`

Returns the authenticated user's `profiles` row and verified Auth email.

### `PATCH /api/profile/me`

Updates only `displayName` and/or `themePreference` for the active user.

```json
{ "displayName": "Sally Chen", "themePreference": "light" }
```

### `POST /api/interviews`

Creates a `Draft` interview. `user_id`, status, IDs, audit fields, and timestamps are database-controlled.

```json
{
  "jobPostingTitle": "Platform API Engineer",
  "candidateName": "Jordan Lee",
  "interviewDate": "2026-08-04",
  "tags": ["engineering", "remote"]
}
```

Only those four properties are accepted. Titles and names are normalized and length-limited. Dates use `YYYY-MM-DD`. Tags are optional, deduplicated, capped at 20, and limited to 40 characters each.

### `PATCH /api/interviews/:interviewId/status`

Advances one approved lifecycle state:

```text
Draft -> UploadsComplete -> QuestionsReady -> InInterview -> Completed -> Archived
```

```json
{ "status": "UploadsComplete" }
```

The update includes the current status in its predicate to reduce lost-update races. RLS and owner predicates prevent access to another user's interview.

### `GET /api/archive/interviews`

Returns the authenticated user's interviews ordered by `updated_at` descending. The archive UI groups this flat result by job-posting title.

### `GET /api/archive/interviews/:interviewId/files`

Returns metadata from `interview_files` for one visible interview. It does not stream objects or return service credentials. Future downloads must use private Storage access with short-lived authorization.

## Errors

```json
{
  "error": {
    "code": "INVALID_STATUS_TRANSITION",
    "message": "An interview in Draft can only move to: UploadsComplete."
  }
}
```

- `400`: invalid or unsupported input
- `401`: missing, malformed, expired, or invalid access token
- `403`: CORS or RLS authorization failure
- `404`: route or visible resource not found
- `409`: uniqueness conflict or invalid lifecycle transition
- `500`: unexpected failure with internal details suppressed

## Transport Controls

Set `CORS_ORIGINS` to approved browser origins. Production defaults to no browser origins when the variable is unset. JSON request bodies default to `256kb`; upload large files directly to private object storage through a controlled flow.
