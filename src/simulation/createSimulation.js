import * as THREE from 'three/webgpu';
import {
  Fn, If, color, hash, instanceIndex, instancedArray, max, mix, mod,
  step, uint, uv, vec3, vec4, sin, cos, smoothstep, time
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

    p.assign(vec3(r1, r2, r3).sub(0.5).mul(params.boundsSize.mul(0.9)));
    v.assign(vec3(r4, r5, r6).sub(0.5).mul(5.0));
  })().compute(count).setName('Initialize Particles');

  const updateParticles = Fn(() => {
    const p = positionBuffer.element(instanceIndex);
    const v = velocityBuffer.element(instanceIndex);

    const dt = params.dt.mul(params.timeScale);
    const force = vec3(0.0).toVar();

    const toCenter = params.attractor.sub(p);
    const dist = max(toCenter.length(), 0.1);
    const dir = toCenter.div(dist);

    // 1. TENSIÓN MAGNÉTICA (Atrae fuerte, pero es asimétrica)
    const tensionForce = dir.mul(params.tensionStrength).div(dist.mul(0.2).add(1.0)).mul(params.tensionEnabled);
    force.addAssign(tensionForce);

    // 2. BURBUJA (Empuje cerca del centro para que no colapsen)
    const bubblePush = smoothstep(3.0, 0.0, dist).mul(params.bubbleStrength).mul(params.bubbleEnabled);
    force.addAssign(dir.mul(bubblePush).mul(-1.0));

    // 3. TURBULENCIA DE FLUIDOS (Movimiento caótico)
    const t = time.mul(3.0);
    const fluidX = sin(p.y.mul(1.5).add(t)).mul(cos(p.z.mul(1.5).add(t)));
    const fluidY = sin(p.z.mul(1.5).add(t)).mul(cos(p.x.mul(1.5).add(t)));
    const fluidZ = sin(p.x.mul(1.5).add(t)).mul(cos(p.y.mul(1.5).add(t)));
    force.addAssign(vec3(fluidX, fluidY, fluidZ).mul(params.fluidStrength).mul(params.fluidEnabled));

    // Fricción base
    force.addAssign(v.mul(-0.1));

    // INTEGRACIÓN
    v.addAssign(force.mul(dt));
    const speed = v.length();
    If(speed.greaterThan(params.maxSpeed), () => v.assign(v.normalize().mul(params.maxSpeed)));
    p.addAssign(v.mul(dt));

    // Mantener dentro del espacio
    const distFromCenter = p.length();
    If(distFromCenter.greaterThan(params.boundsSize), () => p.assign(p.normalize().mul(params.boundsSize)));
  })().compute(count).setName('Update Particles');

  const material = new THREE.SpriteNodeMaterial({
    blending: THREE.AdditiveBlending, depthWrite: false, transparent: true
  });

  material.positionNode = positionBuffer.toAttribute();
  
  const distToCenter = positionBuffer.toAttribute().sub(params.attractor).length();
  // Brillo según cercanía al centro
  const coreProximity = distToCenter.div(params.boundsSize).clamp(0.0, 1.0).oneMinus();
  const speedAttr = velocityBuffer.toAttribute().length();
  const speedNorm = speedAttr.div(params.maxSpeed).clamp(0.0, 1.0);

  material.scaleNode = params.particleSize.mul(coreProximity.mul(4.0).add(1.0)).mul(speedNorm.mul(1.0).add(0.5));

  material.colorNode = Fn(() => {
    const deepPurple = color('#1A0033');
    const magenta = color('#FF007F');
    const white = color('#FFFFFF');
    // Color según la cercanía al centro
    const mix1 = mix(deepPurple, magenta, coreProximity.mul(2.0).clamp(0.0, 1.0));
    const finalRGB = mix(mix1, white, coreProximity.sub(0.5).mul(2.0).clamp(0.0, 1.0));
    return vec4(finalRGB, 1.0);
  })();

  material.opacityNode = smoothstep(0.5, 0.0, uv().xy.sub(0.5).length()).mul(params.globalOpacity);

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