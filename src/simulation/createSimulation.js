// ============================================================
// SIMULACIÓN DE OLEAJE - GPU COMPUTE
// ============================================================

import * as THREE from 'three/webgpu';
import {
  Fn,
  If,
  color,
  hash,
  instanceIndex,
  instancedArray,
  max,
  mix,
  mod,
  sin,
  cos,
  float,
  uint,
  uv,
  vec3,
  vec4,
  time,
  div,
  mul,
  sub,
  add
} from 'three/tsl';

export function createSimulation({ renderer, scene, params, count = 131072 }) {
  // ============================================================
  // 1. ESTADO - Buffers en GPU
  // ============================================================
  const positionBuffer = instancedArray(count, 'vec3');
  const velocityBuffer = instancedArray(count, 'vec3');
  const phaseBuffer = instancedArray(count, 'float');

  // ============================================================
  // 2. INICIALIZACIÓN
  // ============================================================
  const initParticles = Fn(() => {
    const i = instanceIndex;
    const p = positionBuffer.element(i);
    const v = velocityBuffer.element(i);
    const phase = phaseBuffer.element(i);

    const r1 = hash(i.add(uint(11)));
    const r2 = hash(i.add(uint(23)));
    const r3 = hash(i.add(uint(37)));
    const r4 = hash(i.add(uint(53)));

    const radius = r1.mul(3.0).add(0.5);
    const theta = r2.mul(6.2832);
    const z = r3.mul(2.0).sub(1.0);

    p.assign(vec3(
      radius.mul(cos(theta)),
      radius.mul(sin(theta)),
      z
    ));

    v.assign(vec3(
      radius.mul(sin(theta)).mul(-0.3),
      radius.mul(cos(theta)).mul(0.3),
      r4.sub(0.5).mul(0.2)
    ));

    phase.assign(r3.mul(6.2832));
  })().compute(count).setName('Initialize Particles');

  // ============================================================
  // 3. UPDATE
  // ============================================================
  const updateParticles = Fn(() => {
    const i = instanceIndex;
    const p = positionBuffer.element(i);
    const v = velocityBuffer.element(i);
    const phase = phaseBuffer.element(i);

    const dt = params.dt.mul(params.timeScale);
    const force = vec3(0.0).toVar();

    // ============================================================
    // FUERZA 1: ONDA DE PRESIÓN
    // ============================================================
    const toCenter = p.sub(params.waveCenter);
    const distance = max(toCenter.length(), 0.1);
    const direction = toCenter.div(distance);

    const wave = sin(
      params.waveFrequency.mul(time).sub(
        params.waveNumber.mul(distance)
      ).add(phase)
    );

    const decay = max(
      float(1.0).sub(
        params.waveDecay.mul(distance).div(6.0)
      ),
      0.0
    );

    const waveForce = direction
      .mul(params.waveAmplitude)
      .mul(wave)
      .mul(decay)
      .mul(params.waveEnabled)
      .mul(params.intensity);

    force.addAssign(waveForce);

    // ============================================================
    // FUERZA 2: RESPIRACIÓN GLOBAL
    // ============================================================
    const globalPhase = time.mul(params.breatheFrequency).add(phase);
    const breathe = sin(globalPhase);
    const breatheForce = p
      .normalize()
      .mul(params.breatheAmplitude)
      .mul(breathe)
      .mul(params.breatheEnabled)
      .mul(params.intensity);

    force.addAssign(breatheForce);

    // ============================================================
    // FUERZA 3: RESORTE
    // ============================================================
    const springForce = p
      .mul(-1.0)
      .mul(params.springStiffness)
      .mul(params.springEnabled);

    force.addAssign(springForce);

    // ============================================================
    // FUERZA 4: DRAG
    // ============================================================
    force.addAssign(v.mul(params.dragCoefficient).mul(params.dragEnabled).mul(-1.0));

    // ============================================================
    // FUERZA 5: RUIDO
    // ============================================================
    const noiseX = hash(i.add(uint(time.mul(100).toInt())));
    const noiseY = hash(i.add(uint(time.mul(137).toInt())));
    const noiseZ = hash(i.add(uint(time.mul(191).toInt())));
    const noiseVec = vec3(noiseX, noiseY, noiseZ).sub(0.5).mul(2.0);

    force.addAssign(
      noiseVec
        .mul(params.noiseStrength)
        .mul(params.noiseEnabled)
        .mul(params.intensity)
        .mul(0.1)
    );

    // ============================================================
    // 4. INTEGRACIÓN
    // ============================================================
    v.addAssign(force.mul(dt));

    const speed = v.length();
    If(speed.greaterThan(params.maxSpeed), () => {
      v.assign(v.normalize().mul(params.maxSpeed));
    });

    p.addAssign(v.mul(dt));

    // ============================================================
    // 5. BORDES ELÁSTICOS
    // ============================================================
    const half = params.boundsSize.mul(0.5);

    If(p.x.greaterThan(half), () => {
      p.x.assign(half);
      v.x.assign(v.x.mul(-0.5));
    });
    If(p.x.lessThan(half.mul(-1.0)), () => {
      p.x.assign(half.mul(-1.0));
      v.x.assign(v.x.mul(-0.5));
    });

    If(p.y.greaterThan(half), () => {
      p.y.assign(half);
      v.y.assign(v.y.mul(-0.5));
    });
    If(p.y.lessThan(half.mul(-1.0)), () => {
      p.y.assign(half.mul(-1.0));
      v.y.assign(v.y.mul(-0.5));
    });

    If(p.z.greaterThan(half), () => {
      p.z.assign(half);
      v.z.assign(v.z.mul(-0.5));
    });
    If(p.z.lessThan(half.mul(-1.0)), () => {
      p.z.assign(half.mul(-1.0));
      v.z.assign(v.z.mul(-0.5));
    });
  })().compute(count).setName('Update Particles');

  // ============================================================
  // 6. RENDER
  // ============================================================
  const material = new THREE.SpriteNodeMaterial({
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true,
  });

  material.positionNode = positionBuffer.toAttribute();

  // Tamaño dinámico
  material.scaleNode = Fn(() => {
    const baseSize = params.particleSize;
    const speed = velocityBuffer.toAttribute().length();
    const phase = phaseBuffer.toAttribute();

    const breatheScale = float(1.0).add(
      sin(time.mul(params.breatheFrequency).add(phase)).mul(0.3)
    );
    const speedScale = float(1.0).add(speed.div(2.0));

    return baseSize.mul(breatheScale).mul(speedScale);
  })();

  // Color dinámico
  material.colorNode = Fn(() => {
    const speed = velocityBuffer.toAttribute().length();
    const phase = phaseBuffer.toAttribute();
    const t = speed.div(params.maxSpeed).clamp(0.0, 1.0);

    const breath = sin(time.mul(params.breatheFrequency).add(phase)).mul(0.5).add(0.5);

    const c1 = color('#0a0a2e');
    const c2 = color('#00d4ff');
    const c3 = color('#ff6bcd');
    const c4 = color('#ffb35a');

    let finalColor;
    If(t.lessThan(0.33), () => {
      finalColor = mix(c1, c2, t.div(0.33));
    });
    If(t.greaterThan(0.33).and(t.lessThan(0.66)), () => {
      finalColor = mix(c2, c3, t.sub(0.33).div(0.33));
    });
    If(t.greaterThan(0.66), () => {
      finalColor = mix(c3, c4, t.sub(0.66).div(0.34));
    });

    const breatheShift = breath.mul(0.15);
    return vec4(finalColor, 0.9);
  })();

  // Máscara circular
  material.opacityNode = Fn(() => {
    const dist = uv().xy.sub(0.5).length();
    return step(dist, 0.5).mul(float(1.0).sub(dist.mul(0.5)));
  })();

  const geometry = new THREE.PlaneGeometry(1, 1);
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  mesh.frustumCulled = false;
  scene.add(mesh);

  // ============================================================
  // 7. API
  // ============================================================
  function reset() {
    renderer.compute(initParticles);
  }

  function stepSimulation() {
    renderer.compute(updateParticles);
  }

  function dispose() {
    geometry.dispose();
    material.dispose();
    scene.remove(mesh);
  }

  return {
    count,
    positionBuffer,
    velocityBuffer,
    phaseBuffer,
    reset,
    stepSimulation,
    dispose
  };
}
