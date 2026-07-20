import type { NehemiahState } from '@/nehemiah/state-machine';

export function LivingOrganism({ state }: { state: NehemiahState }) {
  return (
    <div
      className="organism"
      data-organism-state={state}
      role="img"
      aria-label={`Nehemiah living intelligence artifact in ${state.replaceAll('-', ' ')} state`}
    >
      <span className="organism-shell shell-one" />
      <span className="organism-shell shell-two" />
      <span className="organism-shell shell-three" />
      <span className="organism-core" />
      <span className="signal-thread" />
    </div>
  );
}
