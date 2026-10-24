import * as THREE from 'three/webgpu';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import WebGPU from 'three/addons/capabilities/WebGPU.js';
import './styles.css';

import { createParameters } from './simulation/parameters.js';
import { createSimulation } from './simulation/createSimulation.js';
import { createLabPanel } from './ui/labPanel.js';

const PARTICLE_COUNT = 131072;
const FADE_OUT_MS = 120;
const HOLD_MS = 60;
const FADE_IN_MS = 120;

async function main() {
  const mount = document.querySelector('#app');
  if (!WebGPU.isAvailable()) {
    mount.appendChild(WebGPU.getErrorMessage());
    throw new Error('Requiere WebGPU.');
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

  const attractorHelper = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 16, 12),
    new THREE.MeshBasicMaterial({ color: '#ffffff' })
  );
  scene.add(attractorHelper);
  const axes = new THREE.AxesHelper(1.5);
  scene.add(axes);

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
  let transitionId = 0;

  function applyPresetValues(id) {
    params.springEnabled.value = 0;
    params.turbEnabled.value = 0;
    params.dragEnabled.value = 0;
    params.initialSpeed.value = 0;

    if (id === 'inertia') {
      params.initialSpeed.value = 1.5;
    } else if (id === 'spring') {
      params.springEnabled.value = 1;
      params.springStrength.value = 5.0;
      params.dragEnabled.value = 1;
      params.dragCoefficient.value = 0.08;
    } else if (id === 'turb') {
      params.turbEnabled.value = 1;
      params.turbStrength.value = 3.5;
    } else if (id === 'chaos') {
      params.springEnabled.value = 1;
      params.springStrength.value = 2.0;
      params.turbEnabled.value = 1;
      params.turbStrength.value = 2.5;
      params.dragEnabled.value = 1;
      params.dragCoefficient.value = 0.05;
    }
  }

  function applyPreset(id) {
    const myId = ++transitionId;
    const startOpacity = params.globalOpacity.value;
    const t0 = performance.now();

    const fadeOut = () => {
      if (myId !== transitionId) return;
      const e = performance.now() - t0;
      const t = Math.min(e / FADE_OUT_MS, 1);
      params.globalOpacity.value = startOpacity * (1 - t);
      if (t < 1) requestAnimationFrame(fadeOut);
      else {
        applyPresetValues(id);
        simulation.reset();
        const t1 = performance.now();
        const fadeIn = () => {
          if (myId !== transitionId) return;
          const e2 = performance.now() - t1;
          const tt = Math.min(e2 / FADE_IN_MS, 1);
          params.globalOpacity.value = tt;
          if (tt < 1) requestAnimationFrame(fadeIn);
          else params.globalOpacity.value = 1;
        };
        setTimeout(() => requestAnimationFrame(fadeIn), HOLD_MS);
      }
    };
    requestAnimationFrame(fadeOut);
    panel?.refresh();
  }

  const keys = {
    KeyW: false, KeyS: false, KeyA: false, KeyD: false, KeyQ: false, KeyE: false
  };

  function updatePerformance() {
    if (mode !== 'PERFORMANCE') return;

    let springTarget = 3.0;
    if (keys.KeyW && !keys.KeyS) springTarget = 10.0;
    else if (keys.KeyS && !keys.KeyW) springTarget = 0.0;
    params.springEnabled.value = 1;
    params.springStrength.value += (springTarget - params.springStrength.value) * 0.1;

    let turbTarget = 1.5;
    if (keys.KeyA && !keys.KeyD) turbTarget = 8.0;
    else if (keys.KeyD && !keys.KeyA) turbTarget = 0.0;
    params.turbEnabled.value = 1;
    params.turbStrength.value += (turbTarget - params.turbStrength.value) * 0.1;

    let dragTarget = 0.1;
    if (keys.KeyQ && !keys.KeyE) dragTarget = 0.5;
    else if (keys.KeyE && !keys.KeyQ) dragTarget = 0.01;
    params.dragEnabled.value = 1;
    params.dragCoefficient.value += (dragTarget - params.dragCoefficient.value) * 0.1;
  }

  function setPerformanceNeutral() {
    params.springEnabled.value = 1;
    params.turbEnabled.value = 1;
    params.dragEnabled.value = 1;
    params.springStrength.value = 3.0;
    params.turbStrength.value = 1.5;
    params.dragCoefficient.value = 0.1;
    Object.keys(keys).forEach((k) => (keys[k] = false));
  }

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
      ? '<strong>LAB</strong> · P: performance · R: reset · 1–4: pruebas'
      : `<strong>PERFORMANCE</strong><br>
         mouse · mover atractor<br>
         W/S · fuerza elástica &nbsp;&nbsp; A/D · turbulencia<br>
         Q/E · fricción &nbsp;&nbsp; R · reset &nbsp;&nbsp; P · LAB`;
  };

  panel = createLabPanel({
    params,
    onReset: () => applyPreset('inertia'),
    onPreset: applyPreset,
    onModeChange: () => setMode(mode === 'LAB' ? 'PERFORMANCE' : 'LAB'),
    onPauseChange: () => (paused = !paused)
  });

  setMode('LAB');

  // 🔥 AQUÍ ESTÁ EL CAMBIO CLAVE: Quitamos la restricción mode === 'LAB'
  addEventListener('keydown', (event) => {
    // Previene que el navegador haga scroll si usas flechas o espacio
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
      event.preventDefault();
    }

    if (event.code in keys) {
      keys[event.code] = true;
      return;
    }

    // Cambio de modo
    if (event.code === 'KeyP') {
      setMode(mode === 'LAB' ? 'PERFORMANCE' : 'LAB');
      if (mode === 'PERFORMANCE') setPerformanceNeutral();
      return;
    }

    // Reset
    if (event.code === 'KeyR') {
      applyPreset(mode === 'LAB' ? 'inertia' : 'chaos');
      return;
    }

    // Números para las pruebas (funcionan SIEMPRE, estés en LAB o PERFORMANCE)
    if (!event.repeat) {
      if (event.code === 'Digit1') applyPreset('inertia');
      if (event.code === 'Digit2') applyPreset('spring');
      if (event.code === 'Digit3') applyPreset('turb');
      if (event.code === 'Digit4') applyPreset('chaos');
    }
  });

  addEventListener('keyup', (event) => {
    if (event.code in keys) {
      keys[event.code] = false;
    }
  });

  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

  // Aseguramos que la ventana tenga el foco para capturar las teclas
  window.focus();

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