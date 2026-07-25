'use client';

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';

// An inverse-fresnel ball of light: densest where the view passes through the
// sphere's centre (the longest path through the volume) and dissolving to
// nothing at the silhouette. Flat additive spheres render as hard-edged
// pancakes; this reads as a genuine glow with no circular border.
const glowShader = {
  uniforms: {
    uColor: { value: new THREE.Color('#ffffff') },
    uOpacity: { value: 0.2 },
    uPower: { value: 1.4 },
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
    uniform vec3 uColor;
    uniform float uOpacity;
    uniform float uPower;
    varying vec3 vNormal;
    varying vec3 vViewDir;
    void main() {
      float facing = abs(dot(normalize(vNormal), normalize(vViewDir)));
      float density = pow(facing, uPower);
      gl_FragColor = vec4(uColor, density * uOpacity);
    }
  `,
};

export function VolumetricGlow({
  color,
  opacity,
  power = 1.4,
  radius,
}: {
  color: string;
  opacity: number;
  power?: number;
  radius: number;
}) {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        ...glowShader,
        uniforms: THREE.UniformsUtils.clone(glowShader.uniforms),
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.FrontSide,
      }),
    [],
  );

  useEffect(() => {
    material.uniforms.uColor.value.set(color);
    material.uniforms.uOpacity.value = opacity;
    material.uniforms.uPower.value = power;
  }, [material, color, opacity, power]);

  useEffect(() => () => material.dispose(), [material]);

  return (
    <mesh material={material}>
      <sphereGeometry args={[radius, 48, 48]} />
    </mesh>
  );
}
