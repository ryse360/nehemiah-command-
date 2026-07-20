'use client';

import { FormEvent, useState } from 'react';
import type { KnowledgeIndex, KnowledgeRecord, KnowledgeSearchResponse, KnowledgeSearchResult } from '@/nehemiah/drive-obsidian-knowledge';

function isSearchResult(record: KnowledgeRecord | KnowledgeSearchResult): record is KnowledgeSearchResult {
  return typeof (record as KnowledgeSearchResult).excerpt === 'string'
    && typeof (record as KnowledgeSearchResult).citation === 'string';
}

export function FounderKnowledgePanel({ data, isOpen, loading, error, onClose, onSearch, onRefresh }: {
  data: KnowledgeIndex | KnowledgeSearchResponse | null;
  isOpen: boolean;
  loading: boolean;
  error: string;
  onClose: () => void;
  onSearch: (query: string) => void;
  onRefresh: () => void;
}) {
  const [query, setQuery] = useState('');
  if (!isOpen) return null;
  const records: Array<KnowledgeRecord | KnowledgeSearchResult> = data && 'results' in data ? data.results : data?.records ?? [];
  return (
    <aside className="memory-panel knowledge-panel" aria-label="Founder knowledge">
      <div className="memory-panel-header">
        <div><p className="section-label">FOUNDER KNOWLEDGE</p><h2>Drive and Obsidian evidence</h2></div>
        <button className="secondary-button" type="button" onClick={onClose}>Close</button>
      </div>
      <form className="memory-controls" onSubmit={(event: FormEvent) => { event.preventDefault(); onSearch(query); }}>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search evidence, decisions, or source records" aria-label="Search Founder knowledge" />
        <button className="secondary-button" type="submit" disabled={loading}>{loading ? 'Searching…' : 'Search'}</button>
        <button className="secondary-button" type="button" onClick={onRefresh} disabled={loading}>All sources</button>
      </form>
      {error ? <p className="error-message">{error}</p> : null}
      <p>{records.length} governed source{records.length === 1 ? '' : 's'} available.</p>
      <div className="memory-list">
        {records.length ? records.map((record) => (
          <article className="memory-record knowledge-record" key={`${record.sourceKind}:${record.id}`}>
            <p className="section-label">{record.sourceKind === 'google-drive' ? 'GOOGLE DRIVE' : 'OBSIDIAN'} · {record.visibility.replace('-', ' ').toUpperCase()}</p>
            <h3>{record.title}</h3>
            {'excerpt' in record ? <p>{String(record.excerpt)}</p> : <p>{record.content.slice(0, 280)}{record.content.length > 280 ? '…' : ''}</p>}
            <div className="knowledge-meta">
              <span>Modified {new Date(record.modifiedAt).toLocaleString()}</span>
              {record.tags.length ? <span>{record.tags.join(' · ')}</span> : null}
            </div>
            {'citation' in record ? <p className="knowledge-citation">{String(record.citation)}</p> : null}
            {record.sourceKind === 'google-drive' ? <a href={record.sourceRef} target="_blank" rel="noreferrer">Open governed source</a> : <code>{record.sourceRef}</code>}
          </article>
        )) : loading ? <p>Retrieving governed knowledge…</p> : <p>No matching knowledge sources are available.</p>}
      </div>
    </aside>
  );
}
