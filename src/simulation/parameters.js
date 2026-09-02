import * as THREE from 'three/webgpu';
import { uniform } from 'three/tsl';

export function createParameters() {
  return {
    // Configuración general
    dt: uniform(1 / 60),
    timeScale: uniform(1.0),
    initialSpeed: uniform(0.35),
    maxSpeed: uniform(5.0),
    boundsSize: uniform(10.0),
    particleSize: uniform(0.035),

    // Viento
    windEnabled: uniform(0.0),
    wind: uniform(new THREE.Vector3(0.0, 0.0, 0.0)),

    // Radial
    radialEnabled: uniform(1.0),
    attractor: uniform(new THREE.Vector3(0.0, 0.0, 0.0)),
    radialStrength: uniform(2.2),
    softening: uniform(0.35),

    // Vórtice
    vortexEnabled: uniform(1.0),
    vortexStrength: uniform(1.4),

    // Drag
    dragEnabled: uniform(1.0),
    dragCoefficient: uniform(0.12)
  };
}
