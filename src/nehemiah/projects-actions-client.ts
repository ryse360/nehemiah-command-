import type { FounderProject, ProjectPortfolio } from './projects-actions';

export type ProjectPortfolioEnvelope = { portfolio: ProjectPortfolio; revision: number };

async function responseBody(response: Response): Promise<ProjectPortfolioEnvelope> {
  const body = await response.json() as ProjectPortfolioEnvelope | { error?: string };
  if (!response.ok) throw new Error('error' in body && body.error ? body.error : 'Projects unavailable.');
  return body as ProjectPortfolioEnvelope;
}

export async function loadProjectPortfolio(): Promise<ProjectPortfolioEnvelope> {
  return responseBody(await fetch('/api/projects-actions', { cache: 'no-store' }));
}

export async function saveProjectPortfolio(projects: FounderProject[], expectedRevision: number): Promise<ProjectPortfolioEnvelope> {
  return responseBody(await fetch('/api/projects-actions', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ projects, expectedRevision }),
  }));
}
