'use client';

import { useEffect, useState } from 'react';
import { Leva, useControls } from 'leva';
import { resolveOrganismParameters } from '@/nehemiah/organism-parameters';
import { ORGANISM_STATUS_LABEL, restingLabCommandSurface } from '@/nehemiah/organism-lab-contract';
import { OrganismEngine } from './organism-engine';
import styles from './organism-lab.module.css';

function useReducedMotionPreference() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(media.matches);

    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  return reduced;
}

export function OrganismLab() {
  const reducedMotion = useReducedMotionPreference();
  const defaults = resolveOrganismParameters();

  const overrides = useControls('Resting state', {
    scale: { value: defaults.scale, min: 0.6, max: 1.4 },
    breathingSpeed: { value: defaults.breathingSpeed, min: 0.1, max: 2 },
    breathingAmplitude: { value: defaults.breathingAmplitude, min: 0, max: 0.12 },
    particleCount: { value: defaults.particleCount, min: 0, max: 400, step: 1 },
    particleSize: { value: defaults.particleSize, min: 0.2, max: 4 },
    particleVelocity: { value: defaults.particleVelocity, min: 0, max: 1 },
    goldIntensity: { value: defaults.goldIntensity, min: 0, max: 1.5 },
    indigoIntensity: { value: defaults.indigoIntensity, min: 0, max: 1.5 },
    shellOpacity: { value: defaults.shellOpacity, min: 0, max: 1 },
    coreIntensity: { value: defaults.coreIntensity, min: 0, max: 4 },
    rotationDrift: { value: defaults.rotationDrift, min: 0, max: 0.2 },
  });

  const parameters = resolveOrganismParameters(overrides);

  return (
    <section className={styles.labShell} aria-label="Nehemiah organism laboratory">
      <Leva hidden={process.env.NODE_ENV === 'production'} collapsed titleBar={{ title: 'Organism controls' }} />

      <div
        className={styles.stage}
        data-state="resting"
        aria-label="Nehemiah living organism, resting state"
      >
        <OrganismEngine parameters={parameters} reducedMotion={reducedMotion} />
      </div>

      <div className={styles.statusRow}>
        <span className={styles.statusDot} aria-hidden="true" />
        <span>{ORGANISM_STATUS_LABEL}</span>
        {reducedMotion ? <span>Reduced motion active</span> : null}
      </div>

      <div
        className={styles.commandSurface}
        aria-label="Command surface"
        data-active={restingLabCommandSurface.active}
      >
        <span className={styles.commandPlaceholder} aria-disabled="true">
          {restingLabCommandSurface.placeholder}
        </span>
        <button
          type="button"
          className={styles.commandButton}
          disabled
          aria-disabled="true"
          tabIndex={-1}
        >
          <span aria-hidden="true">●</span>
        </button>
      </div>
      <p className={styles.commandHelperText}>{restingLabCommandSurface.helperText}</p>
    </section>
  );
}
