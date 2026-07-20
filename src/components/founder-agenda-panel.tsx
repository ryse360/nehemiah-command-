'use client';

import type { FounderAgenda } from '@/nehemiah/calendar-gmail-integration';

export function FounderAgendaPanel({ agenda, isOpen, loading, error, onClose, onRefresh }: {
  agenda: FounderAgenda | null;
  isOpen: boolean;
  loading: boolean;
  error: string;
  onClose: () => void;
  onRefresh: () => void;
}) {
  if (!isOpen) return null;
  return (
    <aside className="memory-panel" aria-label="Founder agenda">
      <div className="memory-panel-header">
        <div><p className="section-label">FOUNDER AGENDA</p><h2>Commitments and decision requests</h2></div>
        <button className="secondary-button" type="button" onClick={onClose}>Close</button>
      </div>
      <div className="memory-controls">
        <button className="secondary-button" type="button" onClick={onRefresh} disabled={loading}>{loading ? 'Refreshing…' : 'Refresh'}</button>
      </div>
      {error ? <p className="error-message">{error}</p> : null}
      {agenda ? (
        <>
          <p>{agenda.decisionRequests} decision request{agenda.decisionRequests === 1 ? '' : 's'} · {agenda.commitments} commitment{agenda.commitments === 1 ? '' : 's'} · {agenda.communications} communication{agenda.communications === 1 ? '' : 's'}</p>
          <div className="memory-list">
            {agenda.items.length ? agenda.items.map((item) => (
              <article className="memory-record" key={item.id}>
                <p className="section-label">{item.kind.replace('-', ' ').toUpperCase()} · {item.source.toUpperCase()}</p>
                <h3>{item.title}</h3>
                <p>{item.summary}</p>
                <time dateTime={item.occurredAt}>{new Date(item.occurredAt).toLocaleString()}</time>
              </article>
            )) : <p>No governed Calendar or Gmail signals are available.</p>}
          </div>
        </>
      ) : loading ? <p>Loading Founder agenda…</p> : null}
    </aside>
  );
}
