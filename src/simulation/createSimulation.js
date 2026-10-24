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
  step,
  uint,
  uv,
  vec3,
  vec4,
  sin,
  cos,
  time,
  smoothstep
} from 'three/tsl';

export function createSimulation({ renderer, scene, params, count = 131072 }) {
  const positionBuffer = instancedArray(count, 'vec3');
  const velocityBuffer = instancedArray(count, 'vec3');

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

    p.assign(vec3(r1, r2, r3).sub(0.5).mul(params.boundsSize.mul(0.6)));
    v.assign(vec3(r4, r5, r6).sub(0.5).mul(params.initialSpeed));
  })().compute(count).setName('Initialize Particles');

  const updateParticles = Fn(() => {
    const p = positionBuffer.element(instanceIndex);
    const v = velocityBuffer.element(instanceIndex);

    const dt = params.dt.mul(params.timeScale);
    const force = vec3(0.0).toVar();

    // 1) FUERZA ELÁSTICA (Muelle)
    const distVec = p.sub(params.attractor);
    const dist = max(distVec.length(), params.softening);
    const springDir = distVec.div(dist);
    const springForce = springDir.mul(dist).mul(params.springStrength).mul(params.springEnabled).mul(-1.0);
    force.addAssign(springForce);

    // 2) TURBULENCIA CÓSMICA
    const t = time.mul(0.5);
    const turbX = sin(p.y.mul(1.5).add(t)).mul(cos(p.z.mul(1.2).add(t)));
    const turbY = sin(p.z.mul(1.5).add(t)).mul(cos(p.x.mul(1.2).add(t)));
    const turbZ = sin(p.x.mul(1.5).add(t)).mul(cos(p.y.mul(1.2).add(t)));
    const turbForce = vec3(turbX, turbY, turbZ).mul(params.turbStrength).mul(params.turbEnabled);
    force.addAssign(turbForce);

    // 3) DRAG
    force.addAssign(v.mul(params.dragCoefficient).mul(params.dragEnabled).mul(-1.0));

    // INTEGRACIÓN
    v.addAssign(force.mul(dt));

    const speed = v.length();
    If(speed.greaterThan(params.maxSpeed), () => {
      v.assign(v.normalize().mul(params.maxSpeed));
    });

    p.addAssign(v.mul(dt));

    const half = params.boundsSize.mul(0.5);
    p.assign(mod(p.add(half), params.boundsSize).sub(half));
  })().compute(count).setName('Update Particles');

  // RENDER VISUAL IMPACTANTE
  const material = new THREE.SpriteNodeMaterial({
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true
  });

  material.positionNode = positionBuffer.toAttribute();
  
  const speedAttr = velocityBuffer.toAttribute().length();
  const speedNorm = speedAttr.div(params.maxSpeed).clamp(0.0, 1.0);
  
  // El tamaño reacciona a la velocidad
  material.scaleNode = params.particleSize.mul(speedNorm.mul(2.0).add(1.0));

  material.colorNode = Fn(() => {
    const t = speedNorm;
    const deepBlue = color('#00E5FF'); // Cyan
    const magenta = color('#FF00FF');  // Magenta
    const yellow = color('#FFEA00');   // Amarillo

    const lowToMid = mix(deepBlue, magenta, t.mul(2.0).clamp(0.0, 1.0));
    const midToHigh = mix(magenta, yellow, t.sub(0.5).mul(2.0).clamp(0.0, 1.0));
    const finalRGB = mix(lowToMid, midToHigh, step(0.5, t));

    return vec4(finalRGB, 1.0);
  })();

  // Núcleo brillante (borde suave)
  const distToCenter = uv().xy.sub(0.5).length();
  const alpha = smoothstep(0.5, 0.1, distToCenter).mul(params.globalOpacity);
  material.opacityNode = alpha;

  const geometry = new THREE.PlaneGeometry(1, 1);
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  mesh.frustumCulled = false;
  scene.add(mesh);

  function reset() { renderer.compute(initParticles); }
  function stepSimulation() { renderer.compute(updateParticles); }
  function dispose() {
    geometry.dispose();
    material.dispose();
    scene.remove(mesh);
  }

  return { count, positionBuffer, velocityBuffer, reset, stepSimulation, dispose };
}