import type { KnowledgeIndex, KnowledgeSearchResponse } from './drive-obsidian-knowledge';

export async function loadFounderKnowledge(query = ''): Promise<KnowledgeIndex | KnowledgeSearchResponse> {
  const suffix = query.trim() ? `?q=${encodeURIComponent(query.trim())}` : '';
  const response = await fetch(`/api/founder-knowledge${suffix}`, { cache: 'no-store' });
  const body = await response.json() as KnowledgeIndex | KnowledgeSearchResponse | { error?: string };
  if (!response.ok) throw new Error('error' in body && body.error ? body.error : 'Founder knowledge unavailable.');
  return body as KnowledgeIndex | KnowledgeSearchResponse;
}
