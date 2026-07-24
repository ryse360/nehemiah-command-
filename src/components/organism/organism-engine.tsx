'use client';

import { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Line, MeshDistortMaterial, Sparkles } from '@react-three/drei';
import * as THREE from 'three';
import type { OrganismParameters } from '@/nehemiah/organism-parameters';
import { resolveMotionScale } from '@/nehemiah/organism-motion';
import { LuminousCore } from './luminous-core';
import styles from './organism-lab.module.css';

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
          color={index % 4 === 0 ? '#8f7a45' : '#c7a65a'}
          transparent
          opacity={opacity}
          lineWidth={index % 5 === 0 ? 1.25 : 0.7}
        />
      ))}
    </group>
  );
}

function IndigoPathways({ opacity }: { opacity: number }) {
  const threads = useMemo(
    () => Array.from({ length: 10 }, (_, index) => createThreadPoints(index, 10, Math.PI)),
    [],
  );

  return (
    <group>
      {threads.map((points, index) => (
        <Line
          key={index}
          points={points}
          color={index % 3 === 0 ? '#5c53b3' : '#8a80d6'}
          transparent
          opacity={opacity}
          lineWidth={0.65}
        />
      ))}
    </group>
  );
}

function LivingScene({
  parameters,
  reducedMotion,
}: {
  parameters: OrganismParameters;
  reducedMotion: boolean;
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
    }

    if (rings.current) {
      rings.current.rotation.z += delta * parameters.rotationDrift * 0.42 * motionScale;
      rings.current.rotation.x = 0.48 + Math.sin(elapsed * 0.16) * 0.06 * motionScale;
    }
  });

  return (
    <>
      <color attach="background" args={['#f4efe5']} />
      <ambientLight intensity={parameters.lighting.ambientIntensity} />
      <hemisphereLight args={['#fffaf0', '#80662f', parameters.lighting.hemisphereIntensity]} />
      <directionalLight position={[4, 5, 5]} intensity={parameters.lighting.directionalIntensity} color="#fff8e8" />

      <group ref={root} scale={parameters.scale}>
        <mesh>
          <sphereGeometry args={[1.62, 96, 96]} />
          <meshPhysicalMaterial
            color="#d9c08a"
            transparent
            opacity={parameters.shellOpacity * 0.52}
            roughness={0.28}
            metalness={0.02}
            transmission={0.38}
            thickness={0.3}
            ior={1.1}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>

        <mesh>
          <sphereGeometry args={[1.18, 96, 96]} />
          <MeshDistortMaterial
            color="#b58b38"
            transparent
            opacity={0.13}
            roughness={0.34}
            metalness={0.04}
            depthWrite={false}
            distort={reducedMotion ? 0.04 : 0.2}
            speed={reducedMotion ? 0 : parameters.breathingSpeed}
          />
        </mesh>

        <GoldPathways opacity={parameters.goldIntensity * 0.32} />
        <IndigoPathways opacity={parameters.indigoIntensity * 0.32} />

        <Sparkles
          count={parameters.particleCount}
          scale={3.8}
          size={parameters.particleSize}
          speed={reducedMotion ? 0.02 : parameters.particleVelocity}
          noise={1.05}
          color="#9f7a2d"
          opacity={0.38}
        />

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
  reducedMotion,
}: {
  parameters: OrganismParameters;
  reducedMotion: boolean;
}) {
  return (
    <Canvas
      camera={{ position: parameters.camera.position, fov: parameters.camera.fieldOfView }}
      dpr={[1, 1.65]}
      gl={{
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance',
      }}
      fallback={<div className={styles.fallback}>Nehemiah visual engine unavailable.</div>}
    >
      <LivingScene parameters={parameters} reducedMotion={reducedMotion} />
    </Canvas>
  );
}
