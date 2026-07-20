import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildKnowledgeIndex,
  normalizeDriveKnowledge,
  normalizeObsidianKnowledge,
  searchKnowledge,
  validateKnowledgeRecord,
} from './drive-obsidian-knowledge';
import { createIntegrationSignal } from './data-boundaries';

const now = new Date('2026-07-20T12:00:00.000Z');

test('normalizes a Google Drive document with bounded content and provenance', () => {
  const signal = normalizeDriveKnowledge({
    id: 'drive-1',
    name: 'Platform v2 pilot evidence',
    mimeType: 'application/vnd.google-apps.document',
    modifiedTime: '2026-07-20T10:00:00.000Z',
    webViewLink: 'https://drive.google.com/file/d/drive-1/view',
    owners: ['product@mip.example'],
    text: 'Pilot results confirmed context transfer across sessions. '.repeat(100),
    visibility: 'enterprise',
  });
  assert.equal(signal.type, 'knowledge.drive.document');
  assert.equal(signal.externalId, 'drive-1');
  assert.equal(signal.payload?.sourceKind, 'google-drive');
  assert.equal(String(signal.payload?.content).length <= 4000, true);
  assert.deepEqual(signal.payload?.owners, ['product@mip.example']);
});

test('normalizes an Obsidian note and preserves vault path provenance', () => {
  const signal = normalizeObsidianKnowledge({
    path: 'Nehemiah/Decisions/platform-v2.md',
    title: 'Platform v2 decision record',
    modifiedTime: '2026-07-20T11:00:00.000Z',
    content: 'The restricted pilot requires a rollback boundary and named Product ownership.',
    tags: ['decision', 'platform-v2'],
    visibility: 'founder-private',
    contentHash: 'sha256:abc123',
  });
  assert.equal(signal.type, 'knowledge.obsidian.note');
  assert.equal(signal.externalId, 'Nehemiah/Decisions/platform-v2.md');
  assert.equal(signal.payload?.sourceKind, 'obsidian');
  assert.equal(signal.payload?.contentHash, 'sha256:abc123');
});

test('rejects knowledge records with invalid references or unsupported visibility', () => {
  const result = validateKnowledgeRecord({
    id: 'x', title: 'Unsafe', sourceKind: 'google-drive', sourceRef: 'javascript:alert(1)',
    modifiedAt: now.toISOString(), content: 'content', visibility: 'public', tags: [], owners: [],
  });
  assert.equal(result.valid, false);
  assert.match(result.errors.join(' '), /source reference|visibility/i);
});

test('builds a deduplicated knowledge index from Drive and Obsidian signals', () => {
  const drive = createIntegrationSignal('google-drive', normalizeDriveKnowledge({
    id: 'shared', name: 'Pilot evidence', mimeType: 'text/plain', modifiedTime: now.toISOString(),
    webViewLink: 'https://drive.google.com/shared', owners: [], text: 'Context transfer proof.', visibility: 'enterprise',
  }), now);
  const duplicate = { ...drive, receivedAt: '2026-07-20T13:00:00.000Z', payload: { ...drive.payload, content: 'Newer context transfer proof.' } };
  const index = buildKnowledgeIndex([drive, duplicate]);
  assert.equal(index.records.length, 1);
  assert.equal(index.records[0]?.content, 'Newer context transfer proof.');
});

test('retrieves relevant evidence with a grounded citation and visibility boundary', () => {
  const drive = createIntegrationSignal('google-drive', normalizeDriveKnowledge({
    id: 'pilot', name: 'Platform pilot evidence', mimeType: 'text/plain', modifiedTime: now.toISOString(),
    webViewLink: 'https://drive.google.com/pilot', owners: ['Product'],
    text: 'Platform v2 restricted pilot confirmed correct context transfer and no critical failures.', visibility: 'enterprise',
  }), now);
  const privateNote = createIntegrationSignal('obsidian', normalizeObsidianKnowledge({
    path: 'Private/family.md', title: 'Private capacity note', modifiedTime: now.toISOString(),
    content: 'Family commitment affects the protected morning window.', tags: ['private'], visibility: 'founder-private',
  }), now);
  const index = buildKnowledgeIndex([drive, privateNote]);
  const enterpriseOnly = searchKnowledge(index, 'platform context transfer proof', { includeFounderPrivate: false });
  assert.equal(enterpriseOnly.results.length, 1);
  assert.equal(enterpriseOnly.results[0]?.title, 'Platform pilot evidence');
  assert.match(enterpriseOnly.results[0]?.citation ?? '', /Google Drive/);
  const withPrivate = searchKnowledge(index, 'family protected morning', { includeFounderPrivate: true });
  assert.equal(withPrivate.results[0]?.visibility, 'founder-private');
});
