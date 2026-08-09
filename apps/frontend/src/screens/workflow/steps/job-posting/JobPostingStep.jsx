import React from 'react';
import JobPostingForm from '../../../../components/workflow/job-posting-form/JobPostingForm.jsx';
import WorkflowCard from '../../../../components/workflow/workflow-card/WorkflowCard.jsx';

export default function JobPostingStep(props) {
  return <WorkflowCard title="Add the job posting" text="Select an existing position or create a new one, then upload the source posting or enter its details manually."><JobPostingForm {...props} /></WorkflowCard>;
}
