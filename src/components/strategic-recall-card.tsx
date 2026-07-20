import type { StrategicRecall } from '@/nehemiah/founder-strategic-recall';

function formatTerms(terms: string[]): string {
  return terms.length > 0 ? terms.join(' · ') : 'No material overlap identified.';
}

export function StrategicRecallCard({ recall }: { recall: StrategicRecall }) {
  const { record } = recall.precedent;

  return (
    <section className="strategic-recall" aria-label="Founder strategic recall">
      <div className="recall-heading">
        <div>
          <p className="section-label">FOUNDER STRATEGIC RECALL</p>
          <h3>{recall.headline}</h3>
        </div>
        <span className="recall-score">{Math.round(recall.precedent.score * 100)}% related</span>
      </div>

      <article className="recall-precedent">
        <p className="recall-kicker">Closest precedent</p>
        <strong>{record.command}</strong>
        <p>{record.lesson ?? record.proof}</p>
      </article>

      <div className="recall-comparison">
        <div>
          <span>What is similar</span>
          <p>{formatTerms(recall.similarities)}</p>
        </div>
        <div>
          <span>What is different now</span>
          <p>{formatTerms(recall.differences.currentOnly)}</p>
        </div>
        <div>
          <span>What belonged to the precedent</span>
          <p>{formatTerms(recall.differences.precedentOnly)}</p>
        </div>
      </div>

      {recall.warning ? (
        <div className={`recall-warning is-${recall.warning.level}`} role="note">
          <p className="recall-kicker">Pattern warning</p>
          <strong>{recall.warning.message}</strong>
          <p>{recall.warning.evidence}</p>
        </div>
      ) : null}

      <div className="recall-question">
        <span>Founder question</span>
        <p>{recall.founderQuestion}</p>
      </div>
    </section>
  );
}
