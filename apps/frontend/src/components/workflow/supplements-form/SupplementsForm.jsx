import React from 'react';
import Upload from '../upload/Upload.jsx';

export default function SupplementsForm({
  files,
  links,
  notes,
  questions,
  onAddLink,
  onAddQuestion,
  onFilesChange,
  onNotesChange,
  onRemoveLink,
  onRemoveQuestion,
  onUpdateLink,
  onUpdateQuestion
}) {
  return (
    <div className="workflow-section">
      <Upload label="Supplemental files" files={files} multiple onFilesChange={onFilesChange} accept=".pdf,.doc,.docx,.txt,.csv,.xlsx,.png,.jpg,.jpeg" helper="Add approved portfolios, question banks, notes, images, spreadsheets, or supporting documents." />
      <div className="editable-list">
        <div className="editable-list-heading">
          <div><strong>Supplemental links</strong><span>Add approved portfolio, repository, or reference links.</span></div>
          <button type="button" onClick={onAddLink}>Add Link</button>
        </div>
        {links.map((link) => (
          <div className="editable-row link-row" key={link.id}>
            <label className="workflow-field"><span>Label</span><input type="text" value={link.label} onChange={(event) => onUpdateLink(link.id, 'label', event.target.value)} placeholder="Portfolio" maxLength={120} /></label>
            <label className="workflow-field"><span>URL</span><input type="url" value={link.url} onChange={(event) => onUpdateLink(link.id, 'url', event.target.value)} placeholder="https://example.com" maxLength={2048} /></label>
            <button type="button" className="remove-row" onClick={() => onRemoveLink(link.id)} aria-label={`Remove ${link.label || 'supplemental link'}`}>Remove</button>
          </div>
        ))}
      </div>
      <div className="editable-list">
        <div className="editable-list-heading">
          <div><strong>Manual interview questions</strong><span>Add questions now; model-generated questions can be integrated later.</span></div>
          <button type="button" onClick={onAddQuestion}>Add Question</button>
        </div>
        {questions.map((question, index) => (
          <div className="editable-row question-row" key={question.id}>
            <label className="workflow-field"><span>Question {index + 1}</span><textarea value={question.prompt} onChange={(event) => onUpdateQuestion(question.id, event.target.value)} placeholder="Enter an interviewer-approved question." rows="3" maxLength={4000} /></label>
            <button type="button" className="remove-row" onClick={() => onRemoveQuestion(question.id)} aria-label={`Remove question ${index + 1}`}>Remove</button>
          </div>
        ))}
      </div>
      <label className="workflow-field">
        <span>Supplement details</span>
        <textarea value={notes} onChange={(event) => onNotesChange(event.target.value)} placeholder="Explain how these materials should be used during the interview." rows="5" maxLength={20000} />
      </label>
    </div>
  );
}
