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
}: {
  onSelect: (disposition: DecisionDisposition) => void;
}) {
  return (
    <div className="decision-actions" aria-label="Founder decision actions">
      {actions.map((action) => (
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
