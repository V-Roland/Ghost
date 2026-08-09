import React from 'react';
import ResumeForm from '../../../../components/workflow/resume-form/ResumeForm.jsx';
import WorkflowCard from '../../../../components/workflow/workflow-card/WorkflowCard.jsx';

export default function ResumeStep(props) {
  return <WorkflowCard title="Add resume and background" text="Upload approved candidate materials and add any interviewer-entered context that should remain with the workspace."><ResumeForm {...props} /></WorkflowCard>;
}
