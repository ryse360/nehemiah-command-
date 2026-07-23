'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Line, MeshDistortMaterial, Sparkles } from '@react-three/drei';
import * as THREE from 'three';
import type { NehemiahState } from '@/nehemiah/state-machine';
import { organismRenderModel } from '@/nehemiah/organism-render-model';
import styles from './organism-lab.module.css';

const states: NehemiahState[] = [
  'resting',
  'listening',
  'focus-surfaced',
  'decision-required',
  'action-underway',
  'proof-created',
];

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

function createThreadPoints(index: number, total: number) {
  const phase = (index / total) * Math.PI * 2;

  return Array.from({ length: 54 }, (_, pointIndex) => {
    const progress = pointIndex / 53;
    const angle = progress * Math.PI * 2;
    const radius =
      1.02 +
      Math.sin(angle * 3 + phase) * 0.18 +
      Math.cos(angle * 5 - phase) * 0.07;

    return new THREE.Vector3(
      Math.cos(angle + phase) * radius,
      Math.sin(angle * 1.4 + phase) * radius * 0.74,
      Math.sin(angle + phase * 0.7) * radius,
    );
  });
}

function NeuralThreads({ opacity }: { opacity: number }) {
  const threads = useMemo(
    () => Array.from({ length: 18 }, (_, index) => createThreadPoints(index, 18)),
    [],
  );

  return (
    <group>
      {threads.map((points, index) => (
        <Line
          key={index}
          points={points}
          color={index % 4 === 0 ? '#8f7a45' : '#c7a65a'}
          transparent
          opacity={opacity}
          lineWidth={index % 5 === 0 ? 1.25 : 0.7}
        />
      ))}
    </group>
  );
}

function LivingScene({
  state,
  reducedMotion,
}: {
  state: NehemiahState;
  reducedMotion: boolean;
}) {
  const model = organismRenderModel[state];
  const root = useRef<THREE.Group>(null);
  const core = useRef<THREE.Mesh>(null);
  const rings = useRef<THREE.Group>(null);

  useFrame(({ clock }, delta) => {
    const elapsed = clock.getElapsedTime();
    const motionScale = reducedMotion ? 0.12 : 1;

    if (root.current) {
      root.current.rotation.y +=
        delta * model.rotationSpeed * motionScale;
      root.current.rotation.x =
        Math.sin(elapsed * 0.22) * 0.075 * motionScale;
    }

    if (core.current) {
      const breath =
        1 +
        Math.sin(elapsed * model.breathRate) *
          model.breathAmplitude *
          motionScale;
      core.current.scale.setScalar(breath);
    }

    if (rings.current) {
      rings.current.rotation.z +=
        delta * model.rotationSpeed * 0.42 * motionScale;
      rings.current.rotation.x =
        0.48 + Math.sin(elapsed * 0.16) * 0.06 * motionScale;
    }
  });

  return (
    <>
      <color attach="background" args={['#f4efe5']} />
      <ambientLight intensity={1.5} />
      <directionalLight position={[4, 5, 5]} intensity={2.2} color="#fffaf0" />
      <pointLight
        position={[-2.8, 1.2, 2.6]}
        intensity={12 * model.goldIntensity}
        distance={8}
        color="#d2ae5c"
      />

      <group ref={root}>
        <mesh>
          <sphereGeometry args={[1.62, 96, 96]} />
          <meshPhysicalMaterial
            color="#f6ead0"
            transparent
            opacity={model.shellOpacity}
            roughness={0.12}
            metalness={0.04}
            transmission={0.86}
            thickness={0.75}
            ior={1.18}
            side={THREE.DoubleSide}
          />
        </mesh>

        <mesh>
          <sphereGeometry args={[1.18, 96, 96]} />
          <MeshDistortMaterial
            color="#d7b66a"
            transparent
            opacity={0.28}
            roughness={0.24}
            metalness={0.08}
            distort={reducedMotion ? 0.05 : 0.24}
            speed={reducedMotion ? 0 : model.breathRate}
          />
        </mesh>

        <NeuralThreads opacity={model.threadOpacity} />

        <Sparkles
          count={220}
          scale={4.2}
          size={2.2}
          speed={reducedMotion ? 0.02 : model.particleSpeed}
          noise={1.15}
          color="#b8974f"
          opacity={0.62}
        />

        <mesh ref={core}>
          <sphereGeometry args={[0.34, 64, 64]} />
          <meshStandardMaterial
            color="#fff7d6"
            emissive="#d6ac51"
            emissiveIntensity={model.goldIntensity * 2.1}
            roughness={0.12}
            metalness={0.08}
          />
        </mesh>

        <group ref={rings}>
          {[1.92, 2.18, 2.42].map((radius, index) => (
            <mesh
              key={radius}
              rotation={[
                Math.PI / 2 + index * 0.18,
                index * 0.36,
                index * 0.24,
              ]}
            >
              <torusGeometry args={[radius, 0.008 + index * 0.003, 12, 220]} />
              <meshBasicMaterial
                color={index === 1 ? '#786f59' : '#c4a45a'}
                transparent
                opacity={model.ringOpacity - index * 0.035}
              />
            </mesh>
          ))}
        </group>
      </group>
    </>
  );
}

export function OrganismLab() {
  const [state, setState] = useState<NehemiahState>('resting');
  const reducedMotion = useReducedMotionPreference();

  return (
    <section className={styles.labShell} aria-label="Nehemiah organism laboratory">
      <div
        className={styles.stage}
        data-state={state}
        aria-label={`Nehemiah living organism in ${state.replaceAll('-', ' ')} state`}
      >
        <Canvas
          camera={{ position: [0, 0, 6.4], fov: 38 }}
          dpr={[1, 1.65]}
          gl={{
            antialias: true,
            alpha: false,
            powerPreference: 'high-performance',
          }}
          fallback={
            <div className={styles.fallback}>
              Nehemiah visual engine unavailable.
            </div>
          }
        >
          <LivingScene state={state} reducedMotion={reducedMotion} />
        </Canvas>
      </div>

      <div className={styles.statusRow}>
        <span className={styles.statusDot} aria-hidden="true" />
        <span>{state.replaceAll('-', ' ')}</span>
        {reducedMotion ? <span>Reduced motion active</span> : null}
      </div>

      <div className={styles.controls} aria-label="Organism states">
        {states.map((candidate) => (
          <button
            key={candidate}
            type="button"
            aria-pressed={state === candidate}
            className={state === candidate ? styles.activeButton : styles.button}
            onClick={() => setState(candidate)}
          >
            {candidate.replaceAll('-', ' ')}
          </button>
        ))}
      </div>
    </section>
  );
}
