export type EnterpriseProject = {
  id: string;
  name: string;
  owner: string;
  status: 'planned' | 'active' | 'blocked' | 'complete';
};

export type EnterpriseContext = {
  version: 1;
  priorities: string[];
  commitments: string[];
  projects: EnterpriseProject[];
  updatedAt: string;
};

export type EnterpriseContextInput = Omit<EnterpriseContext, 'version' | 'updatedAt'>;

export type IntegrationSignalInput = {
  externalId: string;
  type: string;
  occurredAt: string;
  summary: string;
  payload?: Record<string, unknown>;
};

export type IntegrationSignal = IntegrationSignalInput & {
  integrationId: string;
  receivedAt: string;
};

export type ValidationResult = {
  valid: boolean;
  errors: string[];
};

const PRIVATE_KEYS = new Set([
  'founderId',
  'personalStandards',
  'familyCommitments',
  'healthMinimums',
  'privateNotes',
  'capacityConstraints',
]);

function recordOf(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function findPrivateKeys(value: unknown): string[] {
  const record = recordOf(value);
  if (!record) return [];
  const found: string[] = [];
  for (const [key, child] of Object.entries(record)) {
    if (PRIVATE_KEYS.has(key)) found.push(key);
    if (recordOf(child)) found.push(...findPrivateKeys(child));
  }
  return found;
}

export function validateEnterpriseContext(value: unknown): ValidationResult {
  const record = recordOf(value);
  const errors: string[] = [];
  if (!record) return { valid: false, errors: ['Enterprise context must be an object.'] };

  const privateKeys = findPrivateKeys(record);
  if (privateKeys.length) {
    errors.push(`Enterprise context contains private-context fields: ${[...new Set(privateKeys)].join(', ')}.`);
  }
  if (!Array.isArray(record.priorities) || !record.priorities.every((item) => typeof item === 'string')) {
    errors.push('Enterprise priorities must be a string array.');
  }
  if (!Array.isArray(record.commitments) || !record.commitments.every((item) => typeof item === 'string')) {
    errors.push('Enterprise commitments must be a string array.');
  }
  if (!Array.isArray(record.projects)) {
    errors.push('Enterprise projects must be an array.');
  }
  return { valid: errors.length === 0, errors };
}

export function createEnterpriseContext(
  input: EnterpriseContextInput,
  now = new Date(),
): EnterpriseContext {
  const validation = validateEnterpriseContext(input);
  if (!validation.valid) throw new Error(validation.errors.join(' '));
  return {
    version: 1,
    priorities: [...input.priorities],
    commitments: [...input.commitments],
    projects: input.projects.map((project) => ({ ...project })),
    updatedAt: now.toISOString(),
  };
}

export function validateIntegrationSignalInput(value: unknown): ValidationResult {
  const record = recordOf(value);
  const errors: string[] = [];
  if (!record) return { valid: false, errors: ['Integration signal must be an object.'] };

  if ('founderId' in record) errors.push('Integration signals cannot declare a Founder identity.');
  if (findPrivateKeys(record.payload).length) errors.push('Integration payload contains Founder-private fields.');
  if (typeof record.externalId !== 'string' || !record.externalId.trim()) errors.push('externalId is required.');
  if (typeof record.type !== 'string' || !record.type.trim()) errors.push('type is required.');
  if (typeof record.summary !== 'string' || !record.summary.trim()) errors.push('summary is required.');
  if (typeof record.occurredAt !== 'string' || Number.isNaN(Date.parse(record.occurredAt))) {
    errors.push('occurredAt must be a valid ISO timestamp.');
  }
  return { valid: errors.length === 0, errors };
}

export function createIntegrationSignal(
  integrationId: string,
  input: IntegrationSignalInput,
  now = new Date(),
): IntegrationSignal {
  const validation = validateIntegrationSignalInput(input);
  if (!validation.valid) throw new Error(validation.errors.join(' '));
  return {
    ...input,
    payload: input.payload ? { ...input.payload } : undefined,
    integrationId,
    receivedAt: now.toISOString(),
  };
}
