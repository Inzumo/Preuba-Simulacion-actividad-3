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

    // Nacen esparcidas
    p.assign(vec3(r1, r2, r3).sub(0.5).mul(params.boundsSize.mul(0.9)));
    v.assign(vec3(r4, r5, r6).sub(0.5).mul(2.0));
  })().compute(count).setName('Initialize Particles');

  const updateParticles = Fn(() => {
    const p = positionBuffer.element(instanceIndex);
    const v = velocityBuffer.element(instanceIndex);

    const dt = params.dt.mul(params.timeScale);
    const force = vec3(0.0).toVar();

    const toCenter = params.attractor.sub(p);
    const dist = max(toCenter.length(), 0.1);
    const dir = toCenter.div(dist);

    // 1. TENSIÓN MAGNÉTICA (Atracción al núcleo)
    const tensionForce = dir.mul(params.tensionStrength).div(dist.mul(0.2).add(1.0)).mul(params.tensionEnabled);
    force.addAssign(tensionForce);

    // 2. VIENTO ESTELAR (Empuje lateral)
    const windDir = vec3(1.0, 0.5, 0.0).normalize();
    force.addAssign(windDir.mul(params.windStrength).mul(params.windEnabled));

    // 3. TURBULENCIA DE FLUIDOS (Caos)
    const t = time.mul(2.0);
    const turbX = sin(p.y.mul(1.5).add(t)).mul(cos(p.z.mul(1.5).add(t)));
    const turbY = sin(p.z.mul(1.5).add(t)).mul(cos(p.x.mul(1.5).add(t)));
    const turbZ = sin(p.x.mul(1.5).add(t)).mul(cos(p.y.mul(1.5).add(t)));
    force.addAssign(vec3(turbX, turbY, turbZ).mul(params.turbStrength).mul(params.turbEnabled));

    // Fricción base para mantener estabilidad
    force.addAssign(v.mul(-0.05));

    // INTEGRACIÓN
    v.addAssign(force.mul(dt));
    
    // Límite de velocidad
    const speed = v.length();
    If(speed.greaterThan(params.maxSpeed), () => v.assign(v.normalize().mul(params.maxSpeed)));
    
    p.addAssign(v.mul(dt));

    // Frontera esférica
    const distFromCenter = p.length();
    If(distFromCenter.greaterThan(params.boundsSize), () => p.assign(p.normalize().mul(params.boundsSize)));
  })().compute(count).setName('Update Particles');

  // RENDER: Estética de Neón y Fuego (Sin ratón)
  const material = new THREE.SpriteNodeMaterial({
    blending: THREE.AdditiveBlending, depthWrite: false, transparent: true
  });

  material.positionNode = positionBuffer.toAttribute();
  
  // Calculamos qué tan lejos está del centro (0 = centro, 1 = borde)
  const distToCenter = positionBuffer.toAttribute().sub(params.attractor).length();
  const coreProximity = distToCenter.div(params.boundsSize).clamp(0.0, 1.0).oneMinus();
  
  // Calculamos la velocidad
  const speedAttr = velocityBuffer.toAttribute().length();
  const speedNorm = speedAttr.div(params.maxSpeed).clamp(0.0, 1.0);

  // TAMAÑO: Las partículas se hacen gigantes si van rápido o están cerca del centro
  material.scaleNode = params.particleSize.mul(coreProximity.mul(3.0).add(1.0)).mul(speedNorm.mul(2.0).add(0.5));

  // COLOR: Núcleo Blanco -> Naranja -> Magenta -> Azul Profundo (según velocidad y centro)
  material.colorNode = Fn(() => {
    const deepBlue = color('#050022');
    const magenta = color('#FF007F');
    const orange = color('#FF5500');
    const white = color('#FFFFFF');

    // Si van rápido, brillan más
    const mix1 = mix(deepBlue, magenta, speedNorm.mul(2.0).clamp(0.0, 1.0));
    const mix2 = mix(mix1, orange, coreProximity.mul(2.0).clamp(0.0, 1.0));
    const finalRGB = mix(mix2, white, coreProximity.mul(speedNorm).mul(4.0).clamp(0.0, 1.0));

    return vec4(finalRGB, 1.0);
  })();

  // Forma circular suave y brillante
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