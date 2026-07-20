import type { AIOrchestrationResult, AIRequestedTool } from './ai-orchestration';

export async function requestAIDecisionPreparation(input: {
  command: string;
  requestedTools?: AIRequestedTool[];
  context?: {
    founderMemorySummary?: string;
    enterpriseContextSummary?: string;
    decisionReadinessSummary?: string;
  };
}): Promise<AIOrchestrationResult> {
  const response = await fetch('/api/ai/decision-preparation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const payload = await response.json().catch(() => ({})) as AIOrchestrationResult & { error?: string };
  if (!response.ok) throw new Error(payload.error ?? 'AI decision preparation failed.');
  return payload;
}
