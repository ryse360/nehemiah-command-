'use client';

import { FormEvent, useState } from 'react';

export function FounderSignIn() {
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!password || busy) return;
    setBusy(true);
    setStatus('Verifying private access…');
    const response = await fetch('/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }),
    });
    if (response.ok) {
      window.location.reload();
      return;
    }
    setStatus(response.status === 503 ? 'Founder authentication is not configured.' : 'Access could not be verified.');
    setBusy(false);
  }

  async function prepareRecovery() {
    await fetch('/api/auth/recovery', { method: 'POST' });
    setStatus('Recovery preparation recorded. Use the private recovery channel.');
  }

  return <main className="auth-screen">
    <section className="auth-card" aria-labelledby="auth-title">
      <div className="auth-mark">M</div>
      <p className="eyebrow">NEHEMIAH</p>
      <h1 id="auth-title">The Founder’s Private Intelligence</h1>
      <p className="auth-copy">Private access is required before Nehemiah reveals Founder memory, decisions, or evidence.</p>
      <form onSubmit={signIn}>
        <label htmlFor="founder-password">Founder passphrase</label>
        <input id="founder-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} />
        <button className="primary-button" type="submit" disabled={busy}>{busy ? 'Verifying…' : 'Enter Nehemiah'}</button>
      </form>
      <button className="auth-recovery" type="button" onClick={prepareRecovery}>Prepare account recovery</button>
      <p className="auth-status" aria-live="polite">{status}</p>
    </section>
  </main>;
}
