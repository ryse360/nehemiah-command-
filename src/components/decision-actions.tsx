import type { DecisionDisposition } from '@/nehemiah/founder-journey';

const actions: Array<{ disposition: DecisionDisposition; label: string }> = [
  { disposition: 'approve', label: 'Approve' },
  { disposition: 'approve-with-limits', label: 'Approve with limits' },
  { disposition: 'request-evidence', label: 'Request more evidence' },
  { disposition: 'delay', label: 'Delay' },
  { disposition: 'reject', label: 'Reject' },
];

export function DecisionActions({
  onSelect,
  allowedDispositions = actions.map((action) => action.disposition),
}: {
  onSelect: (disposition: DecisionDisposition) => void;
  allowedDispositions?: DecisionDisposition[];
}) {
  return (
    <div className="decision-actions" aria-label="Founder decision actions">
      {actions
        .filter((action) => allowedDispositions.includes(action.disposition))
        .map((action) => (
          <button
            key={action.disposition}
            type="button"
            className={action.disposition === 'approve' ? 'primary-button' : 'secondary-button'}
            onClick={() => onSelect(action.disposition)}
          >
            {action.label}
          </button>
        ))}
    </div>
  );
}
