# API Reference

Browser-development base URL: `http://localhost:7071`. The Electron build embeds this API on a random `127.0.0.1` port and serves the frontend from the same origin.

## Authentication

All `/api/*` routes require:

```http
Authorization: Bearer <supabase-access-token>
```

The middleware verifies the token through Supabase Auth `getUser(token)`, derives `userId` from the verified user, and creates a request-scoped Supabase client carrying the token. Custom identity headers, tenant parameters, cookies, service-role runtime access, and body-supplied ownership are not supported.

Authentication, signup, recovery, refresh, logout, and password changes use Supabase Auth directly from the frontend. The Express API does not expose password endpoints and never handles password hashes.

## After-interview report

`POST /api/after-interview/ingest` accepts one transcript source: `{ "mode": "sample" }`, `{ "mode": "vtt", "vtt": "..." }`, or the server-only Graph adapter input `{ "mode": "graph", "graphMessageId": "..." }`. Unknown and ownership-related fields are rejected. Pasted VTT is limited to 200 KB and must contain at least one valid cue.

The response contains the selected source, normalized transcript segments, descriptive review signals, and evidence packets. Outputs require human interpretation and are not hiring decisions. See `docs/AFTER_INTERVIEW_REPORT_SCHEMA.md`.

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

Creates an owner-scoped interview workspace in one database transaction. The transaction creates or reuses the position, creates the interviewee and `Draft` interview, and inserts supplemental links, manual questions, and metadata for files already staged in private Storage. `user_id`, status, audit fields, and timestamps are database-controlled.

```json
{
  "interviewId": "2ed8f422-395f-45a9-8ad8-cf43f2411240",
  "jobPostingId": null,
  "jobPostingTitle": "Platform API Engineer",
  "department": "Engineering",
  "location": "New York, NY",
  "workArrangement": "Hybrid",
  "jobDescription": "Build and operate reliable platform APIs.",
  "candidateName": "Jordan Lee",
  "candidateEmail": "jordan@example.com",
  "candidateCurrentTitle": "Software Engineer",
  "candidateNotes": "Approved recruiter context.",
  "interviewDate": "2026-08-04",
  "archiveFolderId": "<optional-owned-directory-uuid>",
  "resumeNotes": "Distributed systems background.",
  "processingNotes": "Focus on debugging and architecture.",
  "supplementNotes": "Review the portfolio before the interview.",
  "supplementalLinks": [{ "label": "Portfolio", "url": "https://portfolio.example" }],
  "questions": [{ "prompt": "How would you design a resilient event API?" }],
  "files": [{
    "name": "job-posting.pdf",
    "fileType": "Job Posting",
    "sizeBytes": 2048,
    "storageObjectPath": "<auth-user-id>/<interview-id>/<object-name>"
  }],
  "tags": ["engineering", "remote"]
}
```

`workArrangement` accepts only `Hybrid`, `Remote`, or `In-Person`. Existing `jobPostingId` values must belong to the caller and match the supplied title. `archiveFolderId` is optional and must identify an owned root directory or a directory scoped to that same position; an interview cannot be nested inside another interview. Links accept only HTTP(S) URLs. Manual questions are stored as approved interviewer content; no model processing runs in this flow. File metadata is limited to 50 MB per object and must use the authenticated user's private workspace path. A `Job Posting` file is linked to the transaction's owned position by the database and marks that position as upload-backed; without one, the submitted manual fields remain the posting source. Ownership or role properties are rejected at every nesting level.

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

Returns the authenticated user's interviews ordered by `updated_at` descending, including the owned position fields and posting source metadata needed by the workflow selector. The archive UI groups by `job_posting_id`, with a title fallback for legacy rows.

### `GET /api/archive/interviews/:interviewId/files`

Returns metadata from `interview_files` for one visible interview. It does not stream objects or return service credentials. Future downloads must use private Storage access with short-lived authorization.

The frontend opens a file with a 60-second signed private Storage URL and downloads it through the authenticated Supabase client. Stored signed URLs are never written to the database.

### `GET /api/archive/folders`

Lists immediate custom folders for one exact scope. Optional query properties are `jobPostingId`, `interviewId`, and `parentFolderId`. Omitted values mean database `NULL`, so root, position, and interview folders cannot bleed into one another.

### `POST /api/archive/folders`

Creates a literal archive folder through the security-invoker `create_archive_folder` function:

```json
{
  "name": "Evidence",
  "jobPostingId": "<owned-position-uuid>",
  "interviewId": "<owned-interview-uuid>",
  "parentFolderId": null
}
```

All scope IDs are optional for a root folder. The function derives the owner from `auth.uid()`, validates the interview-to-position relationship, requires nested folders to remain in the same scope, and rejects duplicate sibling names. `userId` and other ownership properties are unsupported.

### `GET /api/archive/interview-directories`

Returns all owned root directories and, when `jobPostingId` is supplied, directories scoped to that owned position. Interview-scoped folders are excluded because an interview cannot be placed inside another interview. The Review screen uses this endpoint for its optional save directory.

### `GET /api/archive/folders/:folderId`

Returns one visible folder, its immediate child folders, interviews assigned directly to it, and file metadata assigned to it.

### `PATCH /api/archive/files/:fileId/folder`

Moves one visible interview file into a folder or back to the interview root:

```json
{ "folderId": "<same-interview-folder-uuid-or-null>" }
```

The API accepts no ownership or interview fields. RLS and the database folder trigger require the destination to belong to the same authenticated owner and interview.

### `GET /api/archive/export`

Returns a private, owner-filtered export manifest. It accepts at most one of `jobPostingId`, `interviewId`, or `folderId`. The manifest contains literal relative directory paths and private Storage metadata; the authenticated frontend downloads each object and packages the selected scope into one client-side ZIP archive.

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
