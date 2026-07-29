'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Leva, useControls } from 'leva';
import type { NehemiahState } from '@/nehemiah/state-machine';
import { resolveStateParameters } from '@/nehemiah/organism-parameters';
import {
  ORGANISM_SLEEP_LABEL,
  commandSurfaceByState,
  organismStateLabels,
} from '@/nehemiah/organism-lab-contract';
import {
  lifecycleOrder,
  requiredDwellSeconds,
  resolveTransitionPersonality,
  sleepTransitionPersonality,
  wakeTransitionPersonality,
  type TransitionPersonality,
} from '@/nehemiah/organism-transition';
import {
  SLEEP_TIMEOUT_MS,
  resolveIdleTimeoutMs,
  toSleepParameters,
} from '@/nehemiah/organism-sleep';
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
  const [asleep, setAsleep] = useState(false);
  const [personality, setPersonality] = useState<TransitionPersonality | null>(null);
  const enteredAtRef = useRef(0);
  const chargeFrameRef = useRef(0);
  const pressStartedAtRef = useRef<number | null>(null);
  const chargeSecondsRef = useRef(CHARGE_SECONDS);
  const stageRef = useRef<HTMLDivElement>(null);

  const asleepRef = useRef(false);
  asleepRef.current = asleep;
  const reducedMotionRef = useRef(reducedMotion);
  reducedMotionRef.current = reducedMotion;
  const idleTimeoutRef = useRef(SLEEP_TIMEOUT_MS);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    floatAmplitude: { value: defaults.floatAmplitude, min: 0, max: 0.25 },
    floatSpeed: { value: defaults.floatSpeed, min: 0, max: 0.4 },
  });

  const stateParameters = resolveStateParameters(
    state,
    manualOverride ? overrides : undefined,
  );
  const parameters = asleep ? toSleepParameters(stateParameters) : stateParameters;
  const surface = commandSurfaceByState[state];
  const surfacePresence = asleep ? 'dormant' : surface.presence;
  const statusLabel = asleep ? ORGANISM_SLEEP_LABEL : organismStateLabels[state];

  const goToSleep = useCallback(() => {
    if (asleepRef.current) {
      return;
    }
    setPersonality(sleepTransitionPersonality(reducedMotionRef.current));
    setAsleep(true);
  }, []);

  const armIdleTimer = useCallback(() => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
    }
    idleTimerRef.current = setTimeout(goToSleep, idleTimeoutRef.current);
  }, [goToSleep]);

  // Any activity resets the idle countdown; if the organism had drifted off,
  // the first touch simply wakes it.
  const registerActivity = useCallback(() => {
    if (asleepRef.current) {
      setPersonality(wakeTransitionPersonality(reducedMotionRef.current));
      setAsleep(false);
    }
    armIdleTimer();
  }, [armIdleTimer]);

  useEffect(() => {
    idleTimeoutRef.current = resolveIdleTimeoutMs(
      new URLSearchParams(window.location.search).get('idleMs'),
    );
    armIdleTimer();

    const onActivity = () => registerActivity();
    window.addEventListener('pointerdown', onActivity);
    window.addEventListener('pointermove', onActivity);
    window.addEventListener('keydown', onActivity);

    return () => {
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
      }
      window.removeEventListener('pointerdown', onActivity);
      window.removeEventListener('pointermove', onActivity);
      window.removeEventListener('keydown', onActivity);
    };
  }, [armIdleTimer, registerActivity]);

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

  const beginCharge = useCallback(() => {
    const startedAt = performance.now();
    pressStartedAtRef.current = startedAt;

    // The ring is a promise: it may only reach full when releasing will
    // actually advance the lifecycle. If the state still owes dwell time
    // (action must be seen to take time), the charge stretches to cover it
    // rather than completing and then silently doing nothing.
    const dwellRemaining =
      requiredDwellSeconds(state) - (startedAt - enteredAtRef.current) / 1000;
    const chargeSeconds = Math.max(CHARGE_SECONDS, dwellRemaining);
    chargeSecondsRef.current = chargeSeconds;

    const tick = () => {
      const progress = Math.min(
        1,
        (performance.now() - startedAt) / 1000 / chargeSeconds,
      );
      setCharge(progress);
      if (progress < 1) {
        chargeFrameRef.current = requestAnimationFrame(tick);
      }
    };
    chargeFrameRef.current = requestAnimationFrame(tick);
  }, [setCharge, state]);

  const releaseCharge = useCallback(
    (advance: boolean) => {
      cancelAnimationFrame(chargeFrameRef.current);
      const startedAt = pressStartedAtRef.current;
      pressStartedAtRef.current = null;
      setCharge(0);
      const heldLongEnough =
        startedAt !== null &&
        (performance.now() - startedAt) / 1000 >= chargeSecondsRef.current;
      if (advance && heldLongEnough) {
        step(1);
      }
    },
    [setCharge, step],
  );

  useEffect(() => () => cancelAnimationFrame(chargeFrameRef.current), []);

  return (
    <section className={styles.labShell} aria-label="Nehemiah organism laboratory">
      <div
        ref={stageRef}
        className={styles.stage}
        data-state={state}
        data-asleep={asleep}
        role="button"
        aria-keyshortcuts="ArrowRight ArrowLeft Home"
        aria-label={`Nehemiah living organism, ${statusLabel.toLowerCase()}. Press and hold to advance, or use arrow keys.`}
        tabIndex={0}
        onPointerDown={(event) => {
          if (asleepRef.current) {
            return;
          }
          if (event.button === 0) {
            beginCharge();
          }
        }}
        onPointerUp={() => releaseCharge(true)}
        onPointerLeave={() => releaseCharge(false)}
        onPointerCancel={() => releaseCharge(false)}
        onKeyDown={(event) => {
          if (asleepRef.current) {
            return;
          }
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            step(1);
          } else if (event.key === 'ArrowRight') {
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
          lifecycle={state}
        />
        <span className={styles.chargeRing} aria-hidden="true" />
      </div>

      <div className={styles.statusRow}>
        <span
          className={styles.statusDot}
          data-asleep={asleep}
          aria-hidden="true"
          style={
            {
              '--pulse-seconds': `${(2 * Math.PI) / parameters.corePulseRate}s`,
            } as React.CSSProperties
          }
        />
        {/* both the state label AND the reduced-motion note live inside the
            polite region, so a reduced-motion toggle is announced and the note
            reads as a delimited second token rather than an unseparated run-on */}
        <span aria-live="polite">
          {statusLabel}
          {reducedMotion ? <span> · Reduced motion</span> : null}
        </span>
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
            onClick={() => {
              if (asleepRef.current) {
                return;
              }
              moveTo(candidate);
            }}
          />
        ))}
      </nav>

      <div
        className={styles.commandSurface}
        aria-label="Command surface"
        data-active={surface.active}
        data-presence={surfacePresence}
        style={{ '--surface-glow': parameters.goldIntensity } as React.CSSProperties}
      >
        <span className={styles.commandPlaceholder} aria-disabled="true">
          {surface.placeholder}
        </span>
        <button
          type="button"
          className={styles.commandButton}
          aria-label="Send — not yet available"
          disabled
        >
          <span aria-hidden="true">●</span>
        </button>
      </div>
      <p className={styles.commandHelperText}>{surface.helperText}</p>

      {/* Leva is position:fixed, so its DOM position is purely a tab-order
          concern. Mounted last, the organism becomes the first tab stop
          instead of the seventeenth. */}
      <Leva
        hidden={process.env.NODE_ENV === 'production'}
        collapsed
        titleBar={{ title: 'Organism controls' }}
      />
    </section>
  );
}
