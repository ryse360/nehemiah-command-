'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Line, Sparkles } from '@react-three/drei';
import * as THREE from 'three';
import type { OrganismParameters } from '@/nehemiah/organism-parameters';
import {
  blendOrganismParameters,
  transitionProgress,
  type TransitionPersonality,
} from '@/nehemiah/organism-transition';
import { organismFloatOffset, resolveMotionScale } from '@/nehemiah/organism-motion';
import { organismField, type MajorFilament } from '@/nehemiah/organism-field';
import { neoPalette } from '@/nehemiah/organism-palette';
import { LuminousCore } from './luminous-core';
import styles from './organism-lab.module.css';

const FIELD_OPTIONS = {
  seed: 11,
  nodeCount: 120,
  connectionRadius: 0.34,
  majorFilamentCount: 26,
  arcCount: 8,
  flareCount: 8,
} as const;

const MEMBRANE_RADIUS = 1.02;

// Spec depth treatment: rear 8-22%, middle 18-45%, front 35-75% opacity.
const DEPTH_BASE = { rear: 0.16, middle: 0.32, front: 0.58 } as const;

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

function familyColors(family: 'gold' | 'lavender') {
  return family === 'gold'
    ? { core: neoPalette.goldMid, halo: neoPalette.goldLight, deep: neoPalette.goldDeep }
    : { core: neoPalette.lavenderMid, halo: neoPalette.lavenderLight, deep: neoPalette.lavenderDark };
}

// Two-pass luminous spline: a fine bright center over a wide, faint additive
// emission halo — bloom without a postprocessing pass.
function FilamentStrand({
  filament,
  intensity,
}: {
  filament: MajorFilament;
  intensity: number;
}) {
  const points = useMemo(() => {
    const vectors = filament.controlPoints.map(
      (p) => new THREE.Vector3(p[0], p[1], p[2]),
    );
    return new THREE.CatmullRomCurve3(vectors).getPoints(40);
  }, [filament]);

  const colors = familyColors(filament.family);
  const base = DEPTH_BASE[filament.depth] * intensity;
  const coreOpacity = Math.min(0.75, Math.max(0.1, base * (0.4 + filament.brightness * 0.9)));
  const haloOpacity = Math.min(0.2, Math.max(0.04, base * filament.brightness * 0.4));

  // Luminous over the dark body: rear strands recede in deep tones, front
  // strands carry the light. Only the brightest few reach full brilliance.
  const coreColor =
    filament.depth === 'rear'
      ? colors.deep
      : filament.brightness > 0.85
        ? colors.halo
        : colors.core;

  return (
    <>
      <Line
        points={points}
        color={coreColor}
        transparent
        opacity={coreOpacity}
        lineWidth={0.4 + filament.brightness * 0.8}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        toneMapped={false}
      />
      <Line
        points={points}
        color={colors.halo}
        transparent
        opacity={haloOpacity}
        lineWidth={4 + filament.brightness * 3}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        toneMapped={false}
      />
    </>
  );
}

function FilamentDepthGroup({
  filaments,
  depth,
  goldIntensity,
  indigoIntensity,
  indigoConvergence,
}: {
  filaments: MajorFilament[];
  depth: 'rear' | 'middle' | 'front';
  goldIntensity: number;
  indigoIntensity: number;
  indigoConvergence: number;
}) {
  const members = filaments.filter((f) => f.depth === depth);

  return (
    <group>
      {members.map((filament, index) => {
        const intensity =
          filament.family === 'gold' ? goldIntensity / 0.72 : indigoIntensity / 0.55;
        const strand = (
          <FilamentStrand key={index} filament={filament} intensity={intensity} />
        );
        if (filament.family === 'lavender') {
          return (
            <group key={index} scale={1 - 0.5 * indigoConvergence}>
              {strand}
            </group>
          );
        }
        return strand;
      })}
    </group>
  );
}

// Particle-node constellation: tiny points plus proximity edges, kept faint.
function NodeConstellation({ intensity }: { intensity: number }) {
  const field = useMemo(() => organismField(FIELD_OPTIONS), []);

  const { nodeGeometry, edgeGeometry } = useMemo(() => {
    const nodePositions = new Float32Array(field.nodes.length * 3);
    field.nodes.forEach((node, index) => {
      nodePositions.set(node.position, index * 3);
    });
    const nodeGeo = new THREE.BufferGeometry();
    nodeGeo.setAttribute('position', new THREE.BufferAttribute(nodePositions, 3));

    const edgePositions = new Float32Array(field.connections.length * 6);
    field.connections.forEach((edge, index) => {
      edgePositions.set(field.nodes[edge.a].position, index * 6);
      edgePositions.set(field.nodes[edge.b].position, index * 6 + 3);
    });
    const edgeGeo = new THREE.BufferGeometry();
    edgeGeo.setAttribute('position', new THREE.BufferAttribute(edgePositions, 3));

    return { nodeGeometry: nodeGeo, edgeGeometry: edgeGeo };
  }, [field]);

  return (
    <group>
      <lineSegments geometry={edgeGeometry}>
        <lineBasicMaterial
          color={neoPalette.goldDeep}
          transparent
          opacity={Math.min(0.16, 0.13 * intensity)}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </lineSegments>
      <points geometry={nodeGeometry}>
        <pointsMaterial
          color={neoPalette.goldLight}
          size={0.016}
          transparent
          opacity={Math.min(0.6, 0.5 * intensity)}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
          sizeAttenuation
        />
      </points>
    </group>
  );
}

// Nodal flares: small emissive beacons with soft halos, each pulsing on its
// own period and phase — never in unison.
function NodalFlares({ intensity, motionScale }: { intensity: number; motionScale: number }) {
  const field = useMemo(() => organismField(FIELD_OPTIONS), []);
  const groupRef = useRef<THREE.Group>(null);
  const elapsedRef = useRef(0);

  useFrame((_, delta) => {
    elapsedRef.current += delta;
    const group = groupRef.current;
    if (!group) return;
    group.children.forEach((child, index) => {
      const flare = field.flares[index];
      if (!flare) return;
      const pulse =
        0.75 +
        0.25 *
          Math.sin(
            (elapsedRef.current / flare.pulseSeconds) * Math.PI * 2 * motionScale +
              flare.phase,
          );
      child.scale.setScalar(flare.scale * pulse * 28);
    });
  });

  return (
    <group ref={groupRef}>
      {field.flares.map((flare, index) => {
        const colors = familyColors(flare.family);
        return (
          <group key={index} position={flare.position} scale={flare.scale * 28}>
            <mesh>
              <sphereGeometry args={[0.012, 12, 12]} />
              <meshBasicMaterial
                color={neoPalette.shellWhite}
                transparent
                opacity={Math.min(1, 0.9 * intensity)}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
                toneMapped={false}
              />
            </mesh>
            <mesh>
              <sphereGeometry args={[0.035, 12, 12]} />
              <meshBasicMaterial
                color={colors.halo}
                transparent
                opacity={Math.min(0.4, 0.3 * intensity)}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
                toneMapped={false}
              />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

// Volumetric internal body: inverse fresnel — opaque warm umber where the
// view passes through the sphere's center (longest path), fading smoothly to
// transparent at the silhouette. One mesh, no visible sphere edge.
const bodyShader = {
  uniforms: {
    uCenterColor: { value: new THREE.Color(neoPalette.coreUmber) },
    uEdgeColor: { value: new THREE.Color('#5a4a3e') },
    uOpacity: { value: 0.9 },
  },
  vertexShader: /* glsl */ `
    varying vec3 vNormal;
    varying vec3 vViewDir;
    void main() {
      vNormal = normalize(normalMatrix * normal);
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      vViewDir = normalize(-mvPosition.xyz);
      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  fragmentShader: /* glsl */ `
    uniform vec3 uCenterColor;
    uniform vec3 uEdgeColor;
    uniform float uOpacity;
    varying vec3 vNormal;
    varying vec3 vViewDir;
    void main() {
      float facing = abs(dot(normalize(vNormal), normalize(vViewDir)));
      float density = pow(facing, 1.15);
      vec3 color = mix(uEdgeColor, uCenterColor, density);
      gl_FragColor = vec4(color, density * uOpacity);
    }
  `,
};

function VolumetricBody({ opacity }: { opacity: number }) {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        ...bodyShader,
        uniforms: THREE.UniformsUtils.clone(bodyShader.uniforms),
        transparent: true,
        depthWrite: false,
        side: THREE.FrontSide,
      }),
    [],
  );

  useEffect(() => {
    material.uniforms.uOpacity.value = Math.min(1, opacity);
  }, [material, opacity]);

  return (
    <mesh material={material}>
      <sphereGeometry args={[1.0, 96, 96]} />
    </mesh>
  );
}

// Volumetric membrane: fresnel rim shader — luminous at the silhouette,
// transparent face-on, gold blending to lavender across x. No hard border.
const membraneShader = {
  uniforms: {
    uGoldColor: { value: new THREE.Color(neoPalette.shellWhite) },
    uLavenderColor: { value: new THREE.Color(neoPalette.lavenderLight) },
    uStrength: { value: 0.38 },
  },
  vertexShader: /* glsl */ `
    varying vec3 vNormal;
    varying vec3 vViewDir;
    varying vec3 vLocalPos;
    void main() {
      vNormal = normalize(normalMatrix * normal);
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      vViewDir = normalize(-mvPosition.xyz);
      vLocalPos = position;
      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  fragmentShader: /* glsl */ `
    uniform vec3 uGoldColor;
    uniform vec3 uLavenderColor;
    uniform float uStrength;
    varying vec3 vNormal;
    varying vec3 vViewDir;
    varying vec3 vLocalPos;
    void main() {
      float rim = pow(1.0 - abs(dot(normalize(vNormal), normalize(vViewDir))), 2.4);
      float mixAmount = smoothstep(-0.6, 0.9, vLocalPos.x);
      vec3 color = mix(uGoldColor, uLavenderColor, mixAmount);
      gl_FragColor = vec4(color, rim * uStrength);
    }
  `,
};

function Membrane({ intensity }: { intensity: number }) {
  const material = useMemo(() => {
    const m = new THREE.ShaderMaterial({
      ...membraneShader,
      uniforms: THREE.UniformsUtils.clone(membraneShader.uniforms),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.FrontSide,
    });
    return m;
  }, []);

  useEffect(() => {
    material.uniforms.uStrength.value = Math.min(0.5, 0.36 * intensity);
  }, [material, intensity]);

  return (
    <mesh material={material}>
      <sphereGeometry args={[MEMBRANE_RADIUS, 96, 96]} />
    </mesh>
  );
}

// Orbital arcs: large tilted elliptical paths, each with its own slow period
// and direction — the system never rotates as one object.
function OrbitalArcs({ intensity, motionScale }: { intensity: number; motionScale: number }) {
  const field = useMemo(() => organismField(FIELD_OPTIONS), []);
  const refs = useRef<(THREE.Group | null)[]>([]);

  const arcPoints = useMemo(
    () =>
      field.arcs.map((arc) => {
        const curve = new THREE.EllipseCurve(
          0, 0,
          arc.radius, arc.radius * (0.82 + 0.14 * Math.sin(arc.tilt[0])),
          0, Math.PI * 2,
          false, 0,
        );
        return curve.getPoints(120).map((p) => new THREE.Vector3(p.x, p.y, 0));
      }),
    [field],
  );

  useFrame((_, delta) => {
    field.arcs.forEach((arc, index) => {
      const group = refs.current[index];
      if (!group) return;
      group.rotation.z +=
        delta * arc.direction * ((Math.PI * 2) / arc.periodSeconds) * motionScale;
    });
  });

  return (
    <group>
      {field.arcs.map((arc, index) => (
        <group key={index} rotation={arc.tilt}>
          <group ref={(el) => { refs.current[index] = el; }}>
            <Line
              points={arcPoints[index]}
              color={index % 3 === 0 ? neoPalette.lavenderDark : neoPalette.goldDeep}
              transparent
              opacity={Math.min(0.1, (0.035 + (index % 3) * 0.02) * intensity)}
              lineWidth={0.4}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              toneMapped={false}
            />
          </group>
        </group>
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
  const field = useMemo(() => organismField(FIELD_OPTIONS), []);
  const root = useRef<THREE.Group>(null);
  const rearGroup = useRef<THREE.Group>(null);
  const frontGroup = useRef<THREE.Group>(null);
  const elapsedTime = useRef(0);

  const goldIntensity = parameters.goldIntensity;
  const indigoIntensity = parameters.indigoIntensity;
  const goldLevel = goldIntensity / 0.72;

  useFrame((_, delta) => {
    elapsedTime.current += delta;
    const elapsed = elapsedTime.current;
    const motionScale = resolveMotionScale(reducedMotion, parameters.reducedMotion.motionScale);

    if (root.current) {
      // Breathing: 1.000 -> ~1.014 over 6.5-8.5s. The organism does NOT
      // rotate as one object — only sub-layers drift.
      const period = Math.min(8.5, Math.max(6.5, 9.5 - parameters.breathingSpeed * 2.2));
      const breath =
        1 + (0.014 + parameters.breathingAmplitude * 0.1) *
          (0.5 + 0.5 * Math.sin((elapsed / period) * Math.PI * 2)) * motionScale;
      root.current.scale.setScalar(parameters.scale * scaleFactor * breath);

      const float = organismFloatOffset(
        elapsed,
        { floatAmplitude: parameters.floatAmplitude, floatSpeed: parameters.floatSpeed },
        motionScale,
      );
      root.current.position.set(float.x, float.y, 0);
    }

    // Counter-drifting depth layers: slow, opposing, never frantic.
    if (rearGroup.current) {
      rearGroup.current.rotation.y += delta * 0.008 * motionScale;
      rearGroup.current.position.x = Math.sin(elapsed * 0.11) * 0.02 * motionScale;
    }
    if (frontGroup.current) {
      frontGroup.current.rotation.y -= delta * 0.006 * motionScale;
      frontGroup.current.position.y = Math.sin(elapsed * 0.09 + 1.7) * 0.02 * motionScale;
    }
  });

  const motionScale = resolveMotionScale(reducedMotion, parameters.reducedMotion.motionScale);

  return (
    <>
      <ambientLight intensity={parameters.lighting.ambientIntensity} />
      <hemisphereLight args={[neoPalette.backgroundLight, neoPalette.goldDeep, parameters.lighting.hemisphereIntensity]} />
      <directionalLight position={[4, 5, 5]} intensity={parameters.lighting.directionalIntensity} color={neoPalette.shellWhite} />

      <group ref={root}>
        {/* 2. distant ambient dust */}
        <Sparkles
          count={Math.round(parameters.particleCount * 1.6)}
          scale={4.6}
          size={0.9}
          speed={reducedMotion ? 0.02 : parameters.particleVelocity * 0.5}
          noise={0.8}
          color={neoPalette.goldLight}
          opacity={0.35 * goldLevel}
        />

        {/* 3. rear orbital arcs */}
        <OrbitalArcs intensity={goldLevel} motionScale={motionScale} />

        {/* 4. translucent outer membrane */}
        <Membrane intensity={goldLevel} />

        {/* 5. rear neural filaments */}
        <group ref={rearGroup}>
          <FilamentDepthGroup
            filaments={field.filaments}
            depth="rear"
            goldIntensity={goldIntensity}
            indigoIntensity={indigoIntensity}
            indigoConvergence={parameters.indigoConvergence}
          />
        </group>

        {/* 6. dark internal volumetric body — inverse-fresnel ball: dense
            warm umber at the center fading to nothing at the rim, so the
            organism has a dark interior with no hard circular border. */}
        <VolumetricBody opacity={0.62 + parameters.shellOpacity * 0.5} />

        {/* 7-8. middle and front neural filaments */}
        <FilamentDepthGroup
          filaments={field.filaments}
          depth="middle"
          goldIntensity={goldIntensity}
          indigoIntensity={indigoIntensity}
          indigoConvergence={parameters.indigoConvergence}
        />
        <group ref={frontGroup}>
          <FilamentDepthGroup
            filaments={field.filaments}
            depth="front"
            goldIntensity={goldIntensity}
            indigoIntensity={indigoIntensity}
            indigoConvergence={parameters.indigoConvergence}
          />
        </group>

        {/* 9. particle-node constellation */}
        <NodeConstellation intensity={goldLevel} />

        {/* inner shimmer */}
        <Sparkles
          count={Math.round(parameters.particleCount * 0.8)}
          scale={1.9}
          size={parameters.particleSize * 0.8}
          speed={reducedMotion ? 0.02 : parameters.particleVelocity}
          noise={1.05}
          color={neoPalette.goldLight}
          opacity={0.55 * goldLevel}
        />
        <group scale={1 - 0.45 * parameters.indigoConvergence} position={[0.35, 0, 0]}>
          <Sparkles
            count={Math.round(parameters.particleCount * 0.35)}
            scale={1.6}
            size={parameters.particleSize * 0.7}
            speed={reducedMotion ? 0.02 : parameters.particleVelocity}
            noise={1.05}
            color={neoPalette.lavenderMid}
            opacity={Math.min(0.6, indigoIntensity)}
          />
        </group>

        {/* 10. major nodal flares */}
        <NodalFlares intensity={goldLevel} motionScale={motionScale} />

        {/* focal core (gold primary + lavender secondary inside LuminousCore) */}
        <LuminousCore parameters={parameters} reducedMotion={reducedMotion} />
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
