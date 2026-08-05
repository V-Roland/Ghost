# Ghost PostgreSQL EER

The physical schema is defined by `supabase/migrations`. Supabase Auth owns credentials and sessions in the `auth` schema; application records live in `public` and reference `auth.users(id)`.

```mermaid
erDiagram
  AUTH_USERS ||--|| PROFILES : has
  AUTH_USERS ||--o{ JOB_POSTINGS : owns
  AUTH_USERS ||--o{ INTERVIEWEES : owns
  AUTH_USERS ||--o{ INTERVIEWS : owns
  JOB_POSTINGS o|--o{ INTERVIEWS : describes
  INTERVIEWEES o|--o{ INTERVIEWS : attends
  INTERVIEWS ||--o{ DOCUMENTS : contains
  INTERVIEWS ||--o{ SUPPLEMENTAL_LINKS : references
  INTERVIEWS ||--o{ QUESTIONS : contains
  QUESTIONS ||--o{ QUESTION_RESPONSES : receives
  INTERVIEWS ||--o{ INTEGRITY_SIGNALS : surfaces
  INTERVIEWS ||--o{ INTERVIEW_FILES : stores
  INTERVIEWS ||--o{ REPORTS : produces
  INTERVIEWS ||--o{ TAGS : labels
  AUTH_USERS ||--o{ AUDIT_EVENTS : owns

  AUTH_USERS {
    uuid id PK
    text email
  }
  PROFILES {
    uuid id PK,FK
    text display_name
    text role
    text theme_preference
  }
  JOB_POSTINGS {
    uuid id PK
    uuid user_id FK
    text title
    text department
    text location
    text_array required_skills
  }
  INTERVIEWEES {
    uuid id PK
    uuid user_id FK
    text full_name
    text email
    text current_title
  }
  INTERVIEWS {
    uuid id PK
    uuid user_id FK
    uuid job_posting_id FK
    uuid interviewee_id FK
    text job_posting_title
    text candidate_name
    date interview_date
    text status
    text archive_path
    text_array tags
    text signal_level
  }
  DOCUMENTS {
    uuid id PK
    uuid user_id FK
    uuid interview_id FK
    text name
    text document_type
    text storage_object_path
  }
  SUPPLEMENTAL_LINKS {
    uuid id PK
    uuid user_id FK
    uuid interview_id FK
    text label
    text url
  }
  QUESTIONS {
    uuid id PK
    uuid user_id FK
    uuid interview_id FK
    int position
    text prompt
    text source
    boolean approved
  }
  QUESTION_RESPONSES {
    uuid id PK
    uuid user_id FK
    uuid interview_id FK
    uuid question_id FK
    text response_text
    text interviewer_notes
  }
  INTEGRITY_SIGNALS {
    uuid id PK
    uuid user_id FK
    uuid interview_id FK
    text signal_type
    text level
    jsonb evidence
    text review_status
  }
  INTERVIEW_FILES {
    uuid id PK
    uuid user_id FK
    uuid interview_id FK
    text name
    text file_type
    bigint size_bytes
    text storage_object_path
  }
  REPORTS {
    uuid id PK
    uuid user_id FK
    uuid interview_id FK
    text status
    jsonb content
  }
  TAGS {
    uuid id PK
    uuid user_id FK
    uuid interview_id FK
    text name
  }
  AUDIT_EVENTS {
    uuid id PK
    uuid user_id FK
    text event_type
    text entity_type
    uuid entity_id
    jsonb details
  }
```

## Ownership Invariants

- `profiles.id` is the Auth user UUID.
- Every owned table uses a non-null `user_id` referencing `auth.users(id)` with cascading account deletion.
- Owned parent tables expose a unique `(id, user_id)` key.
- Child foreign keys contain both the parent ID and `user_id`, so records cannot cross owner boundaries.
- Interview archive paths are unique per user, not globally.
- Storage metadata paths must begin with `<user_id>/`.
- RLS derives visibility from `auth.uid()`, not from browser filters.

## Lifecycle and Audit

Interview status is constrained to:

```text
Draft -> UploadsComplete -> QuestionsReady -> InInterview -> Completed -> Archived
```

The API validates sequential transitions. Database triggers append audit events when an interview is created, its status changes, or a profile is updated. Authenticated users can read their audit events but cannot directly insert, update, or delete them.

## Files

`documents` and `interview_files` store metadata and private object paths. Binary data belongs in the private `interview-files` Storage bucket. The first object-path segment must match the authenticated user's UUID.
