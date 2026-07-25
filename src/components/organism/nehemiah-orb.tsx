'use client';

// Step 3 — the authenticated Founder orb. It renders the SAME approved
// presentation component as the lab (OrganismEngine); the only difference is
// where its parameters come from. The lab feeds OrganismEngine synthetic
// fixtures (Leva + the state machine); production feeds it a sanitized
// OrbStateDTO through the pure orbParametersFromState() map.
//
// The prop type is OrbStateDTO and nothing else — this component structurally
// cannot receive a decision title, note, name, or identifier. That is the
// client boundary the contract tests protect.

import { useMemo } from 'react';
import type { OrbStateDTO } from '@/nehemiah/orb-state';
import { orbParametersFromState } from '@/nehemiah/orb-parameters';
import { OrganismEngine } from './organism-engine';

export function NehemiahOrb({
  dto,
  reducedMotion = false,
}: {
  dto: OrbStateDTO;
  reducedMotion?: boolean;
}) {
  const parameters = useMemo(() => orbParametersFromState(dto), [dto]);
  return <OrganismEngine parameters={parameters} reducedMotion={reducedMotion} />;
}
