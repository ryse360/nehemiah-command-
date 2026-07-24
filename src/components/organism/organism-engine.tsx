'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Line, MeshDistortMaterial, Sparkles } from '@react-three/drei';
import * as THREE from 'three';
import type { OrganismParameters } from '@/nehemiah/organism-parameters';
import {
  blendOrganismParameters,
  transitionProgress,
  type TransitionPersonality,
} from '@/nehemiah/organism-transition';
import { organismFloatOffset, resolveMotionScale } from '@/nehemiah/organism-motion';
import { LuminousCore } from './luminous-core';
import styles from './organism-lab.module.css';

// Animates the displayed parameters toward the target with the held-breath
// personality: still (and slightly contracted) through the hold, then a
// settling ease with overshoot. Re-renders only while a transition runs.
function useTransitionedParameters(
  target: OrganismParameters,
  personality: TransitionPersonality | null,
) {
  const [display, setDisplay] = useState({ parameters: target, scaleFactor: 1 });
  const displayRef = useRef(display);
  const targetRef = useRef(target);
  const frameRef = useRef(0);

  displayRef.current = display;

  useEffect(() => {
    if (target === targetRef.current) {
      return;
    }

    targetRef.current = target;
    cancelAnimationFrame(frameRef.current);

    if (!personality) {
      setDisplay({ parameters: target, scaleFactor: 1 });
      return;
    }

    const from = displayRef.current.parameters;
    const startedAt = performance.now();

    const tick = () => {
      const elapsed = (performance.now() - startedAt) / 1000;
      const progress = transitionProgress(personality, elapsed);

      setDisplay({
        parameters: blendOrganismParameters(from, target, progress.blend),
        scaleFactor: progress.scaleFactor,
      });

      if (progress.phase !== 'complete') {
        frameRef.current = requestAnimationFrame(tick);
      }
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [target, personality]);

  return display;
}

function createThreadPoints(index: number, total: number, phaseOffset: number) {
  const phase = (index / total) * Math.PI * 2 + phaseOffset;

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

function GoldPathways({ opacity }: { opacity: number }) {
  const threads = useMemo(
    () => Array.from({ length: 18 }, (_, index) => createThreadPoints(index, 18, 0)),
    [],
  );

  return (
    <group>
      {threads.map((points, index) => (
        <Line
          key={index}
          points={points}
          color={index % 4 === 0 ? '#c99a3f' : '#f0c264'}
          transparent
          opacity={opacity}
          lineWidth={index % 5 === 0 ? 1.35 : 0.85}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      ))}
    </group>
  );
}

function IndigoPathways({
  opacity,
  convergence,
}: {
  opacity: number;
  convergence: number;
}) {
  const threads = useMemo(
    () => Array.from({ length: 10 }, (_, index) => createThreadPoints(index, 10, Math.PI)),
    [],
  );

  return (
    <group
      position={[0.55 * (1 - convergence * 0.6), 0, 0]}
      scale={1 - 0.5 * convergence}
    >
      {threads.map((points, index) => (
        <Line
          key={index}
          points={points}
          color={index % 3 === 0 ? '#6a5cff' : '#a598ff'}
          transparent
          opacity={opacity}
          lineWidth={0.85}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      ))}
    </group>
  );
}

function LivingScene({
  parameters,
  reducedMotion,
  scaleFactor,
}: {
  parameters: OrganismParameters;
  reducedMotion: boolean;
  scaleFactor: number;
}) {
  const root = useRef<THREE.Group>(null);
  const rings = useRef<THREE.Group>(null);
  const elapsedTime = useRef(0);

  useFrame((_, delta) => {
    elapsedTime.current += delta;
    const elapsed = elapsedTime.current;
    const motionScale = resolveMotionScale(reducedMotion, parameters.reducedMotion.motionScale);

    if (root.current) {
      root.current.rotation.y += delta * parameters.rotationDrift * motionScale;
      root.current.rotation.x = Math.sin(elapsed * 0.22) * 0.075 * motionScale;

      const float = organismFloatOffset(
        elapsed,
        {
          floatAmplitude: parameters.floatAmplitude,
          floatSpeed: parameters.floatSpeed,
        },
        motionScale,
      );
      root.current.position.set(float.x, float.y, 0);
    }

    if (rings.current) {
      rings.current.rotation.z += delta * parameters.rotationDrift * 0.42 * motionScale;
      rings.current.rotation.x = 0.48 + Math.sin(elapsed * 0.16) * 0.06 * motionScale;
    }
  });

  return (
    <>
      <ambientLight intensity={parameters.lighting.ambientIntensity} />
      <hemisphereLight args={['#fffaf0', '#80662f', parameters.lighting.hemisphereIntensity]} />
      <directionalLight position={[4, 5, 5]} intensity={parameters.lighting.directionalIntensity} color="#fff8e8" />

      <group ref={root} scale={parameters.scale * scaleFactor}>
        <mesh>
          <sphereGeometry args={[1.62, 96, 96]} />
          <meshPhysicalMaterial
            color="#171209"
            transparent
            opacity={0.32 + parameters.shellOpacity * 0.42}
            roughness={0.32}
            metalness={0.02}
            transmission={0.22}
            thickness={0.6}
            ior={1.1}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>

        <mesh>
          <sphereGeometry args={[1.18, 96, 96]} />
          <MeshDistortMaterial
            color="#231a0c"
            transparent
            opacity={0.28}
            roughness={0.4}
            metalness={0.04}
            depthWrite={false}
            distort={reducedMotion ? 0.04 : 0.2}
            speed={reducedMotion ? 0 : parameters.breathingSpeed}
          />
        </mesh>

        <GoldPathways opacity={Math.min(parameters.goldIntensity * 0.85, 1)} />
        <IndigoPathways
          opacity={Math.min(parameters.indigoIntensity * 0.85, 1)}
          convergence={parameters.indigoConvergence}
        />

        <Sparkles
          count={parameters.particleCount}
          scale={3.8}
          size={parameters.particleSize}
          speed={reducedMotion ? 0.02 : parameters.particleVelocity}
          noise={1.05}
          color="#f0c264"
          opacity={0.75}
        />

        <group
          position={[0.6 * (1 - parameters.indigoConvergence * 0.6), 0, 0]}
          scale={1 - 0.45 * parameters.indigoConvergence}
        >
          <Sparkles
            count={Math.round(parameters.particleCount * 0.4)}
            scale={2.6}
            size={parameters.particleSize * 0.85}
            speed={reducedMotion ? 0.02 : parameters.particleVelocity}
            noise={1.05}
            color="#8a7dff"
            opacity={Math.min(parameters.indigoIntensity, 1)}
          />
        </group>

        <LuminousCore parameters={parameters} reducedMotion={reducedMotion} />

        <group ref={rings}>
          {[1.92, 2.18, 2.42].map((radius, index) => (
            <mesh key={radius} rotation={[Math.PI / 2 + index * 0.18, index * 0.36, index * 0.24]}>
              <torusGeometry args={[radius, 0.008 + index * 0.003, 12, 220]} />
              <meshBasicMaterial
                color={index === 1 ? '#786f59' : '#c4a45a'}
                transparent
                opacity={parameters.goldIntensity * 0.2 - index * 0.035}
              />
            </mesh>
          ))}
        </group>
      </group>
    </>
  );
}

export function OrganismEngine({
  parameters,
  personality = null,
  reducedMotion,
}: {
  parameters: OrganismParameters;
  personality?: TransitionPersonality | null;
  reducedMotion: boolean;
}) {
  const display = useTransitionedParameters(parameters, personality);

  return (
    <Canvas
      camera={{ position: parameters.camera.position, fov: parameters.camera.fieldOfView }}
      dpr={[1, 1.65]}
      gl={{
        antialias: true,
        alpha: true,
        premultipliedAlpha: false,
        powerPreference: 'high-performance',
      }}
      style={{ background: 'transparent' }}
      fallback={<div className={styles.fallback}>Nehemiah visual engine unavailable.</div>}
    >
      <LivingScene
        parameters={display.parameters}
        reducedMotion={reducedMotion}
        scaleFactor={display.scaleFactor}
      />
    </Canvas>
  );
}
