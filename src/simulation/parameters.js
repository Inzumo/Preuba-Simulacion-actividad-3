import * as THREE from 'three/webgpu';
import { uniform } from 'three/tsl';

export function createParameters() {
  return {
    dt: uniform(1 / 60),
    timeScale: uniform(1.0),
    initialSpeed: uniform(0.35),
    maxSpeed: uniform(6.0),
    boundsSize: uniform(10.0),
    particleSize: uniform(0.04), // Un poco más grandes para ver el efecto
    globalOpacity: uniform(1.0),

    // Fuerza 1: Muelle (Spring)
    springEnabled: uniform(0.0),
    springStrength: uniform(4.0),
    attractor: uniform(new THREE.Vector3(0.0, 0.0, 0.0)),
    softening: uniform(0.5),

    // Fuerza 2: Turbulencia (Ondas trigonométricas)
    turbEnabled: uniform(0.0),
    turbStrength: uniform(2.5),

    // Drag
    dragEnabled: uniform(1.0),
    dragCoefficient: uniform(0.15)
  };
}