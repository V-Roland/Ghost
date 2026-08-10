import React, { useState } from 'react';
import { ingestTranscript } from '../../services/api/afterInterviewService.js';

function formatTimestamp(seconds) {
  const safeSeconds = Math.max(0, Math.floor(Number(seconds) || 0));
  const minutes = Math.floor(safeSeconds / 60);
  return `${minutes}:${String(safeSeconds % 60).padStart(2, '0')}`;
}

export default function AfterInterviewReport() {
  const [mode, setMode] = useState('sample');
  const [vtt, setVtt] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const selectMode = (nextMode) => {
    setMode(nextMode);
    setResult(null);
    setError('');
  };

  const run = async () => {
    setError('');
    setLoading(true);
    setResult(null);
    try {
      setResult(await ingestTranscript(mode === 'vtt' ? { mode, vtt } : { mode }));
    } catch (requestError) {
      setError(requestError.message || 'The report could not be generated.');
    } finally {
      setLoading(false);
    }
  };

  const signals = result?.report?.signals || [];
  const evidencePackets = result?.report?.evidencePackets || [];
  const segments = result?.transcript?.segments || [];

  return (
    <section className="report-screen">
      <div className="card report-intake">
        <span className="eyebrow">Human review workspace</span>
        <h1>After-interview report</h1>
        <p className="muted">Generate a local review packet from WebVTT captions. Transcript excerpts and review signals are context for an interviewer, never hiring conclusions.</p>

        <fieldset className="report-source-options">
          <legend>Transcript source</legend>
          <label>
            <input type="radio" name="report-source" checked={mode === 'sample'} onChange={() => selectMode('sample')} />
            Use bundled sample transcript
          </label>
          <label>
            <input type="radio" name="report-source" checked={mode === 'vtt'} onChange={() => selectMode('vtt')} />
            Paste a WebVTT transcript
          </label>
        </fieldset>

        {mode === 'vtt' && (
          <label className="report-vtt-field">
            <span>WebVTT transcript</span>
            <textarea rows={10} value={vtt} onChange={(event) => setVtt(event.target.value)} placeholder={'WEBVTT\n\n00:00:00.000 --> 00:00:03.000\nInterviewer: Welcome.'} />
            <small>Maximum request size: 200 KB.</small>
          </label>
        )}

        <button type="button" className="primary" onClick={run} disabled={loading || (mode === 'vtt' && !vtt.trim())}>
          {loading ? 'Generating…' : 'Generate review packet'}
        </button>
        <div aria-live="polite">
          {error && <div role="alert" className="auth-error report-status">{error}</div>}
        </div>
      </div>

      {result && (
        <div className="report-results" aria-live="polite">
          <section className="card report-summary">
            <span className="eyebrow">Review packet</span>
            <h2>Summary</h2>
            <p>{result.report.summary}</p>
            <p className="muted">Generated {new Date(result.report.generatedAt).toLocaleString()} from the {result.source} source.</p>
          </section>

          <section className="card">
            <h2>Review signals</h2>
            {signals.length ? (
              <ul className="report-signal-list">
                {signals.map((signal) => <li key={signal.id}><strong>{signal.type}</strong><span>{signal.description}</span></li>)}
              </ul>
            ) : <p className="muted">No heuristic review signals were produced. Review the transcript evidence directly.</p>}
          </section>

          <section className="card report-wide">
            <h2>Evidence packet</h2>
            <div className="report-evidence-grid">
              {evidencePackets.map((evidence) => (
                <article key={evidence.id} className="report-evidence-item">
                  <div><strong>{evidence.speaker}</strong><span>{formatTimestamp(evidence.timestamp)}</span></div>
                  <blockquote>{evidence.quote}</blockquote>
                  <p>{evidence.context}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="card report-wide">
            <h2>Normalized transcript</h2>
            <div className="report-transcript">
              {segments.map((segment, index) => (
                <div key={`${segment.start}-${index}`} className="report-transcript-row">
                  <span>{formatTimestamp(segment.start)}–{formatTimestamp(segment.end)}</span>
                  <strong>{segment.speaker}</strong>
                  <p>{segment.text}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
