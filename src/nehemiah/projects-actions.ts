import type { ValidationResult } from './data-boundaries';

export type ProjectStatus = 'planned' | 'active' | 'blocked' | 'complete';
export type ProjectActionStatus = 'not-started' | 'in-progress' | 'blocked' | 'complete';

export type ActionProof = {
  id: string;
  evidence: string;
  capturedAt: string;
};

export type ProjectAction = {
  id: string;
  title: string;
  owner: string;
  status: ProjectActionStatus;
  dueAt: string;
  dependencies: string[];
  blockers: string[];
  progress: number;
  proof: ActionProof[];
};

export type FounderProject = {
  id: string;
  name: string;
  objective: string;
  owner: string;
  status: ProjectStatus;
  dueAt: string;
  decisionId?: string;
  dependencies: string[];
  blockers: string[];
  actions: ProjectAction[];
};

export type ProjectAttentionItem = {
  projectId: string;
  projectName: string;
  actionId: string;
  actionTitle: string;
  owner: string;
  reason: string;
  dueAt: string;
};

export type ProjectPortfolio = {
  generatedAt: string;
  projects: FounderProject[];
  summary: {
    activeProjects: number;
    blockedProjects: number;
    openActions: number;
    blockedActions: number;
    overdueActions: number;
    completedActions: number;
  };
  attention: ProjectAttentionItem[];
};

function validTimestamp(value: string): boolean {
  return Boolean(value) && !Number.isNaN(Date.parse(value));
}

function boundedStrings(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string' && item.trim().length > 0);
}

function actionErrors(action: Partial<ProjectAction>, projectName: string): string[] {
  const prefix = `Project ${projectName || 'unknown'} action ${action.title || action.id || 'unknown'}`;
  const errors: string[] = [];
  if (!action.id?.trim()) errors.push(`${prefix} id is required.`);
  if (!action.title?.trim()) errors.push(`${prefix} title is required.`);
  if (!action.owner?.trim()) errors.push(`${prefix} owner is required.`);
  if (!['not-started', 'in-progress', 'blocked', 'complete'].includes(action.status ?? '')) errors.push(`${prefix} status is invalid.`);
  if (!action.dueAt || !validTimestamp(action.dueAt)) errors.push(`${prefix} dueAt is invalid.`);
  if (!Number.isFinite(action.progress) || Number(action.progress) < 0 || Number(action.progress) > 100) errors.push(`${prefix} progress must be between 0 and 100.`);
  if (!boundedStrings(action.dependencies ?? [])) errors.push(`${prefix} dependencies must be a string array.`);
  if (!boundedStrings(action.blockers ?? [])) errors.push(`${prefix} blockers must be a string array.`);
  if (!Array.isArray(action.proof)) errors.push(`${prefix} proof must be an array.`);
  return errors;
}

export function validateProjects(value: unknown): ValidationResult {
  if (!Array.isArray(value)) return { valid: false, errors: ['Projects must be an array.'] };
  const errors: string[] = [];
  for (const candidate of value) {
    const project = candidate && typeof candidate === 'object' && !Array.isArray(candidate)
      ? candidate as Partial<FounderProject>
      : {};
    const prefix = `Project ${project.name || project.id || 'unknown'}`;
    if (!project.id?.trim()) errors.push(`${prefix} id is required.`);
    if (!project.name?.trim()) errors.push(`${prefix} name is required.`);
    if (!project.objective?.trim()) errors.push(`${prefix} objective is required.`);
    if (!project.owner?.trim()) errors.push(`${prefix} owner is required.`);
    if (!['planned', 'active', 'blocked', 'complete'].includes(project.status ?? '')) errors.push(`${prefix} status is invalid.`);
    if (!project.dueAt || !validTimestamp(project.dueAt)) errors.push(`${prefix} dueAt is invalid.`);
    if (!boundedStrings(project.dependencies ?? [])) errors.push(`${prefix} dependencies must be a string array.`);
    if (!boundedStrings(project.blockers ?? [])) errors.push(`${prefix} blockers must be a string array.`);
    if (!Array.isArray(project.actions)) errors.push(`${prefix} actions must be an array.`);
    else project.actions.forEach((action) => errors.push(...actionErrors(action, project.name ?? project.id ?? 'unknown')));
  }
  return { valid: errors.length === 0, errors };
}

export function createProject(input: FounderProject): FounderProject {
  const validation = validateProjects([input]);
  if (!validation.valid) throw new Error(validation.errors.join(' '));
  return structuredClone(input);
}

export function updateProjectAction(
  project: FounderProject,
  actionId: string,
  update: Partial<Omit<ProjectAction, 'id' | 'proof'>>,
): FounderProject {
  const action = project.actions.find((item) => item.id === actionId);
  if (!action) throw new Error('Project action was not found.');
  const nextAction: ProjectAction = {
    ...action,
    ...update,
    dependencies: update.dependencies ? [...update.dependencies] : [...action.dependencies],
    blockers: update.blockers ? [...update.blockers] : [...action.blockers],
    proof: action.proof.map((item) => ({ ...item })),
  };
  if (nextAction.status === 'complete' && nextAction.proof.length === 0) {
    throw new Error('Visible proof is required before an action can be completed.');
  }
  if (nextAction.status === 'complete') nextAction.progress = 100;
  const next = {
    ...project,
    actions: project.actions.map((item) => item.id === actionId ? nextAction : structuredClone(item)),
  };
  const validation = validateProjects([next]);
  if (!validation.valid) throw new Error(validation.errors.join(' '));
  return next;
}

export function recordActionProof(
  project: FounderProject,
  actionId: string,
  evidence: string,
  now = new Date(),
): FounderProject {
  if (evidence.trim().length < 12) throw new Error('Visible proof must describe the observable change.');
  const action = project.actions.find((item) => item.id === actionId);
  if (!action) throw new Error('Project action was not found.');
  const proof: ActionProof = {
    id: `proof-${now.getTime()}-${action.proof.length + 1}`,
    evidence: evidence.trim(),
    capturedAt: now.toISOString(),
  };
  return {
    ...project,
    actions: project.actions.map((item) => item.id === actionId
      ? { ...item, proof: [...item.proof.map((entry) => ({ ...entry })), proof] }
      : structuredClone(item)),
  };
}

export function buildProjectPortfolio(projects: FounderProject[], now = new Date()): ProjectPortfolio {
  const validation = validateProjects(projects);
  if (!validation.valid) throw new Error(validation.errors.join(' '));
  const actions = projects.flatMap((project) => project.actions.map((action) => ({ project, action })));
  const attention = actions
    .filter(({ action }) => action.status === 'blocked' || (action.status !== 'complete' && Date.parse(action.dueAt) < now.getTime()))
    .map(({ project, action }) => ({
      projectId: project.id,
      projectName: project.name,
      actionId: action.id,
      actionTitle: action.title,
      owner: action.owner,
      reason: action.status === 'blocked'
        ? `Blocked: ${action.blockers.join('; ') || 'blocker not yet described'}`
        : 'Overdue without visible completion proof.',
      dueAt: action.dueAt,
    }))
    .sort((a, b) => (a.reason.startsWith('Blocked') === b.reason.startsWith('Blocked') ? Date.parse(a.dueAt) - Date.parse(b.dueAt) : a.reason.startsWith('Blocked') ? -1 : 1));
  return {
    generatedAt: now.toISOString(),
    projects: projects.map((project) => structuredClone(project)),
    summary: {
      activeProjects: projects.filter((project) => project.status === 'active').length,
      blockedProjects: projects.filter((project) => project.status === 'blocked').length,
      openActions: actions.filter(({ action }) => action.status !== 'complete').length,
      blockedActions: actions.filter(({ action }) => action.status === 'blocked').length,
      overdueActions: actions.filter(({ action }) => action.status !== 'complete' && Date.parse(action.dueAt) < now.getTime()).length,
      completedActions: actions.filter(({ action }) => action.status === 'complete').length,
    },
    attention,
  };
}

export function normalizeEnterpriseProjects(value: unknown, now = new Date()): FounderProject[] {
  if (!Array.isArray(value)) return [];
  return value.map((candidate, index) => {
    const record = candidate && typeof candidate === 'object' && !Array.isArray(candidate)
      ? candidate as Partial<FounderProject>
      : {};
    const dueAt = record.dueAt && validTimestamp(record.dueAt)
      ? record.dueAt
      : new Date(now.getTime() + (index + 1) * 30 * 24 * 60 * 60 * 1000).toISOString();
    const status: ProjectStatus = ['planned', 'active', 'blocked', 'complete'].includes(record.status ?? '')
      ? record.status as ProjectStatus
      : 'planned';
    return {
      id: record.id?.trim() || `legacy-project-${index + 1}`,
      name: record.name?.trim() || `Project ${index + 1}`,
      objective: record.objective?.trim() || 'Objective must be confirmed by the Founder.',
      owner: record.owner?.trim() || 'Owner required',
      status,
      dueAt,
      decisionId: record.decisionId,
      dependencies: boundedStrings(record.dependencies ?? []) ? [...(record.dependencies ?? [])] : [],
      blockers: boundedStrings(record.blockers ?? []) ? [...(record.blockers ?? [])] : [],
      actions: Array.isArray(record.actions) ? record.actions.map((action) => ({
        id: action.id,
        title: action.title,
        owner: action.owner,
        status: action.status,
        dueAt: action.dueAt,
        dependencies: [...action.dependencies],
        blockers: [...action.blockers],
        progress: action.progress,
        proof: action.proof.map((proof) => ({ ...proof })),
      })) : [],
    };
  });
}
