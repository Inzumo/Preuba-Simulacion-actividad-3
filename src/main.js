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
  let savedRadialStrength = params.radialStrength.value;
  let savedRadialEnabled = params.radialEnabled.value;

  // ============================================================
  // PRESETS - SIN RESET
  // ============================================================
  const applyPreset = (id) => {
    // Desactivar todo
    params.windEnabled.value = 0;
    params.radialEnabled.value = 0;
    params.vortexEnabled.value = 0;
    params.dragEnabled.value = 1;
    params.dragCoefficient.value = 0.08;
    params.windX.value = 0;
    params.windY.value = 0;
    params.initialSpeed.value = 0.35;

    if (id === 'inertia') {
      params.dragCoefficient.value = 0.02;
    } else if (id === 'wind') {
      params.windEnabled.value = 1;
      params.windX.value = 2.0;
    } else if (id === 'attract') {
      params.radialEnabled.value = 1;
      params.radialStrength.value = 3.5;
    } else if (id === 'repel') {
      params.radialEnabled.value = 1;
      params.radialStrength.value = -4.0;
    } else if (id === 'vortex') {
      params.radialEnabled.value = 1;
      params.radialStrength.value = 1.5;
      params.vortexEnabled.value = 1;
      params.vortexStrength.value = 4.0;
    }

    if (panel) panel.refresh();
    
    // Feedback visual
    hud.style.color = '#00d4ff';
    setTimeout(() => { hud.style.color = ''; }, 200);
  };

  const setMode = (next) => {
    mode = next;
    const lab = mode === 'LAB';
    if (panel) panel.setVisible(lab);
    axes.visible = lab;
    attractorHelper.visible = lab;

    hud.innerHTML = lab
      ? '🧪 LAB · P: Performance · R: Reset · 1-5: Presets'
      : '🎵 PERFORMANCE · P: Lab · SPACE: Invertir radial · Mouse: Atractor';
  };

  panel = createLabPanel({
    params,
    onReset: () => {
      simulation.reset();
      hud.style.color = '#ffb35a';
      setTimeout(() => { hud.style.color = ''; }, 300);
    },
    onPreset: applyPreset,
    onModeChange: () => setMode(mode === 'LAB' ? 'PERFORMANCE' : 'LAB'),
    onPauseChange: () => { paused = !paused; }
  });

  const hud = document.createElement('div');
  hud.className = 'hud';
  hud.style.cssText = `
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    color: rgba(255,255,255,0.8);
    font-family: monospace;
    font-size: 13px;
    text-align: center;
    pointer-events: none;
    text-shadow: 0 0 20px rgba(0,0,0,0.9);
    z-index: 10;
    background: rgba(0,0,0,0.4);
    padding: 8px 20px;
    border-radius: 20px;
    backdrop-filter: blur(8px);
    border: 1px solid rgba(255,255,255,0.05);
    transition: color 0.2s;
  `;
  document.body.append(hud);
  setMode('LAB');

  // ============================================================
  // TECLADO
  // ============================================================
  addEventListener('keydown', (event) => {
    if (event.repeat) return;

    if (event.code === 'KeyP') {
      setMode(mode === 'LAB' ? 'PERFORMANCE' : 'LAB');
    }
    if (event.code === 'KeyR') {
      simulation.reset();
      hud.style.color = '#ffb35a';
      setTimeout(() => { hud.style.color = ''; }, 300);
    }

    if (event.code === 'Digit1') applyPreset('inertia');
    if (event.code === 'Digit2') applyPreset('wind');
    if (event.code === 'Digit3') applyPreset('attract');
    if (event.code === 'Digit4') applyPreset('repel');
    if (event.code === 'Digit5') applyPreset('vortex');

    if (event.code === 'Space') {
      event.preventDefault();
      savedRadialStrength = params.radialStrength.value;
      savedRadialEnabled = params.radialEnabled.value;
      params.radialEnabled.value = 1;
      params.radialStrength.value = -(Math.abs(savedRadialStrength) || 3.0);
      hud.style.color = '#ff6b6b';
    }
  });

  addEventListener('keyup', (event) => {
    if (event.code === 'Space') {
      params.radialEnabled.value = savedRadialEnabled;
      params.radialStrength.value = savedRadialStrength;
      hud.style.color = '';
    }
  });

  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

  simulation.reset();

  renderer.setAnimationLoop(() => {
    if (!paused) simulation.stepSimulation();
    orbit.update();
    renderer.render(scene, camera);
  });
}

main().catch((error) => {
  console.error(error);
  const pre = document.createElement('pre');
  pre.style.cssText = 'position:fixed;inset:16px;white-space:pre-wrap;color:#fff;z-index:50;background:#1a1a2e;padding:20px;border-radius:8px;overflow:auto;max-height:80vh;';
  pre.textContent = String(error?.stack || error);
  document.body.append(pre);
});
