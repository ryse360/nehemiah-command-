'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Leva, useControls } from 'leva';
import type { NehemiahState } from '@/nehemiah/state-machine';
import { resolveStateParameters } from '@/nehemiah/organism-parameters';
import {
  commandSurfaceByState,
  organismStateLabels,
} from '@/nehemiah/organism-lab-contract';
import {
  lifecycleOrder,
  requiredDwellSeconds,
  resolveTransitionPersonality,
  type TransitionPersonality,
} from '@/nehemiah/organism-transition';
import { OrganismEngine } from './organism-engine';
import styles from './organism-lab.module.css';

const CHARGE_SECONDS = 0.65;

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
  const [state, setState] = useState<NehemiahState>('resting');
  const [personality, setPersonality] = useState<TransitionPersonality | null>(null);
  const enteredAtRef = useRef(0);
  const chargeFrameRef = useRef(0);
  const stageRef = useRef<HTMLDivElement>(null);

  const defaults = resolveStateParameters('resting');
  const { manualOverride, ...overrides } = useControls('Organism', {
    manualOverride: { value: false, label: 'manual override' },
    scale: { value: defaults.scale, min: 0.6, max: 1.4 },
    breathingSpeed: { value: defaults.breathingSpeed, min: 0.1, max: 2 },
    breathingAmplitude: { value: defaults.breathingAmplitude, min: 0, max: 0.12 },
    particleCount: { value: defaults.particleCount, min: 0, max: 400, step: 1 },
    particleSize: { value: defaults.particleSize, min: 0.2, max: 4 },
    particleVelocity: { value: defaults.particleVelocity, min: 0, max: 1 },
    goldIntensity: { value: defaults.goldIntensity, min: 0, max: 2 },
    indigoIntensity: { value: defaults.indigoIntensity, min: 0, max: 1.5 },
    indigoConvergence: { value: defaults.indigoConvergence, min: 0, max: 1 },
    shellOpacity: { value: defaults.shellOpacity, min: 0, max: 1 },
    coreIntensity: { value: defaults.coreIntensity, min: 0, max: 4 },
    rotationDrift: { value: defaults.rotationDrift, min: 0, max: 0.2 },
  });

  const parameters = resolveStateParameters(
    state,
    manualOverride ? overrides : undefined,
  );
  const surface = commandSurfaceByState[state];

  const moveTo = useCallback(
    (next: NehemiahState) => {
      if (next === state) {
        return;
      }
      const dwelled = (performance.now() - enteredAtRef.current) / 1000;
      if (dwelled < requiredDwellSeconds(state)) {
        return;
      }
      setPersonality(resolveTransitionPersonality(state, next, reducedMotion));
      setState(next);
      enteredAtRef.current = performance.now();
    },
    [state, reducedMotion],
  );

  const step = useCallback(
    (direction: 1 | -1) => {
      const index = lifecycleOrder.indexOf(state);
      const next =
        lifecycleOrder[
          (index + direction + lifecycleOrder.length) % lifecycleOrder.length
        ];
      moveTo(next);
    },
    [state, moveTo],
  );

  const setCharge = useCallback((value: number) => {
    stageRef.current?.style.setProperty('--charge', String(value));
  }, []);

  const pressStartedAtRef = useRef<number | null>(null);

  const beginCharge = useCallback(() => {
    const startedAt = performance.now();
    pressStartedAtRef.current = startedAt;
    const tick = () => {
      const progress = Math.min(
        1,
        (performance.now() - startedAt) / 1000 / CHARGE_SECONDS,
      );
      setCharge(progress);
      if (progress < 1) {
        chargeFrameRef.current = requestAnimationFrame(tick);
      }
    };
    chargeFrameRef.current = requestAnimationFrame(tick);
  }, [setCharge]);

  const releaseCharge = useCallback(
    (advance: boolean) => {
      cancelAnimationFrame(chargeFrameRef.current);
      const startedAt = pressStartedAtRef.current;
      pressStartedAtRef.current = null;
      setCharge(0);
      const heldLongEnough =
        startedAt !== null &&
        (performance.now() - startedAt) / 1000 >= CHARGE_SECONDS;
      if (advance && heldLongEnough) {
        step(1);
      }
    },
    [setCharge, step],
  );

  useEffect(() => () => cancelAnimationFrame(chargeFrameRef.current), []);

  return (
    <section className={styles.labShell} aria-label="Nehemiah organism laboratory">
      <Leva
        hidden={process.env.NODE_ENV === 'production'}
        collapsed
        titleBar={{ title: 'Organism controls' }}
      />

      <div
        ref={stageRef}
        className={styles.stage}
        data-state={state}
        role="group"
        aria-label={`Nehemiah living organism, ${organismStateLabels[state].toLowerCase()}. Press and hold to advance, or use arrow keys.`}
        tabIndex={0}
        onPointerDown={(event) => {
          if (event.button === 0) {
            beginCharge();
          }
        }}
        onPointerUp={() => releaseCharge(true)}
        onPointerLeave={() => releaseCharge(false)}
        onPointerCancel={() => releaseCharge(false)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowRight') {
            event.preventDefault();
            step(1);
          } else if (event.key === 'ArrowLeft') {
            event.preventDefault();
            step(-1);
          } else if (event.key === 'Home') {
            event.preventDefault();
            moveTo('resting');
          }
        }}
      >
        <OrganismEngine
          parameters={parameters}
          personality={personality}
          reducedMotion={reducedMotion}
        />
        <span className={styles.chargeRing} aria-hidden="true" />
      </div>

      <div className={styles.statusRow}>
        <span className={styles.statusDot} data-state={state} aria-hidden="true" />
        <span aria-live="polite">{organismStateLabels[state]}</span>
        {reducedMotion ? <span>Reduced motion active</span> : null}
      </div>

      <nav className={styles.jumpDots} aria-label="Lifecycle states">
        {lifecycleOrder.map((candidate) => (
          <button
            key={candidate}
            type="button"
            className={styles.jumpDot}
            data-current={candidate === state}
            aria-label={organismStateLabels[candidate]}
            aria-pressed={candidate === state}
            onClick={() => moveTo(candidate)}
          />
        ))}
      </nav>

      <div
        className={styles.commandSurface}
        aria-label="Command surface"
        data-active={surface.active}
        data-presence={surface.presence}
        style={{ '--surface-glow': parameters.goldIntensity } as React.CSSProperties}
      >
        <span className={styles.commandPlaceholder} aria-disabled="true">
          {surface.placeholder}
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
      <p className={styles.commandHelperText}>{surface.helperText}</p>
    </section>
  );
}
