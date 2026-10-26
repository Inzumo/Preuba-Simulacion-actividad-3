import * as THREE from 'three/webgpu';
import WebGPU from 'three/addons/capabilities/WebGPU.js';
import './styles.css';
import { createParameters } from './simulation/parameters.js';
import { createSimulation } from './simulation/createSimulation.js';
import { createLabPanel } from './ui/labPanel.js';

async function main() {
  const mount = document.querySelector('#app');
  if (!WebGPU.isAvailable()) throw new Error('Requiere WebGPU.');

  const scene = new THREE.Scene(); scene.background = new THREE.Color('#020005');
  const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.05, 100);
  camera.position.set(0, 0, 25); camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGPURenderer({ antialias: true });
  renderer.setSize(innerWidth, innerHeight); mount.appendChild(renderer.domElement);
  await renderer.init();

  const params = createParameters();
  const simulation = createSimulation({ renderer, scene, params });

  let mode = 'LAB', panel;
  const hud = document.createElement('div'); hud.className = 'hud'; document.body.append(hud);

  // Las 4 pruebas base para el LAB
  const applyPreset = (id) => {
    params.tensionEnabled.value = 0; params.windEnabled.value = 0; params.turbEnabled.value = 0;
    if (id === '1') { params.tensionEnabled.value = 1; params.tensionStrength.value = 15.0; }
    if (id === '2') { params.windEnabled.value = 1; params.windStrength.value = 6.0; }
    if (id === '3') { params.turbEnabled.value = 1; params.turbStrength.value = 8.0; }
    if (id === '4') { params.tensionEnabled.value = 1; params.windEnabled.value = 1; params.turbEnabled.value = 1; }
    simulation.reset();
  };

  const setMode = (next) => {
    mode = next; panel.setVisible(mode === 'LAB');
    hud.innerHTML = mode === 'LAB' ? 'LAB · 1-4 Pruebas · P: PERFORMANCE' : 'PERFORMANCE · A/D Tensión · Q/E Turbulencia · 1-4 Detonadores';
  };

  panel = createLabPanel({ params, onReset: () => simulation.reset(), onPreset: applyPreset, onModeChange: () => setMode(mode === 'LAB' ? 'PERFORMANCE' : 'LAB') });
  setMode('LAB');

  const keys = { KeyA: false, KeyD: false, KeyQ: false, KeyE: false };
  function updatePerformance() {
    if (mode !== 'PERFORMANCE') return;
    
    // A/D: Aumenta o disminuye la Tensión (Atracción)
    let tt = 8.0; if (keys.KeyA) tt = 30.0; else if (keys.KeyD) tt = 0.0;
    params.tensionStrength.value += (tt - params.tensionStrength.value) * 0.1; params.tensionEnabled.value = 1;

    // Q/E: Aumenta o disminuye la Turbulencia
    let ft = 0.0; if (keys.KeyQ) ft = 20.0; else if (keys.KeyE) ft = 0.0;
    params.turbStrength.value += (ft - params.turbStrength.value) * 0.1; params.turbEnabled.value = 1;
  }

  function triggerForceStrike(id) {
    // 1: Onda de Choque
    if (id === '1') { params.tensionStrength.value = 50.0; setTimeout(() => params.tensionStrength.value = 8.0, 200); }
    // 2: Viento Huracanado
    if (id === '2') { params.windEnabled.value = 1; params.windStrength.value = 30.0; setTimeout(() => params.windStrength.value = 0.0, 300); }
    // 3: Terremoto de Fluidos
    if (id === '3') { params.turbStrength.value = 40.0; params.turbEnabled.value = 1; setTimeout(() => params.turbStrength.value = 0.0, 400); }
    // 4: Big Bang
    if (id === '4') { 
      params.tensionStrength.value = 0.0; params.turbStrength.value = 50.0;
      setTimeout(() => { params.tensionStrength.value = 8.0; params.turbStrength.value = 0.0; }, 500);
    }
  }

  addEventListener('keydown', (e) => {
    if (e.code in keys) { keys[e.code] = true; return; }
    if (e.code === 'KeyP') { setMode(mode === 'LAB' ? 'PERFORMANCE' : 'LAB'); return; }
    if (e.code === 'KeyR') { simulation.reset(); return; }
    
    if (mode === 'LAB') {
      if (e.code === 'Digit1') applyPreset('1'); if (e.code === 'Digit2') applyPreset('2');
      if (e.code === 'Digit3') applyPreset('3'); if (e.code === 'Digit4') applyPreset('4');
    } else {
      if (e.code === 'Digit1') triggerForceStrike('1'); if (e.code === 'Digit2') triggerForceStrike('2');
      if (e.code === 'Digit3') triggerForceStrike('3'); if (e.code === 'Digit4') triggerForceStrike('4');
    }
  });

  addEventListener('keyup', (e) => { if (e.code in keys) keys[e.code] = false; });
  addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

  simulation.reset();
  renderer.setAnimationLoop(() => { updatePerformance(); simulation.stepSimulation(); renderer.render(scene, camera); });
}
main();