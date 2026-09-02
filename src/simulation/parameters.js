// ============================================================
// PARÁMETROS DEL SISTEMA DE OLEAJE
// ============================================================

import * as THREE from 'three/webgpu';
import { uniform } from 'three/tsl';

export function createParameters() {
  // Todos los parámetros son uniformes TSL
  const params = {
    // Configuración general
    dt: uniform(1 / 60),
    timeScale: uniform(1.0),
    initialSpeed: uniform(0.2),
    maxSpeed: uniform(4.0),
    boundsSize: uniform(12.0),
    particleSize: uniform(0.04),

    // Onda de presión
    waveEnabled: uniform(1.0),
    waveAmplitude: uniform(2.5),
    waveFrequency: uniform(1.8),
    waveNumber: uniform(0.6),
    waveCenter: uniform(new THREE.Vector3(0, 0, 0)),
    waveDecay: uniform(0.3),

    // Respiración
    breatheEnabled: uniform(1.0),
    breatheAmplitude: uniform(0.8),
    breatheFrequency: uniform(0.5),

    // Resorte
    springEnabled: uniform(1.0),
    springStiffness: uniform(0.15),

    // Drag
    dragEnabled: uniform(1.0),
    dragCoefficient: uniform(0.08),

    // Ruido
    noiseEnabled: uniform(1.0),
    noiseStrength: uniform(0.4),

    // Control de intensidad
    intensity: uniform(1.0),
  };

  // Guardar referencia a los valores originales para reset
  params._defaults = {
    waveAmplitude: 2.5,
    breatheAmplitude: 0.8,
    springStiffness: 0.15,
    dragCoefficient: 0.08,
    noiseStrength: 0.4,
    intensity: 1.0,
  };

  return params;
}
