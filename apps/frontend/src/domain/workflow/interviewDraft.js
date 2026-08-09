export const WORK_ARRANGEMENTS = Object.freeze(['Hybrid', 'Remote', 'In-Person']);
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

let fallbackId = 0;

function editableId(prefix) {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  fallbackId += 1;
  return `${prefix}-${Date.now()}-${fallbackId}`;
}

export function newSupplementalLink() {
  return { id: editableId('link'), label: '', url: '' };
}

export function newQuestion() {
  return { id: editableId('question'), prompt: '' };
}

export function positionTitleFromFileName(fileName) {
  const baseName = fileName.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
  return baseName.replace(/\b(?:job posting|job description|jd)\b$/i, '').trim() || baseName;
}

export function createInterviewDraft(interviewDate = new Date().toISOString().slice(0, 10)) {
  return {
    jobPosting: {
      id: null,
      title: '',
      department: '',
      location: '',
      workArrangement: 'Hybrid',
      description: ''
    },
    candidate: {
      name: '',
      interviewDate,
      email: '',
      currentTitle: '',
      notes: ''
    },
    archiveFolderId: null,
    resumeNotes: '',
    processingNotes: '',
    supplementNotes: '',
    supplementalLinks: [newSupplementalLink()],
    questions: [newQuestion()],
    files: { jobPosting: [], resumes: [], supplements: [] },
    tags: []
  };
}

function completeLink(link) {
  return link.label.trim() && link.url.trim();
}

function validHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function validateWorkflowStep(draft, step) {
  const errors = [];
  if ((step === 1 || step === 6) && !draft.jobPosting.title.trim()) errors.push('Enter or select a position title.');
  if ((step === 2 || step === 6) && !draft.candidate.name.trim()) errors.push('Enter the candidate name.');
  if ((step === 2 || step === 6) && !draft.candidate.interviewDate) errors.push('Select an interview date.');
  if ((step === 2 || step === 6) && draft.candidate.email.trim() && !/^\S+@\S+\.\S+$/.test(draft.candidate.email.trim())) {
    errors.push('Enter a valid candidate email address.');
  }
  if (step === 5 || step === 6) {
    for (const link of draft.supplementalLinks) {
      const hasAnyValue = link.label.trim() || link.url.trim();
      if (hasAnyValue && !completeLink(link)) {
        errors.push('Each supplemental link needs both a label and URL.');
        break;
      }
      if (completeLink(link) && !validHttpUrl(link.url.trim())) {
        errors.push('Supplemental links must use an http or https URL.');
        break;
      }
    }
  }
  return errors;
}

export function interviewSubmission(draft, interviewId, files = []) {
  return {
    interviewId,
    jobPostingId: draft.jobPosting.id,
    jobPostingTitle: draft.jobPosting.title,
    department: draft.jobPosting.department,
    location: draft.jobPosting.location,
    workArrangement: draft.jobPosting.workArrangement,
    jobDescription: draft.jobPosting.description,
    candidateName: draft.candidate.name,
    candidateEmail: draft.candidate.email,
    candidateCurrentTitle: draft.candidate.currentTitle,
    candidateNotes: draft.candidate.notes,
    interviewDate: draft.candidate.interviewDate,
    archiveFolderId: draft.archiveFolderId,
    resumeNotes: draft.resumeNotes,
    processingNotes: draft.processingNotes,
    supplementNotes: draft.supplementNotes,
    supplementalLinks: draft.supplementalLinks
      .filter(completeLink)
      .map(({ label, url }) => ({ label: label.trim(), url: url.trim() })),
    questions: draft.questions
      .filter((question) => question.prompt.trim())
      .map(({ prompt }) => ({ prompt: prompt.trim() })),
    files,
    tags: draft.tags
  };
}
