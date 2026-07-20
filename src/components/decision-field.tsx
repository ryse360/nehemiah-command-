import type { DecisionDisposition } from '@/nehemiah/founder-journey';
import type { StateContent } from '@/nehemiah/state-content';
import { DecisionActions } from './decision-actions';

export function DecisionField({ decision, isOpen, onOpen, onDisposition }: {
  decision: NonNullable<StateContent['decision']>;
  isOpen: boolean;
  onOpen: () => void;
  onDisposition: (disposition: DecisionDisposition) => void;
}) {
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
      {isOpen ? (
        <DecisionActions onSelect={onDisposition} />
      ) : (
        <button className="primary-button" type="button" onClick={onOpen}>
          {decision.cta}
        </button>
      )}
      <p className="authority-line">Nehemiah prepares the decision. You choose the direction.</p>
    </aside>
  );
}
