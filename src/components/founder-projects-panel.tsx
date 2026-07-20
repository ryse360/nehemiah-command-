'use client';

import { FormEvent, useState } from 'react';
import { recordActionProof, updateProjectAction, type FounderProject, type ProjectActionStatus, type ProjectPortfolio } from '@/nehemiah/projects-actions';

export function FounderProjectsPanel({ portfolio, isOpen, loading, saving, error, onClose, onRefresh, onSave }: {
  portfolio: ProjectPortfolio | null;
  isOpen: boolean;
  loading: boolean;
  saving: boolean;
  error: string;
  onClose: () => void;
  onRefresh: () => void;
  onSave: (projects: FounderProject[]) => void;
}) {
  const [proof, setProof] = useState<Record<string, string>>({});
  const [localError, setLocalError] = useState('');
  if (!isOpen) return null;

  function update(project: FounderProject, actionId: string, status: ProjectActionStatus, progress: number) {
    try {
      setLocalError('');
      const nextProject = updateProjectAction(project, actionId, { status, progress });
      onSave((portfolio?.projects ?? []).map((item) => item.id === project.id ? nextProject : item));
    } catch (caught) {
      setLocalError(caught instanceof Error ? caught.message : 'Action could not be updated.');
    }
  }

  function capture(event: FormEvent, project: FounderProject, actionId: string) {
    event.preventDefault();
    const key = `${project.id}:${actionId}`;
    try {
      setLocalError('');
      const nextProject = recordActionProof(project, actionId, proof[key] ?? '');
      onSave((portfolio?.projects ?? []).map((item) => item.id === project.id ? nextProject : item));
      setProof((current) => ({ ...current, [key]: '' }));
    } catch (caught) {
      setLocalError(caught instanceof Error ? caught.message : 'Proof could not be recorded.');
    }
  }

  return (
    <aside className="memory-panel projects-panel" aria-label="Founder projects and actions">
      <div className="memory-panel-header">
        <div><p className="section-label">PROJECTS AND ACTIONS</p><h2>Ownership, movement, blockers, and proof</h2></div>
        <button className="secondary-button" type="button" onClick={onClose}>Close</button>
      </div>
      <div className="project-summary">
        <span><strong>{portfolio?.summary.activeProjects ?? 0}</strong>Active projects</span>
        <span><strong>{portfolio?.summary.openActions ?? 0}</strong>Open actions</span>
        <span><strong>{portfolio?.summary.blockedActions ?? 0}</strong>Blocked</span>
        <span><strong>{portfolio?.summary.overdueActions ?? 0}</strong>Overdue</span>
      </div>
      <button className="secondary-button" type="button" onClick={onRefresh} disabled={loading}>{loading ? 'Refreshing…' : 'Refresh portfolio'}</button>
      {error || localError ? <p className="error-message">{error || localError}</p> : null}
      {portfolio?.attention.length ? <section className="project-attention"><p className="section-label">FOUNDER ATTENTION</p>{portfolio.attention.map((item) => <article key={`${item.projectId}:${item.actionId}`}><strong>{item.actionTitle}</strong><span>{item.projectName} · {item.owner}</span><p>{item.reason}</p></article>)}</section> : null}
      <div className="memory-list">
        {(portfolio?.projects ?? []).map((project) => (
          <article className="memory-record project-record" key={project.id}>
            <div className="memory-record-topline"><span>{project.status}</span><span>Due {new Date(project.dueAt).toLocaleDateString()}</span></div>
            <h3>{project.name}</h3><p>{project.objective}</p><p><strong>Owner:</strong> {project.owner}</p>{project.dependencies.length ? <p><strong>Dependencies:</strong> {project.dependencies.join('; ')}</p> : null}
            <div className="project-actions">
              {project.actions.map((action) => {
                const key = `${project.id}:${action.id}`;
                return <article key={action.id} className={`project-action is-${action.status}`}>
                  <div><strong>{action.title}</strong><span>{action.owner} · {action.progress}% · due {new Date(action.dueAt).toLocaleDateString()}</span></div>
                  {action.dependencies.length ? <p><strong>Dependencies:</strong> {action.dependencies.join('; ')}</p> : null}
                  {action.blockers.length ? <p><strong>Blocked:</strong> {action.blockers.join('; ')}</p> : null}
                  <div className="project-action-controls">
                    <select value={action.status} aria-label={`Status for ${action.title}`} onChange={(event) => update(project, action.id, event.target.value as ProjectActionStatus, event.target.value === 'complete' ? 100 : action.progress)} disabled={saving}>
                      <option value="not-started">Not started</option><option value="in-progress">In progress</option><option value="blocked">Blocked</option><option value="complete">Complete</option>
                    </select>
                    <input type="number" min="0" max="100" value={action.progress} aria-label={`Progress for ${action.title}`} onChange={(event) => update(project, action.id, action.status, Number(event.target.value))} disabled={saving || action.status === 'complete'} />
                  </div>
                  <form className="project-proof-form" onSubmit={(event) => capture(event, project, action.id)}>
                    <input value={proof[key] ?? ''} onChange={(event) => setProof((current) => ({ ...current, [key]: event.target.value }))} placeholder="Record visible proof" aria-label={`Proof for ${action.title}`} />
                    <button className="secondary-button" type="submit" disabled={saving}>Capture proof</button>
                  </form>
                  {action.proof.length ? <small>{action.proof.length} proof record{action.proof.length === 1 ? '' : 's'} preserved.</small> : null}
                </article>;
              })}
            </div>
          </article>
        ))}
        {!loading && !(portfolio?.projects.length) ? <p className="memory-empty">No governed projects are available.</p> : null}
      </div>
    </aside>
  );
}
