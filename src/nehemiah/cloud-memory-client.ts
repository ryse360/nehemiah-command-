import type { CloudFounderMemory } from './cloud-memory';
import type { FounderMemory } from './founder-memory';

export const CLOUD_ACCESS_KEY = 'nehemiah.cloud-access-key';

function headers(accessKey: string) {
  return { Authorization: `Bearer ${accessKey}`, 'Content-Type': 'application/json' };
}

export async function loadCloudFounderMemory(accessKey: string): Promise<CloudFounderMemory> {
  const response = await fetch('/api/founder-memory', { headers: headers(accessKey), cache: 'no-store' });
  if (!response.ok) throw new Error(`Cloud memory load failed (${response.status}).`);
  return response.json() as Promise<CloudFounderMemory>;
}

export async function saveCloudFounderMemory(
  accessKey: string,
  memory: FounderMemory,
  expectedRevision: number,
): Promise<CloudFounderMemory> {
  const response = await fetch('/api/founder-memory', {
    method: 'PUT',
    headers: headers(accessKey),
    body: JSON.stringify({ memory, expectedRevision }),
  });
  if (!response.ok) throw new Error(`Cloud memory save failed (${response.status}).`);
  return response.json() as Promise<CloudFounderMemory>;
}
