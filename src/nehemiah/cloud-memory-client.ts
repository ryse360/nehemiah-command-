import type { CloudFounderMemory } from './cloud-memory';
import type { FounderMemory } from './founder-memory';

const headers = { 'Content-Type': 'application/json' };

export async function loadCloudFounderMemory(): Promise<CloudFounderMemory> {
  const response = await fetch('/api/founder-memory', { headers, cache: 'no-store' });
  if (!response.ok) throw new Error(`Cloud memory load failed (${response.status}).`);
  return response.json() as Promise<CloudFounderMemory>;
}

export async function saveCloudFounderMemory(memory: FounderMemory, expectedRevision: number): Promise<CloudFounderMemory> {
  const response = await fetch('/api/founder-memory', {
    method: 'PUT', headers, body: JSON.stringify({ memory, expectedRevision }),
  });
  if (!response.ok) throw new Error(`Cloud memory save failed (${response.status}).`);
  return response.json() as Promise<CloudFounderMemory>;
}
