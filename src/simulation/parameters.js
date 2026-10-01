import * as THREE from 'three/webgpu';
import { uniform } from 'three/tsl';

// Uniforms son valores CPU que TSL expone a la GPU.
// Cambiar .value NO reconstruye el compute shader.
export function createParameters() {
  return {
    // --- Tiempo e integración ---
    dt: uniform(1 / 60),
    timeScale: uniform(1.0),

    // --- Estado inicial ---
    initialSpeed: uniform(0.0),      // LAB lo sube en preset "inertia"
    maxSpeed: uniform(8.0),
    boundsSize: uniform(12.0),
    particleSize: uniform(0.02),

    // --- Fuerza 1: viento / constante ---
    windEnabled: uniform(1.0),
    wind: uniform(new THREE.Vector3(0.0, 0.0, 0.0)),

    // --- Fuerza 2: radial multi-foco (8 atractores) ---
    // Array de uniforms vec3 independientes → WGSL los reconoce uno por uno.
    attractors: Array.from({ length: 8 }, () => uniform(new THREE.Vector3())),
    radialEnabled: uniform(1.0),
    radialStrength: uniform(0.35),
    softening: uniform(0.2),

    // --- Fuerza 3: vórtice ---
    vortexEnabled: uniform(1.0),
    vortexStrength: uniform(0.15),

    // --- Fuerza 4: drag lineal ---
    dragEnabled: uniform(1.0),
    dragCoefficient: uniform(0.22)
  };
}
