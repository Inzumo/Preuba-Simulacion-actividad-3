import * as THREE from 'three/webgpu';
import { uniform } from 'three/tsl';

export function createParameters() {
  return {
    dt: uniform(1 / 60),
    timeScale: uniform(1.0),
    initialSpeed: uniform(0.0),
    maxSpeed: uniform(10.0), // Más velocidad para los golpes de fuerza
    boundsSize: uniform(16.0),
    particleSize: uniform(0.04),
    globalOpacity: uniform(1.0),

    // Fuerzas base
    windEnabled: uniform(0.0),
    wind: uniform(new THREE.Vector3(0.0, 0.0, 0.0)),

    radialEnabled: uniform(0.0),
    attractor: uniform(new THREE.Vector3(0.0, 0.0, 0.0)),
    radialStrength: uniform(2.0),
    softening: uniform(0.5),

    vortexEnabled: uniform(0.0),
    vortexStrength: uniform(2.0),

    dragEnabled: uniform(1.0),
    dragCoefficient: uniform(0.1),

    // Agujero Negro
    gravityEnabled: uniform(0.0),
    gravityStrength: uniform(10.0),
    
    // Turbulencia
    turbEnabled: uniform(0.0),
    turbStrength: uniform(3.0)
  };
}