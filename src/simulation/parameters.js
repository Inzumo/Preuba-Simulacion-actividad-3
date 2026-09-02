// ============================================================
// PARÁMETROS DEL SISTEMA DE OLEAJE
// ============================================================
// Enfoque: "Respiración orgánica + ondas de presión"
// Las partículas se mueven como un campo de ondas expansivas
// ============================================================

import * as THREE from 'three/webgpu';
import { uniform } from 'three/tsl';

export function createParameters() {
  return {
    // ==========================================================
    // CONFIGURACIÓN GENERAL
    // ==========================================================
    dt: uniform(1 / 60),
    timeScale: uniform(1.0),
    initialSpeed: uniform(0.2),
    maxSpeed: uniform(4.0),
    boundsSize: uniform(12.0),
    particleSize: uniform(0.04),

    // ==========================================================
    // ONDA DE PRESIÓN (fuerza principal)
    // ==========================================================
    // 📐 F_onda = A * sin(ω*t - k*r) * r̂
    //   Genera ondas expansivas desde el punto de impacto
    // ==========================================================
    waveEnabled: uniform(1.0),
    waveAmplitude: uniform(2.5),      // A - intensidad
    waveFrequency: uniform(1.8),      // ω - velocidad de oscilación
    waveNumber: uniform(0.6),         // k - densidad de ondas
    waveCenter: uniform(new THREE.Vector3(0, 0, 0)),
    waveDecay: uniform(0.3),          // Atenuación con distancia

    // ==========================================================
    // FUERZA DE "RESPIRACIÓN" (pulso global)
    // ==========================================================
    // 📐 F_respiración = B * sin(ωᵣ*t) * r̂_global
    //   Todas las partículas respiran al unísono
    // ==========================================================
    breatheEnabled: uniform(1.0),
    breatheAmplitude: uniform(0.8),
    breatheFrequency: uniform(0.5),   // Lento, como respiración

    // ==========================================================
    // FUERZA DE "REBOTE" (restitución elástica)
    // ==========================================================
    // 📐 F_rebote = -k_elástica * (posición - centro)
    //   Las partículas tienden a volver al centro
    // ==========================================================
    springEnabled: uniform(1.0),
    springStiffness: uniform(0.15),

    // ==========================================================
    // ROZAMIENTO
    // ==========================================================
    dragEnabled: uniform(1.0),
    dragCoefficient: uniform(0.08),

    // ==========================================================
    // RUIDO (caos controlado)
    // ==========================================================
    noiseEnabled: uniform(1.0),
    noiseStrength: uniform(0.4),

    // ==========================================================
    // CONTROLES DEL INTÉRPRETE (modo PERFORMANCE)
    // ==========================================================
    intensity: uniform(1.0),          // Control principal (scroll)
    pulsePhase: uniform(0.0),         // Fase de la respiración
  };
}
