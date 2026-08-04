# Ghost Interview Copilot

Ghost is a Microsoft-native interview evidence copilot for the Launchpad Cohort 2 hackathon team **Out Of Office**.

The prototype helps interviewers:

- ingest job postings, resumes, CVs, portfolios, and supporting links;
- generate tailored role-specific interview questions;
- organize interview folders and evidence packets;
- store interview artifacts in Azure Cosmos DB for NoSQL;
- surface review-only integrity signals such as response latency or inconsistent explanations;
- keep the human interviewer in control of all hiring decisions.

> Ghost is not an automated hiring decision system. It does not reject candidates, make final hiring calls, or claim that a candidate cheated. It is an interviewer support and evidence organization tool.

---

## 1. Repository Contents

```text
ghost-interview-copilot/
├── README.md
├── .env.example
├── package.json
├── scripts/
│   ├── cosmosConfig.js
│   ├── initCosmos.js
│   ├── seedGhostData.js
│   ├── verifyCosmos.js
│   └── checkRepoStructure.js
├── docs/
│   ├── EER.md
│   ├── COSMOS_DB.md
│   ├── UI_SPEC.md
│   └── AI_AGENT_PROMPTS.md
├── prompts/
├── .github/
│   └── copilot-instructions.md
└── apps/
    ├── frontend/
    │   ├── index.html
    │   ├── package.json
    │   └── src/
    │       ├── main.jsx
    │       ├── styles.css
    │       └── data/mockData.js
    └── api/
        ├── package.json
        └── src/
            ├── server.js
            ├── routes/
            │   ├── archive.js
            │   └── interviews.js
            └── services/cosmosClient.js
```

---

## 2. Quick Start

### Install dependencies

```bash
npm install
```

### Run the frontend mockup

```bash
npm run dev
```

This starts the Vite React frontend.

### Run the API prototype

```bash
npm run dev:api
```

The API defaults to:

```text
http://localhost:7071
```

Health check:

```bash
curl http://localhost:7071/health
```

---

## 3. Azure Cosmos DB Setup

### Step 1: Create an Azure Cosmos DB for NoSQL account

You can create the account through the Azure Portal, or with Azure CLI:

```bash
az login
az group create --name ghost-rg --location eastus
az cosmosdb create \
  --name <unique-cosmos-account-name> \
  --resource-group ghost-rg \
  --kind GlobalDocumentDB \
  --locations regionName=eastus failoverPriority=0 isZoneRedundant=False
```

### Step 2: Get your endpoint and key

```bash
az cosmosdb show \
  --name <unique-cosmos-account-name> \
  --resource-group ghost-rg \
  --query documentEndpoint \
  --output tsv

az cosmosdb keys list \
  --name <unique-cosmos-account-name> \
  --resource-group ghost-rg \
  --type keys
```

### Step 3: Create your local `.env`

```bash
cp .env.example .env
```

Fill in:

```env
COSMOS_ENDPOINT=https://<your-account>.documents.azure.com:443/
COSMOS_KEY=<your-primary-or-secondary-key>
COSMOS_DATABASE_ID=ghost-dev
COSMOS_THROUGHPUT=400
```

### Step 4: Initialize the database and containers

```bash
npm run cosmos:init
```

### Step 5: Seed demo data

```bash
npm run cosmos:seed
```

### Step 6: Verify setup

```bash
npm run cosmos:verify
```

---

## 4. Cosmos DB Containers

Ghost uses Cosmos DB containers instead of relational SQL tables. The EER is logical and maps to NoSQL containers.

| Container | Partition key | Purpose |
|---|---:|---|
| `Users` | `/tenantId` | Signed-in users, profile, theme, ownership. |
| `Interviews` | `/userId` | Central interview ledger for archive and workflow state. |
| `JobPostings` | `/userId` | Uploaded or pasted job posting context. |
| `Interviewees` | `/userId` | Candidate identity and interview context. |
| `Documents` | `/userId` | Metadata for resumes, CVs, transcripts, and job posting files. |
| `SupplementalLinks` | `/userId` | GitHub, portfolio, website, or approved reference links. |
| `Questions` | `/userId` | Generated or manual question bank items. |
| `QuestionResponses` | `/userId` | Candidate responses mapped to questions and transcript references. |
| `IntegritySignals` | `/userId` | Review-only flags such as response latency or evidence gaps. |
| `InterviewFiles` | `/userId` | File ledger used by the archive UI and export actions. |
| `Reports` | `/userId` | Interview evidence packets and integrity signal reports. |
| `Tags` | `/userId` | User and system tags for archive filtering. |
| `AuditEvents` | `/userId` | Traceability events for setup, export, and future compliance review. |

See [`docs/EER.md`](docs/EER.md) for the logical EER diagram and container explanations.

---

## 5. App Flow

### Home

- Shows “Welcome to Ghost”
- Primary CTA: Start New Interview
- Secondary buttons: Archive and Settings

### Start New Interview

```text
1 Job Posting -> 2 Candidate -> 3 Resume & Links -> 4 Processing -> 5 Supplements -> 6 Review
```

The flow collects:

1. job posting file or pasted job details;
2. candidate information;
3. resume/CV and supporting links;
4. workspace creation confirmation;
5. question-generation instructions or manual question bank;
6. final generated question review.

### Archive

```text
Archive Root
└── Job Posting Folder
    └── Candidate Interview Folder
        ├── Interview Summary.pdf
        ├── Job Posting.pdf
        ├── Resume.pdf
        ├── Transcript.txt
        ├── Q&A Log.pdf
        └── Integrity Report.pdf
```

Export levels:

| Location | Export action |
|---|---|
| Root archive | Export All ZIP |
| Job posting folder | Export This Folder ZIP |
| Candidate interview folder | Export This Folder ZIP |

---

## 6. DBMS / App-Layer Rules

Cosmos DB does not enforce relational foreign keys. The application layer must enforce relationships and validation.

### Required IDs

Most records should include:

```json
{
  "tenantId": "tenant-demo",
  "userId": "user-demo-nick",
  "interviewId": "interview-robert-james-2026-07-18"
}
```

### Interview status state machine

```text
Draft -> UploadsComplete -> QuestionsReady -> InInterview -> Completed -> Archived
```

### Signal guardrails

Use neutral language:

- Review recommended
- Response latency flagged
- Signal requires human review
- Evidence packet available
- Possible inconsistency
- Missing evidence

Avoid:

- Cheating detected
- Candidate cheated
- Fraud confirmed
- Reject candidate
- AI hiring score

### File handling

- Store large files in Blob Storage or another secure file store.
- Store only metadata and secure references in Cosmos DB.
- Do not expose raw file URLs publicly.

---

## 7. Available Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Run the frontend mockup. |
| `npm run dev:api` | Run the API prototype. |
| `npm run build` | Build the frontend. |
| `npm run cosmos:init` | Create Cosmos database and containers. |
| `npm run cosmos:seed` | Seed demo user, job, candidate, questions, files, signals, and report. |
| `npm run cosmos:verify` | Verify containers and item counts. |
| `npm run cosmos:reset-demo` | Initialize containers and seed demo data. |
| `npm run lint:structure` | Check that required repo files exist. |

---

## 8. Coding Agent Instructions

This repo includes prompts for coding chatbots and GitHub Copilot:

- [`docs/AI_AGENT_PROMPTS.md`](docs/AI_AGENT_PROMPTS.md)
- [`.github/copilot-instructions.md`](.github/copilot-instructions.md)

Use these prompts when assigning work to AI coding assistants.

Recommended agent split:

| Agent | Responsibility |
|---|---|
| Frontend Agent | React screens, workflow UI, archive UI, theme polish. |
| Backend / Cosmos Agent | Cosmos scripts, API routes, data validation, export manifests. |
| GenAI Agent | Azure OpenAI prompts, JSON schemas, question generation, evidence extraction. |
| QA Agent | Checks guardrails, repo consistency, UI flow, and build readiness. |

---

## 9. MVP Scope

The MVP should prove one end-to-end run:

1. Ingest job posting and candidate materials.
2. Generate tailored interview questions.
3. Store the question set and candidate workspace.
4. Display archive hierarchy.
5. Produce a review-only evidence or integrity packet from transcript/demo data.

Stretch goals:

- Microsoft Graph transcript ingestion.
- Azure OpenAI structured outputs.
- Blob Storage integration.
- Azure Functions conversion from the Express prototype.
- Export ZIP generation.
- Teams launch or app packaging.

---

## 10. Deployment Notes

This is a starter repository, not a production-ready hiring product.

Before production usage, add:

- Microsoft Entra ID auth;
- tenant-scoped access controls;
- secure Blob Storage with SAS or managed identity;
- PII redaction and retention settings;
- audit logs;
- human-review workflow;
- legal/compliance review for hiring use cases;
- Graph API tenant permissions and admin consent;
- Azure Functions deployment pipeline.
