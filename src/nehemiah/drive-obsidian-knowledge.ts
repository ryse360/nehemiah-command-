import type { IntegrationSignal, IntegrationSignalInput, ValidationResult } from './data-boundaries';

export type KnowledgeVisibility = 'founder-private' | 'enterprise';
export type KnowledgeSourceKind = 'google-drive' | 'obsidian';

export type DriveKnowledgeInput = {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  webViewLink: string;
  owners: string[];
  text: string;
  visibility: KnowledgeVisibility;
  tags?: string[];
  contentHash?: string;
};

export type ObsidianKnowledgeInput = {
  path: string;
  title: string;
  modifiedTime: string;
  content: string;
  tags: string[];
  visibility: KnowledgeVisibility;
  contentHash?: string;
};

export type KnowledgeRecord = {
  id: string;
  title: string;
  sourceKind: KnowledgeSourceKind;
  sourceRef: string;
  modifiedAt: string;
  receivedAt?: string;
  content: string;
  visibility: KnowledgeVisibility;
  tags: string[];
  owners: string[];
  mimeType?: string;
  contentHash?: string;
};

export type KnowledgeIndex = {
  generatedAt: string;
  records: KnowledgeRecord[];
};

export type KnowledgeSearchResult = KnowledgeRecord & {
  score: number;
  excerpt: string;
  citation: string;
};

export type KnowledgeSearchResponse = {
  query: string;
  generatedAt: string;
  results: KnowledgeSearchResult[];
};

const CONTENT_LIMIT = 4000;
const ALLOWED_VISIBILITY = new Set<KnowledgeVisibility>(['founder-private', 'enterprise']);

function validTimestamp(value: string): boolean {
  return !Number.isNaN(Date.parse(value));
}

function validSourceRef(sourceKind: KnowledgeSourceKind, value: string): boolean {
  if (sourceKind === 'google-drive') {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && /(^|\.)google\.com$/.test(url.hostname);
    } catch {
      return false;
    }
  }
  return Boolean(value.trim()) && !value.includes('..') && !value.startsWith('/');
}

function boundedText(value: string): string {
  return value.trim().slice(0, CONTENT_LIMIT);
}

function tags(value: string[] | undefined): string[] {
  return [...new Set((value ?? []).map((item) => item.trim().toLowerCase()).filter(Boolean))].slice(0, 30);
}

export function validateKnowledgeRecord(value: unknown): ValidationResult {
  const record = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Partial<KnowledgeRecord>
    : null;
  if (!record) return { valid: false, errors: ['Knowledge record must be an object.'] };
  const errors: string[] = [];
  if (!record.id?.trim()) errors.push('Knowledge id is required.');
  if (!record.title?.trim()) errors.push('Knowledge title is required.');
  if (record.sourceKind !== 'google-drive' && record.sourceKind !== 'obsidian') errors.push('Knowledge source kind is unsupported.');
  if (!record.sourceKind || !record.sourceRef || !validSourceRef(record.sourceKind, record.sourceRef)) errors.push('Knowledge source reference is invalid.');
  if (!record.modifiedAt || !validTimestamp(record.modifiedAt)) errors.push('Knowledge modifiedAt must be a valid ISO timestamp.');
  if (!record.content?.trim()) errors.push('Knowledge content is required.');
  if (!record.visibility || !ALLOWED_VISIBILITY.has(record.visibility)) errors.push('Knowledge visibility is unsupported.');
  if (!Array.isArray(record.tags) || !record.tags.every((item) => typeof item === 'string')) errors.push('Knowledge tags must be a string array.');
  if (!Array.isArray(record.owners) || !record.owners.every((item) => typeof item === 'string')) errors.push('Knowledge owners must be a string array.');
  return { valid: errors.length === 0, errors };
}

export function normalizeDriveKnowledge(input: DriveKnowledgeInput): IntegrationSignalInput {
  const record: KnowledgeRecord = {
    id: input.id,
    title: input.name,
    sourceKind: 'google-drive',
    sourceRef: input.webViewLink,
    modifiedAt: input.modifiedTime,
    content: boundedText(input.text),
    visibility: input.visibility,
    tags: tags(input.tags),
    owners: [...input.owners].filter(Boolean).slice(0, 20),
    mimeType: input.mimeType,
    contentHash: input.contentHash,
  };
  const validation = validateKnowledgeRecord(record);
  if (!validation.valid) throw new Error(validation.errors.join(' '));
  return {
    externalId: input.id,
    type: 'knowledge.drive.document',
    occurredAt: input.modifiedTime,
    summary: `${input.name} · Google Drive`,
    payload: { ...record },
  };
}

export function normalizeObsidianKnowledge(input: ObsidianKnowledgeInput): IntegrationSignalInput {
  const record: KnowledgeRecord = {
    id: input.path,
    title: input.title,
    sourceKind: 'obsidian',
    sourceRef: input.path,
    modifiedAt: input.modifiedTime,
    content: boundedText(input.content),
    visibility: input.visibility,
    tags: tags(input.tags),
    owners: [],
    mimeType: 'text/markdown',
    contentHash: input.contentHash,
  };
  const validation = validateKnowledgeRecord(record);
  if (!validation.valid) throw new Error(validation.errors.join(' '));
  return {
    externalId: input.path,
    type: 'knowledge.obsidian.note',
    occurredAt: input.modifiedTime,
    summary: `${input.title} · Obsidian`,
    payload: { ...record },
  };
}

function recordFromSignal(signal: IntegrationSignal): KnowledgeRecord | null {
  if (signal.type !== 'knowledge.drive.document' && signal.type !== 'knowledge.obsidian.note') return null;
  const payload = signal.payload as Partial<KnowledgeRecord> | undefined;
  if (!payload) return null;
  const record: KnowledgeRecord = {
    id: String(payload.id ?? signal.externalId),
    title: String(payload.title ?? signal.summary),
    sourceKind: payload.sourceKind === 'obsidian' ? 'obsidian' : 'google-drive',
    sourceRef: String(payload.sourceRef ?? signal.externalId),
    modifiedAt: String(payload.modifiedAt ?? signal.occurredAt),
    receivedAt: signal.receivedAt,
    content: String(payload.content ?? ''),
    visibility: payload.visibility === 'founder-private' ? 'founder-private' : 'enterprise',
    tags: Array.isArray(payload.tags) ? payload.tags.map(String) : [],
    owners: Array.isArray(payload.owners) ? payload.owners.map(String) : [],
    mimeType: payload.mimeType ? String(payload.mimeType) : undefined,
    contentHash: payload.contentHash ? String(payload.contentHash) : undefined,
  };
  return validateKnowledgeRecord(record).valid ? record : null;
}

export function buildKnowledgeIndex(signals: IntegrationSignal[], now = new Date()): KnowledgeIndex {
  const latest = new Map<string, KnowledgeRecord>();
  for (const signal of signals) {
    const record = recordFromSignal(signal);
    if (!record) continue;
    const key = `${record.sourceKind}:${record.id}`;
    const existing = latest.get(key);
    if (!existing || Date.parse(record.receivedAt ?? record.modifiedAt) >= Date.parse(existing.receivedAt ?? existing.modifiedAt)) {
      latest.set(key, record);
    }
  }
  return {
    generatedAt: now.toISOString(),
    records: [...latest.values()].sort((a, b) => Date.parse(b.modifiedAt) - Date.parse(a.modifiedAt)),
  };
}

function tokens(value: string): string[] {
  return [...new Set(value.toLowerCase().match(/[a-z0-9][a-z0-9-]{2,}/g) ?? [])];
}

function excerpt(content: string, queryTokens: string[]): string {
  const normalized = content.replace(/\s+/g, ' ').trim();
  const lower = normalized.toLowerCase();
  const position = queryTokens.map((token) => lower.indexOf(token)).filter((index) => index >= 0).sort((a, b) => a - b)[0] ?? 0;
  const start = Math.max(0, position - 90);
  const text = normalized.slice(start, start + 280);
  return `${start > 0 ? '…' : ''}${text}${start + 280 < normalized.length ? '…' : ''}`;
}

function citationFor(record: KnowledgeRecord): string {
  const source = record.sourceKind === 'google-drive' ? 'Google Drive' : 'Obsidian';
  return `${source} · ${record.title} · modified ${record.modifiedAt}`;
}

export function searchKnowledge(
  index: KnowledgeIndex,
  query: string,
  options: { includeFounderPrivate?: boolean; limit?: number } = {},
): KnowledgeSearchResponse {
  const queryTokens = tokens(query);
  const limit = Math.max(1, Math.min(options.limit ?? 8, 20));
  const results = index.records
    .filter((record) => options.includeFounderPrivate || record.visibility !== 'founder-private')
    .map((record) => {
      const titleTokens = tokens(record.title);
      const contentTokens = tokens(`${record.content} ${record.tags.join(' ')} ${record.owners.join(' ')}`);
      const score = queryTokens.reduce((sum, token) => sum + (titleTokens.includes(token) ? 4 : 0) + (contentTokens.includes(token) ? 1 : 0), 0);
      return { ...record, score, excerpt: excerpt(record.content, queryTokens), citation: citationFor(record) };
    })
    .filter((record) => record.score > 0)
    .sort((a, b) => b.score - a.score || Date.parse(b.modifiedAt) - Date.parse(a.modifiedAt))
    .slice(0, limit);
  return { query, generatedAt: new Date().toISOString(), results };
}
