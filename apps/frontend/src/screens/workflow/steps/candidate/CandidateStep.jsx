import React from 'react';
import CandidateForm from '../../../../components/workflow/candidate-form/CandidateForm.jsx';
import WorkflowCard from '../../../../components/workflow/workflow-card/WorkflowCard.jsx';

export default function CandidateStep(props) {
  return <WorkflowCard title="Add candidate details" text="These details create an owner-scoped interview workspace under the selected position."><CandidateForm {...props} /></WorkflowCard>;
}
