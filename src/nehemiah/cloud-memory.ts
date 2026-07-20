import type { FounderMemory } from './founder-memory';

export type CloudFounderMemory = {
  founderId: string;
  memory: FounderMemory;
  revision: number;
  updatedAt: string;
};

export interface FounderMemoryStore {
  load(founderId: string): Promise<CloudFounderMemory | null>;
  save(founderId: string, memory: FounderMemory, expectedRevision: number): Promise<CloudFounderMemory>;
}

export class MemoryConflictError extends Error {
  constructor(message = 'Founder memory changed in another session.') {
    super(message);
    this.name = 'MemoryConflictError';
  }
}

export class InMemoryFounderMemoryStore implements FounderMemoryStore {
  private readonly records = new Map<string, CloudFounderMemory>();

  async load(founderId: string): Promise<CloudFounderMemory | null> {
    return this.records.get(founderId) ?? null;
  }

  async save(founderId: string, memory: FounderMemory, expectedRevision: number): Promise<CloudFounderMemory> {
    const current = this.records.get(founderId);
    const currentRevision = current?.revision ?? 0;
    if (currentRevision !== expectedRevision) throw new MemoryConflictError();
    const next: CloudFounderMemory = {
      founderId,
      memory,
      revision: currentRevision + 1,
      updatedAt: new Date().toISOString(),
    };
    this.records.set(founderId, next);
    return next;
  }
}

export function mergeFounderMemories(local: FounderMemory, cloud: FounderMemory): FounderMemory {
  const records = new Map<string, FounderMemory['decisions'][number]>();
  for (const record of [...cloud.decisions, ...local.decisions]) {
    if (!records.has(record.id)) records.set(record.id, record);
  }
  return {
    version: 2,
    decisions: [...records.values()].sort((a, b) => b.proofRecordedAt.localeCompare(a.proofRecordedAt)),
  };
}
