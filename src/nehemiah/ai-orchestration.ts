import { randomUUID } from 'node:crypto';

const ALLOWED_TOOLS = new Set(['search-founder-memory', 'read-enterprise-context']);
const REQUIRED_STRING_FIELDS = [
  'summary', 'whyNow', 'whatCouldBecomePossible', 'immediateResponse',
  'secondOrderConsequence', 'preparedContinuation', 'founderQuestion',
] as const;

export type AIRequestedTool = 'search-founder-memory' | 'read-enterprise-context';

export type AIOrchestrationRequest = {
  command: string;
  requestedTools: AIRequestedTool[];
  context?: {
    founderMemorySummary?: string;
    enterpriseContextSummary?: string;
    decisionReadinessSummary?: string;
  };
};

export type AIDecisionPreparation = {
  summary: string;
  whyNow: string;
  whatCouldBecomePossible: string;
  tradeoffs: string[];
  immediateResponse: string;
  secondOrderConsequence: string;
  preparedContinuation: string;
  evidenceRequired: string[];
  assumptions: string[];
  risks: Array<{ risk: string; mitigation: string }>;
  founderQuestion: string;
  confidence: number;
};

export type AIProviderResponse = {
  model: string;
  providerRequestId?: string;
  output: unknown;
};

export interface AIModelProvider {
  generate(input: {
    system: string;
    user: string;
    schema: Record<string, unknown>;
    timeoutMs: number;
  }): Promise<AIProviderResponse>;
}

export type AIOrchestrationAudit = {
  orchestrationId: string;
  startedAt: string;
  completedAt: string;
  attempts: number;
  model: string;
  providerRequestId?: string;
  requestedTools: AIRequestedTool[];
  toolsExecuted: [];
  policyVersion: 'founder-decision-preparation-v1';
  outcome: 'succeeded';
};

export type AIOrchestrationResult = {
  preparation: AIDecisionPreparation;
  audit: AIOrchestrationAudit;
};

export class AIOrchestrationError extends Error {
  constructor(
    public readonly code: 'invalid_request' | 'provider_unavailable' | 'provider_timeout' | 'invalid_output' | 'not_configured',
    message: string,
    public readonly retryable = false,
  ) {
    super(message);
    this.name = 'AIOrchestrationError';
  }
}

function boundedText(value: unknown, label: string, max: number): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new AIOrchestrationError('invalid_request', `${label} is required.`);
  }
  const trimmed = value.trim();
  if (trimmed.length > max) throw new AIOrchestrationError('invalid_request', `${label} exceeds ${max} characters.`);
  return trimmed;
}

export function validateAIRequest(input: unknown): AIOrchestrationRequest {
  if (!input || typeof input !== 'object') throw new AIOrchestrationError('invalid_request', 'A request body is required.');
  const record = input as Record<string, unknown>;
  const command = boundedText(record.command, 'Command', 4000);
  const rawTools = record.requestedTools ?? [];
  if (!Array.isArray(rawTools)) throw new AIOrchestrationError('invalid_request', 'requestedTools must be an array.');
  const tools = rawTools.map((tool) => {
    if (typeof tool !== 'string' || !ALLOWED_TOOLS.has(tool)) {
      throw new AIOrchestrationError('invalid_request', `Tool ${String(tool)} is not permitted.`);
    }
    return tool as AIRequestedTool;
  });
  const contextRecord = record.context && typeof record.context === 'object'
    ? record.context as Record<string, unknown>
    : undefined;
  const context = contextRecord ? {
    founderMemorySummary: typeof contextRecord.founderMemorySummary === 'string' ? contextRecord.founderMemorySummary.slice(0, 6000) : undefined,
    enterpriseContextSummary: typeof contextRecord.enterpriseContextSummary === 'string' ? contextRecord.enterpriseContextSummary.slice(0, 6000) : undefined,
    decisionReadinessSummary: typeof contextRecord.decisionReadinessSummary === 'string' ? contextRecord.decisionReadinessSummary.slice(0, 3000) : undefined,
  } : undefined;
  return { command, requestedTools: [...new Set(tools)], context };
}

export const decisionPreparationSchema: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  required: [
    'summary', 'whyNow', 'whatCouldBecomePossible', 'tradeoffs', 'immediateResponse',
    'secondOrderConsequence', 'preparedContinuation', 'evidenceRequired', 'assumptions',
    'risks', 'founderQuestion', 'confidence',
  ],
  properties: {
    summary: { type: 'string' },
    whyNow: { type: 'string' },
    whatCouldBecomePossible: { type: 'string' },
    tradeoffs: { type: 'array', items: { type: 'string' }, maxItems: 6 },
    immediateResponse: { type: 'string' },
    secondOrderConsequence: { type: 'string' },
    preparedContinuation: { type: 'string' },
    evidenceRequired: { type: 'array', items: { type: 'string' }, maxItems: 8 },
    assumptions: { type: 'array', items: { type: 'string' }, maxItems: 8 },
    risks: {
      type: 'array', maxItems: 8,
      items: {
        type: 'object', additionalProperties: false, required: ['risk', 'mitigation'],
        properties: { risk: { type: 'string' }, mitigation: { type: 'string' } },
      },
    },
    founderQuestion: { type: 'string' },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
  },
};

export function buildDecisionPreparationPrompt(request: AIOrchestrationRequest): { system: string; user: string } {
  const system = [
    'You are Nehemiah, the Founder\'s private decision-preparation intelligence.',
    'The Founder remains the final authority. Never approve, reject, commit, send, publish, or execute on the Founder\'s behalf.',
    'Do not execute tools. Requested tools are context permissions only and must be reported as unused by this orchestration layer.',
    'Prepare one consequential decision using evidence, tradeoffs, three-move consequence thinking, explicit assumptions, and proof requirements.',
    'Do not invent facts. Distinguish evidence from assumptions. Use concise, direct language.',
  ].join(' ');
  const context = request.context
    ? `\nContext:\n${JSON.stringify(request.context)}`
    : '';
  const user = `Founder command: ${request.command}${context}\nReturn only the required structured decision-preparation object.`;
  return { system, user };
}

function stringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || !item.trim())) {
    throw new AIOrchestrationError('invalid_output', `Model structured output is invalid: ${field}.`);
  }
  return value.map((item) => item.trim());
}

export function validateAIResult(input: unknown): AIDecisionPreparation {
  if (!input || typeof input !== 'object') throw new AIOrchestrationError('invalid_output', 'Model structured output is invalid.');
  const record = input as Record<string, unknown>;
  const strings = Object.fromEntries(REQUIRED_STRING_FIELDS.map((field) => {
    try { return [field, boundedText(record[field], field, 6000)]; }
    catch { throw new AIOrchestrationError('invalid_output', `Model structured output is invalid: ${field}.`); }
  })) as Record<typeof REQUIRED_STRING_FIELDS[number], string>;
  if (typeof record.confidence !== 'number' || record.confidence < 0 || record.confidence > 1) {
    throw new AIOrchestrationError('invalid_output', 'Model structured output is invalid: confidence.');
  }
  if (!Array.isArray(record.risks)) throw new AIOrchestrationError('invalid_output', 'Model structured output is invalid: risks.');
  const risks = record.risks.map((item) => {
    if (!item || typeof item !== 'object') throw new AIOrchestrationError('invalid_output', 'Model structured output is invalid: risk item.');
    const risk = item as Record<string, unknown>;
    return { risk: boundedText(risk.risk, 'risk', 2000), mitigation: boundedText(risk.mitigation, 'mitigation', 2000) };
  });
  return {
    ...strings,
    tradeoffs: stringArray(record.tradeoffs, 'tradeoffs'),
    evidenceRequired: stringArray(record.evidenceRequired, 'evidenceRequired'),
    assumptions: stringArray(record.assumptions, 'assumptions'),
    risks,
    confidence: record.confidence,
  };
}

export async function orchestrateDecisionPreparation(
  request: AIOrchestrationRequest,
  provider: AIModelProvider,
  options: { maxAttempts?: number; timeoutMs?: number; now?: () => string; id?: () => string } = {},
): Promise<AIOrchestrationResult> {
  const maxAttempts = Math.max(1, Math.min(options.maxAttempts ?? 2, 3));
  const timeoutMs = Math.max(1000, Math.min(options.timeoutMs ?? 30000, 60000));
  const now = options.now ?? (() => new Date().toISOString());
  const id = options.id ?? randomUUID;
  const startedAt = now();
  const prompt = buildDecisionPreparationPrompt(request);
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await provider.generate({ ...prompt, schema: decisionPreparationSchema, timeoutMs });
      const preparation = validateAIResult(response.output);
      return {
        preparation,
        audit: {
          orchestrationId: id(), startedAt, completedAt: now(), attempts: attempt,
          model: response.model, providerRequestId: response.providerRequestId,
          requestedTools: request.requestedTools, toolsExecuted: [],
          policyVersion: 'founder-decision-preparation-v1', outcome: 'succeeded',
        },
      };
    } catch (error) {
      lastError = error;
      const retryable = error instanceof AIOrchestrationError && error.retryable;
      if (!retryable || attempt === maxAttempts) break;
    }
  }

  if (lastError instanceof AIOrchestrationError) throw lastError;
  throw new AIOrchestrationError('provider_unavailable', 'AI provider unavailable.', true);
}

export class OpenAICompatibleResponsesProvider implements AIModelProvider {
  constructor(
    private readonly config: { apiKey: string; model: string; baseUrl?: string },
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async generate(input: { system: string; user: string; schema: Record<string, unknown>; timeoutMs: number }): Promise<AIProviderResponse> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), input.timeoutMs);
    try {
      const response = await this.fetchImpl(`${this.config.baseUrl ?? 'https://api.openai.com/v1'}/responses`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.config.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.config.model,
          input: [
            { role: 'system', content: [{ type: 'input_text', text: input.system }] },
            { role: 'user', content: [{ type: 'input_text', text: input.user }] },
          ],
          text: { format: { type: 'json_schema', name: 'founder_decision_preparation', strict: true, schema: input.schema } },
        }),
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new AIOrchestrationError('provider_unavailable', `AI provider returned ${response.status}.`, response.status >= 500 || response.status === 429);
      }
      const payload = await response.json() as { id?: string; model?: string; output_text?: string };
      if (!payload.output_text) throw new AIOrchestrationError('invalid_output', 'AI provider returned no structured output.');
      let output: unknown;
      try { output = JSON.parse(payload.output_text); }
      catch { throw new AIOrchestrationError('invalid_output', 'AI provider returned malformed JSON.'); }
      return { model: payload.model ?? this.config.model, providerRequestId: payload.id, output };
    } catch (error) {
      if (error instanceof AIOrchestrationError) throw error;
      if (error instanceof Error && error.name === 'AbortError') throw new AIOrchestrationError('provider_timeout', 'AI provider timed out.', true);
      throw new AIOrchestrationError('provider_unavailable', 'AI provider unavailable.', true);
    } finally {
      clearTimeout(timer);
    }
  }
}

export function aiProviderFromEnv(): AIModelProvider {
  const apiKey = process.env.NEHEMIAH_AI_API_KEY;
  const model = process.env.NEHEMIAH_AI_MODEL;
  if (!apiKey || !model) throw new AIOrchestrationError('not_configured', 'AI orchestration is not configured.');
  return new OpenAICompatibleResponsesProvider({ apiKey, model, baseUrl: process.env.NEHEMIAH_AI_BASE_URL });
}
