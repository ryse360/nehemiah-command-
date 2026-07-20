import type { NehemiahState } from './state-machine';

export type DecisionDisposition =
  | 'approve'
  | 'approve-with-limits'
  | 'request-evidence'
  | 'delay'
  | 'reject';

export type JourneyHistoryItem = {
  kind: 'command' | 'focus' | 'decision' | 'action' | 'proof' | 'review';
  summary: string;
  recordedAt: string;
};

export type FounderJourney = {
  lifecycle: NehemiahState;
  command: string;
  decision?: {
    disposition: DecisionDisposition;
    note?: string;
    decidedAt: string;
  };
  action?: {
    visibleAction: string;
    startedAt: string;
  };
  proof?: {
    evidence: string;
    lesson?: string;
    recordedAt: string;
  };
  history: JourneyHistoryItem[];
};

export type FounderJourneyEvent =
  | { type: 'command-submitted'; command: string }
  | { type: 'focus-identified' }
  | { type: 'decision-justified' }
  | { type: 'decision-disposed'; disposition: DecisionDisposition; note?: string }
  | { type: 'proof-recorded'; evidence: string; lesson?: string }
  | { type: 'review-closed' };

const visibleAction = 'Approve the pilot boundary, name Product and Engineering ownership, and define the activation gate.';

function now(): string {
  return new Date().toISOString();
}

function history(kind: JourneyHistoryItem['kind'], summary: string): JourneyHistoryItem {
  return { kind, summary, recordedAt: now() };
}

export function createFounderJourney(): FounderJourney {
  return {
    lifecycle: 'resting',
    command: '',
    history: [],
  };
}

function invalid(journey: FounderJourney, event: FounderJourneyEvent): never {
  throw new Error(`Invalid Founder journey event: ${journey.lifecycle} + ${event.type}`);
}

export function reduceFounderJourney(
  journey: FounderJourney,
  event: FounderJourneyEvent,
): FounderJourney {
  switch (event.type) {
    case 'command-submitted': {
      if (journey.lifecycle !== 'resting' || !event.command.trim()) return invalid(journey, event);
      return {
        ...createFounderJourney(),
        lifecycle: 'listening',
        command: event.command.trim(),
        history: [...journey.history, history('command', event.command.trim())],
      };
    }
    case 'focus-identified': {
      if (journey.lifecycle !== 'listening') return invalid(journey, event);
      return {
        ...journey,
        lifecycle: 'focus-surfaced',
        history: [...journey.history, history('focus', 'The decision preventing Product from proceeding was surfaced.')],
      };
    }
    case 'decision-justified': {
      if (journey.lifecycle !== 'focus-surfaced') return invalid(journey, event);
      return {
        ...journey,
        lifecycle: 'decision-required',
        history: [...journey.history, history('decision', 'Founder authority is required for the restricted pilot.')],
      };
    }
    case 'decision-disposed': {
      if (journey.lifecycle !== 'decision-required') return invalid(journey, event);
      const decidedAt = now();
      const decision = { disposition: event.disposition, note: event.note?.trim() || undefined, decidedAt };

      if (event.disposition === 'request-evidence' || event.disposition === 'delay') {
        return {
          ...journey,
          lifecycle: 'focus-surfaced',
          decision,
          history: [...journey.history, history('decision', `Decision disposition: ${event.disposition}.`)],
        };
      }

      if (event.disposition === 'reject') {
        return {
          ...journey,
          lifecycle: 'proof-created',
          decision,
          proof: {
            evidence: 'The restricted pilot was rejected and the decision boundary was recorded.',
            recordedAt: decidedAt,
          },
          history: [
            ...journey.history,
            history('decision', 'Restricted pilot rejected.'),
            history('proof', 'Rejection and rationale recorded as decision proof.'),
          ],
        };
      }

      return {
        ...journey,
        lifecycle: 'action-underway',
        decision,
        action: { visibleAction, startedAt: decidedAt },
        history: [
          ...journey.history,
          history('decision', `Decision disposition: ${event.disposition}.`),
          history('action', visibleAction),
        ],
      };
    }
    case 'proof-recorded': {
      if (journey.lifecycle !== 'action-underway' || !event.evidence.trim()) return invalid(journey, event);
      return {
        ...journey,
        lifecycle: 'proof-created',
        proof: {
          evidence: event.evidence.trim(),
          lesson: event.lesson?.trim() || undefined,
          recordedAt: now(),
        },
        history: [...journey.history, history('proof', event.evidence.trim())],
      };
    }
    case 'review-closed': {
      if (journey.lifecycle !== 'proof-created') return invalid(journey, event);
      return {
        ...createFounderJourney(),
        history: [...journey.history, history('review', 'Founder closed the completed decision review.')],
      };
    }
  }
}
