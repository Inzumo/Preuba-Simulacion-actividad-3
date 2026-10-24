import * as THREE from 'three/webgpu';
import { uniform } from 'three/tsl';

export function createParameters() {
  return {
    dt: uniform(1 / 60),
    timeScale: uniform(1.0),
    initialSpeed: uniform(0.0),
    maxSpeed: uniform(8.0),
    boundsSize: uniform(16.0),
    particleSize: uniform(0.04),
    globalOpacity: uniform(1.0),

    // 1. Fuerza Constante (Viento)
    windEnabled: uniform(0.0),
    wind: uniform(new THREE.Vector3(0.0, 0.0, 0.0)),

    // 2. Fuerza Radial (Atracción/Repulsión base)
    radialEnabled: uniform(0.0),
    attractor: uniform(new THREE.Vector3(0.0, 0.0, 0.0)),
    radialStrength: uniform(2.0),
    softening: uniform(0.5),

    // 3. Fuerza de Vórtice (Giro base)
    vortexEnabled: uniform(0.0),
    vortexStrength: uniform(2.0),

    // 4. Drag (Fricción)
    dragEnabled: uniform(1.0),
    dragCoefficient: uniform(0.1),

    // 5. FUERZA PROPIA: Gravedad de Agujero Negro (Inversa)
    gravityEnabled: uniform(0.0),
    gravityStrength: uniform(10.0),

    // 6. FUERZA PROPIA: Turbulencia Cósmica
    turbEnabled: uniform(0.0),
    turbStrength: uniform(3.0)
  };
}