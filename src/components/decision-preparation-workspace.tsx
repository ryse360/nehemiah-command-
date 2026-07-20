'use client';

import { useState } from 'react';
import type { DecisionPreparationWorkspace } from '@/nehemiah/founder-decision-preparation';
import type { ReadinessDimension } from '@/nehemiah/founder-decision-readiness';
import type { PreparationEvidenceInput } from '@/nehemiah/founder-decision-evidence';

type EvidenceDraft = PreparationEvidenceInput;

const emptyEvidenceDraft: EvidenceDraft = {
  type: 'link',
  title: '',
  reference: '',
  owner: '',
  dueDate: '',
};

export function DecisionPreparationWorkspaceCard({
  workspace,
  onResolve,
  onAddEvidence,
  onVerifyEvidence,
}: {
  workspace: DecisionPreparationWorkspace;
  onResolve: (dimension: ReadinessDimension, response: string) => void;
  onAddEvidence: (dimension: ReadinessDimension, evidence: PreparationEvidenceInput) => void;
  onVerifyEvidence: (dimension: ReadinessDimension, evidenceId: string) => void;
}) {
  const [responses, setResponses] = useState<Partial<Record<ReadinessDimension, string>>>({});
  const [evidenceDrafts, setEvidenceDrafts] = useState<Partial<Record<ReadinessDimension, EvidenceDraft>>>({});
  const [error, setError] = useState<string | null>(null);

  if (workspace.status === 'not-needed') return null;

  function resolve(dimension: ReadinessDimension) {
    try {
      onResolve(dimension, responses[dimension] ?? '');
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The preparation item could not be resolved.');
    }
  }

  function updateEvidenceDraft(
    dimension: ReadinessDimension,
    field: keyof EvidenceDraft,
    value: string,
  ) {
    setEvidenceDrafts((current) => ({
      ...current,
      [dimension]: {
        ...emptyEvidenceDraft,
        ...current[dimension],
        [field]: value,
      },
    }));
  }

  function addEvidence(dimension: ReadinessDimension) {
    try {
      const draft = { ...emptyEvidenceDraft, ...evidenceDrafts[dimension] };
      onAddEvidence(dimension, draft);
      setEvidenceDrafts((current) => ({ ...current, [dimension]: emptyEvidenceDraft }));
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The evidence could not be attached.');
    }
  }

  return (
    <section className={`preparation-workspace is-${workspace.status}`} aria-label="Decision preparation workspace">
      <header className="preparation-heading">
        <div>
          <p className="section-label">DECISION PREPARATION</p>
          <h3>{workspace.status === 'complete' ? 'Preparation complete' : 'Resolve what is missing'}</h3>
        </div>
        <span>{workspace.completed}/{workspace.total}</span>
      </header>

      <p className="preparation-summary">
        {workspace.status === 'complete'
          ? 'The missing requirements have been converted into explicit Founder-supplied operating detail.'
          : 'A gap is resolved only when concrete operating detail and required evidence are recorded.'}
      </p>

      <div className="preparation-items">
        {workspace.items.map((item) => {
          const draft = { ...emptyEvidenceDraft, ...evidenceDrafts[item.dimension] };
          return (
            <article key={item.dimension} className={item.status === 'resolved' ? 'is-resolved' : 'is-unresolved'}>
              <div className="preparation-item-heading">
                <div>
                  <span>{item.label}</span>
                  <strong>{item.prompt}</strong>
                </div>
                <b aria-label={`${item.label} ${item.status}`}>{item.status === 'resolved' ? '✓' : '—'}</b>
              </div>

              <div className="evidence-list" aria-label={`${item.label} evidence`}>
                {item.evidence.length ? item.evidence.map((evidence) => (
                  <div className={`evidence-record is-${evidence.verificationStatus}`} key={evidence.id}>
                    <div>
                      <strong>{evidence.title}</strong>
                      <span>{evidence.type} · {evidence.owner ?? 'Owner unassigned'}</span>
                      <small>{evidence.reference}</small>
                    </div>
                    {evidence.verificationStatus === 'verified' ? (
                      <b>Verified</b>
                    ) : (
                      <button type="button" className="text-action" onClick={() => onVerifyEvidence(item.dimension, evidence.id)}>
                        Verify
                      </button>
                    )}
                  </div>
                )) : <p className="empty-evidence">No evidence attached.</p>}
              </div>

              {item.status === 'resolved' ? (
                <div className="preparation-response">
                  <span>Recorded resolution</span>
                  <p>{item.response}</p>
                </div>
              ) : (
                <>
                  <details className="evidence-composer">
                    <summary>Attach evidence</summary>
                    <div className="evidence-fields">
                      <label>
                        Type
                        <select value={draft.type} onChange={(event) => updateEvidenceDraft(item.dimension, 'type', event.target.value)}>
                          <option value="link">Link</option>
                          <option value="file">File reference</option>
                          <option value="source">Source record</option>
                        </select>
                      </label>
                      <label>
                        Title
                        <input value={draft.title} onChange={(event) => updateEvidenceDraft(item.dimension, 'title', event.target.value)} />
                      </label>
                      <label className="is-wide">
                        Reference
                        <input value={draft.reference} onChange={(event) => updateEvidenceDraft(item.dimension, 'reference', event.target.value)} placeholder={draft.type === 'link' ? 'https://…' : 'File name, path, or source identifier'} />
                      </label>
                      <label>
                        Owner
                        <input value={draft.owner ?? ''} onChange={(event) => updateEvidenceDraft(item.dimension, 'owner', event.target.value)} />
                      </label>
                      <label>
                        Due date
                        <input type="date" value={draft.dueDate ?? ''} onChange={(event) => updateEvidenceDraft(item.dimension, 'dueDate', event.target.value)} />
                      </label>
                    </div>
                    <button className="secondary-button" type="button" onClick={() => addEvidence(item.dimension)}>
                      Add evidence
                    </button>
                  </details>

                  <p className="preparation-required">{item.requiredOutput}</p>
                  <label htmlFor={`preparation-${item.dimension}`}>Founder response</label>
                  <textarea
                    id={`preparation-${item.dimension}`}
                    value={responses[item.dimension] ?? ''}
                    onChange={(event) => setResponses((current) => ({
                      ...current,
                      [item.dimension]: event.target.value,
                    }))}
                    placeholder={item.suggestedAction}
                  />
                  <button className="secondary-button" type="button" onClick={() => resolve(item.dimension)}>
                    Record resolution
                  </button>
                </>
              )}
            </article>
          );
        })}
      </div>

      {error ? <p className="preparation-error" role="alert">{error}</p> : null}
    </section>
  );
}
