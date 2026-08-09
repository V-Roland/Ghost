import { useState } from 'react';
import {
  createInterviewDraft,
  newQuestion,
  newSupplementalLink,
  positionTitleFromFileName
} from '../../domain/workflow/interviewDraft.js';

function postingForTitle(currentPosting, positions, title) {
  const match = positions.find((position) => position.name.toLowerCase() === title.trim().toLowerCase());
  return match ? {
    id: match.jobPostingId || null,
    title,
    department: match.department || '',
    location: match.location || '',
    workArrangement: match.workArrangement || 'Hybrid',
    description: match.description || ''
  } : { ...currentPosting, id: null, title };
}

export default function useInterviewDraft(positions = []) {
  const [draft, setDraft] = useState(() => createInterviewDraft());

  const updateJobPosting = (field, value) => {
    setDraft((current) => {
      if (field !== 'title') return { ...current, jobPosting: { ...current.jobPosting, [field]: value } };
      return {
        ...current,
        jobPosting: postingForTitle(current.jobPosting, positions, value)
      };
    });
  };

  const updateCandidate = (field, value) => setDraft((current) => ({
    ...current,
    candidate: { ...current.candidate, [field]: value }
  }));
  const updateDraftField = (field, value) => setDraft((current) => ({ ...current, [field]: value }));
  const updateFiles = (category, files) => setDraft((current) => ({
    ...current,
    files: { ...current.files, [category]: files }
  }));
  const updateJobPostingFiles = (files) => setDraft((current) => {
    const derivedTitle = files[0] && !current.jobPosting.title.trim()
      ? positionTitleFromFileName(files[0].name)
      : null;
    return {
      ...current,
      jobPosting: derivedTitle
        ? postingForTitle(current.jobPosting, positions, derivedTitle)
        : current.jobPosting,
      files: { ...current.files, jobPosting: files }
    };
  });
  const addLink = () => setDraft((current) => ({ ...current, supplementalLinks: [...current.supplementalLinks, newSupplementalLink()] }));
  const updateLink = (id, field, value) => setDraft((current) => ({
    ...current,
    supplementalLinks: current.supplementalLinks.map((link) => link.id === id ? { ...link, [field]: value } : link)
  }));
  const removeLink = (id) => setDraft((current) => ({ ...current, supplementalLinks: current.supplementalLinks.filter((link) => link.id !== id) }));
  const addQuestion = () => setDraft((current) => ({ ...current, questions: [...current.questions, newQuestion()] }));
  const updateQuestion = (id, prompt) => setDraft((current) => ({
    ...current,
    questions: current.questions.map((question) => question.id === id ? { ...question, prompt } : question)
  }));
  const removeQuestion = (id) => setDraft((current) => ({ ...current, questions: current.questions.filter((question) => question.id !== id) }));

  return {
    draft,
    resetDraft: () => setDraft(createInterviewDraft()),
    updateJobPosting,
    updateCandidate,
    updateDraftField,
    updateFiles,
    updateJobPostingFiles,
    addLink,
    updateLink,
    removeLink,
    addQuestion,
    updateQuestion,
    removeQuestion
  };
}
