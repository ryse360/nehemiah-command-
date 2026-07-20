import { NextResponse } from 'next/server';
import packageJson from '../../../../package.json';
import { buildHealthSnapshot } from '@/nehemiah/observability';

export const dynamic = 'force-dynamic';

export async function GET() {
  const snapshot = buildHealthSnapshot({
    database: Boolean(process.env.DATABASE_URL),
    aiProvider: Boolean(process.env.OPENAI_API_KEY),
    integrations: Boolean(process.env.NEHEMIAH_INTEGRATION_KEYS),
    version: packageJson.version,
  });
  return NextResponse.json(snapshot, { status: snapshot.status === 'healthy' ? 200 : 200 });
}
