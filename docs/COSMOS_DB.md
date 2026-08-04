# Cosmos DB Setup Guide

This repo includes a repeatable Cosmos DB initialization flow for the Ghost MVP.

## Prerequisites

- Node.js 18+
- Azure subscription
- Azure Cosmos DB for NoSQL account
- A database key or a future managed identity setup

## 1. Create a Cosmos DB account

You can create the account from the Azure Portal, or with Azure CLI:

```bash
az login
az group create --name ghost-rg --location eastus
az cosmosdb create \
  --name <unique-cosmos-account-name> \
  --resource-group ghost-rg \
  --kind GlobalDocumentDB \
  --locations regionName=eastus failoverPriority=0 isZoneRedundant=False
```

## 2. Get endpoint and key

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

## 3. Configure local environment

```bash
cp .env.example .env
```

Fill in:

```env
COSMOS_ENDPOINT=https://<your-account>.documents.azure.com:443/
COSMOS_KEY=<your-key>
COSMOS_DATABASE_ID=ghost-dev
COSMOS_THROUGHPUT=400
```

## 4. Install dependencies

```bash
npm install
```

## 5. Initialize containers

```bash
npm run cosmos:init
```

This creates:

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

## 6. Seed demo data

```bash
npm run cosmos:seed
```

This creates demo records for:

```text
Senior Development Position 2026
└── Robert James - 7/18/26
    ├── Job Posting
    ├── Resume / CV
    ├── Links
    ├── Questions
    └── Reports
```

## 7. Verify containers

```bash
npm run cosmos:verify
```

## Important DBMS Rules

Cosmos DB is not a relational DBMS and does not enforce foreign keys. The application must enforce these rules:

- Every child record must include `tenantId`, `userId`, and the relevant parent ID.
- Every interview must follow the status state machine.
- File records should point to secure storage URLs, not public URLs.
- Signal records should use neutral labels such as `ReviewRecommended`, not accusations.
- Unique key policies must be created when containers are first created; they cannot be added later without recreating containers.
- Production versions should move from key-based local auth to Microsoft Entra ID or managed identity.
