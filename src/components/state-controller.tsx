import type { NehemiahState } from '@/nehemiah/state-machine';

const stateLabels: Record<NehemiahState, string> = {
  resting: 'Resting',
  listening: 'Listening',
  'focus-surfaced': 'Focus surfaced',
  'decision-required': 'Decision required',
  'action-underway': 'Action underway',
  'proof-created': 'Proof created',
};

export function StateController({ current, onAdvance }: {
  current: NehemiahState;
  onAdvance: () => void;
}) {
  const action: Partial<Record<NehemiahState, string>> = {
    listening: 'Surface focus',
    'focus-surfaced': 'Prepare decision',
  };

  return (
    <section className="state-controller" aria-label="Journey status">
      <span className="journey-status"><span aria-hidden="true" />{stateLabels[current]}</span>
      {action[current] ? (
        <button type="button" className="state-button is-current" onClick={onAdvance}>
          {action[current]}
        </button>
      ) : null}
    </section>
  );
}
