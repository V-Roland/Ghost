import React from 'react';
import CandidateForm from '../../../../components/workflow/candidate-form/CandidateForm.jsx';
import JobPostingForm from '../../../../components/workflow/job-posting-form/JobPostingForm.jsx';
import ProcessingForm from '../../../../components/workflow/processing-form/ProcessingForm.jsx';
import ResumeForm from '../../../../components/workflow/resume-form/ResumeForm.jsx';
import SupplementsForm from '../../../../components/workflow/supplements-form/SupplementsForm.jsx';
import WorkflowCard from '../../../../components/workflow/workflow-card/WorkflowCard.jsx';
import DirectoryPicker from '../../../../components/workflow/directory-picker/DirectoryPicker.jsx';

export default function ReviewStep({ jobPostingProps, candidateProps, resumeProps, processingProps, supplementsProps, directoryProps }) {
  return (
    <WorkflowCard title="Review the interview workspace" text="Every field, upload, link, and question remains editable before the workspace is saved.">
      <div className="review-section"><h2>Job Posting</h2><JobPostingForm {...jobPostingProps} /></div>
      <div className="review-section"><h2>Candidate</h2><CandidateForm {...candidateProps} /></div>
      <div className="review-section"><h2>Resume and Background</h2><ResumeForm {...resumeProps} /></div>
      <div className="review-section"><h2>Preparation</h2><ProcessingForm {...processingProps} /></div>
      <div className="review-section"><h2>Supplements and Questions</h2><SupplementsForm {...supplementsProps} /></div>
      <div className="review-section">
        <h2>Archive Directory</h2>
        <DirectoryPicker {...directoryProps} />
      </div>
    </WorkflowCard>
  );
}
