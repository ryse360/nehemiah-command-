import test from 'node:test';
import assert from 'node:assert/strict';

import {
  converseWithFounder,
  localConversationReply,
  type ConversationContext,
} from './founder-conversation';
import { AIOrchestrationError, type AIModelProvider } from './ai-orchestration';

const CTX: ConversationContext = { decisionsInMemory: 4, openJourney: false };

test('the loop closes without any provider — deterministic local reply', async () => {
  const result = await converseWithFounder('Good morning Nehemiah', CTX, null);
  assert.equal(result.mode, 'local');
  assert.ok(result.reply.includes('4 decisions'));
  const again = await converseWithFounder('Good morning Nehemiah', CTX, null);
  assert.equal(again.reply, result.reply, 'deterministic');
});

test('a configured provider answers through the governed path', async () => {
  const provider: AIModelProvider = {
    async generate(input) {
      assert.ok(input.system.includes('Nehemiah'), 'identity in system prompt');
      assert.ok(input.system.includes('4 decisions'), 'derived context only');
      return { model: 'm', providerRequestId: 'r1', output: { reply: 'On it. Two items need you today.' } };
    },
  };
  const result = await converseWithFounder('What needs me today?', CTX, provider);
  assert.equal(result.mode, 'ai');
  assert.equal(result.reply, 'On it. Two items need you today.');
});

test('a governed refusal (budget/unavailable) falls back to local — never throws to the Founder', async () => {
  const refused: AIModelProvider = {
    async generate() {
      throw new AIOrchestrationError('provider_unavailable', 'AI spend refused (daily) to protect the budget.', false);
    },
  };
  const result = await converseWithFounder('status', CTX, refused);
  assert.equal(result.mode, 'local');
  assert.ok(result.reply.length > 0);
});

test('malformed provider output falls back to local', async () => {
  const weird: AIModelProvider = {
    async generate() {
      return { model: 'm', providerRequestId: 'r', output: { nope: true } };
    },
  };
  const result = await converseWithFounder('hello', CTX, weird);
  assert.equal(result.mode, 'local');
});

test('local replies acknowledge the utterance and stay bounded', () => {
  const long = 'x'.repeat(1000);
  const reply = localConversationReply(long, CTX);
  assert.ok(reply.length < 260, 'reply stays short');
  const journey = localConversationReply('status?', { decisionsInMemory: 1, openJourney: true });
  assert.ok(journey.includes('in progress'));
});
