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
  vec4
} from 'three/tsl';

export function createSimulation({ renderer, scene, params, count = 300000 }) {
  // STATE -----------------------------------------------------------------
  // Cada partícula guarda posición y velocidad. Viven en GPU storage.
  const positionBuffer = instancedArray(count, 'vec3');
  const velocityBuffer = instancedArray(count, 'vec3');

  // INITIALIZATION --------------------------------------------------------
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

    p.assign(vec3(r1, r2, r3).sub(0.5).mul(params.boundsSize.mul(0.45)));
    v.assign(vec3(r4, r5, r6).sub(0.5).mul(params.initialSpeed));
  })().compute(count).setName('Initialize Particles');

  // UPDATE / COMPUTE SHADER ----------------------------------------------
  // estado → fuerzas → aceleración → velocidad → posición
  const updateParticles = Fn(() => {
    const p = positionBuffer.element(instanceIndex);
    const v = velocityBuffer.element(instanceIndex);

    const dt = params.dt.mul(params.timeScale);
    const force = vec3(0.0).toVar();

    // 1) VIENTO / FUERZA CONSTANTE  F = c
    force.addAssign(params.wind.mul(params.windEnabled));

    // 2) RADIAL MULTI-FOCO (8 atractores)  F = k * (A - p) / |A - p|^3
    // Sumamos la contribución de cada foco. Suavizado con "softening".
    const totalRadialForce = vec3(0.0).toVar();

    for (let i = 0; i < 8; i++) {
      const attractorPos = params.attractors[i];
      const toAttractor = attractorPos.sub(p);
      const distance = max(toAttractor.length(), params.softening);
      const radialDirection = toAttractor.div(distance);

      const f = radialDirection
        .mul(params.radialStrength)
        .div(distance.pow(2));

      totalRadialForce.addAssign(f);
    }

    force.addAssign(totalRadialForce.mul(params.radialEnabled));

    // 3) VÓRTICE  F = k * (z × r̂)
    // Tangente al eje Z respecto al atractor primario (foco 0).
    const primaryDir = params.attractors[0].sub(p).normalize();
    const zAxis = vec3(0.0, 0.0, 1.0);
    const tangent = zAxis.cross(primaryDir);
    force.addAssign(tangent.mul(params.vortexStrength).mul(params.vortexEnabled));

    // 4) DRAG LINEAL  F = -c v
    force.addAssign(v.mul(params.dragCoefficient).mul(params.dragEnabled).mul(-1.0));

    // INTEGRACIÓN Euler semiimplícito (masa unitaria: a = F)
    v.addAssign(force.mul(dt));

    const speed = v.length();
    If(speed.greaterThan(params.maxSpeed), () => {
      v.assign(v.normalize().mul(params.maxSpeed));
    });

    p.addAssign(v.mul(dt));

    // Fronteras periódicas: lo que sale por un lado entra por el opuesto.
    const half = params.boundsSize.mul(0.5);
    p.assign(mod(p.add(half), params.boundsSize).sub(half));
  })().compute(count).setName('Update Particles');

  // RENDER ---------------------------------------------------------------
  const material = new THREE.SpriteNodeMaterial({
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true
  });

  material.positionNode = positionBuffer.toAttribute();
  material.scaleNode = params.particleSize;

  // Magnitud de velocidad → color (paleta de 3 puntos)
  const velAttr = velocityBuffer.toAttribute();
  const speed = velAttr.length();
  const t = speed.div(params.maxSpeed).clamp(0.0, 1.0);

  const cobaltBlue = color('#0047ab'); // lento
  const purple     = color('#7a1fa0'); // medio
  const crimsonRed = color('#d12e2e'); // rápido

  const lowToMid  = mix(cobaltBlue, purple, t.mul(2.0).clamp(0.0, 1.0));
  const midToHigh = mix(purple, crimsonRed, t.sub(0.5).mul(2.0).clamp(0.0, 1.0));
  const finalRGB  = mix(lowToMid, midToHigh, step(0.5, t));

  material.colorNode = vec4(finalRGB, 1.0);

  // Máscara circular para evitar sprites cuadrados visibles.
  material.opacityNode = step(uv().xy.sub(0.5).length(), 0.5);

  const geometry = new THREE.PlaneGeometry(1, 1);
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  mesh.frustumCulled = false;
  scene.add(mesh);

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
    // Nota: los storage buffers de instancedArray se liberan con el renderer.
  }

  return {
    count,
    positionBuffer,
    velocityBuffer,
    reset,
    stepSimulation,
    dispose
  };
}
