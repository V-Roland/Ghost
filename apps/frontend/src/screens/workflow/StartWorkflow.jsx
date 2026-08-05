import React, { useState } from 'react';
import Progress from '../../components/progress/Progress.jsx';
import Checklist from '../../components/workflow/checklist/Checklist.jsx';
import FolderPreview from '../../components/workflow/folder-preview/FolderPreview.jsx';
import InputList from '../../components/workflow/input-list/InputList.jsx';
import Question from '../../components/workflow/question/Question.jsx';
import Upload from '../../components/workflow/upload/Upload.jsx';
import WorkflowCard from '../../components/workflow/workflow-card/WorkflowCard.jsx';

export default function StartWorkflow({ step, setWorkflowStep, setScreen, onComplete }) {
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const steps = ['Job Posting', 'Candidate', 'Resume', 'Processing', 'Supplements', 'Review'];
  const next = async () => {
    if (step < 6) {
      setWorkflowStep(step + 1);
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onComplete({
        jobPostingTitle: 'Senior Development Position 2026',
        candidateName: 'Robert James',
        interviewDate: new Date().toISOString().slice(0, 10)
      });
    } catch (saveError) {
      setError(saveError.message || 'The interview could not be saved.');
      setSaving(false);
    }
  };
  const back = () => step > 1 ? setWorkflowStep(step - 1) : setScreen('home');

  return (
    <section>
      <Progress steps={steps} active={step} />
      {step === 1 && <WorkflowCard title="Upload the job posting" text="Ghost uses the posting to understand the role, required skills, seniority, and evaluation focus."><Upload label="Job Posting File" /><InputList values={['Senior Development Position 2026', 'Engineering', 'Remote / Hybrid']} /></WorkflowCard>}
      {step === 2 && <WorkflowCard title="Add candidate details" text="This creates the candidate interview folder inside the selected job posting archive."><InputList values={['Robert James', 'July 18, 2026', 'robert.james@example.com', 'Backend Engineer']} /><FolderPreview /></WorkflowCard>}
      {step === 3 && <WorkflowCard title="Add resume, CV, or links" text="Add approved materials so Ghost can tailor questions to the candidate’s actual background."><Upload label="Resume / CV Upload" /><InputList values={['GitHub · https://github.com/...', 'Portfolio · https://portfolio...']} /></WorkflowCard>}
      {step === 4 && <WorkflowCard title="Preparing workspace" text="Ghost is organizing files and extracting interview context for question generation."><Checklist /><FolderPreview expanded /></WorkflowCard>}
      {step === 5 && <WorkflowCard title="Build interview questions" text="Generate tailored questions or add your own bank before the interview begins."><div className="choice-row"><div className="choice active">Generate with Ghost<br /><span>Recommended</span></div><div className="choice">Add question bank<br /><span>Manual input</span></div></div><InputList values={['Focus on system design, debugging, collaboration, and cloud architecture.', 'Difficulty: Balanced', 'Questions: 10']} /></WorkflowCard>}
      {step === 6 && <WorkflowCard title="Review generated questions" text="Edit, remove, reorder, or approve questions before saving them to the interview folder."><Question text="Design a scalable API for processing transcript events." /><Question text="Walk through debugging a delayed cloud service." /><FolderPreview expanded /></WorkflowCard>}
      {error && <div className="auth-error" role="alert">{error}</div>}
      <div className="footer-actions"><button onClick={back} disabled={saving}>Back</button><button className="primary" onClick={next} disabled={saving}>{saving ? 'Saving…' : step === 6 ? 'Save Set' : 'Next'}</button></div>
    </section>
  );
}
