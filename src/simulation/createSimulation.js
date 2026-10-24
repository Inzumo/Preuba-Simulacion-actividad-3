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
  smoothstep
} from 'three/tsl';

export function createSimulation({ renderer, scene, params, count = 131072 }) {
  const positionBuffer = instancedArray(count, 'vec3');
  const velocityBuffer = instancedArray(count, 'vec3');

  const initParticles = Fn(() => {
    const i = instanceIndex;
    const p = positionBuffer.element(i);
    const v = velocityBuffer.element(i);

    // Nacen en los bordes del espacio (lejos del centro)
    const angle = hash(i.add(uint(13))).mul(Math.PI * 2.0);
    const radius = hash(i.add(uint(23))).mul(params.boundsSize.mul(0.5));
    const height = hash(i.add(uint(37))).sub(0.5).mul(4.0);
    
    p.assign(vec3(cos(angle).mul(radius), height, sin(angle).mul(radius)));
    // Nacen girando
    v.assign(vec3(sin(angle).mul(2.0), 0.0, cos(angle).mul(2.0)));
  })().compute(count).setName('Initialize Particles');

  const updateParticles = Fn(() => {
    const p = positionBuffer.element(instanceIndex);
    const v = velocityBuffer.element(instanceIndex);

    const dt = params.dt.mul(params.timeScale);
    const force = vec3(0.0).toVar();

    // 1) GRAVEDAD DEL AGUJERO NEGRO
    const toCenter = params.attractor.sub(p);
    const dist = max(toCenter.length(), 0.1);
    const dir = toCenter.div(dist);
    
    // Fuerza inversamente proporcional a la distancia
    const gravityForce = dir.mul(params.gravityStrength).div(dist.mul(0.5).add(1.0));
    force.addAssign(gravityForce);

    // 2) FUERZA DE TORBELLINO (Swirl) - Hace que giren alrededor
    const zAxis = vec3(0.0, 1.0, 0.0); // Giran en el eje Y
    const tangent = zAxis.cross(dir);
    force.addAssign(tangent.mul(params.swirlStrength).div(dist.mul(0.3).add(1.0)));

    // 3) ESCUDO (Para que no colapsen en el centro)
    // Si la distancia es menor al "event horizon", empujamos hacia afuera
    const pushOut = smoothstep(params.eventHorizon, 0.0, dist).mul(20.0);
    force.addAssign(dir.mul(pushOut).mul(-1.0));

    // INTEGRACIÓN
    v.addAssign(force.mul(dt));

    // Límite de velocidad
    const speed = v.length();
    If(speed.greaterThan(params.maxSpeed), () => {
      v.assign(v.normalize().mul(params.maxSpeed));
    });

    p.addAssign(v.mul(dt));

    // Frontera infinita circular
    const distFromCenter = p.length();
    If(distFromCenter.greaterThan(params.boundsSize), () => {
       p.assign(p.normalize().mul(params.boundsSize));
    });
  })().compute(count).setName('Update Particles');

  // RENDER - FUEGO Y GALAXIA
  const material = new THREE.SpriteNodeMaterial({
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true
  });

  material.positionNode = positionBuffer.toAttribute();
  
  // Calcular distancia al centro para el color y tamaño
  const distToCenter = positionBuffer.toAttribute().sub(params.attractor).length();
  // Normalizar la distancia (1 = lejos, 0 = centro)
  const distNorm = distToCenter.div(params.boundsSize).clamp(0.0, 1.0);
  // Invertir: 1 = centro, 0 = lejos
  const coreProximity = distNorm.oneMinus().pow(3.0); 

  // Tamaño: Las del centro son gigantes, las de afuera son polvo
  material.scaleNode = params.particleSize.mul(coreProximity.mul(4.0).add(0.5));

  material.colorNode = Fn(() => {
    // Paleta térmica
    const deepBlue = color('#0A0030'); // Polvo espacial
    const purple = color('#6A00FF');   // Nebulosa
    const orange = color('#FF3300');   // Fuego
    const white = color('#FFFFFF');    // Núcleo incandescente

    const lowToMid = mix(deepBlue, purple, coreProximity.mul(3.0).clamp(0.0, 1.0));
    const midToHigh = mix(lowToMid, orange, coreProximity.sub(0.33).mul(3.0).clamp(0.0, 1.0));
    const finalRGB = mix(midToHigh, white, coreProximity.sub(0.66).mul(3.0).clamp(0.0, 1.0));

    return vec4(finalRGB, 1.0);
  })();

  // Brillo en el centro (forma de estrella)
  const distToCenterUv = uv().xy.sub(0.5).length();
  const alpha = smoothstep(0.5, 0.0, distToCenterUv).mul(params.globalOpacity);
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