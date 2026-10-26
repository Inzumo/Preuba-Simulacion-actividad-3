import * as THREE from 'three/webgpu';
import { uniform } from 'three/tsl';

export function createParameters() {
  return {
    dt: uniform(1 / 60),
    timeScale: uniform(1.0),
    maxSpeed: uniform(18.0),

    // Ahora es un vec3 (ancho, alto, profundidad). main.js lo ajusta
    // para que coincida con lo que ve la cámara (ver fitBounds).
    boundsSize: uniform(new THREE.Vector3(100.0, 60.0, 30.0)),

    // Estética
    particleSize: uniform(0.16),   // grosor base de cada partícula
    trailLength: uniform(6.0),     // cuánto se alarga la estela a máxima velocidad
    globalOpacity: uniform(0.55),  // bajo a propósito: el blending aditivo acumula y blanquea

    attractor: uniform(new THREE.Vector3(0.0, 0.0, 0.0)),
    initialSpeed: uniform(0.0),

    windEnabled: uniform(1.0),
    windStrength: uniform(8.0),

    radialEnabled: uniform(1.0),
    radialStrength: uniform(12.0),

    vortexEnabled: uniform(1.0),
    vortexStrength: uniform(10.0),

    dragEnabled: uniform(1.0),
    dragCoefficient: uniform(0.08),

    // 5. TURBULENCIA (fuerza propia)
    // F = A * ( sin(k*y + w*t), sin(k*z + 1.3*w*t + 2.1), sin(k*x + 0.7*w*t + 4.2) )
    turbulenceEnabled: uniform(1.0),
    turbulenceStrength: uniform(0.0), // A: amplitud (0 = fuerza apagada)
    turbulenceScale: uniform(0.15),   // k: rad/unidad; el "tamaño" de los remolinos es ~ 2*pi/k
    turbulenceSpeed: uniform(0.6),    // w: rad/s; qué tan rápido cambia el campo
    simTime: uniform(0.0)             // t: tiempo de simulación, lo avanza stepSimulation
  };
}