import React from 'react';
import ProcessingForm from '../../../../components/workflow/processing-form/ProcessingForm.jsx';
import WorkflowCard from '../../../../components/workflow/workflow-card/WorkflowCard.jsx';

export default function ProcessingStep(props) {
  return <WorkflowCard title="Prepare the interview workspace" text="Record the interview focus manually while automated processing remains out of scope for this prototype."><ProcessingForm {...props} /></WorkflowCard>;
}
