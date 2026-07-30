// The Founder ↔ Nehemiah conversation loop — the JARVIS moment.
//
// SERVER-ONLY. One narrow job: take a spoken/typed utterance and return a
// short, useful reply. When a real provider is configured the reply comes
// through the SAME governed AI path as decision preparation (cost ceilings,
// cache, durable ledger — every control already in front of it). When no
// provider is configured the loop STILL closes with a deterministic local
// reply, so the assistant answers in every environment; it simply says less.
//
// The orb never sees any of this text — it receives only the lifecycle enum.

import {
  AIOrchestrationError,
  type AIModelProvider,
} from './ai-orchestration';

export interface ConversationContext {
  /** Derived counts only — safe to interpolate into a reply. */
  decisionsInMemory: number;
  openJourney: boolean;
}

export interface ConversationResult {
  reply: string;
  mode: 'ai' | 'local';
}

const REPLY_SCHEMA: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  required: ['reply'],
  properties: {
    reply: {
      type: 'string',
      description:
        'A short, direct, spoken-style answer for the Founder. Two sentences maximum. No markdown.',
    },
  },
};

export function conversationSystemPrompt(context: ConversationContext): string {
  return [
    'You are Nehemiah, the Founder’s private chief-of-staff intelligence.',
    'Answer in a calm, direct, spoken register — at most two sentences.',
    'Never invent facts about the Founder’s business. If the ask needs data you do not have, say what you would need.',
    `Context: ${context.decisionsInMemory} decisions in memory; ${context.openJourney ? 'a decision journey is in progress' : 'no journey is in progress'}.`,
  ].join(' ');
}

/**
 * Deterministic fallback so the loop closes without a configured provider.
 * Uses only derived context counts — it cannot leak or fabricate content.
 */
export function localConversationReply(
  utterance: string,
  context: ConversationContext,
): string {
  const clean = utterance.trim().replace(/\s+/g, ' ');
  if (!clean) return 'I am listening.';
  const lower = clean.toLowerCase();
  if (/(hello|hey|good (morning|afternoon|evening)|hi\b)/.test(lower)) {
    return `I am here. ${context.decisionsInMemory} decisions are in memory and I am ready when you are.`;
  }
  if (/(status|where are we|update)/.test(lower)) {
    return context.openJourney
      ? 'A decision journey is in progress — advance it and I will keep the record.'
      : `Everything is settled. ${context.decisionsInMemory} decisions are witnessed in memory.`;
  }
  if (/(remember|memory|decisions?)/.test(lower)) {
    return `I hold ${context.decisionsInMemory} witnessed decisions. Open the Memory panel to walk them.`;
  }
  return `Heard: “${clean.slice(0, 120)}”. My reasoning engine is not yet connected in this environment — start a decision journey and I will structure it with you.`;
}

/**
 * The full loop. Tries the governed provider; on ANY orchestration failure
 * (unconfigured, over budget, provider down) falls back to the local reply —
 * the assistant always answers, and never bypasses the cost governor to do so.
 */
export async function converseWithFounder(
  utterance: string,
  context: ConversationContext,
  provider: AIModelProvider | null,
): Promise<ConversationResult> {
  if (provider) {
    try {
      const response = await provider.generate({
        system: conversationSystemPrompt(context),
        user: utterance.slice(0, 2000),
        schema: REPLY_SCHEMA,
        timeoutMs: 20_000,
      });
      const reply = (response.output as { reply?: unknown }).reply;
      if (typeof reply === 'string' && reply.trim()) {
        return { reply: reply.trim().slice(0, 600), mode: 'ai' };
      }
    } catch (error) {
      if (!(error instanceof AIOrchestrationError)) throw error;
      // governed refusal (budget/unavailable) → fall through to local
    }
  }
  return { reply: localConversationReply(utterance, context), mode: 'local' };
}
