'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { NehemiahState } from '@/nehemiah/state-machine';
import { organismCoreModel } from '@/nehemiah/organism-core-model';

export function LuminousCore({
  state,
  reducedMotion,
}: {
  state: NehemiahState;
  reducedMotion: boolean;
}) {
  const profile = organismCoreModel[state];
  const root = useRef<THREE.Group>(null);
  const halo = useRef<THREE.Mesh>(null);
  const kernel = useRef<THREE.Mesh>(null);
  const elapsedTime = useRef(0);

  useFrame((_, delta) => {
    elapsedTime.current += delta;

    const elapsed = elapsedTime.current;
    const motionScale = reducedMotion ? 0.12 : 1;
    const pulse =
      1 +
      Math.sin(elapsed * profile.pulseRate) *
        profile.pulseAmplitude *
        motionScale;

    if (root.current) {
      root.current.scale.setScalar(pulse);
      root.current.rotation.y += delta * 0.06 * motionScale;
    }

    if (halo.current) {
      const haloPulse =
        1 +
        Math.sin(elapsed * profile.pulseRate * 0.72) *
          profile.pulseAmplitude *
          1.8 *
          motionScale;

      halo.current.scale.setScalar(profile.haloRadius * haloPulse);
      halo.current.rotation.z -= delta * 0.045 * motionScale;
    }

    if (kernel.current) {
      const kernelPulse =
        1 +
        Math.sin(elapsed * profile.pulseRate * 1.45) *
          0.055 *
          motionScale;

      kernel.current.scale.setScalar(
        profile.kernelRadius * kernelPulse,
      );
    }
  });

  return (
    <group ref={root}>
      <pointLight
        position={[0, 0, 0.28]}
        intensity={profile.pointLightIntensity}
        distance={4.6}
        decay={2}
        color="#d8aa49"
      />

      <mesh ref={halo} scale={profile.haloRadius}>
        <sphereGeometry args={[1, 64, 64]} />
        <meshBasicMaterial
          color="#9f6f16"
          transparent
          opacity={profile.haloOpacity}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      <mesh scale={profile.bodyRadius * 1.22}>
        <sphereGeometry args={[1, 72, 72]} />
        <meshBasicMaterial
          color="#b78328"
          transparent
          opacity={profile.haloOpacity * 0.48}
          blending={THREE.AdditiveBlending}
          side={THREE.BackSide}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      <mesh scale={profile.bodyRadius}>
        <sphereGeometry args={[1, 96, 96]} />
        <meshPhysicalMaterial
          color="#e8c46e"
          emissive="#b8781d"
          emissiveIntensity={profile.emissiveIntensity}
          roughness={0.18}
          metalness={0.06}
          clearcoat={1}
          clearcoatRoughness={0.16}
          transmission={0.1}
          thickness={0.22}
        />
      </mesh>

      <mesh ref={kernel} scale={profile.kernelRadius}>
        <sphereGeometry args={[1, 56, 56]} />
        <meshBasicMaterial
          color="#fff4c4"
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}
