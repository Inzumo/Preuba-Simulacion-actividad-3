// ============================================================
// PARÁMETROS DEL SISTEMA DE FUERZAS
// ============================================================
// Todos los parámetros son "uniformes": valores que viven en la CPU
// pero son accesibles desde el shader de cómputo en la GPU.
// Cambiar .value no recompila el shader.
// ============================================================

import * as THREE from 'three/webgpu';
import { uniform } from 'three/tsl';

export function createParameters() {
  return {
    // ==========================================================
    // CONFIGURACIÓN GENERAL DE LA SIMULACIÓN
    // ==========================================================

    /** Paso de tiempo (segundos por frame). Valor típico: 1/60 */
    dt: uniform(1 / 60),

    /** Escala de tiempo global. 1.0 = tiempo real, >1 = más rápido */
    timeScale: uniform(1.0),

    /** Velocidad inicial de las partículas al resetear */
    initialSpeed: uniform(0.35),

    /** Velocidad máxima permitida (clamp) */
    maxSpeed: uniform(5.0),

    /** Tamaño del espacio de simulación (bounding box) */
    boundsSize: uniform(10.0),

    /** Tamaño de cada partícula en pantalla */
    particleSize: uniform(0.035),

    // ==========================================================
    // FUERZA 1: VIENTO (Fuerza constante)
    // ==========================================================
    // 📐 F = c (vector constante)
    //   Acelera todas las partículas en una dirección fija.
    // ==========================================================

    /** 0 = desactivado, 1 = activado */
    windEnabled: uniform(0.0),

    /** Vector de viento (dirección y magnitud) */
    wind: uniform(new THREE.Vector3(0.0, 0.0, 0.0)),

    // ==========================================================
    // FUERZA 2: RADIAL (Atracción / Repulsión)
    // ==========================================================
    // 📐 F = k * (r̂) / (|r|² + ε²)
    //   k > 0 → Atracción (partículas van al atractor)
    //   k < 0 → Repulsión (partículas huyen del atractor)
    //   ε (softening) evita singularidad cuando r → 0
    // ==========================================================

    /** 0 = desactivado, 1 = activado */
    radialEnabled: uniform(1.0),

    /** Posición del atractor (controlada por el mouse) */
    attractor: uniform(new THREE.Vector3(0.0, 0.0, 0.0)),

    /** Intensidad de la fuerza radial (k). Positivo = atrae, negativo = repele */
    radialStrength: uniform(2.2),

    /** Suavizado (ε). Evita explosiones cuando distancia → 0 */
    softening: uniform(0.35),

    // ==========================================================
    // FUERZA 3: VÓRTICE (Rotación alrededor del atractor)
    // ==========================================================
    // 📐 F = s * (ẑ × r̂)
    //   Genera una componente tangencial alrededor del eje Z.
    //   Crea un efecto de "remolino" o "galaxia".
    // ==========================================================

    /** 0 = desactivado, 1 = activado */
    vortexEnabled: uniform(1.0),

    /** Intensidad del vórtice (s) */
    vortexStrength: uniform(1.4),

    // ==========================================================
    // FUERZA 4: DRAG (Rozamiento / Amortiguamiento)
    // ==========================================================
    // 📐 F = -c * v
    //   Disipa energía progresivamente.
    //   Evita que el sistema se vuelva inestable.
    // ==========================================================

    /** 0 = desactivado, 1 = activado */
    dragEnabled: uniform(1.0),

    /** Coeficiente de rozamiento (c). Mayor valor = más frenado */
    dragCoefficient: uniform(0.12)
  };
}
