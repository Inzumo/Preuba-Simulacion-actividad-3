import * as THREE from 'three/webgpu';
import {
  Fn, If, color, hash, instanceIndex, instancedArray, max, mix, mod,
  uint, uv, vec2, vec3, vec4, smoothstep, time, sin, float
} from 'three/tsl';

export function createSimulation({ renderer, scene, params, count = 131072 }) {
  const positionBuffer = instancedArray(count, 'vec3');
  const velocityBuffer = instancedArray(count, 'vec3');
  // Número aleatorio fijo por partícula (variación de color y parpadeo)
  const seedBuffer = instancedArray(count, 'float');

  const initParticles = Fn(() => {
    const i = instanceIndex;
    const p = positionBuffer.element(i);
    const v = velocityBuffer.element(i);

    const r1 = hash(i.add(uint(11)));
    const r2 = hash(i.add(uint(23)));
    const r3 = hash(i.add(uint(37)));
    const r4 = hash(i.add(uint(53)));
    const r5 = hash(i.add(uint(71)));
    const r6 = hash(i.add(uint(89)));

    // Nacen repartidas por todo el volumen visible (boundsSize es vec3)
    p.assign(vec3(r1, r2, r3).sub(0.5).mul(params.boundsSize));
    v.assign(vec3(r4, r5, r6).sub(0.5).mul(params.initialSpeed));
    seedBuffer.element(i).assign(hash(i.add(uint(101))));
  })().compute(count).setName('Initialize Particles');

  const updateParticles = Fn(() => {
    const p = positionBuffer.element(instanceIndex);
    const v = velocityBuffer.element(instanceIndex);

    const dt = params.dt.mul(params.timeScale);
    const force = vec3(0.0).toVar();

    const toCenter = params.attractor.sub(p);
    const dist = max(toCenter.length(), 0.1);
    const dir = toCenter.div(dist);
    const zAxis = vec3(0.0, 0.0, 1.0);
    const tangent = zAxis.cross(dir);

    // 1. VIENTO
    force.addAssign(vec3(1.0, 0.0, 0.0).mul(params.windStrength).mul(params.windEnabled));
    // 2. RADIAL
    force.addAssign(dir.mul(params.radialStrength).div(dist.mul(0.5).add(1.0)).mul(params.radialEnabled));
    // 3. VÓRTICE
    force.addAssign(tangent.mul(params.vortexStrength).mul(params.vortexEnabled));
    // 4. DRAG
    force.addAssign(v.mul(params.dragCoefficient).mul(params.dragEnabled).mul(-1.0));

    v.addAssign(force.mul(dt));
    const speed = v.length();
    If(speed.greaterThan(params.maxSpeed), () => v.assign(v.normalize().mul(params.maxSpeed)));
    p.addAssign(v.mul(dt));

    const half = params.boundsSize.mul(0.5);
    p.assign(mod(p.add(half), params.boundsSize).sub(half));
  })().compute(count).setName('Update Particles');

  // ---------------------------------------------------------------- RENDER
  const material = new THREE.SpriteNodeMaterial({
    blending: THREE.AdditiveBlending, depthWrite: false, transparent: true
  });

  material.positionNode = positionBuffer.toAttribute();

  const velAttr = velocityBuffer.toAttribute();
  const seed = seedBuffer.toAttribute();

  const speedNorm = velAttr.length().div(params.maxSpeed).clamp(0.0, 1.0);

  // Factor de estela: 1 (círculo) en reposo -> 1 + trailLength a máxima velocidad
  const stretch = speedNorm.mul(params.trailLength).add(1.0);

  // El quad crece con la velocidad para tener sitio donde dibujar la estela
  material.scaleNode = params.particleSize.mul(stretch);

  // --- Color: paleta térmica neón (sin blanco puro) ---
  material.colorNode = Fn(() => {
    const cyan = color('#00E5FF');
    const purple = color('#8A2BE2');
    const magenta = color('#FF1FD0');
    const red = color('#FF0033');

    // Un poco de variación por partícula para que el color no sea una banda uniforme
    const s = speedNorm.add(seed.sub(0.5).mul(0.12)).clamp(0.0, 1.0);

    const mix1 = mix(cyan, purple, s.mul(2.5).clamp(0.0, 1.0));
    const mix2 = mix(mix1, magenta, s.sub(0.4).mul(2.5).clamp(0.0, 1.0));
    const rgb = mix(mix2, red, s.sub(0.7).mul(3.0).clamp(0.0, 1.0));

    // Parpadeo suave por partícula + más brillo cuanto más rápido
    const twinkle = sin(time.mul(1.5).add(seed.mul(6.2831))).mul(0.5).add(0.5);
    const brightness = float(0.55).add(twinkle.mul(0.25)).add(speedNorm.mul(0.6));

    return vec4(rgb.mul(brightness), 1.0);
  })();

  // --- Forma: elipse orientada según la velocidad, con núcleo y halo ---
  material.opacityNode = Fn(() => {
    const p = uv().sub(0.5);

    // Dirección de movimiento en pantalla (la cámara mira en -Z, así que basta xy).
    // El pequeño offset evita normalizar un vector nulo cuando v = 0.
    const dir = velAttr.xy.add(vec2(0.0001, 0.0)).normalize();
    const perp = vec2(dir.y.negate(), dir.x);

    const along = p.dot(dir);
    // Comprimimos el eje transversal: el largo crece, el grosor casi no.
    const widen = speedNorm.mul(0.5).add(0.75);
    const across = p.dot(perp).mul(stretch).div(widen);

    const d = vec2(along, across).length();

    // smoothstep siempre con edge0 < edge1 (invertimos con 1 - x)
    const core = float(1.0).sub(smoothstep(0.0, 0.14, d));
    const halo = float(1.0).sub(smoothstep(0.1, 0.5, d)).mul(0.35);

    // Cabeza más brillante que la cola
    const head = smoothstep(-0.5, 0.5, along).mul(0.5).add(0.5);
    const headMix = mix(float(1.0), head, speedNorm);

    return core.add(halo).mul(headMix).mul(params.globalOpacity);
  })();

  const geometry = new THREE.PlaneGeometry(1, 1);
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  mesh.frustumCulled = false;
  scene.add(mesh);

  return {
    count, positionBuffer, velocityBuffer,
    reset: () => renderer.compute(initParticles),
    stepSimulation: () => renderer.compute(updateParticles),
    dispose: () => { geometry.dispose(); material.dispose(); scene.remove(mesh); }
  };
}