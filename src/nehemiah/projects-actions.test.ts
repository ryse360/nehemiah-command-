import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildProjectPortfolio,
  createProject,
  recordActionProof,
  updateProjectAction,
  validateProjects,
  type FounderProject,
} from './projects-actions';

const project: FounderProject = createProject({
  id: 'platform-v2',
  name: 'Platform v2 restricted pilot',
  objective: 'Validate governed context transfer before expansion.',
  owner: 'Product',
  status: 'active',
  dueAt: '2026-08-15T17:00:00.000Z',
  decisionId: 'decision-pilot-v2',
  dependencies: ['Founder pilot boundary'],
  blockers: [],
  actions: [{
    id: 'activation-gate',
    title: 'Define the pilot activation gate',
    owner: 'Product and Engineering',
    status: 'in-progress',
    dueAt: '2026-08-01T17:00:00.000Z',
    dependencies: [],
    blockers: [],
    progress: 60,
    proof: [],
  }],
});

test('rejects projects without governed ownership or valid dates', () => {
  const result = validateProjects([{ ...project, owner: '', dueAt: 'not-a-date' }]);
  assert.equal(result.valid, false);
  assert.match(result.errors.join(' '), /owner/i);
  assert.match(result.errors.join(' '), /dueAt/i);
});

test('updates progress without mutating the original project', () => {
  const next = updateProjectAction(project, 'activation-gate', { progress: 80, status: 'in-progress' });
  assert.equal(next.actions[0]?.progress, 80);
  assert.equal(project.actions[0]?.progress, 60);
});

test('requires visible proof before an action can be completed', () => {
  assert.throws(() => updateProjectAction(project, 'activation-gate', { status: 'complete', progress: 100 }), /Visible proof is required/);
});

test('records proof and permits completion', () => {
  const withProof = recordActionProof(project, 'activation-gate', 'Founder approved the written activation gate.', new Date('2026-07-20T12:00:00.000Z'));
  const complete = updateProjectAction(withProof, 'activation-gate', { status: 'complete', progress: 100 });
  assert.equal(complete.actions[0]?.proof.length, 1);
  assert.equal(complete.actions[0]?.status, 'complete');
});

test('prioritizes blocked and overdue actions in the Founder portfolio', () => {
  const blocked = updateProjectAction(project, 'activation-gate', {
    status: 'blocked',
    blockers: ['Engineering owner not confirmed'],
    dueAt: '2026-07-10T17:00:00.000Z',
  });
  const portfolio = buildProjectPortfolio([blocked], new Date('2026-07-20T12:00:00.000Z'));
  assert.equal(portfolio.summary.blockedActions, 1);
  assert.equal(portfolio.summary.overdueActions, 1);
  assert.match(portfolio.attention[0]?.reason ?? '', /Blocked/);
});
