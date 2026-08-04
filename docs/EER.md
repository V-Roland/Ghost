# Ghost Logical EER / Cosmos DB Container Design

Ghost uses Azure Cosmos DB for NoSQL. Cosmos DB is document-oriented, so this EER is a **logical model** rather than a physical relational schema. The physical implementation uses containers, partition keys, app-level references, and JSON documents.

## Logical EER Diagram

```mermaid
erDiagram
  Users ||--o{ Interviews : owns
  Users ||--o{ Tags : defines
  Interviews ||--|| JobPostings : uses
  Interviews ||--|| Interviewees : evaluates
  Interviews ||--o{ Documents : stores
  Interviews ||--o{ SupplementalLinks : references
  Interviews ||--o{ Questions : includes
  Interviews ||--o{ QuestionResponses : captures
  Interviews ||--o{ IntegritySignals : flags
  Interviews ||--o{ InterviewFiles : archives
  Interviews ||--o{ Reports : generates
  Questions ||--o{ QuestionResponses : answered_by
  QuestionResponses ||--o{ IntegritySignals : supports
  Reports }o--o{ Questions : cites
  Reports }o--o{ IntegritySignals : cites

  Users {
    string id
    string tenantId
    string aadObjectId
    string displayName
    string email
    string role
    string themePreference
    datetime createdAt
    datetime updatedAt
  }

  Interviews {
    string id
    string tenantId
    string userId
    string jobPostingId
    string intervieweeId
    string jobPostingTitle
    string candidateName
    date interviewDate
    string status
    string archivePath
    string signalLevel
    array tags
    datetime createdAt
    datetime updatedAt
  }

  JobPostings {
    string id
    string tenantId
    string userId
    string title
    string department
    string location
    string sourceType
    string sourceDocumentId
    string descriptionText
    array requiredSkills
    string seniority
    datetime createdAt
    datetime updatedAt
  }

  Interviewees {
    string id
    string tenantId
    string userId
    string fullName
    string email
    string currentTitle
    string notes
    datetime createdAt
    datetime updatedAt
  }

  Documents {
    string id
    string tenantId
    string userId
    string interviewId
    string documentType
    string fileName
    string mimeType
    string storageUrl
    string extractionStatus
    datetime createdAt
    datetime updatedAt
  }

  Questions {
    string id
    string tenantId
    string userId
    string interviewId
    string source
    string questionText
    string difficulty
    string category
    string rationale
    number sortOrder
    datetime createdAt
    datetime updatedAt
  }

  IntegritySignals {
    string id
    string tenantId
    string userId
    string interviewId
    string signalType
    string severity
    string label
    string description
    array evidenceRefs
    object details
    datetime createdAt
    datetime updatedAt
  }
```

## Containers

| Container | Partition key | Why it exists | App connection |
|---|---:|---|---|
| `Users` | `/tenantId` | Stores signed-in Teams or app users. | Drives homepage, settings, ownership, and archive filtering. |
| `Interviews` | `/userId` | Central interview ledger. | Powers archive root, candidate folders, status, signal level, and export grouping. |
| `JobPostings` | `/userId` | Stores uploaded or pasted job posting context. | Used by question generation and folder naming. |
| `Interviewees` | `/userId` | Stores candidate identity and context. | Used for candidate folder, reports, and generated question personalization. |
| `Documents` | `/userId` | Stores metadata for uploaded PDFs, resumes, transcripts, and CVs. | Binary files should live in Blob Storage; Cosmos stores pointers. |
| `SupplementalLinks` | `/userId` | Stores GitHub, portfolio, personal site, or other approved links. | Used by the resume/CV/link upload step and question generation. |
| `Questions` | `/userId` | Stores generated and manually provided questions. | Used by the question dashboard and final interview set. |
| `QuestionResponses` | `/userId` | Captures candidate responses mapped to questions. | Supports evidence packets and transcript references. |
| `IntegritySignals` | `/userId` | Stores review-only signals such as response latency or inconsistent answer patterns. | Powers the Signals tab and post-interview report. |
| `InterviewFiles` | `/userId` | Stores archive-visible file records. | Powers candidate file ledger and export ZIP manifest. |
| `Reports` | `/userId` | Stores generated evidence and integrity reports. | Powers report screen and exported packet. |
| `Tags` | `/userId` | Stores user-defined and system tags. | Powers archive filters and interview organization. |
| `AuditEvents` | `/userId` | Stores important app events. | Useful for traceability and future compliance review. |

## Status State Machine

```text
Draft -> UploadsComplete -> QuestionsReady -> InInterview -> Completed -> Archived
```

## Guardrail Rules

- Integrity signals are **review indicators**, not proof of cheating.
- Ghost should not automatically reject candidates.
- `overallScore` or signal severity must not be treated as a hiring decision.
- Large files should be stored outside Cosmos DB, usually in Blob Storage.
- All candidate data should be treated as sensitive hiring data.
- The application layer enforces relationships because Cosmos DB does not enforce relational foreign keys.
