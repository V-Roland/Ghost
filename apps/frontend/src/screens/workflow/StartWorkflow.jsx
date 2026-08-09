import React, { useEffect, useRef, useState } from 'react';
import Progress from '../../components/progress/Progress.jsx';
import { validateWorkflowStep } from '../../domain/workflow/interviewDraft.js';
import useInterviewDraft from '../../hooks/workflow/useInterviewDraft.js';
import useInterviewDirectoryOptions from '../../hooks/workflow/useInterviewDirectoryOptions.js';
import CandidateStep from './steps/candidate/CandidateStep.jsx';
import JobPostingStep from './steps/job-posting/JobPostingStep.jsx';
import ProcessingStep from './steps/processing/ProcessingStep.jsx';
import ResumeStep from './steps/resume/ResumeStep.jsx';
import ReviewStep from './steps/review/ReviewStep.jsx';
import SupplementsStep from './steps/supplements/SupplementsStep.jsx';

const steps = ['Job Posting', 'Candidate', 'Resume', 'Processing', 'Supplements', 'Review'];

export default function StartWorkflow({ step, setWorkflowStep, setScreen, onComplete, positions = [] }) {
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const workflowTopRef = useRef(null);
  const workflow = useInterviewDraft(positions);
  const { draft } = workflow;
  const directoryOptions = useInterviewDirectoryOptions(step === 6, draft.jobPosting.id);

  const jobPostingProps = {
    jobPosting: draft.jobPosting,
    positions,
    files: draft.files.jobPosting,
    onFieldChange: workflow.updateJobPosting,
    onFilesChange: workflow.updateJobPostingFiles
  };

  useEffect(() => {
    const scrollContainer = workflowTopRef.current?.closest('.content-shell');
    scrollContainer?.scrollTo({ top: 0, behavior: 'smooth' });
    const focusFrame = requestAnimationFrame(() => workflowTopRef.current?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(focusFrame);
  }, [step]);
  const candidateProps = { candidate: draft.candidate, onFieldChange: workflow.updateCandidate };
  const resumeProps = {
    files: draft.files.resumes,
    notes: draft.resumeNotes,
    onFilesChange: (files) => workflow.updateFiles('resumes', files),
    onNotesChange: (value) => workflow.updateDraftField('resumeNotes', value)
  };
  const processingProps = {
    notes: draft.processingNotes,
    onNotesChange: (value) => workflow.updateDraftField('processingNotes', value)
  };
  const supplementsProps = {
    files: draft.files.supplements,
    links: draft.supplementalLinks,
    notes: draft.supplementNotes,
    questions: draft.questions,
    onAddLink: workflow.addLink,
    onAddQuestion: workflow.addQuestion,
    onFilesChange: (files) => workflow.updateFiles('supplements', files),
    onNotesChange: (value) => workflow.updateDraftField('supplementNotes', value),
    onRemoveLink: workflow.removeLink,
    onRemoveQuestion: workflow.removeQuestion,
    onUpdateLink: workflow.updateLink,
    onUpdateQuestion: workflow.updateQuestion
  };
  const directoryProps = {
    ...directoryOptions,
    value: draft.archiveFolderId,
    onChange: (folderId) => workflow.updateDraftField('archiveFolderId', folderId)
  };

  useEffect(() => {
    if (step !== 6 || directoryOptions.loading || !draft.archiveFolderId) return;
    if (!directoryOptions.folders.some((folder) => folder.id === draft.archiveFolderId)) {
      workflow.updateDraftField('archiveFolderId', null);
    }
  }, [directoryOptions.folders, directoryOptions.loading, draft.archiveFolderId, step]);

  const next = async () => {
    const validationErrors = validateWorkflowStep(draft, step);
    if (validationErrors.length) {
      setError(validationErrors[0]);
      return;
    }
    setError('');
    if (step < steps.length) {
      setWorkflowStep(step + 1);
      return;
    }
    setSaving(true);
    try {
      await onComplete(draft);
      workflow.resetDraft();
    } catch (saveError) {
      setError(saveError.message || 'The interview workspace could not be saved.');
      setSaving(false);
    }
  };

  const back = () => {
    setError('');
    if (step > 1) setWorkflowStep(step - 1);
    else setScreen('home');
  };

  return (
    <section className="workflow-screen" ref={workflowTopRef} tabIndex="-1">
      <Progress steps={steps} active={step} />
      {step === 1 && <JobPostingStep {...jobPostingProps} />}
      {step === 2 && <CandidateStep {...candidateProps} />}
      {step === 3 && <ResumeStep {...resumeProps} />}
      {step === 4 && <ProcessingStep {...processingProps} />}
      {step === 5 && <SupplementsStep {...supplementsProps} />}
      {step === 6 && <ReviewStep jobPostingProps={jobPostingProps} candidateProps={candidateProps} resumeProps={resumeProps} processingProps={processingProps} supplementsProps={supplementsProps} directoryProps={directoryProps} />}
      {error && <div className="auth-error" role="alert">{error}</div>}
      <div className="footer-actions">
        <button type="button" onClick={back} disabled={saving}>Back</button>
        <button type="button" className="primary" onClick={next} disabled={saving}>{saving ? 'Saving…' : step === 6 ? 'Save Interview Workspace' : 'Next'}</button>
      </div>
    </section>
  );
}
