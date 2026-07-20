import type { AIOrchestrationResult } from '@/nehemiah/ai-orchestration';

export function AIDecisionPreparationCard({
  result,
  status,
  error,
  onPrepare,
}: {
  result: AIOrchestrationResult | null;
  status: 'idle' | 'loading' | 'ready' | 'error';
  error?: string;
  onPrepare: () => void;
}) {
  return (
    <section className="ai-preparation-card" aria-label="AI decision preparation">
      <div className="ai-preparation-header">
        <div>
          <p className="section-label">NEHEMIAH AI PREPARATION</p>
          <h3>Prepare with governed intelligence</h3>
        </div>
        <button className="secondary-button" type="button" onClick={onPrepare} disabled={status === 'loading'}>
          {status === 'loading' ? 'Preparing…' : result ? 'Refresh preparation' : 'Prepare decision'}
        </button>
      </div>
      <p>AI may organize evidence, assumptions, risks, and three-move consequences. It cannot decide or execute.</p>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      {result ? (
        <div className="ai-preparation-content">
          <section><p className="section-label">WHY NOW</p><p>{result.preparation.whyNow}</p></section>
          <section><p className="section-label">WHAT COULD BECOME POSSIBLE</p><p>{result.preparation.whatCouldBecomePossible}</p></section>
          <section><p className="section-label">THREE MOVES AHEAD</p>
            <ol>
              <li>{result.preparation.immediateResponse}</li>
              <li>{result.preparation.secondOrderConsequence}</li>
              <li>{result.preparation.preparedContinuation}</li>
            </ol>
          </section>
          <section><p className="section-label">EVIDENCE REQUIRED</p><ul>{result.preparation.evidenceRequired.map((item) => <li key={item}>{item}</li>)}</ul></section>
          <section><p className="section-label">RISKS</p><ul>{result.preparation.risks.map((item) => <li key={item.risk}><strong>{item.risk}</strong> — {item.mitigation}</li>)}</ul></section>
          <blockquote>{result.preparation.founderQuestion}</blockquote>
          <p className="ai-audit-line">Model: {result.audit.model} · Attempts: {result.audit.attempts} · Confidence: {Math.round(result.preparation.confidence * 100)}% · No tools executed</p>
        </div>
      ) : null}
    </section>
  );
}
