import * as THREE from 'three/webgpu';
import { uniform } from 'three/tsl';

export function createParameters() {
  return {
    // Tiempo / integración
    dt: uniform(1 / 60),
    timeScale: uniform(1.0),

    // Estado inicial
    initialSpeed: uniform(0.35),
    maxSpeed: uniform(6.0),
    boundsSize: uniform(10.0),
    particleSize: uniform(0.035),

    // Fuerza 1: viento / fuerza constante
    windEnabled: uniform(0.0),
    wind: uniform(new THREE.Vector3(0.0, 0.0, 0.0)),

    // Fuerza 2: radial hacia el atractor
    radialEnabled: uniform(1.0),
    attractor: uniform(new THREE.Vector3(0.0, 0.0, 0.0)),
    radialStrength: uniform(2.2),
    softening: uniform(0.35),

    // Fuerza 3: vórtice tangencial alrededor de Z
    vortexEnabled: uniform(1.0),
    vortexStrength: uniform(1.4),

    // Fuerza 4: drag lineal
    dragEnabled: uniform(1.0),
    dragCoefficient: uniform(0.12),

    // Fuerza 5 (propia): espiral logarítmica
    // Combina radial con tangencial dependiente de r.
    // Con +1 → se enrosca hacia adentro. Con -1 → hacia afuera.
    spiralEnabled: uniform(0.0),
    spiralStrength: uniform(1.6),
    spiralDirection: uniform(1.0)
  };
}