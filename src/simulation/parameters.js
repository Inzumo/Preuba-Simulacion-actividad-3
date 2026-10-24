import * as THREE from 'three/webgpu';
import { uniform } from 'three/tsl';

export function createParameters() {
  return {
    dt: uniform(1 / 60),
    timeScale: uniform(1.0),
    initialSpeed: uniform(2.0),
    maxSpeed: uniform(12.0),
    boundsSize: uniform(20.0),
    particleSize: uniform(0.03),
    globalOpacity: uniform(1.0),

    // NUEVAS FUERZAS (Nada del profe)
    // 1. Fuerza de Vórtice Central (Remolino gravitacional)
    vortexEnabled: uniform(1.0),
    vortexStrength: uniform(15.0),

    // 2. Fuerza de Resonancia (Ondas de choque que empujan desde el centro)
    pulseEnabled: uniform(0.0),
    pulseStrength: uniform(0.0),

    // 3. Fuerza de Turbulencia Magnética
    turbEnabled: uniform(0.0),
    turbStrength: uniform(4.0),

    // Atractor (El núcleo de la estrella de neutrones)
    attractor: uniform(new THREE.Vector3(0.0, 0.0, 0.0))
  };
}