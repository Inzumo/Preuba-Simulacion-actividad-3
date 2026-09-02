import * as THREE from 'three/webgpu';
import {
  Fn,
  If,
  color,
  hash,
  instanceIndex,
  instancedArray,
  max,
  min,
  mix,
  mod,
  step,
  uint,
  uv,
  vec3,
  vec4,
  sin,
  cos,
  time
} from 'three/tsl';

export function createSimulation({ renderer, scene, params, count = 131072 }) {
  const positionBuffer = instancedArray(count, 'vec3');
  const velocityBuffer = instancedArray(count, 'vec3');

  // ============================================================
  // INICIALIZACIÓN - Distribución en espiral
  // ============================================================
  const initParticles = Fn(() => {
    const i = instanceIndex;
    const p = positionBuffer.element(i);
    const v = velocityBuffer.element(i);

    const r1 = hash(i.add(uint(11)));
    const r2 = hash(i.add(uint(23)));
    const r3 = hash(i.add(uint(37)));
    const r4 = hash(i.add(uint(53)));

    // Distribución en espiral/globo
    const radius = r1.mul(4.0).add(0.2);
    const theta = r2.mul(6.2832).mul(3.0);
    const phi = r3.mul(3.14159);

    p.assign(vec3(
      radius.mul(sin(phi)).mul(cos(theta)),
      radius.mul(sin(phi)).mul(sin(theta)),
      radius.mul(cos(phi))
    ));

    // Velocidad tangencial inicial (movimiento orbital)
    const speed = 0.5 + r4.mul(0.5);
    v.assign(vec3(
      -p.y.mul(speed),
      p.x.mul(speed),
      r4.sub(0.5).mul(0.3)
    ));
  })().compute(count).setName('init');

  // ============================================================
  // UPDATE - CON RUIDO PERMANENTE
  // ============================================================
  const updateParticles = Fn(() => {
    const p = positionBuffer.element(instanceIndex);
    const v = velocityBuffer.element(instanceIndex);

    const dt = params.dt.mul(params.timeScale);
    const force = vec3(0.0).toVar();

    // ============================================================
    // RUIDO PERMANENTE - Siempre activo para movimiento continuo
    // ============================================================
    const noiseSeed = instanceIndex.add(uint(time.mul(50).toInt()));
    const n1 = hash(noiseSeed.add(uint(7)));
    const n2 = hash(noiseSeed.add(uint(13)));
    const n3 = hash(noiseSeed.add(uint(19)));
    
    const noise = vec3(n1, n2, n3).sub(0.5).mul(2.0);
    const noiseStrength = 0.15; // Siempre presente
    force.addAssign(noise.mul(noiseStrength));

    // ============================================================
    // OSCILACIÓN SUTIL - Efecto "respiración"
    // ============================================================
    const breathe = sin(time.mul(0.3).add(instanceIndex.mul(0.001)));
    const breatheForce = p.normalize().mul(breathe.mul(0.05));
    force.addAssign(breatheForce);

    // ============================================================
    // VIENTO
    // ============================================================
    const windVec = vec3(params.windX, params.windY, 0.0);
    force.addAssign(windVec.mul(params.windEnabled));

    // ============================================================
    // RADIAL
    // ============================================================
    const toAttractor = params.attractor.sub(p);
    const distance = max(toAttractor.length(), params.softening);
    const radialDirection = toAttractor.div(distance);
    const radialForce = radialDirection
      .mul(params.radialStrength)
      .div(distance.pow(2).add(0.5))
      .mul(params.radialEnabled);
    force.addAssign(radialForce);

    // ============================================================
    // VÓRTICE - Con efecto de espiral
    // ============================================================
    const zAxis = vec3(0.0, 0.0, 1.0);
    const tangent = zAxis.cross(radialDirection);
    // El vórtice es más fuerte cerca del centro
    const vortexFalloff = max(1.0, distance.mul(0.3));
    force.addAssign(
      tangent
        .mul(params.vortexStrength)
        .mul(params.vortexEnabled)
        .div(vortexFalloff)
    );

    // ============================================================
    // DRAG
    // ============================================================
    force.addAssign(v.mul(params.dragCoefficient).mul(params.dragEnabled).mul(-1.0));

    // ============================================================
    // INTEGRACIÓN
    // ============================================================
    v.addAssign(force.mul(dt));

    const speed = v.length();
    If(speed.greaterThan(params.maxSpeed), () => {
      v.assign(v.normalize().mul(params.maxSpeed));
    });

    p.addAssign(v.mul(dt));

    // ============================================================
    // BORDES - Wrap con efecto "curvatura"
    // ============================================================
    const half = params.boundsSize.mul(0.5);
    p.assign(mod(p.add(half), params.boundsSize).sub(half));
  })().compute(count).setName('update');

  // ============================================================
  // RENDER - Con efecto de "brillo pulsante"
  // ============================================================
  const material = new THREE.SpriteNodeMaterial({
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true
  });

  material.positionNode = positionBuffer.toAttribute();
  
  // Tamaño dinámico - respira y varía con velocidad
  material.scaleNode = Fn(() => {
    const baseSize = params.particleSize;
    const speed = velocityBuffer.toAttribute().length();
    const breathe = sin(time.mul(0.5).add(instanceIndex.mul(0.005))).mul(0.3).add(1.0);
    const speedBoost = speed.div(2.0).add(1.0);
    return baseSize.mul(breathe).mul(speedBoost);
  })();

  // Color dinámico con más variedad
  material.colorNode = Fn(() => {
    const speed = velocityBuffer.toAttribute().length();
    const t = speed.div(params.maxSpeed).clamp(0.0, 1.0);
    
    // Más colores para más dinamismo
    const c1 = color('#0a0a2e'); // Azul profundo
    const c2 = color('#00d4ff'); // Cian
    const c3 = color('#7c3aed'); // Violeta
    const c4 = color('#ec4899'); // Rosa
    const c5 = color('#f59e0b'); // Ámbar
    const c6 = color('#ff6b6b'); // Rojo
    
    let finalColor;
    If(t.lessThan(0.2), () => {
      finalColor = mix(c1, c2, t.div(0.2));
    });
    If(t.greaterThan(0.2).and(t.lessThan(0.4)), () => {
      finalColor = mix(c2, c3, t.sub(0.2).div(0.2));
    });
    If(t.greaterThan(0.4).and(t.lessThan(0.6)), () => {
      finalColor = mix(c3, c4, t.sub(0.4).div(0.2));
    });
    If(t.greaterThan(0.6).and(t.lessThan(0.8)), () => {
      finalColor = mix(c4, c5, t.sub(0.6).div(0.2));
    });
    If(t.greaterThan(0.8), () => {
      finalColor = mix(c5, c6, t.sub(0.8).div(0.2));
    });

    // Brillo pulsante
    const pulse = sin(time.mul(0.8)).mul(0.1).add(0.9);
    return vec4(finalColor, pulse);
  })();

  // Máscara circular suave
  material.opacityNode = Fn(() => {
    const dist = uv().xy.sub(0.5).length();
    return step(dist, 0.5).mul(float(1.0).sub(dist.mul(0.5)));
  })();

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
