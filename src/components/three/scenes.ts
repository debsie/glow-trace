import * as THREE from "three";

/**
 * The two Glowtrace WebGL scenes. Both are flat-shaded line and point work in theme colours:
 * no lighting, no bloom, no gradients. Each returns a small handle the canvas wrapper drives.
 */

export type SceneKind = "field" | "ring";

export type SceneColors = { base: THREE.Color; accent: THREE.Color };

export type SceneHandle = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  /** Advance to `time` seconds; pointer is -1..1 on both axes. */
  update: (time: number, pointer: { x: number; y: number }) => void;
  setColors: (colors: SceneColors) => void;
  resize: (width: number, height: number, pixelRatio: number) => void;
  dispose: () => void;
};

/* ---------- Scene 1: skin topography, read by a sweeping scan line ---------- */

const FIELD_VERTEX = /* glsl */ `
  uniform float uTime;
  uniform float uScan;
  uniform float uPixel;
  varying float vScan;
  varying float vFade;

  float relief(vec2 p) {
    return sin(p.x * 0.9 + uTime * 0.35) * 0.34
      + sin(p.y * 1.3 - uTime * 0.25) * 0.24
      + sin((p.x + p.y) * 2.1 + uTime * 0.5) * 0.11
      + sin(p.x * 4.3) * sin(p.y * 3.7) * 0.06;
  }

  void main() {
    vec3 p = position;
    p.y = relief(p.xz);
    vScan = smoothstep(1.1, 0.0, abs(p.x - uScan));
    p.y += vScan * 0.14;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    // Fade towards the far edge and the sides so the field has no hard border.
    float depth = smoothstep(13.0, 4.0, -mv.z);
    float side = smoothstep(9.0, 5.0, abs(p.x));
    vFade = depth * side;
    gl_PointSize = (1.9 + vScan * 2.8) * uPixel * (7.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;

const FIELD_FRAGMENT = /* glsl */ `
  uniform vec3 uBase;
  uniform vec3 uAccent;
  varying float vScan;
  varying float vFade;

  void main() {
    vec2 c = gl_PointCoord - 0.5;
    if (dot(c, c) > 0.25) discard;
    vec3 color = mix(uBase, uAccent, vScan);
    float alpha = (0.42 + 0.58 * vScan) * vFade;
    gl_FragColor = vec4(color, alpha);
  }
`;

const createField = (colors: SceneColors): SceneHandle => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 40);

  const columns = 170;
  const rows = 80;
  const width = 18;
  const depth = 11;
  const positions = new Float32Array(columns * rows * 3);
  let cursor = 0;
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      positions[cursor] = (column / (columns - 1) - 0.5) * width;
      positions[cursor + 1] = 0;
      positions[cursor + 2] = (row / (rows - 1) - 0.5) * depth - 2.5;
      cursor += 3;
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

  const uniforms = {
    uTime: { value: 0 },
    uScan: { value: 0 },
    uPixel: { value: 1 },
    uBase: { value: colors.base.clone() },
    uAccent: { value: colors.accent.clone() },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: FIELD_VERTEX,
    fragmentShader: FIELD_FRAGMENT,
    transparent: true,
    depthWrite: false,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  scene.add(points);

  return {
    scene,
    camera,
    update: (time, pointer) => {
      uniforms.uTime.value = time;
      // Ease in and out across the field, like a scanner head.
      uniforms.uScan.value = Math.sin(time * 0.45) * (width * 0.42);
      camera.position.set(pointer.x * 0.6, 2.3 - pointer.y * 0.25, 6.2);
      camera.lookAt(0, 0.1, -1.5);
    },
    setColors: (next) => {
      uniforms.uBase.value.copy(next.base);
      uniforms.uAccent.value.copy(next.accent);
    },
    resize: (w, h, pixelRatio) => {
      camera.aspect = w / Math.max(1, h);
      camera.updateProjectionMatrix();
      uniforms.uPixel.value = pixelRatio;
    },
    dispose: () => {
      geometry.dispose();
      material.dispose();
    },
  };
};

/* ---------- Scene 2: the Glowtrace mark — a ring with a live trace through it ---------- */

const ringPoints = (radius: number, segments: number): THREE.Vector3[] =>
  Array.from({ length: segments }, (_, index) => {
    const angle = (index / segments) * Math.PI * 2;
    return new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius, 0);
  });

const createRing = (colors: SceneColors): SceneHandle => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 30);
  camera.position.set(0, 0, 5.2);

  const group = new THREE.Group();
  scene.add(group);

  const lineMaterial = new THREE.LineBasicMaterial({ color: colors.accent });
  const faintMaterial = new THREE.LineBasicMaterial({
    color: colors.base,
    transparent: true,
    opacity: 0.35,
  });

  const ringGeometry = new THREE.BufferGeometry().setFromPoints(ringPoints(1.5, 160));
  group.add(new THREE.LineLoop(ringGeometry, lineMaterial));
  // WebGL lines are one pixel wide; a second loop a hair outside gives the ring its weight.
  const ringOuter = new THREE.LineLoop(ringGeometry, lineMaterial);
  ringOuter.scale.setScalar(1.008);
  group.add(ringOuter);

  // Two quiet companion orbits, tilted off-axis, give the mark depth as it turns.
  const orbitGeometry = new THREE.BufferGeometry().setFromPoints(ringPoints(1.86, 160));
  const orbitA = new THREE.LineLoop(orbitGeometry, faintMaterial);
  orbitA.rotation.set(1.15, 0.3, 0);
  const orbitB = new THREE.LineLoop(orbitGeometry, faintMaterial);
  orbitB.rotation.set(-0.9, -0.55, 0);
  group.add(orbitA, orbitB);

  // The trace: a travelling wave across the ring's diameter.
  const traceSegments = 140;
  const tracePositions = new Float32Array(traceSegments * 3);
  const traceGeometry = new THREE.BufferGeometry();
  traceGeometry.setAttribute("position", new THREE.BufferAttribute(tracePositions, 3));
  group.add(new THREE.Line(traceGeometry, lineMaterial));

  // Sample points riding the companion orbits.
  const dotCount = 90;
  const dotPositions = new Float32Array(dotCount * 3);
  const dotSeeds = Array.from({ length: dotCount }, (_, index) => ({
    angle: (index / dotCount) * Math.PI * 2 * 3.1,
    speed: 0.08 + ((index * 37) % 11) * 0.012,
    orbit: index % 2,
  }));
  const dotGeometry = new THREE.BufferGeometry();
  dotGeometry.setAttribute("position", new THREE.BufferAttribute(dotPositions, 3));
  const dotMaterial = new THREE.PointsMaterial({
    color: colors.base,
    size: 0.035,
    transparent: true,
    opacity: 0.8,
    depthWrite: false,
  });
  group.add(new THREE.Points(dotGeometry, dotMaterial));

  const scratch = new THREE.Vector3();

  return {
    scene,
    camera,
    update: (time, pointer) => {
      for (let index = 0; index < traceSegments; index += 1) {
        const t = index / (traceSegments - 1);
        const x = (t - 0.5) * 2.6;
        // Amplitude tapers to zero where the trace meets the ring.
        const envelope = Math.sin(t * Math.PI) ** 1.5;
        tracePositions[index * 3] = x;
        tracePositions[index * 3 + 1] = Math.sin(x * 3.2 - time * 1.6) * 0.42 * envelope;
        tracePositions[index * 3 + 2] = 0;
      }
      traceGeometry.attributes["position"]!.needsUpdate = true;

      dotSeeds.forEach((seed, index) => {
        const angle = seed.angle + time * seed.speed;
        scratch.set(Math.cos(angle) * 1.86, Math.sin(angle) * 1.86, 0);
        scratch.applyEuler(seed.orbit === 0 ? orbitA.rotation : orbitB.rotation);
        dotPositions[index * 3] = scratch.x;
        dotPositions[index * 3 + 1] = scratch.y;
        dotPositions[index * 3 + 2] = scratch.z;
      });
      dotGeometry.attributes["position"]!.needsUpdate = true;

      group.rotation.y = Math.sin(time * 0.3) * 0.55 + pointer.x * 0.35;
      group.rotation.x = Math.cos(time * 0.24) * 0.18 - pointer.y * 0.25;
    },
    setColors: (next) => {
      lineMaterial.color.copy(next.accent);
      faintMaterial.color.copy(next.base);
      dotMaterial.color.copy(next.base);
    },
    resize: (w, h) => {
      camera.aspect = w / Math.max(1, h);
      // Keep the whole mark in frame on narrow canvases.
      camera.position.z = camera.aspect < 1 ? 5.2 / camera.aspect : 5.2;
      camera.updateProjectionMatrix();
    },
    dispose: () => {
      ringGeometry.dispose();
      orbitGeometry.dispose();
      traceGeometry.dispose();
      dotGeometry.dispose();
      lineMaterial.dispose();
      faintMaterial.dispose();
      dotMaterial.dispose();
    },
  };
};

export const createScene = (kind: SceneKind, colors: SceneColors): SceneHandle =>
  kind === "field" ? createField(colors) : createRing(colors);
