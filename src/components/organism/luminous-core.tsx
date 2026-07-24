'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { OrganismParameters } from '@/nehemiah/organism-parameters';
import { resolveMotionScale } from '@/nehemiah/organism-motion';
import { organismCoreModel } from '@/nehemiah/organism-core-model';
import { neoPalette } from '@/nehemiah/organism-palette';

export function LuminousCore({
  parameters,
  reducedMotion,
}: {
  parameters: OrganismParameters;
  reducedMotion: boolean;
}) {
  const shape = organismCoreModel.resting;
  const CORE_VISUAL_SCALE = 0.62;
  const profile = {
    bodyRadius: shape.bodyRadius * CORE_VISUAL_SCALE,
    haloRadius: shape.haloRadius * CORE_VISUAL_SCALE,
    kernelRadius: shape.kernelRadius * CORE_VISUAL_SCALE,
    pulseAmplitude: shape.pulseAmplitude,
    pulseRate: shape.pulseRate,
    emissiveIntensity: parameters.coreIntensity,
    haloOpacity: shape.haloOpacity,
    pointLightIntensity:
      parameters.coreIntensity * (shape.pointLightIntensity / shape.emissiveIntensity),
  };
  const root = useRef<THREE.Group>(null);
  const halo = useRef<THREE.Mesh>(null);
  const kernel = useRef<THREE.Mesh>(null);
  const lavenderNode = useRef<THREE.Group>(null);
  const elapsedTime = useRef(0);

  useFrame((_, delta) => {
    elapsedTime.current += delta;

    const elapsed = elapsedTime.current;
    const motionScale = resolveMotionScale(reducedMotion, parameters.reducedMotion.motionScale);
    const pulse =
      1 +
      Math.sin(elapsed * profile.pulseRate) *
        profile.pulseAmplitude *
        motionScale;

    if (root.current) {
      root.current.scale.setScalar(pulse);
    }

    if (halo.current) {
      const haloPulse =
        1 +
        Math.sin(elapsed * profile.pulseRate * 0.72) *
          profile.pulseAmplitude *
          1.8 *
          motionScale;

      halo.current.scale.setScalar(profile.haloRadius * haloPulse);
    }

    if (kernel.current) {
      const kernelPulse =
        1 +
        Math.sin(elapsed * profile.pulseRate * 1.45) *
          0.055 *
          motionScale;

      kernel.current.scale.setScalar(profile.kernelRadius * kernelPulse);
    }

    if (lavenderNode.current) {
      // Secondary beacon breathes on its own slower phase — never in sync
      // with the gold focal point.
      const secondaryPulse =
        1 + Math.sin(elapsed * profile.pulseRate * 0.55 + 2.1) * 0.08 * motionScale;
      lavenderNode.current.scale.setScalar(secondaryPulse);
    }
  });

  const coreLevel = parameters.coreIntensity / organismCoreModel.resting.emissiveIntensity;

  return (
    <group>
      <group ref={root}>
        <pointLight
          position={[0, 0, 0.28]}
          intensity={profile.pointLightIntensity}
          distance={4.6}
          decay={2}
          color={neoPalette.goldMid}
        />

        <mesh ref={halo} scale={profile.haloRadius}>
          <sphereGeometry args={[1, 64, 64]} />
          <meshBasicMaterial
            color={neoPalette.goldMid}
            transparent
            opacity={profile.haloOpacity}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>

        <mesh scale={profile.bodyRadius * 1.3}>
          <sphereGeometry args={[1, 72, 72]} />
          <meshBasicMaterial
            color={neoPalette.goldLight}
            transparent
            opacity={profile.haloOpacity * 0.55}
            blending={THREE.AdditiveBlending}
            side={THREE.BackSide}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>

        <mesh scale={profile.bodyRadius}>
          <sphereGeometry args={[1, 96, 96]} />
          <meshBasicMaterial
            color={neoPalette.goldMid}
            transparent
            opacity={Math.min(0.85, 0.55 * coreLevel)}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>

        <mesh ref={kernel} scale={profile.kernelRadius}>
          <sphereGeometry args={[1, 56, 56]} />
          <meshBasicMaterial
            color={neoPalette.shellWhite}
            transparent
            opacity={Math.min(1, coreLevel)}
            toneMapped={false}
          />
        </mesh>
      </group>

      {/* Secondary lavender beacon — right side, smaller, cooler, never
          visually dominant over the gold focal point. */}
      <group ref={lavenderNode} position={[0.52, 0.1, 0.15]}>
        <pointLight
          intensity={profile.pointLightIntensity * 0.28}
          distance={2.4}
          decay={2}
          color={neoPalette.lavenderMid}
        />
        <mesh>
          <sphereGeometry args={[0.055, 32, 32]} />
          <meshBasicMaterial
            color={neoPalette.lavenderLight}
            transparent
            opacity={Math.min(0.9, 0.7 * coreLevel)}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
        <mesh>
          <sphereGeometry args={[0.14, 32, 32]} />
          <meshBasicMaterial
            color={neoPalette.lavenderMid}
            transparent
            opacity={Math.min(0.35, 0.26 * coreLevel)}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      </group>
    </group>
  );
}
