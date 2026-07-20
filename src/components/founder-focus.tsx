'use client';

import { useState } from 'react';
import type { StateContent } from '@/nehemiah/state-content';

export function FounderFocus({ focus }: { focus: NonNullable<StateContent['focus']> }) {
  const [whyOpen, setWhyOpen] = useState(false);

  return (
    <section className="focus-column" aria-labelledby="today-focus-title">
      <p className="section-label">{focus.label}</p>
      <h2 id="today-focus-title">{focus.body}</h2>
      <button
        className="text-action"
        type="button"
        aria-expanded={whyOpen}
        onClick={() => setWhyOpen((value) => !value)}
      >
        Why this comes first {whyOpen ? '↑' : '↓'}
      </button>
      {whyOpen ? <p className="why-copy">{focus.why}</p> : null}
      <div className="protected-window">
        <span className="window-icon" aria-hidden="true">◷</span>
        <div>
          <p className="section-label">PROTECTED WINDOW</p>
          <strong>{focus.protectedWindow.split(' · ')[0]}</strong>
          <span>{focus.protectedWindow.split(' · ').slice(1).join(' · ')}</span>
        </div>
      </div>
    </section>
  );
}
