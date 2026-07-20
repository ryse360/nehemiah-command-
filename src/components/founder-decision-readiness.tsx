import type { FounderDecisionReadiness } from '@/nehemiah/founder-decision-readiness';

const statusLabel = {
  ready: 'Ready for Founder',
  conditional: 'Conditional readiness',
  'not-ready': 'Continue preparation',
} as const;

export function FounderDecisionReadinessCard({ readiness }: { readiness: FounderDecisionReadiness }) {
  return (
    <section className={`decision-readiness is-${readiness.status}`} aria-label="Founder decision readiness">
      <header className="readiness-heading">
        <div>
          <p className="section-label">DECISION READINESS</p>
          <h3>{statusLabel[readiness.status]}</h3>
        </div>
        <span className="readiness-score" aria-label={`${readiness.score} of ${readiness.total} readiness dimensions complete`}>
          {readiness.score}/{readiness.total}
        </span>
      </header>

      <p className="readiness-summary">{readiness.summary}</p>

      <div className="readiness-dimensions">
        {readiness.dimensions.map((dimension) => (
          <article key={dimension.key} className={dimension.ready ? 'is-ready' : 'is-missing'}>
            <span aria-hidden="true">{dimension.ready ? '✓' : '—'}</span>
            <div>
              <strong>{dimension.label}</strong>
              <p>{dimension.explanation}</p>
            </div>
          </article>
        ))}
      </div>

      {readiness.nextRequirement ? (
        <div className="readiness-next">
          <span>Next requirement</span>
          <p>{readiness.nextRequirement}</p>
        </div>
      ) : null}
    </section>
  );
}
