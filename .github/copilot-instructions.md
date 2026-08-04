# GitHub Copilot Instructions — Ghost

Ghost is a Microsoft-native interview evidence copilot. It prepares interviewers, generates role-specific questions, stores interview evidence, and surfaces review-only integrity signals.

## Core guardrails

- Do not implement automatic hiring decisions.
- Do not implement automatic candidate rejection.
- Do not label a candidate as cheating.
- Do not convert integrity signals into a final verdict.
- Use human-in-the-loop language everywhere.

## Preferred language

Use:

- Review recommended
- Response latency flagged
- Signal requires human review
- Evidence packet available
- Possible inconsistency
- Missing evidence

Avoid:

- Cheating detected
- Fraud confirmed
- Reject candidate
- Candidate failed
- AI hiring score

## Stack

- Frontend: React + Vite
- API: Node/Express prototype, future Azure Functions
- DB: Azure Cosmos DB for NoSQL
- Future integrations: Microsoft Graph, Teams transcripts, Azure OpenAI, Azure AI Speech/Vision, Blob Storage

## Data model

Core containers:

- Users
- Interviews
- JobPostings
- Interviewees
- Documents
- SupplementalLinks
- Questions
- QuestionResponses
- IntegritySignals
- InterviewFiles
- Reports
- Tags
- AuditEvents

Most containers use `/userId` as partition key. `Users` uses `/tenantId`.

## UI flow

- Home
- Start New Interview workflow
- Archive root
- Job posting folder
- Candidate folder/files
- Settings

Archive hierarchy:

```text
Job Posting Folder
└── Candidate Interview Folder
    └── Interview Files
```
