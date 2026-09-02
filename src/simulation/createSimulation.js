// ============================================================
// SIMULACIÓN DE PARTÍCULAS CON GPU COMPUTE
// ============================================================
// ARQUITECTURA:
//   1. ESTADO      → positionBuffer, velocityBuffer
//   2. INICIALIZACIÓN → distribución aleatoria de partículas
//   3. FUERZAS     → wind, radial, vortex, drag
//   4. INTEGRACIÓN → Euler semi-implicito (v → p)
//   5. RENDER      → InstancedMesh con SpriteNodeMaterial
// ============================================================

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

export function createSimulation({ renderer, scene, params, count = 131072 }) {
  // ============================================================
  // 1. ESTADO - Buffers en GPU
  // ============================================================
  // Cada partícula tiene:
  //   - posición (vec3) → positionBuffer
  //   - velocidad (vec3) → velocityBuffer
  // Estos buffers viven en memoria GPU para acceso paralelo.
  // ============================================================

  const positionBuffer = instancedArray(count, 'vec3');
  const velocityBuffer = instancedArray(count, 'vec3');

  // ============================================================
  // 2. INICIALIZACIÓN - Distribución aleatoria
  // ============================================================
  // Se ejecuta en paralelo para todas las partículas.
  // Usa hash para generar números pseudo-aleatorios.
  // ============================================================

  const initParticles = Fn(() => {
    const i = instanceIndex;
    const p = positionBuffer.element(i);
    const v = velocityBuffer.element(i);

    // Semillas para hash (números primos para evitar correlación)
    const r1 = hash(i.add(uint(11)));
    const r2 = hash(i.add(uint(23)));
    const r3 = hash(i.add(uint(37)));
    const r4 = hash(i.add(uint(53)));
    const r5 = hash(i.add(uint(71)));
    const r6 = hash(i.add(uint(89)));

    // Posición: distribución uniforme en el espacio [-bounds/2, bounds/2]
    p.assign(vec3(r1, r2, r3).sub(0.5).mul(params.boundsSize.mul(0.45)));

    // Velocidad: distribución uniforme en todas las direcciones
    v.assign(vec3(r4, r5, r6).sub(0.5).mul(params.initialSpeed));
  })().compute(count).setName('Initialize Particles');

  // ============================================================
  // 3. UPDATE - Cálculo de fuerzas e integración
  // ============================================================
  // Este es el CORAZÓN CONCEPTUAL del proyecto:
  //   estado → fuerzas → aceleración → velocidad → posición
  // ============================================================

  const updateParticles = Fn(() => {
    const p = positionBuffer.element(instanceIndex);
    const v = velocityBuffer.element(instanceIndex);

    // Paso de tiempo efectivo
    const dt = params.dt.mul(params.timeScale);

    // Acumulador de fuerzas (F = m*a, con m = 1)
    const force = vec3(0.0).toVar();

    // ----------------------------------------------------------
    // FUERZA 1: VIENTO (Fuerza constante)
    // ----------------------------------------------------------
    // 📐 F_wind = c (vector constante)
    //   Aplica una aceleración constante en una dirección fija.
    // ----------------------------------------------------------
    force.addAssign(params.wind.mul(params.windEnabled));

    // ----------------------------------------------------------
    // FUERZA 2: RADIAL (Atracción / Repulsión)
    // ----------------------------------------------------------
    // 📐 F_radial = k * (r̂) / (|r|² + ε²)
    //   r = attractor - p  (vector desde partícula al atractor)
    //   r̂ = r / |r|        (dirección normalizada)
    //   k > 0 → Atracción   k < 0 → Repulsión
    //   ε → softening (evita singularidad)
    // ----------------------------------------------------------
    const toAttractor = params.attractor.sub(p);
    const distance = max(toAttractor.length(), params.softening);
    const radialDirection = toAttractor.div(distance);
    const radialForce = radialDirection
      .mul(params.radialStrength)
      .div(distance.pow(2))
      .mul(params.radialEnabled);
    force.addAssign(radialForce);

    // ----------------------------------------------------------
    // FUERZA 3: VÓRTICE (Rotación tangencial)
    // ----------------------------------------------------------
    // 📐 F_vortex = s * (ẑ × r̂)
    //   ẑ = eje Z (0,0,1)
    //   r̂ = dirección radial normalizada
    //   El producto cruz genera una componente tangencial.
    // ----------------------------------------------------------
    const zAxis = vec3(0.0, 0.0, 1.0);
    const tangent = zAxis.cross(radialDirection);
    force.addAssign(tangent.mul(params.vortexStrength).mul(params.vortexEnabled));

    // ----------------------------------------------------------
    // FUERZA 4: DRAG (Rozamiento lineal)
    // ----------------------------------------------------------
    // 📐 F_drag = -c * v
    //   c = dragCoefficient
    //   La fuerza se opone a la velocidad (disipación).
    // ----------------------------------------------------------
    force.addAssign(v.mul(params.dragCoefficient).mul(params.dragEnabled).mul(-1.0));

    // ============================================================
    // 4. INTEGRACIÓN - Euler Semi-Implícito
    // ============================================================
    //   v(t+dt) = v(t) + a(t) * dt
    //   p(t+dt) = p(t) + v(t+dt) * dt
    // La velocidad se actualiza ANTES de la posición (más estable).
    // ============================================================

    // Aceleración = Fuerza (masa unitaria)
    v.addAssign(force.mul(dt));

    // Clamp de velocidad máxima (evita inestabilidad numérica)
    const speed = v.length();
    If(speed.greaterThan(params.maxSpeed), () => {
      v.assign(v.normalize().mul(params.maxSpeed));
    });

    // Actualizar posición
    p.addAssign(v.mul(dt));

    // ============================================================
    // 5. CONDICIONES DE BORDE - Periódicas (Wrap-around)
    // ============================================================
    // Las partículas que salen por un lado reaparecen por el otro.
    // Mantiene la densidad constante en el espacio.
    // ============================================================
    const half = params.boundsSize.mul(0.5);
    p.assign(mod(p.add(half), params.boundsSize).sub(half));
  })().compute(count).setName('Update Particles');

  // ============================================================
  // 6. RENDER - Visualización de partículas
  // ============================================================
  // No recalcula la física. Solo consume el estado de la GPU.
  // Usa InstancedMesh para renderizar muchas partículas eficientemente.
  // ============================================================

  const material = new THREE.SpriteNodeMaterial({
    blending: THREE.AdditiveBlending, // Efecto de "brillo" al superponerse
    depthWrite: false,                // Las partículas se dibujan por encima
    transparent: true
  });

  // Posición de cada partícula (leída desde el buffer)
  material.positionNode = positionBuffer.toAttribute();

  // Tamaño de cada partícula
  material.scaleNode = params.particleSize;

  // ============================================================
  // COLOR DINÁMICO - Según velocidad
  // ============================================================
  //   Velocidad baja  → Azul (#46a6ff) - "frío / quieto"
  //   Velocidad media → Magenta / violeta
  //   Velocidad alta  → Naranja (#ffb35a) - "caliente / rápido"
  // ============================================================

  material.colorNode = Fn(() => {
    const speed = velocityBuffer.toAttribute().length();
    const t = speed.div(params.maxSpeed).clamp(0.0, 1.0);

    // Paleta de colores: Azul → Violeta → Naranja
    const slow = color('#46a6ff');   // Azul frío
    const mid = color('#a855f7');    // Púrpura
    const fast = color('#ffb35a');   // Naranja cálido

    // Interpolación con dos puntos de control para más riqueza
    const color1 = mix(slow, mid, t.mul(2.0).clamp(0.0, 1.0));
    const color2 = mix(mid, fast, t.sub(0.5).mul(2.0).clamp(0.0, 1.0));
    const finalColor = mix(color1, color2, step(0.5, t));

    return vec4(finalColor, 1.0);
  })();

  // Máscara circular (evita que se vean cuadrados)
  material.opacityNode = step(uv().xy.sub(0.5).length(), 0.5);

  // Geometría y malla instanciada
  const geometry = new THREE.PlaneGeometry(1, 1);
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  mesh.frustumCulled = false;
  scene.add(mesh);

  // ============================================================
  // 7. API PÚBLICA
  // ============================================================

  /** Reinicia todas las partículas a su estado inicial */
  function reset() {
    renderer.compute(initParticles);
  }

  /** Avanza la simulación un paso (un frame) */
  function stepSimulation() {
    renderer.compute(updateParticles);
  }

  /** Libera recursos de GPU */
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
