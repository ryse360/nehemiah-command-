import { NextRequest } from 'next/server';
import { ingestKnowledge } from '@/nehemiah/knowledge-route-helpers';
import { normalizeObsidianKnowledge, type ObsidianKnowledgeInput } from '@/nehemiah/drive-obsidian-knowledge';

export const runtime = 'nodejs';
export async function POST(request: NextRequest) {
  return ingestKnowledge(request, 'obsidian', (value) => normalizeObsidianKnowledge(value as ObsidianKnowledgeInput));
}
