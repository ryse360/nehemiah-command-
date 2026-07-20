import type { FounderDecisionGate } from '@/nehemiah/founder-decision-gate';
import type { DecisionDisposition } from '@/nehemiah/founder-journey';
import type { StateContent } from '@/nehemiah/state-content';
import { DecisionActions } from './decision-actions';

export function DecisionField({ decision, gate, isOpen, onOpen, onDisposition }: {
  decision: NonNullable<StateContent['decision']>;
  gate: FounderDecisionGate;
  isOpen: boolean;
  onOpen: () => void;
  onDisposition: (disposition: DecisionDisposition) => void;
}) {
  const showActions = isOpen || gate.status === 'blocked';

  return (
    <aside className="decision-field" aria-labelledby="decision-title">
      <p className="decision-kicker">FOUNDER DECISION REQUIRED</p>
      <h2 id="decision-title">{decision.title}</h2>
      <div className="decision-sequence">
        {decision.sections.map((section) => (
          <section key={section.label}>
            <p className="section-label">{section.label}</p>
            <p>{section.body}</p>
          </section>
        ))}
      </div>

      <section className={`decision-gate is-${gate.status}`} aria-label="Founder decision gate">
        <p className="section-label">DECISION GATE</p>
        <strong>{gate.message}</strong>
        {gate.requirement ? <p>{gate.requirement}</p> : null}
      </section>

      {showActions ? (
        <DecisionActions
          onSelect={onDisposition}
          allowedDispositions={gate.allowedDispositions}
        />
      ) : (
        <button className="primary-button" type="button" onClick={onOpen}>
          {gate.status === 'conditional' ? 'Review with conditions' : decision.cta}
        </button>
      )}
      <p className="authority-line">Nehemiah prepares the decision. You choose the direction.</p>
    </aside>
  );
}
