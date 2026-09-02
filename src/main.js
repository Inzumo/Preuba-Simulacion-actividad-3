// ============================================================
// MAIN - PUNTO DE ENTRADA DEL INSTRUMENTO
// ============================================================
// ARQUITECTURA:
//   1. Escena + Cámara + Renderizador (Three.js)
//   2. Simulación (GPU Compute)
//   3. Controles (mouse, teclado, panel UI)
//   4. Modos: LAB (pruebas) y PERFORMANCE (interpretación)
// ============================================================

import * as THREE from 'three/webgpu';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import WebGPU from 'three/addons/capabilities/WebGPU.js';
import './styles.css';

import { createParameters } from './simulation/parameters.js';
import { createSimulation } from './simulation/createSimulation.js';
import { createLabPanel } from './ui/labPanel.js';

// ============================================================
// CONFIGURACIÓN
// ============================================================
// Número de partículas: 2^17 = 131,072
// Aumentar solo después de medir rendimiento.
// ============================================================

const PARTICLE_COUNT = 131072; // 2^17

// ============================================================
// FUNCIÓN PRINCIPAL
// ============================================================

async function main() {
  const mount = document.querySelector('#app');

  // Verificar soporte de WebGPU
  if (!WebGPU.isAvailable()) {
    mount.appendChild(WebGPU.getErrorMessage());
    throw new Error('Este proyecto requiere WebGPU para ejecutar compute shaders.');
  }

  // ------------------------------------------------------------
  // 1. ESCENA + CÁMARA + RENDERIZADOR (Three.js mental model)
  // ------------------------------------------------------------

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#050607'); // Fondo oscuro

  const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.05, 100);
  camera.position.set(0, 0, 11);

  const renderer = new THREE.WebGPURenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  mount.appendChild(renderer.domElement);
  await renderer.init();

  // Controles de órbita (para mover la cámara)
  const orbit = new OrbitControls(camera, renderer.domElement);
  orbit.enableDamping = true;
  orbit.target.set(0, 0, 0);

  // ------------------------------------------------------------
  // 2. PARÁMETROS + SIMULACIÓN
  // ------------------------------------------------------------

  const params = createParameters();
  const simulation = createSimulation({
    renderer,
    scene,
    params,
    count: PARTICLE_COUNT
  });

  // ------------------------------------------------------------
  // 3. HERRAMIENTAS DE LABORATORIO
  // ------------------------------------------------------------

  // Atractor visual (esfera blanca en la posición del mouse)
  const attractorHelper = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 16, 12),
    new THREE.MeshBasicMaterial({ color: '#ffffff' })
  );
  scene.add(attractorHelper);

  // Ejes de referencia
  const axes = new THREE.AxesHelper(1.5);
  scene.add(axes);

  // ------------------------------------------------------------
  // 4. INTERACCIÓN CON EL MOUSE
  // ------------------------------------------------------------
  // Convertir coordenadas de pantalla → posición en el plano Z=0
  // ------------------------------------------------------------

  const pointerNdc = new THREE.Vector2();   // Coordenadas normalizadas (-1 a 1)
  const raycaster = new THREE.Raycaster();  // Rayo desde la cámara
  const interactionPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const hit = new THREE.Vector3();

  addEventListener('pointermove', (event) => {
    pointerNdc.x = (event.clientX / innerWidth) * 2 - 1;
    pointerNdc.y = -(event.clientY / innerHeight) * 2 + 1;

    raycaster.setFromCamera(pointerNdc, camera);
    if (raycaster.ray.intersectPlane(interactionPlane, hit)) {
      params.attractor.value.copy(hit);
      attractorHelper.position.copy(hit);
    }
  });

  // ------------------------------------------------------------
  // 5. ESTADO DE LA APLICACIÓN
  // ------------------------------------------------------------

  let paused = false;
  let mode = 'LAB'; // 'LAB' | 'PERFORMANCE'

  // Valores guardados para la inversión de la fuerza radial (Space)
  let savedRadialStrength = params.radialStrength.value;
  let savedRadialEnabled = params.radialEnabled.value;

  // Panel de control (UI)
  let panel;

  // ------------------------------------------------------------
  // 6. PRESETS DE LABORATORIO (Escenarios 1-5)
  // ------------------------------------------------------------

  const applyPreset = (id) => {
    // Resetear todas las fuerzas
    params.windEnabled.value = 0;
    params.radialEnabled.value = 0;
    params.vortexEnabled.value = 0;
    params.dragEnabled.value = 0;
    params.wind.value.set(0, 0, 0);
    params.initialSpeed.value = 0;

    // Escenario 1: INERCIA
    //   Sin fuerzas, velocidad inicial ≠ 0
    if (id === 'inertia') {
      params.initialSpeed.value = 0.8;
    }

    // Escenario 2: VIENTO (Fuerza constante +X)
    else if (id === 'wind') {
      params.windEnabled.value = 1;
      params.wind.value.set(1.5, 0, 0);
    }

    // Escenario 3: ATRACCIÓN (k > 0)
    else if (id === 'attract') {
      params.radialEnabled.value = 1;
      params.radialStrength.value = 3.0;
    }

    // Escenario 4: REPULSIÓN (k < 0)
    else if (id === 'repel') {
      params.radialEnabled.value = 1;
      params.radialStrength.value = -3.0;
    }

    // Escenario 5: VÓRTICE (Radial + Tangencial)
    else if (id === 'vortex') {
      params.radialEnabled.value = 1;
      params.radialStrength.value = 1.0;
      params.vortexEnabled.value = 1;
      params.vortexStrength.value = 3.0;
      params.dragEnabled.value = 1;
      params.dragCoefficient.value = 0.08;
    }

    simulation.reset();
    panel?.refresh();
  };

  // ------------------------------------------------------------
  // 7. CAMBIO DE MODO (LAB ↔ PERFORMANCE)
  // ------------------------------------------------------------

  const setMode = (next) => {
    mode = next;
    const lab = mode === 'LAB';

    panel.setVisible(lab);
    axes.visible = lab;
    attractorHelper.visible = lab;

    // HUD (información en pantalla)
    hud.innerHTML = lab
      ? '🧪 <strong>LAB</strong> · P: Performance · R: Reset · 1-5: Presets'
      : '🎵 <strong>PERFORMANCE</strong> · P: Lab · SPACE: Invertir radial · Mouse: Atractor';
  };

  // ------------------------------------------------------------
  // 8. PANEL DE CONTROL (UI)
  // ------------------------------------------------------------

  panel = createLabPanel({
    params,
    onReset: () => simulation.reset(),
    onPreset: applyPreset,
    onModeChange: () => setMode(mode === 'LAB' ? 'PERFORMANCE' : 'LAB'),
    onPauseChange: () => paused = !paused
  });

  // HUD (Head-Up Display)
  const hud = document.createElement('div');
  hud.className = 'hud';
  document.body.append(hud);
  setMode('LAB');

  // ------------------------------------------------------------
  // 9. CONTROLES DE TECLADO
  // ------------------------------------------------------------

  addEventListener('keydown', (event) => {
    if (event.repeat) return;

    // Cambiar modo (P)
    if (event.code === 'KeyP') {
      setMode(mode === 'LAB' ? 'PERFORMANCE' : 'LAB');
    }

    // Reset (R)
    if (event.code === 'KeyR') {
      simulation.reset();
      // Feedback visual: flash rápido
      hud.style.color = '#ffb35a';
      setTimeout(() => hud.style.color = '', 200);
    }

    // Presets (1-5)
    if (event.code === 'Digit1') applyPreset('inertia');
    if (event.code === 'Digit2') applyPreset('wind');
    if (event.code === 'Digit3') applyPreset('attract');
    if (event.code === 'Digit4') applyPreset('repel');
    if (event.code === 'Digit5') applyPreset('vortex');

    // ==========================================================
    // CONTROL CLAVE: BARRA ESPACIADORA
    // ==========================================================
    // Invierte la fuerza radial (atracción ↔ repulsión)
    // Mantener presionado = repulsión, soltar = vuelve a atracción
    // ==========================================================
    if (event.code === 'Space') {
      event.preventDefault();

      // Guardar estado actual
      savedRadialStrength = params.radialStrength.value;
      savedRadialEnabled = params.radialEnabled.value;

      // Activar radial y cambiar a repulsión
      params.radialEnabled.value = 1;
      params.radialStrength.value = -(savedRadialStrength || 2.0);

      // Feedback visual
      hud.style.color = '#ff6b6b';
    }
  });

  // Al soltar la barra espaciadora, restaurar el estado original
  addEventListener('keyup', (event) => {
    if (event.code === 'Space') {
      params.radialEnabled.value = savedRadialEnabled;
      params.radialStrength.value = savedRadialStrength;
      hud.style.color = '';
    }
  });

  // ------------------------------------------------------------
  // 10. REDIMENSIONAR VENTANA
  // ------------------------------------------------------------

  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

  // ------------------------------------------------------------
  // 11. INICIALIZAR Y BUCLE DE RENDERIZADO
  // ------------------------------------------------------------

  simulation.reset();

  renderer.setAnimationLoop(() => {
    if (!paused) simulation.stepSimulation();
    orbit.update();
    renderer.render(scene, camera);
  });
}

// ============================================================
// 12. EJECUTAR
// ============================================================

main().catch((error) => {
  console.error(error);
  const pre = document.createElement('pre');
  pre.style.cssText = 'position:fixed;inset:16px;white-space:pre-wrap;color:#fff;z-index:50;background:#1a1a2e;padding:20px;border-radius:8px;';
  pre.textContent = String(error?.stack || error);
  document.body.append(pre);
});
