import postgres from 'postgres';
import type { FounderPilotSession } from './founder-pilot';

export class PostgresFounderPilotStore {
  private readonly sql;
  constructor(connectionString: string) { this.sql = postgres(connectionString, { max: 2, prepare: false }); }

  async append(founderId: string, session: FounderPilotSession): Promise<FounderPilotSession> {
    await this.sql`
      insert into founder_pilot_sessions (
        founder_id, session_id, started_at, ended_at, command, completed_journey,
        proof_captured, decision_useful, five_second_gate, critical_issues, high_issues, notes
      ) values (
        ${founderId}, ${session.id}, ${session.startedAt}, ${session.endedAt}, ${session.command}, ${session.completedJourney},
        ${session.proofCaptured}, ${session.decisionUseful}, ${this.sql.json(session.fiveSecondGate)},
        ${session.criticalIssues}, ${session.highIssues}, ${session.notes}
      ) on conflict (founder_id, session_id) do nothing
    `;
    return session;
  }

  async list(founderId: string): Promise<FounderPilotSession[]> {
    const rows = await this.sql<any[]>`
      select session_id, started_at, ended_at, command, completed_journey, proof_captured,
             decision_useful, five_second_gate, critical_issues, high_issues, notes
      from founder_pilot_sessions where founder_id = ${founderId} order by started_at desc limit 100
    `;
    return rows.map((row) => ({
      id: row.session_id, startedAt: row.started_at.toISOString(), endedAt: row.ended_at.toISOString(),
      command: row.command, completedJourney: row.completed_journey, proofCaptured: row.proof_captured,
      decisionUseful: row.decision_useful, fiveSecondGate: row.five_second_gate,
      criticalIssues: row.critical_issues, highIssues: row.high_issues, notes: row.notes,
    }));
  }
}
