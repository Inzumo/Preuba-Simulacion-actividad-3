import * as THREE from 'three/webgpu';
import {
  Fn, If, color, hash, instanceIndex, instancedArray, max, mix, mod,
  step, uint, uv, vec3, vec4, sin, cos, smoothstep
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

    // Partículas más esparcidas por toda la pantalla
    p.assign(vec3(r1, r2, r3).sub(0.5).mul(params.boundsSize.mul(1.2)));
    v.assign(vec3(r4, r5, r6).sub(0.5).mul(params.initialSpeed));
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

    // INTEGRACIÓN
    v.addAssign(force.mul(dt));
    const speed = v.length();
    If(speed.greaterThan(params.maxSpeed), () => v.assign(v.normalize().mul(params.maxSpeed)));
    p.addAssign(v.mul(dt));

    const half = params.boundsSize.mul(0.5);
    p.assign(mod(p.add(half), params.boundsSize).sub(half));
  })().compute(count).setName('Update Particles');

  // RENDER: Estética de Fuego Cósmico (Sin blanco puro)
  const material = new THREE.SpriteNodeMaterial({
    blending: THREE.AdditiveBlending, depthWrite: false, transparent: true
  });

  material.positionNode = positionBuffer.toAttribute();
  
  const speedAttr = velocityBuffer.toAttribute().length();
  const speedNorm = speedAttr.div(params.maxSpeed).clamp(0.0, 1.0);
  
  // El tamaño crece con la velocidad, pero de forma controlada
  material.scaleNode = params.particleSize.mul(speedNorm.mul(2.5).add(0.8));

  material.colorNode = Fn(() => {
    // Paleta inmersiva y elegante
    const deepBlue = color('#0A0033');   // Azul Zafiro (Lento)
    const purple = color('#4B0082');     // Púrpura Real
    const magenta = color('#FF007F');    // Magenta Vibrante
    const orange = color('#FF5500');     // Naranja Atardecer (Rápido)

    // Mezcla escalonada
    const mix1 = mix(deepBlue, purple, speedNorm.mul(2.0).clamp(0.0, 1.0));
    const mix2 = mix(mix1, magenta, speedNorm.sub(0.4).mul(2.0).clamp(0.0, 1.0));
    const finalRGB = mix(mix2, orange, speedNorm.sub(0.8).mul(5.0).clamp(0.0, 1.0));
    
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