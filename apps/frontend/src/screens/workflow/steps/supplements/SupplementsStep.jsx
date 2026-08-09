import React from 'react';
import SupplementsForm from '../../../../components/workflow/supplements-form/SupplementsForm.jsx';
import WorkflowCard from '../../../../components/workflow/workflow-card/WorkflowCard.jsx';

export default function SupplementsStep(props) {
  return <WorkflowCard title="Add supplements and questions" text="Attach additional files and links, then build an editable interviewer-approved question set."><SupplementsForm {...props} /></WorkflowCard>;
}
