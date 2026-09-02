// ============================================================
// MAIN - INSTRUMENTO DE OLEAJE
// ============================================================

import * as THREE from 'three/webgpu';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import WebGPU from 'three/addons/capabilities/WebGPU.js';
import './styles.css';

import { createParameters } from './simulation/parameters.js';
import { createSimulation } from './simulation/createSimulation.js';
import { createLabPanel } from './ui/labPanel.js';

const PARTICLE_COUNT = 131072;

async function main() {
  const mount = document.querySelector('#app');

  if (!WebGPU.isAvailable()) {
    mount.appendChild(WebGPU.getErrorMessage());
    throw new Error('WebGPU no disponible');
  }

  // ============================================================
  // 1. ESCENA
  // ============================================================
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#0a0a12');

  const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.05, 100);
  camera.position.set(0, 0, 14);

  const renderer = new THREE.WebGPURenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  mount.appendChild(renderer.domElement);
  await renderer.init();

  const orbit = new OrbitControls(camera, renderer.domElement);
  orbit.enableDamping = true;
  orbit.target.set(0, 0, 0);

  // ============================================================
  // 2. SIMULACIÓN
  // ============================================================
  const params = createParameters();
  const simulation = createSimulation({
    renderer,
    scene,
    params,
    count: PARTICLE_COUNT
  });

  // ============================================================
  // 3. HERRAMIENTAS LAB
  // ============================================================
  const centerHelper = new THREE.Mesh(
    new THREE.SphereGeometry(0.1, 12, 8),
    new THREE.MeshBasicMaterial({ color: '#00d4ff', transparent: true, opacity: 0.5 })
  );
  scene.add(centerHelper);

  const axes = new THREE.AxesHelper(1.5);
  scene.add(axes);

  // ============================================================
  // 4. INTERACCIÓN
  // ============================================================
  const pointerNdc = new THREE.Vector2();
  const raycaster = new THREE.Raycaster();
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const hit = new THREE.Vector3();

  addEventListener('pointermove', (event) => {
    pointerNdc.x = (event.clientX / innerWidth) * 2 - 1;
    pointerNdc.y = -(event.clientY / innerHeight) * 2 + 1;

    raycaster.setFromCamera(pointerNdc, camera);
    if (raycaster.ray.intersectPlane(plane, hit)) {
      params.waveCenter.value.copy(hit);
      centerHelper.position.copy(hit);
    }
  });

  let pulseTimer = 0;
  addEventListener('pointerdown', () => {
    pulseTimer = 1.0;
  });

  addEventListener('wheel', (event) => {
    event.preventDefault();
    let newIntensity = params.intensity.value + event.deltaY * 0.002;
    newIntensity = Math.max(0.1, Math.min(3.0, newIntensity));
    params.intensity.value = newIntensity;
    updateIntensityDisplay();
  }, { passive: false });

  // ============================================================
  // 5. UI
  // ============================================================
  const hud = document.createElement('div');
  hud.className = 'hud';
  hud.style.cssText = `
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    color: rgba(255,255,255,0.7);
    font-family: monospace;
    font-size: 13px;
    text-align: center;
    pointer-events: none;
    text-shadow: 0 0 20px rgba(0,0,0,0.8);
    z-index: 10;
    letter-spacing: 0.5px;
  `;
  document.body.append(hud);

  const intensityDisplay = document.createElement('div');
  intensityDisplay.style.cssText = `
    position: fixed;
    bottom: 70px;
    left: 50%;
    transform: translateX(-50%);
    color: rgba(255,255,255,0.9);
    font-family: monospace;
    font-size: 18px;
    pointer-events: none;
    z-index: 10;
    text-shadow: 0 0 30px rgba(0,212,255,0.3);
  `;
  document.body.append(intensityDisplay);

  function updateIntensityDisplay() {
    intensityDisplay.textContent = `◈ ${params.intensity.value.toFixed(2)}`;
  }
  updateIntensityDisplay();

  // ============================================================
  // 6. ESTADO
  // ============================================================
  let paused = false;
  let mode = 'LAB';
  let panel;

  // ============================================================
  // 7. PRESETS (corregidos para usar .value correctamente)
  // ============================================================
  const applyPreset = (id) => {
    // Resetear todos los parámetros a valores por defecto
    params.waveEnabled.value = 1;
    params.breatheEnabled.value = 1;
    params.springEnabled.value = 1;
    params.dragEnabled.value = 1;
    params.noiseEnabled.value = 1;
    params.intensity.value = 1.0;

    // Aplicar preset específico
    switch(id) {
      case 'quiet':
        params.waveAmplitude.value = 0.5;
        params.breatheAmplitude.value = 0.3;
        params.springStiffness.value = 0.3;
        params.dragCoefficient.value = 0.15;
        params.noiseStrength.value = 0.2;
        break;
      case 'storm':
        params.waveAmplitude.value = 4.0;
        params.breatheAmplitude.value = 1.5;
        params.springStiffness.value = 0.05;
        params.dragCoefficient.value = 0.03;
        params.noiseStrength.value = 1.0;
        break;
      case 'pulse':
        params.waveAmplitude.value = 2.0;
        params.breatheAmplitude.value = 0.0;
        params.springStiffness.value = 0.2;
        params.dragCoefficient.value = 0.1;
        params.noiseStrength.value = 0.3;
        break;
      case 'chaos':
        params.waveAmplitude.value = 3.0;
        params.breatheAmplitude.value = 1.0;
        params.springStiffness.value = 0.0;
        params.dragCoefficient.value = 0.02;
        params.noiseStrength.value = 1.5;
        break;
      case 'orbit':
        params.waveAmplitude.value = 1.0;
        params.breatheAmplitude.value = 0.0;
        params.springStiffness.value = 0.4;
        params.dragCoefficient.value = 0.05;
        params.noiseStrength.value = 0.1;
        break;
      default:
        break;
    }

    simulation.reset();
    if (panel?.refresh) panel.refresh();
    updateIntensityDisplay();
  };

  // ============================================================
  // 8. MODO
  // ============================================================
  const setMode = (next) => {
    mode = next;
    const lab = mode === 'LAB';
    if (panel?.setVisible) panel.setVisible(lab);
    axes.visible = lab;
    centerHelper.visible = lab;

    hud.innerHTML = lab
      ? '🧪 LAB · P: Performance · R: Reset · 1: Quiet · 2: Storm · 3: Pulse · 4: Chaos · 5: Orbit'
      : '🎵 PERFORMANCE · P: Lab · Click: Onda · Scroll: Intensidad';
  };

  panel = createLabPanel({
    params,
    onReset: () => simulation.reset(),
    onPreset: applyPreset,
    onModeChange: () => setMode(mode === 'LAB' ? 'PERFORMANCE' : 'LAB'),
    onPauseChange: () => paused = !paused
  });

  setMode('LAB');

  // ============================================================
  // 9. TECLADO
  // ============================================================
  addEventListener('keydown', (event) => {
    if (event.repeat) return;

    if (event.code === 'KeyP') {
      setMode(mode === 'LAB' ? 'PERFORMANCE' : 'LAB');
    }
    if (event.code === 'KeyR') {
      simulation.reset();
      hud.style.color = '#ffb35a';
      setTimeout(() => hud.style.color = '', 300);
    }

    if (event.code === 'Digit1') applyPreset('quiet');
    if (event.code === 'Digit2') applyPreset('storm');
    if (event.code === 'Digit3') applyPreset('pulse');
    if (event.code === 'Digit4') applyPreset('chaos');
    if (event.code === 'Digit5') applyPreset('orbit');

    if (event.code === 'Space') {
      event.preventDefault();
      pulseTimer = 0.8;
      let newIntensity = params.intensity.value + 0.5;
      newIntensity = Math.min(3.0, newIntensity);
      params.intensity.value = newIntensity;
      updateIntensityDisplay();
    }
  });

  // ============================================================
  // 10. RESIZE
  // ============================================================
  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

  // ============================================================
  // 11. LOOP
  // ============================================================
  simulation.reset();

  renderer.setAnimationLoop(() => {
    // Pulso del click
    if (pulseTimer > 0.01) {
      const pulseIntensity = pulseTimer * 2.0;
      params.waveAmplitude.value = 2.5 + pulseIntensity;
      pulseTimer *= 0.97;
    } else if (pulseTimer > 0) {
      pulseTimer = 0;
      params.waveAmplitude.value = 2.5;
    }

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
  pre.style.cssText = 'position:fixed;inset:16px;white-space:pre-wrap;color:#fff;z-index:50;background:#1a1a2e;padding:20px;border-radius:8px;overflow:auto;';
  pre.textContent = String(error?.stack || error);
  document.body.append(pre);
});
