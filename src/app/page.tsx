export const dynamic = 'force-dynamic';

import { FounderSignIn } from '@/components/founder-sign-in';
import { NehemiahShell } from '@/components/nehemiah-shell';
import { getFounderSession } from '@/nehemiah/founder-auth-server';

export default async function Home() {
  const session = await getFounderSession();
  return session ? <NehemiahShell /> : <FounderSignIn />;
}
