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

    const toCenter = params.attractor.sub(p);
    const dist = max(toCenter.length(), 0.1);
    const dir = toCenter.div(dist);
    const zAxis = vec3(0.0, 0.0, 1.0);
    
    // 1. VÓRTICE CENTRAL (Obliga a orbitar)
    const tangent = zAxis.cross(dir);
    force.addAssign(tangent.mul(params.vortexStrength).mul(params.vortexEnabled).div(dist.mul(0.2).add(1.0)));

    // 2. FUERZA DE RESONANCIA (Ondas que empujan hacia afuera desde el centro)
    // Usamos el tiempo para crear anillos de choque
    const wave = sin(dist.mul(2.0).sub(time.mul(10.0)));
    const pulsePush = dir.mul(wave).mul(params.pulseStrength).mul(params.pulseEnabled);
    force.addAssign(pulsePush);

    // 3. TURBULENCIA MAGNÉTICA (Ondas cruzadas)
    const t = time.mul(2.0);
    const turbX = sin(p.y.mul(3.0).add(t)).mul(cos(p.z.mul(2.0).add(t)));
    const turbY = sin(p.z.mul(3.0).add(t)).mul(cos(p.x.mul(2.0).add(t)));
    const turbZ = sin(p.x.mul(3.0).add(t)).mul(cos(p.y.mul(2.0).add(t)));
    force.addAssign(vec3(turbX, turbY, turbZ).mul(params.turbStrength).mul(params.turbEnabled));

    // Fricción base para que no se aceleren al infinito
    force.addAssign(v.mul(-0.05));

    // INTEGRACIÓN
    v.addAssign(force.mul(dt));
    const speed = v.length();
    If(speed.greaterThan(params.maxSpeed), () => v.assign(v.normalize().mul(params.maxSpeed)));
    p.addAssign(v.mul(dt));

    // Contenedor circular
    const distFromCenter = p.length();
    If(distFromCenter.greaterThan(params.boundsSize), () => p.assign(p.normalize().mul(params.boundsSize)));
  })().compute(count).setName('Update Particles');

  // RENDER (Iluminación basada en velocidad, no en el ratón)
  const material = new THREE.SpriteNodeMaterial({
    blending: THREE.AdditiveBlending, depthWrite: false, transparent: true
  });

  material.positionNode = positionBuffer.toAttribute();
  
  const speedAttr = velocityBuffer.toAttribute().length();
  const speedNorm = speedAttr.div(params.maxSpeed).clamp(0.0, 1.0);

  // Tamaño reactivo a la velocidad
  material.scaleNode = params.particleSize.mul(speedNorm.mul(3.0).add(0.5));

  material.colorNode = Fn(() => {
    // Paleta de plasma: Azul profundo (lento) -> Cian (medio) -> Blanco incandescente (rápido)
    const deepBlue = color('#020033');
    const cyan = color('#00FFFF');
    const white = color('#FFFFFF');

    const mix1 = mix(deepBlue, cyan, speedNorm.mul(2.0).clamp(0.0, 1.0));
    const finalRGB = mix(mix1, white, speedNorm.sub(0.5).mul(2.0).clamp(0.0, 1.0));

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