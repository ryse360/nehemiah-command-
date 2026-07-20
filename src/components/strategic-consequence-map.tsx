import type { StrategicConsequenceMap } from '@/nehemiah/strategic-consequence-mapping';

const moves: Array<{ key: keyof Pick<StrategicConsequenceMap, 'immediateResponse' | 'secondOrderConsequence' | 'preparedContinuation'>; label: string; move: string }> = [
  { key: 'immediateResponse', label: 'Likely immediate response', move: 'Move 1' },
  { key: 'secondOrderConsequence', label: 'Second-order consequence', move: 'Move 2' },
  { key: 'preparedContinuation', label: 'Prepared continuation', move: 'Move 3' },
];

export function StrategicConsequenceMapCard({ map }: { map: StrategicConsequenceMap }) {
  return (
    <section className={`consequence-map is-${map.riskLevel}`} aria-label="Strategic consequence map">
      <header className="consequence-heading">
        <div>
          <p className="section-label">THREE MOVES AHEAD</p>
          <h3>Consequences prepared before commitment.</h3>
        </div>
        <span className="consequence-risk">{map.riskLevel} exposure</span>
      </header>

      <div className="consequence-moves">
        {moves.map(({ key, label, move }) => (
          <article key={key}>
            <span>{move}</span>
            <strong>{label}</strong>
            <p>{map[key]}</p>
          </article>
        ))}
      </div>

      <div className="consequence-boundaries">
        <article>
          <span>Resource tradeoff</span>
          <p>{map.resourceTradeoff}</p>
        </article>
        <article>
          <span>Stop condition</span>
          <p>{map.stopCondition}</p>
        </article>
      </div>

      <details className="consequence-assumptions">
        <summary>Assumptions Nehemiah is using</summary>
        <ul>{map.assumptions.map((assumption) => <li key={assumption}>{assumption}</li>)}</ul>
      </details>

      <div className="consequence-question">
        <span>Founder question</span>
        <p>{map.founderQuestion}</p>
      </div>
    </section>
  );
}
