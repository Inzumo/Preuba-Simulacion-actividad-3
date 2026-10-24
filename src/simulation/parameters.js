import * as THREE from 'three/webgpu';
import { uniform } from 'three/tsl';

export function createParameters() {
  return {
    dt: uniform(1 / 60),
    timeScale: uniform(1.0),
    maxSpeed: uniform(15.0),
    boundsSize: uniform(25.0), // Espacio más grande
    particleSize: uniform(0.04),
    globalOpacity: uniform(1.0),

    // 1. TENSIÓN MAGNÉTICA (Atracción asimétrica)
    tensionEnabled: uniform(1.0),
    tensionStrength: uniform(12.0),
    
    // 2. FUERZA DE BURBUJA (Empuje desde el centro)
    bubbleEnabled: uniform(1.0),
    bubbleStrength: uniform(8.0),

    // 3. TURBULENCIA DE FLUIDOS
    fluidEnabled: uniform(0.0),
    fluidStrength: uniform(5.0),

    // Centro del colapso
    attractor: uniform(new THREE.Vector3(0.0, 0.0, 0.0))
  };
}