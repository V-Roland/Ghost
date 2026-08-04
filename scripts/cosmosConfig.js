import 'dotenv/config';

export const databaseId = process.env.COSMOS_DATABASE_ID || 'ghost-dev';
export const throughput = Number(process.env.COSMOS_THROUGHPUT || 400);

export const containerDefinitions = [
  {
    id: 'Users',
    partitionKey: '/tenantId',
    uniqueKeyPolicy: { uniqueKeys: [{ paths: ['/aadObjectId'] }, { paths: ['/email'] }] }
  },
  {
    id: 'Interviews',
    partitionKey: '/userId',
    uniqueKeyPolicy: { uniqueKeys: [{ paths: ['/archivePath'] }] }
  },
  { id: 'JobPostings', partitionKey: '/userId' },
  { id: 'Interviewees', partitionKey: '/userId' },
  { id: 'Documents', partitionKey: '/userId' },
  { id: 'SupplementalLinks', partitionKey: '/userId' },
  { id: 'Questions', partitionKey: '/userId' },
  { id: 'QuestionResponses', partitionKey: '/userId' },
  { id: 'IntegritySignals', partitionKey: '/userId' },
  { id: 'InterviewFiles', partitionKey: '/userId' },
  { id: 'Reports', partitionKey: '/userId' },
  {
    id: 'Tags',
    partitionKey: '/userId',
    uniqueKeyPolicy: { uniqueKeys: [{ paths: ['/normalizedName'] }] }
  },
  { id: 'AuditEvents', partitionKey: '/userId' }
];

export function requireCosmosEnv() {
  const missing = [];
  if (!process.env.COSMOS_ENDPOINT) missing.push('COSMOS_ENDPOINT');
  if (!process.env.COSMOS_KEY) missing.push('COSMOS_KEY');
  if (missing.length) {
    throw new Error(`Missing required Cosmos DB environment variables: ${missing.join(', ')}. Copy .env.example to .env and fill in values.`);
  }
}
