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

  // --- SISTEMA DE TRANSICIÓN SUAVE ---
  let currentState = { wind: 0, radial: 0, vortex: 0, initialSpeed: 0 };
  let targetState = { wind: 0, radial: 0, vortex: 0, initialSpeed: 0 };

  function setTargets(w, r, v, i) {
    targetState.wind = w; targetState.radial = r; targetState.vortex = v; targetState.initialSpeed = i;
  }

  // Las 5 pruebas base para el LAB
  const applyPreset = (id) => {
    params.windEnabled.value = 1; params.radialEnabled.value = 1; params.vortexEnabled.value = 1;
    if (id === '1') { setTargets(0, 0, 0, 6.0); } 
    if (id === '2') { setTargets(10.0, 0, 0, 0); } 
    if (id === '3') { setTargets(0, 15.0, 0, 0); } 
    if (id === '4') { setTargets(0, -15.0, 0, 0); } 
    if (id === '5') { setTargets(0, 5.0, 20.0, 0); } 
  };

  const setMode = (next) => {
    mode = next; panel.setVisible(mode === 'LAB');
    hud.innerHTML = mode === 'LAB' 
      ? 'LAB · 1-5 Pruebas · P: PERFORMANCE' 
      : `<strong>PERFORMANCE</strong> · ¡Toca el sistema!<br>W/S: Viento · A/D: Atracción/Repulsión<br>Q/E: Torbellino · 1-4: Explosiones · R: Reiniciar`;
  };

  panel = createLabPanel({ params, onReset: () => simulation.reset(), onPreset: applyPreset, onModeChange: () => setMode(mode === 'LAB' ? 'PERFORMANCE' : 'LAB') });
  setMode('LAB');

  const keys = { KeyW: false, KeyS: false, KeyA: false, KeyD: false, KeyQ: false, KeyE: false };
  
  function updateSmoothTransitions() {
    const lerpSpeed = 0.06;

    currentState.wind += (targetState.wind - currentState.wind) * lerpSpeed;
    params.windStrength.value = currentState.wind;

    currentState.radial += (targetState.radial - currentState.radial) * lerpSpeed;
    params.radialStrength.value = currentState.radial;

    currentState.vortex += (targetState.vortex - currentState.vortex) * lerpSpeed;
    params.vortexStrength.value = currentState.vortex;

    // PERFORMANCE: Control en vivo con el teclado
    if (mode === 'PERFORMANCE') {
      // W/S: Viento (+X / -X)
      if (keys.KeyW) targetState.wind = 30.0;
      else if (keys.KeyS) targetState.wind = -30.0;
      else targetState.wind = 0.0;

      // A/D: Atracción / Repulsión
      if (keys.KeyA) targetState.radial = 40.0;
      else if (keys.KeyD) targetState.radial = -25.0;
      else targetState.radial = 10.0;

      // Q/E: Vórtice
      if (keys.KeyQ) targetState.vortex = 50.0;
      else if (keys.KeyE) targetState.vortex = 0.0;
      else targetState.vortex = 15.0;
    }
  }

  function triggerForceStrike(id) {
    // Golpes de fuerza en PERFORMANCE (Números)
    if (id === '1') { targetState.radial = 80.0; setTimeout(() => targetState.radial = 10.0, 200); } 
    if (id === '2') { targetState.wind = 60.0; setTimeout(() => targetState.wind = 0.0, 300); } 
    if (id === '3') { targetState.vortex = 100.0; setTimeout(() => targetState.vortex = 15.0, 400); } 
    if (id === '4') { targetState.radial = -60.0; setTimeout(() => targetState.radial = 10.0, 300); } 
  }

  addEventListener('keydown', (e) => {
    if (e.code in keys) { keys[e.code] = true; return; }
    if (e.code === 'KeyP') { setMode(mode === 'LAB' ? 'PERFORMANCE' : 'LAB'); return; }
    if (e.code === 'KeyR') { simulation.reset(); return; }
    
    if (mode === 'LAB') {
      if (e.code === 'Digit1') applyPreset('1'); if (e.code === 'Digit2') applyPreset('2');
      if (e.code === 'Digit3') applyPreset('3'); if (e.code === 'Digit4') applyPreset('4');
      if (e.code === 'Digit5') applyPreset('5');
    } else {
      if (e.code === 'Digit1') triggerForceStrike('1'); if (e.code === 'Digit2') triggerForceStrike('2');
      if (e.code === 'Digit3') triggerForceStrike('3'); if (e.code === 'Digit4') triggerForceStrike('4');
    }
  });

  addEventListener('keyup', (e) => { if (e.code in keys) keys[e.code] = false; });
  addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

  simulation.reset();
  
  renderer.setAnimationLoop(() => { 
    updateSmoothTransitions(); 
    simulation.stepSimulation(); 
    renderer.render(scene, camera); 
  });
}
main();