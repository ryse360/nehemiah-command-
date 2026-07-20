import { NextRequest } from 'next/server';
import { ingestKnowledge } from '@/nehemiah/knowledge-route-helpers';
import { normalizeDriveKnowledge, type DriveKnowledgeInput } from '@/nehemiah/drive-obsidian-knowledge';

export const runtime = 'nodejs';
export async function POST(request: NextRequest) {
  return ingestKnowledge(request, 'google-drive', (value) => normalizeDriveKnowledge(value as DriveKnowledgeInput));
}
