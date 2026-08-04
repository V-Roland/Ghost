import { CosmosClient } from '@azure/cosmos';
import { v4 as uuidv4 } from 'uuid';
import { databaseId, requireCosmosEnv } from './cosmosConfig.js';

requireCosmosEnv();

const now = new Date().toISOString();
const tenantId = process.env.DEMO_TENANT_ID || 'tenant-demo';
const userId = process.env.DEMO_USER_ID || 'user-demo-nick';
const userEmail = (process.env.DEMO_USER_EMAIL || 'nick@example.com').toLowerCase();
const displayName = process.env.DEMO_USER_DISPLAY_NAME || 'Nick Steltzner';

const client = new CosmosClient({ endpoint: process.env.COSMOS_ENDPOINT, key: process.env.COSMOS_KEY });
const db = client.database(databaseId);

const ids = {
  interview: 'interview-robert-james-2026-07-18',
  job: 'job-senior-development-2026',
  candidate: 'candidate-robert-james',
  report: 'report-robert-james-integrity',
  question1: 'question-api-transcripts',
  question2: 'question-debug-cloud-delay'
};

async function upsert(containerId, item) {
  const { resource } = await db.container(containerId).items.upsert(item);
  return resource;
}

async function main() {
  console.log(`Seeding demo data into ${databaseId}...`);

  await upsert('Users', {
    id: userId,
    tenantId,
    userId,
    aadObjectId: 'aad-demo-object-id',
    displayName,
    email: userEmail,
    role: 'Interviewer',
    themePreference: 'system',
    createdAt: now,
    updatedAt: now
  });

  await upsert('JobPostings', {
    id: ids.job,
    tenantId,
    userId,
    title: 'Senior Development Position 2026',
    department: 'Engineering',
    location: 'Remote / Hybrid',
    sourceType: 'PastedText',
    descriptionText: 'Senior developer role focused on backend APIs, cloud architecture, debugging, and collaboration.',
    requiredSkills: ['API design', 'cloud architecture', 'debugging', 'team communication'],
    seniority: 'Senior',
    createdAt: now,
    updatedAt: now
  });

  await upsert('Interviewees', {
    id: ids.candidate,
    tenantId,
    userId,
    fullName: 'Robert James',
    email: 'robert.james@example.com',
    currentTitle: 'Backend Engineer',
    notes: 'Demo candidate for archive and question generation flow.',
    createdAt: now,
    updatedAt: now
  });

  await upsert('Interviews', {
    id: ids.interview,
    tenantId,
    userId,
    jobPostingId: ids.job,
    intervieweeId: ids.candidate,
    jobPostingTitle: 'Senior Development Position 2026',
    candidateName: 'Robert James',
    interviewDate: '2026-07-18',
    status: 'QuestionsReady',
    archivePath: 'Senior Development Position 2026/Robert James - 7-18-26',
    tags: ['engineering', 'senior', 'demo'],
    signalLevel: 'ReviewRecommended',
    createdAt: now,
    updatedAt: now
  });

  const documents = [
    ['doc-job-posting', 'Job Posting.pdf', 'JobPosting', 'PDF'],
    ['doc-resume', 'Resume.pdf', 'Resume', 'PDF'],
    ['doc-transcript', 'Transcript.txt', 'Transcript', 'TXT']
  ];

  for (const [id, fileName, documentType, extension] of documents) {
    await upsert('Documents', {
      id,
      tenantId,
      userId,
      interviewId: ids.interview,
      documentType,
      fileName,
      mimeType: extension === 'PDF' ? 'application/pdf' : 'text/plain',
      storageUrl: `blob://ghost-demo/${id}`,
      extractionStatus: 'DemoReady',
      createdAt: now,
      updatedAt: now
    });
  }

  await upsert('SupplementalLinks', {
    id: 'link-github-robert-james',
    tenantId,
    userId,
    interviewId: ids.interview,
    intervieweeId: ids.candidate,
    linkType: 'GitHub',
    url: 'https://github.com/example/robert-james',
    domain: 'github.com',
    createdAt: now,
    updatedAt: now
  });

  await upsert('Questions', {
    id: ids.question1,
    tenantId,
    userId,
    interviewId: ids.interview,
    source: 'Generated',
    questionText: 'Design a scalable API for processing transcript events from a live interview.',
    difficulty: 'Medium',
    category: 'System Design',
    rationale: 'The role requires backend API and event processing experience.',
    sortOrder: 1,
    createdAt: now,
    updatedAt: now
  });

  await upsert('Questions', {
    id: ids.question2,
    tenantId,
    userId,
    interviewId: ids.interview,
    source: 'Generated',
    questionText: 'Walk through your debugging approach for a delayed cloud service.',
    difficulty: 'Medium',
    category: 'Troubleshooting',
    rationale: 'The candidate claims cloud troubleshooting experience.',
    sortOrder: 2,
    createdAt: now,
    updatedAt: now
  });

  await upsert('IntegritySignals', {
    id: 'signal-response-latency-1',
    tenantId,
    userId,
    interviewId: ids.interview,
    signalType: 'ResponseLatency',
    severity: 'ReviewRecommended',
    label: 'Response latency flagged',
    description: 'Long pause before a technical answer. This is a review indicator only, not a misconduct verdict.',
    evidenceRefs: [ids.question2],
    details: { latencyMs: 9400, baselineMs: 2800 },
    createdAt: now,
    updatedAt: now
  });

  await upsert('Reports', {
    id: ids.report,
    tenantId,
    userId,
    interviewId: ids.interview,
    reportType: 'IntegritySignalReport',
    title: 'Robert James Interview Evidence Packet',
    summary: 'Demo report with generated questions, transcript references, and review-only integrity signals.',
    overallSignalLevel: 'ReviewRecommended',
    evidenceRefs: [ids.question1, ids.question2, 'signal-response-latency-1'],
    createdAt: now,
    updatedAt: now
  });

  const files = [
    ['file-summary', 'Interview Summary.pdf', 'PDF', '188 KB'],
    ['file-job', 'Job Posting.pdf', 'PDF', '96 KB'],
    ['file-resume', 'Resume.pdf', 'PDF', '178 KB'],
    ['file-transcript', 'Transcript.txt', 'TXT', '42 KB'],
    ['file-qa', 'Q&A Log.pdf', 'PDF', '101 KB'],
    ['file-report', 'Integrity Report.pdf', 'PDF', '220 KB']
  ];

  for (const [id, name, type, size] of files) {
    await upsert('InterviewFiles', {
      id,
      tenantId,
      userId,
      interviewId: ids.interview,
      name,
      fileType: type,
      size,
      storageUrl: `blob://ghost-demo/${id}`,
      createdAt: now,
      updatedAt: now
    });
  }

  for (const tag of ['engineering', 'senior', 'demo', 'review recommended']) {
    await upsert('Tags', {
      id: `tag-${tag.replaceAll(' ', '-')}`,
      tenantId,
      userId,
      displayName: tag,
      normalizedName: tag.toLowerCase(),
      isSystem: tag === 'review recommended',
      createdAt: now,
      updatedAt: now
    });
  }

  await upsert('AuditEvents', {
    id: uuidv4(),
    tenantId,
    userId,
    eventType: 'DemoSeedCompleted',
    entityType: 'RepositorySetup',
    entityId: 'seedGhostData.js',
    createdAt: now
  });

  console.log('Demo seed complete.');
}

main().catch((error) => {
  console.error('Demo seed failed.');
  console.error(error);
  process.exit(1);
});
