'use client';

import { useMemo, useState } from 'react';
import type { DecisionDisposition } from '@/nehemiah/founder-journey';
import type { FounderMemory } from '@/nehemiah/founder-memory';
import {
  analyzeFounderMemory,
  filterFounderDecisions,
} from '@/nehemiah/founder-memory-intelligence';

const dispositions: Array<{ value: DecisionDisposition | 'all'; label: string }> = [
  { value: 'all', label: 'All decisions' },
  { value: 'approve', label: 'Approved' },
  { value: 'approve-with-limits', label: 'Approved with limits' },
  { value: 'request-evidence', label: 'Evidence requested' },
  { value: 'delay', label: 'Delayed' },
  { value: 'reject', label: 'Rejected' },
];

export function FounderMemoryPanel({ memory, isOpen, onClose, currentCommand = '' }: {
  memory: FounderMemory;
  isOpen: boolean;
  onClose: () => void;
  currentCommand?: string;
}) {
  const [query, setQuery] = useState('');
  const [disposition, setDisposition] = useState<DecisionDisposition | 'all'>('all');
  const intelligence = useMemo(
    () => analyzeFounderMemory(memory, currentCommand),
    [memory, currentCommand],
  );
  const decisions = useMemo(
    () => filterFounderDecisions(memory.decisions, { query, disposition }),
    [memory.decisions, query, disposition],
  );

  if (!isOpen) return null;

  return (
    <aside className="memory-panel" aria-label="Founder memory intelligence">
      <header className="memory-header">
        <div>
          <p className="section-label">FOUNDER MEMORY INTELLIGENCE</p>
          <h2>Decisions that compound</h2>
        </div>
        <button className="secondary-button" type="button" onClick={onClose}>Close</button>
      </header>

      <section className="memory-intelligence" aria-label="Memory intelligence summary">
        <div className="memory-stat"><strong>{intelligence.totalDecisions}</strong><span>completed decisions</span></div>
        <div className="memory-stat"><strong>{intelligence.patterns.length}</strong><span>recurring patterns</span></div>
        <div className="memory-stat"><strong>{intelligence.lessons.length}</strong><span>preserved lessons</span></div>
      </section>

      {intelligence.similarDecisions.length > 0 ? (
        <section className="memory-insight">
          <p className="section-label">RELEVANT PRECEDENT</p>
          <h3>A prior decision resembles the current command.</h3>
          {intelligence.similarDecisions.map(({ record, sharedTerms }) => (
            <article key={record.id} className="precedent-card">
              <span>{sharedTerms.join(' · ')}</span>
              <strong>{record.command}</strong>
              <p>{record.lesson ?? record.proof}</p>
            </article>
          ))}
        </section>
      ) : null}

      {intelligence.patterns.length > 0 ? (
        <section className="memory-insight">
          <p className="section-label">RECURRING PATTERNS</p>
          <ul className="pattern-list">
            {intelligence.patterns.map((pattern) => (
              <li key={pattern.id}><strong>{pattern.count}×</strong><span>{pattern.summary}</span></li>
            ))}
          </ul>
        </section>
      ) : null}

      {intelligence.lessons.length > 0 ? (
        <details className="lesson-library">
          <summary>Lessons learned</summary>
          <ul>{intelligence.lessons.map((lesson) => <li key={lesson}>{lesson}</li>)}</ul>
        </details>
      ) : null}

      <section className="memory-search" aria-label="Search decision history">
        <label htmlFor="memory-query">Search history</label>
        <input
          id="memory-query"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search commands, proof, actions, or lessons…"
        />
        <label htmlFor="memory-disposition">Decision type</label>
        <select
          id="memory-disposition"
          value={disposition}
          onChange={(event) => setDisposition(event.target.value as DecisionDisposition | 'all')}
        >
          {dispositions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
      </section>

      {memory.decisions.length === 0 ? (
        <div className="memory-empty">
          <p>No completed decisions yet.</p>
          <span>Decisions appear here after visible proof is captured and the review is closed.</span>
        </div>
      ) : decisions.length === 0 ? (
        <div className="memory-empty">
          <p>No matching decisions.</p>
          <span>Adjust the search or decision filter.</span>
        </div>
      ) : (
        <ol className="memory-list">
          {decisions.map((record) => (
            <li key={record.id} className="memory-record">
              <div className="memory-record-topline">
                <span>{record.disposition.replaceAll('-', ' ')}</span>
                <time dateTime={record.proofRecordedAt}>{new Date(record.proofRecordedAt).toLocaleDateString()}</time>
              </div>
              <h3>{record.command}</h3>
              {record.decisionNote ? <p><strong>Limits:</strong> {record.decisionNote}</p> : null}
              {record.visibleAction ? <p><strong>Visible action:</strong> {record.visibleAction}</p> : null}
              <p><strong>Proof:</strong> {record.proof}</p>
              {record.lesson ? <p className="memory-lesson"><strong>Lesson:</strong> {record.lesson}</p> : null}
            </li>
          ))}
        </ol>
      )}
    </aside>
  );
}
