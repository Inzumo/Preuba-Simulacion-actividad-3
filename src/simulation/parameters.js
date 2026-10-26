import * as THREE from 'three/webgpu';
import { uniform } from 'three/tsl';

export function createParameters() {
  return {
    dt: uniform(1 / 60),
    timeScale: uniform(1.0),
    maxSpeed: uniform(15.0),
    boundsSize: uniform(20.0),
    particleSize: uniform(0.04),
    globalOpacity: uniform(1.0),

    attractor: uniform(new THREE.Vector3(0.0, 0.0, 0.0)),

    // 1. Inercia
    initialSpeed: uniform(0.0),

    // 2. Viento (Fuerza Constante)
    windEnabled: uniform(0.0),
    windStrength: uniform(8.0),

    // 3. Radial (Atracción/Repulsión)
    radialEnabled: uniform(0.0),
    radialStrength: uniform(12.0),

    // 4. Vórtice
    vortexEnabled: uniform(0.0),
    vortexStrength: uniform(10.0),

    // 5. Drag (Fricción)
    dragEnabled: uniform(1.0),
    dragCoefficient: uniform(0.08)
  };
}