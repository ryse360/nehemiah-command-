import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AIOrchestrationError,
  buildDecisionPreparationPrompt,
  orchestrateDecisionPreparation,
  validateAIRequest,
  validateAIResult,
  type AIModelProvider,
} from './ai-orchestration';

const validResult = {
  summary: 'A restricted pilot can proceed only after ownership and proof gates are explicit.',
  whyNow: 'Product is blocked by an unresolved Founder decision.',
  whatCouldBecomePossible: 'A governed pilot could validate context transfer without committing to full release.',
  tradeoffs: ['One lower-priority initiative pauses for two weeks.'],
  immediateResponse: 'Product and Engineering prepare the restricted pilot boundary.',
  secondOrderConsequence: 'Capacity shifts toward activation support and proof collection.',
  preparedContinuation: 'Expand only after the activation gate and proof criteria are met.',
  evidenceRequired: ['Named owner', 'Pilot boundary', 'Activation proof'],
  assumptions: ['Engineering capacity is available inside the protected window.'],
  risks: [{ risk: 'Pilot scope expands prematurely.', mitigation: 'Use a written stop condition.' }],
  founderQuestion: 'What must be true before this pilot deserves your approval?',
  confidence: 0.78,
};

test('validates a bounded Founder AI request', () => {
  const request = validateAIRequest({ command: 'Should we authorize a restricted Platform v2 pilot?' });
  assert.equal(request.command, 'Should we authorize a restricted Platform v2 pilot?');
  assert.deepEqual(request.requestedTools, []);
});

test('rejects unsupported tool requests', () => {
  assert.throws(
    () => validateAIRequest({ command: 'Prepare this decision.', requestedTools: ['send-email'] }),
    /not permitted/i,
  );
});

test('builds a prompt that preserves Founder authority and forbids execution', () => {
  const prompt = buildDecisionPreparationPrompt(validateAIRequest({ command: 'Prepare the pilot decision.' }));
  assert.match(prompt.system, /Founder remains the final authority/i);
  assert.match(prompt.system, /Do not execute tools/i);
  assert.match(prompt.user, /Prepare the pilot decision/);
});

test('validates structured model output', () => {
  const result = validateAIResult(validResult);
  assert.equal(result.confidence, 0.78);
  assert.equal(result.risks.length, 1);
});

test('retries transient provider failures and returns an audited result', async () => {
  let attempts = 0;
  const provider: AIModelProvider = {
    async generate() {
      attempts += 1;
      if (attempts === 1) throw new AIOrchestrationError('provider_unavailable', 'Temporary failure', true);
      return { model: 'test-model', providerRequestId: 'req-2', output: validResult };
    },
  };

  const result = await orchestrateDecisionPreparation(
    validateAIRequest({ command: 'Prepare the pilot decision.' }),
    provider,
    { maxAttempts: 2, now: () => '2026-07-20T12:00:00.000Z', id: () => 'orch-1' },
  );

  assert.equal(attempts, 2);
  assert.equal(result.audit.orchestrationId, 'orch-1');
  assert.equal(result.audit.attempts, 2);
  assert.equal(result.preparation.summary, validResult.summary);
});

test('fails closed when the provider returns malformed output', async () => {
  const provider: AIModelProvider = {
    async generate() {
      return { model: 'test-model', output: { summary: 'Incomplete' } };
    },
  };

  await assert.rejects(
    () => orchestrateDecisionPreparation(
      validateAIRequest({ command: 'Prepare the pilot decision.' }),
      provider,
      { maxAttempts: 1 },
    ),
    /structured output/i,
  );
});
