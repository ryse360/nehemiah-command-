'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  createFounderJourney,
  reduceFounderJourney,
  type DecisionDisposition,
} from '@/nehemiah/founder-journey';
import { buildShellModel } from '@/nehemiah/shell-model';
import {
  appendJourneyToMemory,
  createFounderMemory,
  deserializeFounderMemory,
  FOUNDER_MEMORY_KEY,
  LEGACY_FOUNDER_MEMORY_KEY,
  serializeFounderMemory,
} from '@/nehemiah/founder-memory';
import { DecisionField } from './decision-field';
import { FounderFocus } from './founder-focus';
import { LivingOrganism } from './living-organism';
import { StateController } from './state-controller';
import { FounderMemoryPanel } from './founder-memory-panel';
import { buildStrategicRecall } from '@/nehemiah/founder-strategic-recall';
import { StrategicRecallCard } from './strategic-recall-card';
import { buildConsequenceMap } from '@/nehemiah/strategic-consequence-mapping';
import { StrategicConsequenceMapCard } from './strategic-consequence-map';
import { assessDecisionReadiness } from '@/nehemiah/founder-decision-readiness';
import { FounderDecisionReadinessCard } from './founder-decision-readiness';
import { buildFounderDecisionGate, dispositionIsAllowed } from '@/nehemiah/founder-decision-gate';
import {
  applyDecisionPreparation,
  buildDecisionPreparationWorkspace,
  resolvePreparationItem,
  type DecisionPreparationWorkspace,
} from '@/nehemiah/founder-decision-preparation';
import type { ReadinessDimension } from '@/nehemiah/founder-decision-readiness';
import { DecisionPreparationWorkspaceCard } from './decision-preparation-workspace';
import { addPreparationEvidence, verifyPreparationEvidence, type PreparationEvidenceInput } from '@/nehemiah/founder-decision-evidence';
import { mergeFounderMemories } from '@/nehemiah/cloud-memory';
import { loadCloudFounderMemory, saveCloudFounderMemory } from '@/nehemiah/cloud-memory-client';

export function NehemiahShell() {
  const [journey, setJourney] = useState(createFounderJourney);
  const [command, setCommand] = useState('');
  const [decisionOpen, setDecisionOpen] = useState(false);
  const [proof, setProof] = useState('');
  const [lesson, setLesson] = useState('');
  const [memory, setMemory] = useState(createFounderMemory);
  const [memoryOpen, setMemoryOpen] = useState(false);
  const [memoryLoaded, setMemoryLoaded] = useState(false);
  const [cloudRevision, setCloudRevision] = useState(0);
  const [cloudStatus, setCloudStatus] = useState<'local' | 'connecting' | 'synced' | 'error'>('local');
  const [preparation, setPreparation] = useState<DecisionPreparationWorkspace | null>(null);
  const model = useMemo(() => buildShellModel(journey.lifecycle), [journey.lifecycle]);
  const strategicRecall = useMemo(
    () => journey.lifecycle === 'decision-required'
      ? buildStrategicRecall(memory, journey.command)
      : null,
    [memory, journey.command, journey.lifecycle],
  );
  const consequenceMap = useMemo(
    () => journey.lifecycle === 'decision-required'
      ? buildConsequenceMap(journey.command, strategicRecall)
      : null,
    [journey.command, journey.lifecycle, strategicRecall],
  );
  const baseDecisionReadiness = useMemo(
    () => journey.lifecycle === 'decision-required'
      ? assessDecisionReadiness(journey.command, consequenceMap, strategicRecall)
      : null,
    [consequenceMap, journey.command, journey.lifecycle, strategicRecall],
  );
  const decisionReadiness = useMemo(
    () => baseDecisionReadiness && preparation
      ? applyDecisionPreparation(baseDecisionReadiness, preparation)
      : baseDecisionReadiness,
    [baseDecisionReadiness, preparation],
  );
  const decisionGate = useMemo(
    () => decisionReadiness ? buildFounderDecisionGate(decisionReadiness) : null,
    [decisionReadiness],
  );

  useEffect(() => {
    const current = window.localStorage.getItem(FOUNDER_MEMORY_KEY);
    const legacy = window.localStorage.getItem(LEGACY_FOUNDER_MEMORY_KEY);
    const local = deserializeFounderMemory(current ?? legacy);
    setMemory(local);
    setMemoryLoaded(true);

    setCloudStatus('connecting');
    loadCloudFounderMemory()
      .then((cloud) => {
        setMemory(mergeFounderMemories(local, cloud.memory));
        setCloudRevision(cloud.revision);
        setCloudStatus('synced');
      })
      .catch(() => setCloudStatus('error'));
  }, []);

  useEffect(() => {
    if (memoryLoaded) window.localStorage.setItem(FOUNDER_MEMORY_KEY, serializeFounderMemory(memory));
  }, [memory, memoryLoaded]);

  useEffect(() => {
    if (journey.lifecycle === 'decision-required' && baseDecisionReadiness) {
      setPreparation(buildDecisionPreparationWorkspace(baseDecisionReadiness));
      return;
    }
    setPreparation(null);
  }, [baseDecisionReadiness, journey.command, journey.lifecycle]);


  function dispatch(event: Parameters<typeof reduceFounderJourney>[1]) {
    setJourney((current) => reduceFounderJourney(current, event));
  }

  function submitCommand(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!command.trim() || journey.lifecycle !== 'resting') return;
    dispatch({ type: 'command-submitted', command });
    setCommand('');
  }

  function advanceJourney() {
    if (journey.lifecycle === 'listening') dispatch({ type: 'focus-identified' });
    if (journey.lifecycle === 'focus-surfaced') dispatch({ type: 'decision-justified' });
  }


  function addEvidence(dimension: ReadinessDimension, evidence: PreparationEvidenceInput) {
    setPreparation((current) => current ? addPreparationEvidence(current, dimension, evidence) : current);
  }

  function verifyEvidence(dimension: ReadinessDimension, evidenceId: string) {
    setPreparation((current) => current ? verifyPreparationEvidence(current, dimension, evidenceId, 'Founder') : current);
  }

  function resolvePreparation(dimension: ReadinessDimension, response: string) {
    setPreparation((current) => {
      if (!current) return current;
      return resolvePreparationItem(current, dimension, response);
    });
  }

  function disposeDecision(disposition: DecisionDisposition) {
    if (!decisionGate || !dispositionIsAllowed(decisionGate, disposition)) return;
    dispatch({
      type: 'decision-disposed',
      disposition,
      note: disposition === 'approve-with-limits'
        ? 'Pause one lower-priority initiative for two weeks.'
        : undefined,
    });
    setDecisionOpen(false);
  }

  function closeReview() {
    setMemory((current) => {
      const next = appendJourneyToMemory(current, journey);
      setCloudStatus('connecting');
      void saveCloudFounderMemory(next, cloudRevision)
        .then((cloud) => {
          setCloudRevision(cloud.revision);
          setCloudStatus('synced');
        })
        .catch(() => setCloudStatus('error'));
      return next;
    });
    dispatch({ type: 'review-closed' });
  }

  async function signOut() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.reload();
  }

  function submitProof(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!proof.trim()) return;
    dispatch({ type: 'proof-recorded', evidence: proof, lesson });
    setProof('');
    setLesson('');
  }

  return (
    <div className="app-shell" data-state={journey.lifecycle}>
      <aside className="rail" aria-label="Primary navigation">
        <div className="brand-mark" aria-label="MiP Coaching">M</div>
        <nav>
          {['Command', 'Intelligence', 'Decisions', 'Projects', 'More'].map((item, index) => (
            <button key={item} className={`rail-button${index === 0 ? ' is-active' : ''}`} type="button" aria-label={item} onClick={() => item === 'Decisions' && setMemoryOpen(true)}>
              {['⌂', '◇', '⌁', '□', '•••'][index]}
            </button>
          ))}
        </nav>
        <div className="rail-footer">Founder<br /><span>MiP</span></div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div><p className="eyebrow">NEHEMIAH</p><h1>The Founder’s Private Intelligence</h1></div>
          <div className="topbar-actions">
            <button className="search-button" type="button" onClick={() => setMemoryOpen(true)}>Memory · {memory.decisions.length}</button>
            <span className="search-button" aria-label="Cloud memory status">Cloud · {cloudStatus}</span>
            <button className="search-button" type="button" onClick={signOut}>Sign out</button>
            <span className="private-status">Private Mode Active</span>
            <span className="founder-chip">Founder · MiP</span>
          </div>
        </header>

        <section className="command-grid">
          <div className={`context-slot${model.showFocus || model.showAction || model.showProof ? ' is-visible' : ''}`}>
            {model.showFocus && model.focus ? <FounderFocus focus={model.focus} /> : null}
            {model.showAction ? (
              <section className="outcome-card" aria-live="polite">
                <p className="section-label">ACTION UNDERWAY</p>
                <h2>{journey.action?.visibleAction ?? model.actionMessage}</h2>
                <p>Ownership is aligned. Nehemiah is watching dependencies and waiting for visible proof.</p>
                <form className="proof-form" onSubmit={submitProof}>
                  <label htmlFor="proof-input">Record visible proof</label>
                  <textarea id="proof-input" value={proof} onChange={(event) => setProof(event.target.value)} placeholder="What changed, and what evidence confirms it?" />
                  <label htmlFor="lesson-input">Lesson learned</label>
                  <textarea id="lesson-input" value={lesson} onChange={(event) => setLesson(event.target.value)} placeholder="What should Nehemiah remember for the next similar decision?" />
                  <button className="primary-button" type="submit">Capture proof</button>
                </form>
              </section>
            ) : null}
            {model.showProof ? (
              <section className="outcome-card proof-card" aria-live="polite">
                <p className="section-label">PROOF CREATED</p>
                <h2>{model.proofMessage}</h2>
                <p>{journey.proof?.evidence}</p>
                <button className="secondary-button" type="button" onClick={closeReview}>Close review</button>
              </section>
            ) : null}
          </div>

          <section className="artifact-zone" aria-labelledby="primary-prompt">
            <h2 id="primary-prompt">{model.prompt}</h2>
            <LivingOrganism state={model.organismState} />
            <form className="command-bar" onSubmit={submitCommand}>
              <label className="sr-only" htmlFor="command-input">Ask Nehemiah</label>
              <input id="command-input" value={command} onChange={(event) => setCommand(event.target.value)} placeholder={journey.lifecycle === 'resting' ? 'Ask Nehemiah anything…' : journey.command || 'Journey in progress'} autoComplete="off" disabled={journey.lifecycle !== 'resting'} />
              <button type="button" className="voice-button" aria-label="Start listening" disabled={journey.lifecycle !== 'resting'} onClick={() => setCommand('Listen to my decision about the restricted pilot.')}>◉</button>
              <button type="submit" className="send-button" aria-label="Send command" disabled={journey.lifecycle !== 'resting'}>↑</button>
            </form>
          </section>

          <div className={`decision-slot${model.showDecision ? ' is-visible' : ''}`}>
            {model.showDecision && model.decision ? (
              <div className="decision-chamber">
                {decisionReadiness ? <FounderDecisionReadinessCard readiness={decisionReadiness} /> : null}
                {preparation && preparation.status !== 'not-needed' ? (
                  <DecisionPreparationWorkspaceCard
                    workspace={preparation}
                    onResolve={resolvePreparation}
                    onAddEvidence={addEvidence}
                    onVerifyEvidence={verifyEvidence}
                  />
                ) : null}
                {strategicRecall ? <StrategicRecallCard recall={strategicRecall} /> : null}
                {consequenceMap ? <StrategicConsequenceMapCard map={consequenceMap} /> : null}
                {decisionGate ? (
                  <DecisionField
                    decision={model.decision}
                    gate={decisionGate}
                    isOpen={decisionOpen}
                    onOpen={() => decisionGate.canOpenDecision && setDecisionOpen(true)}
                    onDisposition={disposeDecision}
                  />
                ) : null}
              </div>
            ) : null}
          </div>
        </section>

        <StateController current={journey.lifecycle} onAdvance={advanceJourney} />
      </main>
      <FounderMemoryPanel
        memory={memory}
        isOpen={memoryOpen}
        onClose={() => setMemoryOpen(false)}
        currentCommand={journey.command || command}
      />
    </div>
  );
}
