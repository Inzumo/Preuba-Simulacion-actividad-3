import * as THREE from 'three/webgpu';
import { uniform } from 'three/tsl';

export function createParameters() {
  return {
    dt: uniform(1 / 60),
    timeScale: uniform(1.0),
    maxSpeed: uniform(6.0),
    boundsSize: uniform(15.0), // Más grande para que viajen más
    particleSize: uniform(0.05),
    globalOpacity: uniform(1.0),

    // El corazón del sistema: Agujero Negro
    gravityStrength: uniform(8.0),
    swirlStrength: uniform(3.0),
    eventHorizon: uniform(1.5), // Radio de seguridad para que no colapsen

    // Atractor (posición del agujero negro)
    attractor: uniform(new THREE.Vector3(0.0, 0.0, 0.0))
  };
}