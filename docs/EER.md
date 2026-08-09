# Ghost PostgreSQL EER

The physical schema is defined by `supabase/migrations`. Supabase Auth owns credentials and sessions in the `auth` schema; application records live in `public` and reference `auth.users(id)`.

```mermaid
erDiagram
  AUTH_USERS ||--|| PROFILES : has
  AUTH_USERS ||--o{ JOB_POSTINGS : owns
  AUTH_USERS ||--o{ INTERVIEWEES : owns
  AUTH_USERS ||--o{ INTERVIEWS : owns
  JOB_POSTINGS ||--o{ INTERVIEWS : describes
  INTERVIEWEES o|--o{ INTERVIEWS : attends
  ARCHIVE_FOLDERS o|--o{ INTERVIEWS : organizes
  INTERVIEWS ||--o{ DOCUMENTS : contains
  INTERVIEWS ||--o{ SUPPLEMENTAL_LINKS : references
  INTERVIEWS ||--o{ QUESTIONS : contains
  QUESTIONS ||--o{ QUESTION_RESPONSES : receives
  INTERVIEWS ||--o{ INTEGRITY_SIGNALS : surfaces
  INTERVIEWS ||--o{ INTERVIEW_FILES : stores
  JOB_POSTINGS ||--o{ ARCHIVE_FOLDERS : scopes
  INTERVIEWS ||--o{ ARCHIVE_FOLDERS : scopes
  ARCHIVE_FOLDERS o|--o{ ARCHIVE_FOLDERS : contains
  ARCHIVE_FOLDERS o|--o{ INTERVIEW_FILES : contains
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
    text work_arrangement
    text description
    text source_type
    text source_file_name
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
    uuid archive_folder_id FK
    text job_posting_title
    text candidate_name
    date interview_date
    text status
    text archive_path
    text_array tags
    text signal_level
    text resume_notes
    text processing_notes
    text supplement_notes
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
    uuid job_posting_id FK
    uuid folder_id FK
    text name
    text file_type
    bigint size_bytes
    text storage_object_path
  }
  ARCHIVE_FOLDERS {
    uuid id PK
    uuid user_id FK
    uuid job_posting_id FK
    uuid interview_id FK
    uuid parent_folder_id FK
    text name
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
- Every interview references an owned job posting; the source-link migration backfills legacy title-only interviews before enforcing this requirement.
- Storage metadata paths must begin with `<user_id>/`.
- Job-posting file metadata includes the owned `job_posting_id`; non-posting files cannot claim that relationship.
- Custom archive folders are real `archive_folders` rows. Their job, interview, and parent references include the owner boundary.
- An interview may optionally reference an owner-matched root or position directory through `archive_folder_id`. A database trigger rejects interview-scoped folders and directories belonging to another position; deleting that directory safely returns the interview to its default position folder.
- Files may reference only a custom folder belonging to the same interview and owner.
- RLS derives visibility from `auth.uid()`, not from browser filters.

## Lifecycle and Audit

Interview status is constrained to:

```text
Draft -> UploadsComplete -> QuestionsReady -> InInterview -> Completed -> Archived
```

The API validates sequential transitions. Database triggers append audit events when an interview is created, its status changes, or a profile is updated. Authenticated users can read their audit events but cannot directly insert, update, or delete them.

## Files

`documents` and `interview_files` store metadata and private object paths. Binary data belongs in the private `interview-files` Storage bucket. The first object-path segment must match the authenticated user's UUID.

`job_postings` and `interviews` are the persisted position and candidate-folder records. `archive_folders` stores user-created root, position, interview, and nested folders. Optional `interviews.archive_folder_id` placement lets a candidate interview appear in a selected root or matching-position directory. Export manifests translate those database records and private file metadata into relative paths inside a downloaded ZIP without treating browser display state as the source of truth.

## Workspace Creation

`create_interview_workspace` is a security-invoker PostgreSQL function called with the authenticated user's JWT. In one transaction it creates or reuses an owned job posting, creates the interviewee and interview, persists the optional archive directory, and inserts supplemental links, manual questions, and uploaded-file metadata. It derives ownership from `auth.uid()`, rejects cross-owner position and directory IDs, and requires each object path to begin with `<auth-user-id>/<interview-id>/`.

Job postings default to `source_type = 'manual'`. A before-insert trigger on `interview_files` recognizes `file_type = 'Job Posting'`, derives the owned position through the interview, assigns the composite owner-safe `job_posting_id`, and changes the position source to `upload` with its source filename. This keeps manual-only positions valid while making uploaded source files directly queryable from their position.
