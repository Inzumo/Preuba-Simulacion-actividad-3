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

    p.assign(vec3(r1, r2, r3).sub(0.5).mul(params.boundsSize.mul(0.8)));
    v.assign(vec3(r4, r5, r6).sub(0.5).mul(params.initialSpeed));
  })().compute(count).setName('Initialize Particles');

  const updateParticles = Fn(() => {
    const p = positionBuffer.element(instanceIndex);
    const v = velocityBuffer.element(instanceIndex);

    const dt = params.dt.mul(params.timeScale);
    const force = vec3(0.0).toVar();

    const toAttractor = params.attractor.sub(p);
    const dist = max(toAttractor.length(), params.softening);
    const dir = toAttractor.div(dist);
    const zAxis = vec3(0.0, 0.0, 1.0);
    const tangent = zAxis.cross(dir);

    // 1) VIENTO
    force.addAssign(params.wind.mul(params.windEnabled));

    // 2) RADIAL
    const radialForce = dir.mul(params.radialStrength).div(dist.pow(2)).mul(params.radialEnabled);
    force.addAssign(radialForce);

    // 3) VÓRTICE
    force.addAssign(tangent.mul(params.vortexStrength).mul(params.vortexEnabled));

    // 4) DRAG
    force.addAssign(v.mul(params.dragCoefficient).mul(params.dragEnabled).mul(-1.0));

    // 5) GRAVEDAD AGUJERO NEGRO (Fuerza propia)
    const blackHoleForce = dir.mul(params.gravityStrength).div(dist.mul(0.5).add(1.0)).mul(params.gravityEnabled);
    force.addAssign(blackHoleForce);

    // 6) TURBULENCIA CÓSMICA (Fuerza propia)
    const t = time.mul(1.5);
    const turbX = sin(p.y.mul(2.0).add(t)).mul(cos(p.z.mul(2.0).add(t)));
    const turbY = sin(p.z.mul(2.0).add(t)).mul(cos(p.x.mul(2.0).add(t)));
    const turbZ = sin(p.x.mul(2.0).add(t)).mul(cos(p.y.mul(2.0).add(t)));
    force.addAssign(vec3(turbX, turbY, turbZ).mul(params.turbStrength).mul(params.turbEnabled));

    // ESCUDO (Evita el colapso total en el agujero negro)
    const pushOut = smoothstep(1.5, 0.0, dist).mul(30.0).mul(params.gravityEnabled);
    force.addAssign(dir.mul(pushOut).mul(-1.0));

    // INTEGRACIÓN
    v.addAssign(force.mul(dt));
    const speed = v.length();
    If(speed.greaterThan(params.maxSpeed), () => v.assign(v.normalize().mul(params.maxSpeed)));
    p.addAssign(v.mul(dt));

    const half = params.boundsSize.mul(0.5);
    p.assign(mod(p.add(half), params.boundsSize).sub(half));
  })().compute(count).setName('Update Particles');

  // RENDER (Estilo Galaxia / Fuego)
  const material = new THREE.SpriteNodeMaterial({
    blending: THREE.AdditiveBlending, depthWrite: false, transparent: true
  });

  material.positionNode = positionBuffer.toAttribute();
  
  const distToCenter = positionBuffer.toAttribute().sub(params.attractor).length();
  const coreProximity = distToCenter.div(params.boundsSize).clamp(0.0, 1.0).oneMinus().pow(2.0);
  
  material.scaleNode = params.particleSize.mul(coreProximity.mul(3.0).add(0.5));

  material.colorNode = Fn(() => {
    const deepBlue = color('#050022'); const purple = color('#8A00FF');
    const orange = color('#FF3300'); const white = color('#FFFFFF');
    const mix1 = mix(deepBlue, purple, coreProximity.mul(3.0).clamp(0.0, 1.0));
    const mix2 = mix(mix1, orange, coreProximity.sub(0.33).mul(3.0).clamp(0.0, 1.0));
    const finalRGB = mix(mix2, white, coreProximity.sub(0.66).mul(3.0).clamp(0.0, 1.0));
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