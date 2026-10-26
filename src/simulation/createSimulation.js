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

    // Nacen por toda la pantalla
    p.assign(vec3(r1, r2, r3).sub(0.5).mul(params.boundsSize.mul(1.3)));
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

    v.addAssign(force.mul(dt));
    const speed = v.length();
    If(speed.greaterThan(params.maxSpeed), () => v.assign(v.normalize().mul(params.maxSpeed)));
    p.addAssign(v.mul(dt));

    const half = params.boundsSize.mul(0.5);
    p.assign(mod(p.add(half), params.boundsSize).sub(half));
  })().compute(count).setName('Update Particles');

  // RENDER (Visuales ultra mejorados)
  const material = new THREE.SpriteNodeMaterial({
    blending: THREE.AdditiveBlending, depthWrite: false, transparent: true
  });

  material.positionNode = positionBuffer.toAttribute();
  
  const speedAttr = velocityBuffer.toAttribute().length();
  const speedNorm = speedAttr.div(params.maxSpeed).clamp(0.0, 1.0);
  
  // Efecto de estela: Se hacen más grandes y largas al ir rápido
  material.scaleNode = params.particleSize.mul(speedNorm.mul(4.0).add(0.6));

  // Paleta Neón Térmica (Cero blanco puro)
  material.colorNode = Fn(() => {
    const cyan = color('#00FFFF');      // Cian eléctrico (Lento)
    const purple = color('#8A2BE2');    // Púrpura profundo
    const magenta = color('#FF00FF');   // Magenta vibrante
    const red = color('#FF0033');       // Rojo neón (Rápido)

    const mix1 = mix(cyan, purple, speedNorm.mul(2.5).clamp(0.0, 1.0));
    const mix2 = mix(mix1, magenta, speedNorm.sub(0.4).mul(2.5).clamp(0.0, 1.0));
    const finalRGB = mix(mix2, red, speedNorm.sub(0.7).mul(3.0).clamp(0.0, 1.0));
    
    return vec4(finalRGB, 1.0);
  })();

  // Brillo central intenso (Hace que parezcan estrellas y no simples puntos)
  const distToCenterUv = uv().xy.sub(0.5).length();
  // Un núcleo sólido y un halo suave
  const core = smoothstep(0.15, 0.0, distToCenterUv);
  const halo = smoothstep(0.5, 0.2, distToCenterUv).mul(0.4);
  
  material.opacityNode = core.add(halo).mul(params.globalOpacity);

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