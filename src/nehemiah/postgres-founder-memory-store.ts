import postgres from 'postgres';
import type { FounderMemory } from './founder-memory';
import {
  MemoryConflictError,
  type CloudFounderMemory,
  type FounderMemoryStore,
} from './cloud-memory';

export class PostgresFounderMemoryStore implements FounderMemoryStore {
  private readonly sql;

  constructor(connectionString: string) {
    this.sql = postgres(connectionString, { max: 2, prepare: false });
  }

  async load(founderId: string): Promise<CloudFounderMemory | null> {
    const rows = await this.sql<{
      founder_id: string;
      memory: FounderMemory;
      revision: number;
      updated_at: Date;
    }[]>`
      select founder_id, memory, revision, updated_at
      from founder_memory
      where founder_id = ${founderId}
      limit 1
    `;
    const row = rows[0];
    return row ? {
      founderId: row.founder_id,
      memory: row.memory,
      revision: row.revision,
      updatedAt: row.updated_at.toISOString(),
    } : null;
  }

  async save(founderId: string, memory: FounderMemory, expectedRevision: number): Promise<CloudFounderMemory> {
    const rows = await this.sql<{
      founder_id: string;
      memory: FounderMemory;
      revision: number;
      updated_at: Date;
    }[]>`
      insert into founder_memory (founder_id, memory, revision)
      values (${founderId}, ${this.sql.json(memory)}, 1)
      on conflict (founder_id) do update
      set memory = excluded.memory,
          revision = founder_memory.revision + 1,
          updated_at = now()
      where founder_memory.revision = ${expectedRevision}
      returning founder_id, memory, revision, updated_at
    `;
    const row = rows[0];
    if (!row) throw new MemoryConflictError();
    return {
      founderId: row.founder_id,
      memory: row.memory,
      revision: row.revision,
      updatedAt: row.updated_at.toISOString(),
    };
  }
}
