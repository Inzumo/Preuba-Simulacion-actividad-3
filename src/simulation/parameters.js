import * as THREE from 'three/webgpu';
import { uniform } from 'three/tsl';

export function createParameters() {
  return {
    dt: uniform(1 / 60),
    timeScale: uniform(1.0),
    initialSpeed: uniform(0.0),
    maxSpeed: uniform(8.0),
    boundsSize: uniform(12.0),
    particleSize: uniform(0.02),
    windEnabled: uniform(1.0),
    wind: uniform(new THREE.Vector3(0.0, 0.0, 0.0)),
    attractors: Array.from({ length: 8 }, () => uniform(new THREE.Vector3())),
    radialEnabled: uniform(1.0),
    radialStrength: uniform(0.35),
    softening: uniform(0.2),
    vortexEnabled: uniform(1.0),
    vortexStrength: uniform(0.15),
    dragEnabled: uniform(1.0),
    dragCoefficient: uniform(0.22)
  };
}