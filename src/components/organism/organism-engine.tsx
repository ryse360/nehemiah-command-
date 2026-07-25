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
import {
  ORGANISM_FIELD_OPTIONS,
  organismField,
  type MajorFilament,
} from '@/nehemiah/organism-field';

// The field is deterministic and pure, so build it ONCE at module scope.
// Calling organismField() inside six separate components cost ~8.4ms each,
// i.e. ~50ms of mount time recomputing an identical result.
const FIELD = organismField(ORGANISM_FIELD_OPTIONS);
import { neoPalette } from '@/nehemiah/organism-palette';
import { VolumetricGlow } from './volumetric-glow';
import { LuminousCore } from './luminous-core';
import styles from './organism-lab.module.css';

const FIELD_OPTIONS = ORGANISM_FIELD_OPTIONS;

const MEMBRANE_RADIUS = 1.02;

// Spec depth treatment: rear 8-22%, middle 18-45%, front 35-75% opacity.
const DEPTH_BASE = { rear: 0.18, middle: 0.36, front: 0.62 } as const;

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
  const personalityRef = useRef(personality);
  const frameRef = useRef(0);

  displayRef.current = display;

  useEffect(() => {
    if (target === targetRef.current) {
      return;
    }

    // A personality describes ONE intent (a state change, sleep, or wake). It
    // stays mounted afterwards, so without this guard every later parameter
    // edit — a Leva slider drag — replays that stale held breath and the
    // control feels dead. Only a genuinely new intent animates.
    const isNewIntent = personality !== personalityRef.current;
    personalityRef.current = personality;

    targetRef.current = target;
    cancelAnimationFrame(frameRef.current);

    if (!personality || !isNewIntent) {
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

// Lavender carries far less luminance than gold, so at matched opacity it
// disappears against the warm interior. Its halo stays at mid-tone (rather
// than the near-white light tint) and its strands run hotter, so the
// deliberation field is actually legible — the WEIGHING convergence depends
// on it being visible.
function familyColors(family: 'gold' | 'lavender') {
  return family === 'gold'
    ? { core: neoPalette.goldMid, halo: neoPalette.goldLight, deep: neoPalette.goldDeep, boost: 1 }
    : { core: neoPalette.lavenderMid, halo: neoPalette.lavenderDark, deep: neoPalette.lavenderDark, boost: 1.15 };
}

// Batched filament pass. One <Line segments> draws every strand of a given
// family in a single call, with each strand's colour x opacity baked into
// per-vertex colours (additive blending makes opacity a colour multiply).
// Per-strand <Line> components cost two draw calls EACH, which caps density
// at a few dozen cables; batching is what makes a genuine hair-thin weave of
// ~200 strands affordable.
function BatchedFilaments({
  filaments,
  family,
  intensity,
  lineWidth,
  halo,
}: {
  filaments: MajorFilament[];
  family: 'gold' | 'lavender';
  intensity: number;
  lineWidth: number;
  halo: boolean;
}) {
  const { points, vertexColors } = useMemo(() => {
    const pts: [number, number, number][] = [];
    const cols: ([number, number, number] | [number, number, number, number])[] = [];
    const colors = familyColors(family);

    for (const filament of filaments) {
      const vectors = filament.controlPoints.map(
        (p) => new THREE.Vector3(p[0], p[1], p[2]),
      );
      const samples = new THREE.CatmullRomCurve3(vectors).getPoints(36);

      const base = DEPTH_BASE[filament.depth] * intensity * colors.boost;
      // Only hero strands earn a halo. Complexity should be enormous while
      // only a fraction is fully legible, so support strands bind the field
      // quietly and recessive strands are sensed rather than read.
      if (halo && filament.filamentClass !== 'hero') continue;
      // Recessive mass pulled well back: the reference's texture is a point-
      // graph punctuated by a few legible strands, not a ball of thread. The
      // hero/support hierarchy stays; the fog around it thins.
      const classGain =
        filament.filamentClass === 'hero'
          ? 1
          : filament.filamentClass === 'support'
            ? 0.42
            : 0.06;
      const strength = halo
        ? Math.min(0.2, Math.max(0.04, base * filament.brightness * 0.34)) * 0.85
        : Math.min(0.62, Math.max(0.03, base * (0.3 + filament.brightness * 0.7) * classGain));

      const hex =
        halo || filament.depth === 'rear'
          ? colors.halo
          : family === 'gold' && filament.filamentClass === 'hero'
            ? neoPalette.shellWhite
            : filament.filamentClass === 'recessive'
              ? colors.deep
              : colors.core;
      const full = new THREE.Color(hex);
      const tint = full.clone().multiplyScalar(strength);

      for (let i = 0; i < samples.length - 1; i += 1) {
        // taper toward both ends so strands dissolve instead of stopping
        const t = i / (samples.length - 1);
        const taper = 0.35 + 0.65 * Math.sin(t * Math.PI);
        if (family === 'lavender') {
          const a = Math.min(0.72, strength * taper * 1.25);
          pts.push(
            [samples[i].x, samples[i].y, samples[i].z],
            [samples[i + 1].x, samples[i + 1].y, samples[i + 1].z],
          );
          cols.push([full.r, full.g, full.b, a], [full.r, full.g, full.b, a]);
          continue;
        }
        const c = tint.clone().multiplyScalar(taper);
        pts.push(
          [samples[i].x, samples[i].y, samples[i].z],
          [samples[i + 1].x, samples[i + 1].y, samples[i + 1].z],
        );
        cols.push([c.r, c.g, c.b], [c.r, c.g, c.b]);
      }
    }

    return { points: pts, vertexColors: cols };
  }, [filaments, family, intensity, halo]);

  if (points.length === 0) {
    return null;
  }

  return (
    <Line
      segments
      points={points}
      vertexColors={vertexColors}
      transparent
      opacity={1}
      lineWidth={lineWidth}
      blending={family === 'lavender' ? THREE.NormalBlending : THREE.AdditiveBlending}
      depthWrite={false}
      toneMapped={false}
    />
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
  const members = useMemo(
    () => filaments.filter((f) => f.depth === depth),
    [filaments, depth],
  );
  const gold = useMemo(() => members.filter((f) => f.family === 'gold'), [members]);
  const lavender = useMemo(
    () => members.filter((f) => f.family === 'lavender'),
    [members],
  );

  const goldLevel = goldIntensity / 1.18;
  const lavenderLevel = indigoIntensity / 0.85;

  return (
    <group>
      <BatchedFilaments
        filaments={gold}
        family="gold"
        intensity={goldLevel}
        lineWidth={0.42}
        halo={false}
      />
      <BatchedFilaments
        filaments={gold}
        family="gold"
        intensity={goldLevel}
        lineWidth={1.5}
        halo
      />
      {/* the deliberation field retracts toward the core at the decision */}
      <group scale={1 - 0.5 * indigoConvergence}>
        <BatchedFilaments
          filaments={lavender}
          family="lavender"
          intensity={lavenderLevel}
          lineWidth={0.42}
          halo={false}
        />
        <BatchedFilaments
          filaments={lavender}
          family="lavender"
          intensity={lavenderLevel}
          lineWidth={1.5}
          halo
        />
      </group>
    </group>
  );
}

// Secondary micro-weave: 100+ extremely fine, mostly receding strands
// interlacing the volume beneath the major filaments. Batched into a single
// LineSegments geometry per half (one draw call each) with per-vertex
// colors, so density costs almost nothing. Native 1px lines at very low
// additive opacity — hairlines, never competing with the majors.
function MicroWeave({
  goldIntensity,
  indigoIntensity,
  half,
}: {
  goldIntensity: number;
  indigoIntensity: number;
  half: 'rear' | 'front';
}) {
  const field = FIELD;

  const geometry = useMemo(() => {
    const members = field.microFilaments.filter((_, index) =>
      half === 'rear' ? index % 2 === 0 : index % 2 === 1,
    );
    const positions: number[] = [];
    const colors: number[] = [];
    const goldColor = new THREE.Color(neoPalette.goldMid);
    const lavenderColor = new THREE.Color(neoPalette.lavenderMid);

    for (const micro of members) {
      const vectors = micro.controlPoints.map((p) => new THREE.Vector3(p[0], p[1], p[2]));
      const samples = new THREE.CatmullRomCurve3(vectors).getPoints(8);
      // Roughly half its former weight. This layer is latent tissue; at the
      // old gains it accumulated into the "hairball" that buried the crisp
      // point-graph the reference is actually built from.
      const tint = (micro.family === 'gold' ? goldColor : lavenderColor)
        .clone()
        .multiplyScalar(micro.opacity * (micro.family === 'lavender' ? 6.2 : 3.2));

      for (let index = 0; index < samples.length - 1; index += 1) {
        // taper: strands fade toward both ends
        const t = index / (samples.length - 1);
        const taper = Math.sin(t * Math.PI) * 0.75 + 0.25;
        positions.push(
          samples[index].x, samples[index].y, samples[index].z,
          samples[index + 1].x, samples[index + 1].y, samples[index + 1].z,
        );
        const segmentTint = tint.clone().multiplyScalar(taper);
        colors.push(
          segmentTint.r, segmentTint.g, segmentTint.b,
          segmentTint.r, segmentTint.g, segmentTint.b,
        );
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    return geo;
  }, [field, half]);

  const level = Math.min(1.4, (goldIntensity / 0.72 + indigoIntensity / 0.55) / 2);

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial
        vertexColors
        transparent
        opacity={Math.min(0.3, 0.2 * level)}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        toneMapped={false}
      />
    </lineSegments>
  );
}

// The dendrite system — the organism's radiating anatomy, drawn as a fan of
// branching families rather than independent wandering strands. Each
// generation is finer and dimmer than its parent, so a trunk reads clearly,
// its branches support it, and its twigs dissolve. Split into three passes so
// each generation gets its own line width in a single draw call.
function Dendrites({
  generation,
  lineWidth,
  goldIntensity,
  indigoIntensity,
}: {
  generation: 0 | 1 | 2;
  lineWidth: number;
  goldIntensity: number;
  indigoIntensity: number;
}) {
  const goldLevel = goldIntensity / 1.18;
  const indigoLevel = indigoIntensity / 0.85;

  const { points, vertexColors } = useMemo(() => {
    const pts: [number, number, number][] = [];
    const cols: [number, number, number][] = [];

    const tone = {
      gold: {
        0: new THREE.Color(neoPalette.shellWhite),
        1: new THREE.Color(neoPalette.goldMid),
        2: new THREE.Color(neoPalette.goldDeep),
      },
      lavender: {
        0: new THREE.Color(neoPalette.lavenderLight),
        1: new THREE.Color(neoPalette.lavenderMid),
        2: new THREE.Color(neoPalette.lavenderDark),
      },
    } as const;

    // generation gain: trunks carry the light, twigs are barely sensed
    const gain = generation === 0 ? 0.5 : generation === 1 ? 0.24 : 0.1;

    for (const dendrite of FIELD.dendrites) {
      if (dendrite.generation !== generation) continue;

      const level = dendrite.family === 'gold' ? goldLevel : indigoLevel;
      const base = tone[dendrite.family][generation];
      const vectors = dendrite.points.map((p) => new THREE.Vector3(p[0], p[1], p[2]));
      const samples = new THREE.CatmullRomCurve3(vectors).getPoints(
        generation === 0 ? 40 : generation === 1 ? 28 : 18,
      );

      for (let i = 0; i < samples.length - 1; i += 1) {
        const t = i / (samples.length - 1);
        // taper toward the tip so a strand dissolves rather than stopping,
        // and stays fine where it leaves its parent
        const taper = Math.pow(Math.sin(Math.min(1, t * 1.15) * Math.PI), 0.55);
        const c = base
          .clone()
          .multiplyScalar(dendrite.brightness * gain * level * taper);
        pts.push(
          [samples[i].x, samples[i].y, samples[i].z],
          [samples[i + 1].x, samples[i + 1].y, samples[i + 1].z],
        );
        cols.push([c.r, c.g, c.b], [c.r, c.g, c.b]);
      }
    }

    return { points: pts, vertexColors: cols };
  }, [generation, goldLevel, indigoLevel]);

  if (points.length === 0) return null;

  return (
    <Line
      segments
      points={points}
      vertexColors={vertexColors}
      transparent
      opacity={1}
      lineWidth={lineWidth}
      blending={THREE.AdditiveBlending}
      depthWrite={false}
      toneMapped={false}
    />
  );
}

// Beads: tiny bright nodes seated ON the strand paths themselves. This is
// the reference's defining texture — its filaments are not drawn lines but
// strings of discrete luminous points, wiring with solder joints. Sampling
// the dendrite geometry directly guarantees every bead sits exactly on a
// strand, so the two layers can never drift apart, and the whole pass is a
// single draw call. Seeded stride-jitter keeps the spacing organic without
// touching any field RNG stream.
function StrandBeads({
  goldIntensity,
  indigoIntensity,
}: {
  goldIntensity: number;
  indigoIntensity: number;
}) {
  const goldLevel = goldIntensity / 1.18;
  const indigoLevel = indigoIntensity / 0.85;

  const geometry = useMemo(() => {
    const positions: number[] = [];
    const colors: number[] = [];
    const gold = new THREE.Color(neoPalette.goldLight);
    const hot = new THREE.Color(neoPalette.shellWhite);
    // lavenderMid boosted: lavenderLight is nearly white, and white beads on
    // the right read as grey dust — the reference's right side is saturated
    // amethyst, so the beads must carry real chroma
    const lavender = new THREE.Color(neoPalette.lavenderMid).multiplyScalar(1.45);

    let jitterState = 7;
    const jitter = () => {
      // tiny deterministic LCG — display-only spacing, no field stream touched
      jitterState = (jitterState * 48271) % 2147483647;
      return jitterState / 2147483647;
    };

    for (const dendrite of FIELD.dendrites) {
      if (dendrite.generation > 1) continue;
      const level = dendrite.family === 'gold' ? goldLevel : indigoLevel;
      const genGain = dendrite.generation === 0 ? 1 : 0.55;
      const stride = dendrite.generation === 0 ? 2 : 3;
      for (let i = 1; i < dendrite.points.length - 1; i += stride) {
        if (jitter() < 0.25) continue;
        const p = dendrite.points[i];
        positions.push(p[0], p[1], p[2]);
        const t = i / (dendrite.points.length - 1);
        // beads brighten toward the strand's outer reach, then the last few
        // fade — the strand dissolves into points at its tip
        const along = Math.sin(Math.min(1, t * 1.15) * Math.PI);
        const base = dendrite.family === 'gold'
          ? (jitter() < 0.3 ? hot : gold)
          : lavender;
        const c = base
          .clone()
          .multiplyScalar(
            (0.5 + 0.85 * along) * dendrite.brightness * genGain * level,
          );
        colors.push(c.r, c.g, c.b);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    return geo;
  }, [goldLevel, indigoLevel]);

  return (
    <points geometry={geometry}>
      <pointsMaterial
        vertexColors
        size={0.03}
        transparent
        opacity={0.95}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        toneMapped={false}
        sizeAttenuation
      />
    </points>
  );
}

// The surrounding constellation.
//
// This layer has to be drawn DARKER than the page, not brighter. The ground is
// ivory (#F4EBE2), so an additive or light-toned point adds almost nothing and
// simply disappears — which is exactly why the previous star pass could have its
// count raised with no measurable change on screen. Each star is therefore a
// normal-blended point tinted from the background toward umber (or dusk violet
// on the reasoning side) in proportion to its brightness, so a faint star sits a
// hair below the ivory and a bright one reads as a definite speck.
//
// Split into three size classes because a points material carries one size for
// the whole buffer; three passes is what buys a graded field instead of a
// uniform sprinkle.
function AmbientStarfield({ intensity }: { intensity: number }) {
  const classes = useMemo(() => {
    const background = new THREE.Color(neoPalette.background);
    const warm = new THREE.Color(neoPalette.coreUmber);
    const cool = new THREE.Color(neoPalette.lavenderDark);

    const buckets: { max: number; size: number; stars: typeof FIELD.stars }[] = [
      { max: 0.4, size: 0.013, stars: [] },
      { max: 0.75, size: 0.022, stars: [] },
      { max: 1.01, size: 0.036, stars: [] },
    ];

    for (const star of FIELD.stars) {
      (buckets.find((b) => star.size < b.max) ?? buckets[2]).stars.push(star);
    }

    return buckets.map(({ size, stars }) => {
      const positions = new Float32Array(stars.length * 3);
      const colors = new Float32Array(stars.length * 3);
      stars.forEach((star, index) => {
        positions.set(star.position, index * 3);
        // Baked at FULL strength and dimmed by material opacity below. Folding
        // intensity into the vertex colours instead would rebuild three buffers
        // on every frame of every transition, and since these points never
        // overlap the body, alpha-blending them toward the ivory background is
        // arithmetically the same fade.
        const tint = background
          .clone()
          .lerp(star.family === 'gold' ? warm : cool, Math.min(0.8, star.opacity * 1.25));
        colors.set([tint.r, tint.g, tint.b], index * 3);
      });
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      return { geometry, size };
    });
  }, []);

  return (
    <group>
      {classes.map(({ geometry, size }, index) => (
        <points key={index} geometry={geometry}>
          <pointsMaterial
            vertexColors
            size={size}
            transparent
            // the constellation dims with the organism and all but vanishes in
            // sleep, rather than hanging in the dark on its own
            opacity={Math.min(1, intensity)}
            depthWrite={false}
            toneMapped={false}
            sizeAttenuation
          />
        </points>
      ))}
    </group>
  );
}

// Volumetric ribbons ("caustic wisps") — the reference's signature grace.
// Broad, smooth light-sheets that sweep through the volume and catch light,
// built as tapered triangle strips along the macro loops so the ribbons ARE
// the circulation made visible rather than decoration laid on top. They read
// as luminous field folds, never as material ribbon sculpture.
function VolumetricRibbons({ intensity }: { intensity: number }) {
  const geometry = useMemo(() => {
    const positions: number[] = [];
    const colors: number[] = [];
    const warm = new THREE.Color(neoPalette.goldLight);
    const cool = new THREE.Color(neoPalette.lavenderLight);

    const pushTri = (
      p0: THREE.Vector3, c0: THREE.Color,
      p1: THREE.Vector3, c1: THREE.Color,
      p2: THREE.Vector3, c2: THREE.Color,
    ) => {
      positions.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z, p2.x, p2.y, p2.z);
      colors.push(c0.r, c0.g, c0.b, c1.r, c1.g, c1.b, c2.r, c2.g, c2.b);
    };

    FIELD.macroLoops.forEach((loop) => {
      const curve = new THREE.CatmullRomCurve3(
        loop.controlPoints.map((p) => new THREE.Vector3(p[0], p[1], p[2])),
        true,
      );
      // Finer sampling: coarse strips make the curvature read as flat facets,
      // which is what turns a light-fold into ribbon sculpture.
      const samples = curve.getPoints(240).map((p) => {
        // a sheet escaping the shell reads as a separate object, so fold any
        // stray point back inside the membrane
        const r = p.length();
        return r > 0.9 ? p.clone().multiplyScalar(0.9 / r) : p;
      });
      const width = 0.12 + loop.weight * 0.16;

      const tangentAt = (index: number) => {
        const next = samples[Math.min(index + 1, samples.length - 1)];
        const prev = samples[Math.max(index - 1, 0)];
        const t = next.clone().sub(prev);
        return t.lengthSq() < 1e-12 ? new THREE.Vector3(1, 0, 0) : t.normalize();
      };

      // Parallel-transported width frame. Crossing the tangent with a FIXED up
      // vector flips the sheet wherever the loop turns through that axis, and a
      // flipped quad is a bowtie — the hard-edged shard artifact. Carrying the
      // previous frame forward and re-orthogonalising it keeps the sheet
      // continuous all the way around the loop.
      let side = (() => {
        const t0 = tangentAt(0);
        const seed = Math.abs(t0.z) < 0.9
          ? new THREE.Vector3(0, 0, 1)
          : new THREE.Vector3(1, 0, 0);
        return seed.clone().sub(t0.clone().multiplyScalar(seed.dot(t0))).normalize();
      })();

      const frames = samples.map((point, index) => {
        const tangent = tangentAt(index);
        const projected = side.clone().sub(tangent.clone().multiplyScalar(side.dot(tangent)));
        side = projected.lengthSq() < 1e-10 ? side : projected.normalize();
        const localT = index / (samples.length - 1);
        const halfWidth = width * (Math.sin(localT * Math.PI) ** 0.7);
        const offset = side.clone().multiplyScalar(halfWidth);
        return {
          left: point.clone().add(offset),
          center: point,
          right: point.clone().sub(offset),
        };
      });

      for (let i = 0; i < frames.length - 1; i += 1) {
        const t = i / (frames.length - 1);
        // the sheet swells mid-sweep and dissolves at both ends
        const taper = Math.sin(t * Math.PI) ** 0.7;
        if (taper < 0.02) continue;

        // warm sheets sweep the left, cooler ones the right
        const cool01 = Math.min(1, Math.max(0, (samples[i].x + 0.5) / 1.3));
        const tint = warm.clone().lerp(cool, cool01 * 0.85);
        // Brightness lives on a real SPINE. The old two-vertex strip had no
        // centre to be bright at, so one border carried the whole value and the
        // sheet read as a lit edge. Three vertices across — dark, bright, dark —
        // let the strength go up while both borders still dissolve.
        const edge = tint.clone().multiplyScalar(taper * 0.0016 * intensity);
        const mid = tint.clone().multiplyScalar(taper * 0.04 * intensity);

        const f0 = frames[i];
        const f1 = frames[i + 1];

        pushTri(f0.left, edge, f0.center, mid, f1.center, mid);
        pushTri(f0.left, edge, f1.center, mid, f1.left, edge);
        pushTri(f0.center, mid, f0.right, edge, f1.right, edge);
        pushTri(f0.center, mid, f1.right, edge, f1.center, mid);
      }
    });

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    return geo;
  }, [intensity]);

  return (
    <mesh geometry={geometry}>
      <meshBasicMaterial
        vertexColors
        transparent
        opacity={0.9}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        side={THREE.DoubleSide}
        toneMapped={false}
      />
    </mesh>
  );
}

// The point-graph — the layer the reference is actually made of. Discrete
// bright nodes joined by clean thin edges, jewel-like, almost engineered.
// Two node passes: the full constellation as fine specks, and the high-
// centrality hubs as distinctly larger, near-white points — the reference's
// texture is exactly this separation, many faint points punctuated by a
// scatter of unmistakable ones. Uniform bright linking is still the enemy:
// edges stay thin and centrality-weighted so the graph never becomes a cage.
function NodeConstellation({ intensity }: { intensity: number }) {
  const field = FIELD;

  const { nodeGeometry, hubGeometry, edgeGeometry } = useMemo(() => {
    const gold = new THREE.Color(neoPalette.goldLight);
    const lavender = new THREE.Color(neoPalette.lavenderMid).multiplyScalar(1.35);
    const hotGold = new THREE.Color(neoPalette.shellWhite);
    const hotLavender = new THREE.Color(neoPalette.lavenderLight);

    const HUB_CENTRALITY = 0.68;
    const hubs = field.nodes.filter((n) => n.centrality >= HUB_CENTRALITY);
    const rest = field.nodes.filter((n) => n.centrality < HUB_CENTRALITY);

    const build = (
      nodes: typeof field.nodes,
      tintFor: (node: (typeof field.nodes)[number]) => THREE.Color,
    ) => {
      const positions = new Float32Array(nodes.length * 3);
      const colors = new Float32Array(nodes.length * 3);
      nodes.forEach((node, index) => {
        positions.set(node.position, index * 3);
        const tint = tintFor(node);
        colors.set([tint.r, tint.g, tint.b], index * 3);
      });
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      return geo;
    };

    const nodeGeo = build(rest, (node) =>
      (node.family === 'gold' ? gold : lavender)
        .clone()
        .multiplyScalar(0.3 + 0.7 * node.centrality),
    );

    // Hubs burn close to white-hot: these are the discrete jewels.
    const hubGeo = build(hubs, (node) =>
      (node.family === 'gold' ? hotGold : hotLavender)
        .clone()
        .multiplyScalar(0.75 + 0.25 * node.centrality),
    );

    const edgePositions = new Float32Array(field.connections.length * 6);
    const edgeColors = new Float32Array(field.connections.length * 6);
    const goldEdge = new THREE.Color(neoPalette.goldMid);
    const lavenderEdge = new THREE.Color(neoPalette.lavenderMid);

    field.connections.forEach((edge, index) => {
      const a = field.nodes[edge.a];
      const b = field.nodes[edge.b];
      edgePositions.set(a.position, index * 6);
      edgePositions.set(b.position, index * 6 + 3);

      const tint = (a.family === 'gold' ? goldEdge : lavenderEdge)
        .clone()
        .multiplyScalar(0.2 + 0.8 * ((a.centrality + b.centrality) / 2));
      edgeColors.set([tint.r, tint.g, tint.b], index * 6);
      edgeColors.set([tint.r, tint.g, tint.b], index * 6 + 3);
    });

    const edgeGeo = new THREE.BufferGeometry();
    edgeGeo.setAttribute('position', new THREE.BufferAttribute(edgePositions, 3));
    edgeGeo.setAttribute('color', new THREE.BufferAttribute(edgeColors, 3));

    return { nodeGeometry: nodeGeo, hubGeometry: hubGeo, edgeGeometry: edgeGeo };
  }, [field]);

  return (
    <group>
      {/* clean thin edges between discrete points — the graph's wiring */}
      <lineSegments geometry={edgeGeometry}>
        <lineBasicMaterial
          vertexColors
          transparent
          opacity={0.22 * intensity}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </lineSegments>
      <points geometry={nodeGeometry}>
        <pointsMaterial
          vertexColors
          size={0.015}
          transparent
          opacity={0.6 * intensity}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
          sizeAttenuation
        />
      </points>
      <points geometry={hubGeometry}>
        <pointsMaterial
          vertexColors
          size={0.038}
          transparent
          opacity={0.95 * intensity}
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
  const field = FIELD;
  const groupRef = useRef<THREE.Group>(null);
  const elapsedRef = useRef(0);

  useFrame((_, delta) => {
    elapsedRef.current += delta;
    const group = groupRef.current;
    if (!group) return;
    group.children.forEach((child, index) => {
      const flare = field.flares[index];
      if (!flare) return;
      // Reduced motion damps how far a flare swings, not how fast it swings.
      // Scaling the frequency left them travelling the full 2x range.
      const amplitude = 0.25 * motionScale;
      const pulse =
        1 -
        amplitude +
        amplitude *
          Math.sin(
            (elapsedRef.current / flare.pulseSeconds) * Math.PI * 2 + flare.phase,
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
    // Near-black at the deepest pockets. The reference's gold and violet only
    // punch because the gaps between its lobes are genuinely dark; a warm
    // mid-umber center (the old #4a3728) lifted the whole interior to a
    // midtone and every glow layer lost half its contrast before it started.
    uCenterColor: { value: new THREE.Color('#181008') },
    uMidColor: { value: new THREE.Color('#4a3728') },
    uEdgeColor: { value: new THREE.Color('#8a6f52') },
    uOpacity: { value: 0.9 },
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
    uniform vec3 uCenterColor;
    uniform vec3 uMidColor;
    uniform vec3 uEdgeColor;
    uniform float uOpacity;
    varying vec3 vNormal;
    varying vec3 vViewDir;
    varying vec3 vLocalPos;
    void main() {
      float facing = abs(dot(normalize(vNormal), normalize(vViewDir)));
      float density = pow(facing, 1.18);
      // Lobed darkness: the deep tone gathers in petal-shaped pockets rather
      // than one uniform vignette, so the interior reads as segmented volume
      // (the reference's mandala structure) instead of amorphous haze. Two
      // angular frequencies, offset by depth, keep the petals asymmetric.
      float ang = atan(vLocalPos.y, vLocalPos.x);
      float lobe = 0.5
        + 0.32 * sin(ang * 5.0 + vLocalPos.z * 2.1 + 0.7)
        + 0.18 * sin(ang * 3.0 - vLocalPos.z * 1.4 - 1.9);
      float pocket = smoothstep(0.25, 0.85, lobe);
      vec3 deep = mix(uMidColor, uCenterColor, pocket);
      vec3 color = mix(uEdgeColor, deep, density);
      float alpha = density * uOpacity * mix(0.82, 1.2, pocket);
      gl_FragColor = vec4(color, clamp(alpha, 0.0, 1.0));
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
      <sphereGeometry args={[1.0, 48, 32]} />
    </mesh>
  );
}

// Soft elliptical contact shadow, rendered in-scene because the opaque canvas
// now covers the CSS layer that used to carry it. Warm brown-grey, never
// black, so the organism reads as lightly suspended above the surface.
const shadowShader = {
  uniforms: {
    uColor: { value: new THREE.Color('#443529') },
    uOpacity: { value: 0.15 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform vec3 uColor;
    uniform float uOpacity;
    varying vec2 vUv;
    void main() {
      float d = distance(vUv, vec2(0.5));
      float falloff = 1.0 - smoothstep(0.0, 0.5, d);
      gl_FragColor = vec4(uColor, falloff * falloff * uOpacity);
    }
  `,
};

function ContactShadow({ opacity }: { opacity: number }) {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        ...shadowShader,
        uniforms: THREE.UniformsUtils.clone(shadowShader.uniforms),
        transparent: true,
        depthWrite: false,
      }),
    [],
  );

  useEffect(() => {
    material.uniforms.uOpacity.value = opacity;
  }, [material, opacity]);

  return (
    <mesh material={material} position={[0, -1.62, -0.35]} scale={[1.5, 0.26, 1]}>
      <planeGeometry args={[1, 1]} />
    </mesh>
  );
}

// Volumetric membrane: fresnel rim shader — luminous at the silhouette,
// transparent face-on, gold blending to lavender across x. No hard border.
const membraneShader = {
  uniforms: {
    uGoldColor: { value: new THREE.Color(neoPalette.goldLight) },
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
      float facing = abs(dot(normalize(vNormal), normalize(vViewDir)));
      float rim = pow(1.0 - facing, 4.2);
      float ang = atan(vLocalPos.y, vLocalPos.x);
      // Broad overlapping sweeps rather than one closed ring: the boundary is
      // defined by light accumulation, so some arcs glow and others dissolve
      // into air. A constant-brightness ring reads as a glass container.
      float sweep = clamp(
          0.42 + 0.34 * sin(ang * 2.0 + 0.9)
               + 0.24 * sin(ang * 3.0 - 2.1 + vLocalPos.z * 1.6),
          0.12, 1.0);
      // Refractive glass edge: a second, far tighter fresnel that hugs the
      // silhouette. It is what separates "glass sphere" from "soft halo" —
      // still a gradient (no stroked circle), but steep enough to read as a
      // surface. Modulated gently so it brightens where the sweeps do.
      float glass = pow(1.0 - facing, 11.0) * (0.55 + 0.45 * sweep) * 2.6;
      float mixAmount = smoothstep(-0.6, 0.9, vLocalPos.x);
      vec3 color = mix(uGoldColor, uLavenderColor, mixAmount);
      gl_FragColor = vec4(color, (rim * sweep + glass) * uStrength);
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
    // Retuned for the opaque framebuffer: additive light now genuinely adds,
    // so the values that read as a faint veil under broken compositing burn
    // out here. Roughly a third of the former strength.
    material.uniforms.uStrength.value = 0.115 * intensity;
  }, [material, intensity]);

  return (
    <>
      <mesh material={material}>
        <sphereGeometry args={[MEMBRANE_RADIUS, 64, 32]} />
      </mesh>
      {/* atmospheric bloom: wider, fainter shells feather the boundary so
          the membrane dissolves into the ivory instead of ending in a ring */}
      <VolumetricGlow
        color={neoPalette.goldLight}
        opacity={0.045 * intensity}
        power={1.4}
        radius={MEMBRANE_RADIUS * 1.2}
      />
    </>
  );
}

// Orbital arcs: large tilted elliptical paths, each with its own slow period
// and direction — the system never rotates as one object.
function OrbitalArcs({ intensity, motionScale }: { intensity: number; motionScale: number }) {
  const field = FIELD;
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
  const field = FIELD;
  const root = useRef<THREE.Group>(null);
  const rearGroup = useRef<THREE.Group>(null);
  const frontGroup = useRef<THREE.Group>(null);
  const weaveGroup = useRef<THREE.Group>(null);
  const elapsedTime = useRef(0);

  const goldIntensity = parameters.goldIntensity;
  const indigoIntensity = parameters.indigoIntensity;
  // Normalised against the TOP of the gold ramp (1.18), not the bottom.
  // Dividing by resting pinned every clamp from `listening` onward, which is
  // why the six states measured as visually identical.
  const goldLevel = goldIntensity / 1.18;

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
    if (weaveGroup.current) {
      // the connective tissue drifts on its own barely-perceptible phase
      weaveGroup.current.rotation.y += delta * 0.004 * motionScale;
      weaveGroup.current.rotation.z = Math.sin(elapsed * 0.07 + 0.9) * 0.012 * motionScale;
    }
  });

  const motionScale = resolveMotionScale(reducedMotion, parameters.reducedMotion.motionScale);

  return (
    <>
      <color attach="background" args={[neoPalette.background]} />
      <ContactShadow opacity={0.15} />
      <ambientLight intensity={parameters.lighting.ambientIntensity} />
      <hemisphereLight args={[neoPalette.backgroundLight, neoPalette.goldDeep, parameters.lighting.hemisphereIntensity]} />
      <directionalLight position={[4, 5, 5]} intensity={parameters.lighting.directionalIntensity} color={neoPalette.shellWhite} />

      <group ref={root}>
        {/* 2. the surrounding constellation, plus the drifting ambient dust
            that catches the organism's own light near the shell. The dust is
            light-on-light and so stays a shimmer; the constellation is the
            layer that actually carries density. */}
        <AmbientStarfield intensity={goldLevel} />
        <Sparkles
          count={Math.round(parameters.particleCount * 2.2)}
          scale={4.6}
          size={0.7}
          speed={reducedMotion ? 0.02 : parameters.particleVelocity * 0.5}
          noise={0.8}
          color={neoPalette.goldLight}
          opacity={0.38 * goldLevel}
        />
        <Sparkles
          count={Math.round(parameters.particleCount * 1.2)}
          scale={6.2}
          size={1.3}
          speed={reducedMotion ? 0.01 : parameters.particleVelocity * 0.3}
          noise={0.6}
          color={neoPalette.backgroundLight}
          opacity={0.2 * goldLevel}
        />

        {/* 3. rear orbital arcs */}
        <OrbitalArcs intensity={goldLevel} motionScale={motionScale} />

        {/* 4. translucent outer membrane */}
        <Membrane intensity={goldLevel} />

        {/* 5. rear neural filaments + receding half of the micro-weave */}
        <group ref={rearGroup}>
          <MicroWeave
            goldIntensity={goldIntensity}
            indigoIntensity={indigoIntensity}
            half="rear"
          />
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
        <VolumetricBody opacity={0.82 + parameters.shellOpacity * 0.3} />

        {/* the violet reasoning hemisphere: a genuine cool VOLUME on the
            right, which is what the reference has and a lone beacon cannot
            supply */}
        <group position={[0.34, 0.04, 0.05]}>
          {/* outer reach: wide and soft, so the cool region has an extent
              rather than an edge */}
          <VolumetricGlow
            color={neoPalette.lavenderMid}
            opacity={Math.min(0.17, 0.15 * (indigoIntensity / 0.85))}
            power={1.7}
            radius={0.8}
          />
          {/* body of the volume: this is the layer that gives the hemisphere
              actual presence against the warm field */}
          <VolumetricGlow
            color={neoPalette.lavenderMid}
            opacity={Math.min(0.34, 0.3 * (indigoIntensity / 0.85))}
            power={2.2}
            radius={0.55}
          />
          {/* saturated heart: lavenderDark keeps the volume violet instead of
              washing to white as additive layers accumulate */}
          <VolumetricGlow
            color={neoPalette.lavenderDark}
            opacity={Math.min(0.36, 0.32 * (indigoIntensity / 0.85))}
            power={2.8}
            radius={0.4}
          />
        </group>

        {/* warm interior atmosphere: a faint golden breath inside the body —
            volumetric, so it dissolves instead of reading as a disk edge.
            Deliberately quiet: this wash sits on top of the dark pockets, and
            every unit of it here is a unit of chiaroscuro lost. */}
        <VolumetricGlow
          color={neoPalette.goldMid}
          opacity={0.045 * goldLevel}
          power={1.9}
          radius={0.9}
        />

        {/* volumetric ribbons: the circulation made visible */}
        <VolumetricRibbons intensity={goldLevel} />

        {/* the radiating anatomy: trunks, branches, twigs */}
        <Dendrites
          generation={2}
          lineWidth={0.34}
          goldIntensity={goldIntensity}
          indigoIntensity={indigoIntensity}
        />
        <Dendrites
          generation={1}
          lineWidth={0.5}
          goldIntensity={goldIntensity}
          indigoIntensity={indigoIntensity}
        />
        <Dendrites
          generation={0}
          lineWidth={0.85}
          goldIntensity={goldIntensity}
          indigoIntensity={indigoIntensity}
        />
        {/* the beads that turn drawn lines into strings of luminous points */}
        <StrandBeads
          goldIntensity={goldIntensity}
          indigoIntensity={indigoIntensity}
        />

        {/* 7-8. inner micro-weave + constellation drift together, then the
            middle and front majors */}
        <group ref={weaveGroup}>
          <MicroWeave
            goldIntensity={goldIntensity}
            indigoIntensity={indigoIntensity}
            half="front"
          />
          <NodeConstellation intensity={goldLevel} />
        </group>
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

        {/* inner shimmer — finer and more numerous */}
        <Sparkles
          count={Math.round(parameters.particleCount * 1.3)}
          scale={1.9}
          size={parameters.particleSize * 0.6}
          speed={reducedMotion ? 0.02 : parameters.particleVelocity}
          noise={1.05}
          color={neoPalette.goldLight}
          opacity={0.6 * goldLevel}
        />
        <group scale={1 - 0.45 * parameters.indigoConvergence} position={[0.35, 0, 0]}>
          <Sparkles
            count={Math.round(parameters.particleCount * 0.35)}
            scale={1.6}
            size={parameters.particleSize * 0.7}
            speed={reducedMotion ? 0.02 : parameters.particleVelocity}
            noise={1.05}
            color={neoPalette.lavenderMid}
            opacity={Math.min(0.85, indigoIntensity * 1.4)}
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
      dpr={[1, 1.4]}
      // Opaque framebuffer. With alpha:true, every additive pass accumulated
      // alpha and composited over the ivory page as a grey veil — the glow
      // layers were DARKENING the background instead of adding light. An
      // opaque canvas gives additive blending real light to add to.
      gl={{
        // Every silhouette in this scene is an alpha falloff, not a hard
        // edge, so MSAA buys almost nothing and costs fill rate.
        antialias: false,
        alpha: false,
        powerPreference: 'high-performance',
      }}
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
