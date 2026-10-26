import * as THREE from 'three/webgpu';
import { uniform } from 'three/tsl';

export function createParameters() {
  return {
    dt: uniform(1 / 60),
    timeScale: uniform(1.0),
    maxSpeed: uniform(18.0),
    boundsSize: uniform(22.0),
    particleSize: uniform(0.06), // Partículas más grandes
    globalOpacity: uniform(1.0),

    attractor: uniform(new THREE.Vector3(0.0, 0.0, 0.0)),
    initialSpeed: uniform(0.0),

    windEnabled: uniform(1.0),
    windStrength: uniform(8.0),

    radialEnabled: uniform(1.0),
    radialStrength: uniform(12.0),

    vortexEnabled: uniform(1.0),
    vortexStrength: uniform(10.0),

    dragEnabled: uniform(1.0),
    dragCoefficient: uniform(0.08)
  };
}