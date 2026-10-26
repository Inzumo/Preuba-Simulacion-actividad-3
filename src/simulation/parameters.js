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

    // Fuerzas del Núcleo
    attractor: uniform(new THREE.Vector3(0.0, 0.0, 0.0)),
    
    // 1. Tensión Magnética
    tensionEnabled: uniform(1.0),
    tensionStrength: uniform(8.0),
    
    // 2. Viento Estelar
    windEnabled: uniform(0.0),
    windStrength: uniform(4.0),

    // 3. Turbulencia de Fluidos
    turbEnabled: uniform(0.0),
    turbStrength: uniform(5.0)
  };
}