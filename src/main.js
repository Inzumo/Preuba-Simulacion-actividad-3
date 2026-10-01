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
    throw new Error('Este proyecto requiere WebGPU para ejecutar compute shaders.');
  }

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#050607');

  const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.05, 100);
  camera.position.set(0, 0, 11);

  const renderer = new THREE.WebGPURenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  mount.appendChild(renderer.domElement);
  await renderer.init();

  const orbit = new OrbitControls(camera, renderer.domElement);
  orbit.enableDamping = true;
  orbit.target.set(0, 0, 0);

  const params = createParameters();
  const simulation = createSimulation({ renderer, scene, params, count: PARTICLE_COUNT });

  // Helpers LAB
  const attractorHelper = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 16, 12),
    new THREE.MeshBasicMaterial({ color: '#ffffff' })
  );
  scene.add(attractorHelper);
  const axes = new THREE.AxesHelper(1.5);
  scene.add(axes);

  // Puntero → mundo
  const pointerNdc = new THREE.Vector2();
  const raycaster = new THREE.Raycaster();
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

  let paused = false;
  let mode = 'LAB';
  let panel;

  // LAB PRESETS (idénticos al profe) -------------------------------------
  const applyPreset = (id) => {
    params.windEnabled.value = 0;
    params.radialEnabled.value = 0;
    params.vortexEnabled.value = 0;
    params.dragEnabled.value = 0;
    params.spiralEnabled.value = 0;
    params.wind.value.set(0, 0, 0);
    params.initialSpeed.value = 0;

    if (id === 'inertia') {
      params.initialSpeed.value = 0.8;
    } else if (id === 'wind') {
      params.windEnabled.value = 1;
      params.wind.value.set(1.5, 0, 0);
    } else if (id === 'attract') {
      params.radialEnabled.value = 1;
      params.radialStrength.value = 3.0;
    } else if (id === 'repel') {
      params.radialEnabled.value = 1;
      params.radialStrength.value = -3.0;
    } else if (id === 'vortex') {
      params.radialEnabled.value = 1;
      params.radialStrength.value = 1.0;
      params.vortexEnabled.value = 1;
      params.vortexStrength.value = 3.0;
      params.dragEnabled.value = 1;
      params.dragCoefficient.value = 0.08;
    } else if (id === 'spiral') {
      // Prueba propia del estudiante
      params.radialEnabled.value = 1;
      params.radialStrength.value = 2.0;
      params.spiralEnabled.value = 1;
      params.spiralStrength.value = 2.5;
      params.spiralDirection.value = 1;
      params.dragEnabled.value = 1;
      params.dragCoefficient.value = 0.05;
    }
    simulation.reset();
    panel?.refresh();
  };

  // PERFORMANCE INSTRUMENT -----------------------------------------------
  const keys = {
    ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false,
    KeyW: false, KeyS: false,
    KeyA: false, KeyD: false,
    KeyQ: false, KeyE: false,
    KeyF: false, KeyG: false
  };

  const perfBase = {
    radialStrength: 1.5,
    spiralStrength: 1.6,
    dragCoefficient: 0.12,
    particleSize: 0.035
  };
  const perfRanges = {
    radialMax: 4.0,
    spiralMax: 4.0,
    dragMin: 0.02,
    dragMax: 0.6,
    sizeMin: 0.005,
    sizeMax: 0.12,
    attractorSpeed: 0.15
  };

  const approach = (current, target, amount = 0.08) =>
    current + (target - current) * amount;

  function updatePerformance() {
    if (mode !== 'PERFORMANCE') return;

    // 1) Atractor se mueve con flechas
    const a = params.attractor.value;
    if (keys.ArrowUp) a.y += perfRanges.attractorSpeed;
    if (keys.ArrowDown) a.y -= perfRanges.attractorSpeed;
    if (keys.ArrowLeft) a.x -= perfRanges.attractorSpeed;
    if (keys.ArrowRight) a.x += perfRanges.attractorSpeed;
    attractorHelper.position.copy(a);

    // 2) Intensidad radial (W/S)
    let radialTarget = perfBase.radialStrength;
    if (keys.KeyW && !keys.KeyS) radialTarget = perfRanges.radialMax;
    else if (keys.KeyS && !keys.KeyW) radialTarget = -perfRanges.radialMax;
    params.radialEnabled.value = 1;
    params.radialStrength.value = approach(params.radialStrength.value, radialTarget, 0.06);

    // 3) Intensidad espiral (A/D)
    let spiralTarget = perfBase.spiralStrength;
    if (keys.KeyA && !keys.KeyD) spiralTarget = perfRanges.spiralMax;
    else if (keys.KeyD && !keys.KeyA) spiralTarget = -perfRanges.spiralMax;
    params.spiralEnabled.value = 1;
    params.spiralStrength.value = approach(params.spiralStrength.value, spiralTarget, 0.07);

    // 4) Drag (Q/E)
    let dragTarget = perfBase.dragCoefficient;
    if (keys.KeyQ && !keys.KeyE) dragTarget = perfRanges.dragMax;
    else if (keys.KeyE && !keys.KeyQ) dragTarget = perfRanges.dragMin;
    params.dragEnabled.value = 1;
    params.dragCoefficient.value = approach(params.dragCoefficient.value, dragTarget, 0.06);

    // 5) Tamaño (F/G)
    if (keys.KeyF) {
      params.particleSize.value = Math.min(perfRanges.sizeMax, params.particleSize.value + 0.001);
      panel?.refresh();
    } else if (keys.KeyG) {
      params.particleSize.value = Math.max(perfRanges.sizeMin, params.particleSize.value - 0.001);
      panel?.refresh();
    }
  }

  function setPerformanceNeutral() {
    params.radialEnabled.value = 1;
    params.vortexEnabled.value = 1;
    params.dragEnabled.value = 1;
    params.spiralEnabled.value = 1;

    params.radialStrength.value = perfBase.radialStrength;
    params.spiralStrength.value = perfBase.spiralStrength;
    params.dragCoefficient.value = perfBase.dragCoefficient;
    params.spiralDirection.value = 1;

    Object.keys(keys).forEach((k) => (keys[k] = false));
  }

  // HUD / MODOS ----------------------------------------------------------
  const hud = document.createElement('div');
  hud.className = 'hud';
  document.body.append(hud);

  const setMode = (next) => {
    mode = next;
    const lab = mode === 'LAB';
    panel.setVisible(lab);
    axes.visible = lab;
    attractorHelper.visible = lab;
    hud.innerHTML = lab
      ? '<strong>LAB</strong> · P: performance · R: reset · 1–5: pruebas · 6: espiral'
      : `<strong>PERFORMANCE</strong><br>
         mouse / flechas · mover atractor<br>
         W/S · tensión radial &nbsp;&nbsp; A/D · espiral<br>
         Q/E · drag &nbsp;&nbsp; F/G · tamaño<br>
         espacio · invertir espiral &nbsp;&nbsp; R · reset &nbsp;&nbsp; P · LAB`;
  };

  panel = createLabPanel({
    params,
    onReset: () => simulation.reset(),
    onPreset: applyPreset,
    onModeChange: () => setMode(mode === 'LAB' ? 'PERFORMANCE' : 'LAB'),
    onPauseChange: () => (paused = !paused)
  });

  setMode('LAB');

  // TECLADO --------------------------------------------------------------
  addEventListener('keydown', (event) => {
    if (event.code in keys) {
      keys[event.code] = true;
      event.preventDefault();
      return;
    }

    if (event.code === 'KeyP') {
      setMode(mode === 'LAB' ? 'PERFORMANCE' : 'LAB');
      if (mode === 'PERFORMANCE') setPerformanceNeutral();
      return;
    }

    if (event.code === 'KeyR') {
      simulation.reset();
      if (mode === 'PERFORMANCE') setPerformanceNeutral();
      return;
    }

    if (event.code === 'Space') {
      event.preventDefault();
      // Invierte el sentido de la espiral
      params.spiralDirection.value = -params.spiralDirection.value;
      return;
    }

    if (mode === 'LAB' && !event.repeat) {
      if (event.code === 'Digit1') applyPreset('inertia');
      if (event.code === 'Digit2') applyPreset('wind');
      if (event.code === 'Digit3') applyPreset('attract');
      if (event.code === 'Digit4') applyPreset('repel');
      if (event.code === 'Digit5') applyPreset('vortex');
      if (event.code === 'Digit6') applyPreset('spiral');
    }
  });

  addEventListener('keyup', (event) => {
    if (event.code in keys) {
      keys[event.code] = false;
      event.preventDefault();
    }
  });

  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

  simulation.reset();

  renderer.setAnimationLoop(() => {
    if (!paused) {
      updatePerformance();
      simulation.stepSimulation();
    }
    orbit.update();
    renderer.render(scene, camera);
  });
}

main().catch((error) => {
  console.error(error);
  const pre = document.createElement('pre');
  pre.style.cssText = 'position:fixed;inset:16px;white-space:pre-wrap;color:#fff;z-index:50';
  pre.textContent = String(error?.stack || error);
  document.body.append(pre);
});