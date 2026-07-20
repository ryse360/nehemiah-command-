import { NextResponse } from 'next/server';
import { getFounderSession } from '@/nehemiah/founder-auth-server';
import { assessDeploymentReadiness, REQUIRED_MIGRATIONS } from '@/nehemiah/deployment-readiness';
import { evaluateDeploymentRehearsal, parseDeploymentRehearsalEvidence } from '@/nehemiah/deployment-rehearsal';

export async function GET() {
  const session = await getFounderSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const readiness = assessDeploymentReadiness(process.env, [...REQUIRED_MIGRATIONS]);
  return NextResponse.json({
    readiness,
    rehearsal: evaluateDeploymentRehearsal({
      readiness: readiness.ready,
      migrations: readiness.missingMigrations.length === 0,
      backupRestore: false,
      tests: false,
      typecheck: false,
      build: false,
      performance: false,
      smoke: false,
      securityHeaders: false,
      rollbackPrepared: false,
    }),
    note: 'Runtime evidence is intentionally false until supplied by the deployment rehearsal pipeline.',
  });
}

export async function POST(request: Request) {
  const session = await getFounderSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await request.json() as { evidence?: unknown };
    const evidence = parseDeploymentRehearsalEvidence(body.evidence);
    return NextResponse.json(evaluateDeploymentRehearsal(evidence));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Invalid rehearsal evidence.' },
      { status: 400 },
    );
  }
}
