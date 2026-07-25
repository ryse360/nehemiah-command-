'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { OrganismParameters } from '@/nehemiah/organism-parameters';
import { resolveMotionScale } from '@/nehemiah/organism-motion';
import { organismCoreModel } from '@/nehemiah/organism-core-model';
import { neoPalette } from '@/nehemiah/organism-palette';
import { VolumetricGlow } from './volumetric-glow';

export function LuminousCore({
  parameters,
  reducedMotion,
}: {
  parameters: OrganismParameters;
  reducedMotion: boolean;
}) {
  // Read the LIVE per-state parameters. These were previously pinned to
  // organismCoreModel.resting, which silently discarded five of the eight
  // per-state core values — the focal point never changed shape or pulse
  // across the lifecycle, and never cross-faded during a transition.
  const CORE_VISUAL_SCALE = 0.52;
  const restingShape = organismCoreModel.resting;
  const profile = {
    bodyRadius: parameters.coreBodyRadius * CORE_VISUAL_SCALE,
    haloRadius: parameters.coreHaloRadius * CORE_VISUAL_SCALE,
    kernelRadius: parameters.coreKernelRadius * CORE_VISUAL_SCALE,
    pulseAmplitude: parameters.corePulseAmplitude,
    pulseRate: parameters.corePulseRate,
    emissiveIntensity: parameters.coreIntensity,
    haloOpacity: parameters.coreHaloOpacity,
    pointLightIntensity:
      parameters.coreIntensity *
      (restingShape.pointLightIntensity / restingShape.emissiveIntensity),
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

  // Normalised against the TOP of the core ramp (2.60 at proof), not resting,
  // so the state ladder is expressible instead of saturating every clamp.
  const coreLevel = parameters.coreIntensity / 2.6;
  // The secondary beacon belongs to the INDIGO story, not the gold one: it
  // must peak while the decision is weighed and be nearly gone by proof.
  // Driving it from coreLevel inverted the narrative entirely.
  const indigoLevel = parameters.indigoIntensity / 0.85;

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

        {/* Focal point as a graded starburst, not stacked pancakes. Three
            inverse-fresnel shells: a tight hot centre, a gold mid-falloff,
            and a wide soft bloom. Opacities are scaled so the full coreLevel
            range spans a visible band instead of saturating its clamp at
            every state past resting. */}
        <mesh ref={halo} scale={profile.haloRadius}>
          <sphereGeometry args={[1, 8, 8]} />
          <meshBasicMaterial visible={false} />
        </mesh>

        <VolumetricGlow
          color={neoPalette.goldLight}
          opacity={0.36 * coreLevel}
          power={1.3}
          radius={profile.haloRadius * 0.95}
        />

        <VolumetricGlow
          color={neoPalette.goldMid}
          opacity={0.66 * coreLevel}
          power={2.4}
          radius={profile.bodyRadius * 1.5}
        />

        <VolumetricGlow
          color={neoPalette.shellWhite}
          opacity={0.92 * coreLevel}
          power={3.4}
          radius={profile.bodyRadius * 0.75}
        />

        <mesh ref={kernel} scale={profile.kernelRadius}>
          <sphereGeometry args={[1, 40, 40]} />
          <meshBasicMaterial
            color={neoPalette.shellWhite}
            transparent
            opacity={0.95 * coreLevel}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      </group>

      {/* Secondary lavender beacon — right side, smaller, cooler, never
          visually dominant over the gold focal point. */}
      <group ref={lavenderNode} position={[0.52, 0.1, 0.15]}>
        <pointLight
          intensity={profile.pointLightIntensity * 0.28 * indigoLevel}
          distance={2.4}
          decay={2}
          color={neoPalette.lavenderMid}
        />
        {/* Graded falloff, never a hard-edged disk. Additive lavenderLight at
            full strength clips straight to white — which both violates "no
            hard circular borders" and erases the colour entirely. */}
        <VolumetricGlow
          color={neoPalette.lavenderLight}
          opacity={Math.min(0.72, 0.72 * indigoLevel)}
          power={3.2}
          radius={0.062}
        />
        <VolumetricGlow
          color={neoPalette.lavenderMid}
          opacity={Math.min(0.34, 0.34 * indigoLevel)}
          power={2.1}
          radius={0.21}
        />
      </group>
    </group>
  );
}
