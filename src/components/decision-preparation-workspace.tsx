'use client';

import { useState } from 'react';
import type { DecisionPreparationWorkspace } from '@/nehemiah/founder-decision-preparation';
import type { ReadinessDimension } from '@/nehemiah/founder-decision-readiness';

export function DecisionPreparationWorkspaceCard({
  workspace,
  onResolve,
}: {
  workspace: DecisionPreparationWorkspace;
  onResolve: (dimension: ReadinessDimension, response: string) => void;
}) {
  const [responses, setResponses] = useState<Partial<Record<ReadinessDimension, string>>>({});
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
          : 'Nehemiah will not treat an identified gap as resolved until a concrete answer is recorded.'}
      </p>

      <div className="preparation-items">
        {workspace.items.map((item) => (
          <article key={item.dimension} className={item.status === 'resolved' ? 'is-resolved' : 'is-unresolved'}>
            <div className="preparation-item-heading">
              <div>
                <span>{item.label}</span>
                <strong>{item.prompt}</strong>
              </div>
              <b aria-label={`${item.label} ${item.status}`}>{item.status === 'resolved' ? '✓' : '—'}</b>
            </div>

            {item.status === 'resolved' ? (
              <div className="preparation-response">
                <span>Recorded resolution</span>
                <p>{item.response}</p>
              </div>
            ) : (
              <>
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
        ))}
      </div>

      {error ? <p className="preparation-error" role="alert">{error}</p> : null}
    </section>
  );
}
