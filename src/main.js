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
  let currentState = { tension: 8.0, wind: 0.0, turb: 0.0 };
  let targetState = { tension: 8.0, wind: 0.0, turb: 0.0 };

  function setTargets(t, w, tb) {
    targetState.tension = t;
    targetState.wind = w;
    targetState.turb = tb;
  }

  // Las 4 pruebas base (SIN RESET, solo cambian los targets)
  const applyPreset = (id) => {
    if (id === '1') setTargets(15.0, 0.0, 0.0);
    if (id === '2') setTargets(0.0, 8.0, 0.0);
    if (id === '3') setTargets(0.0, 0.0, 12.0);
    if (id === '4') setTargets(15.0, 8.0, 12.0);
    
    // Encendemos las fuerzas en la GPU
    params.tensionEnabled.value = 1; params.windEnabled.value = 1; params.turbEnabled.value = 1;
  };

  const setMode = (next) => {
    mode = next; panel.setVisible(mode === 'LAB');
    hud.innerHTML = mode === 'LAB' ? 'LAB · 1-4 Pruebas · P: PERFORMANCE' : 'PERFORMANCE · A/D Tensión · Q/E Turbulencia · 1-4 Detonadores';
  };

  panel = createLabPanel({ params, onReset: () => simulation.reset(), onPreset: applyPreset, onModeChange: () => setMode(mode === 'LAB' ? 'PERFORMANCE' : 'LAB') });
  setMode('LAB');

  const keys = { KeyA: false, KeyD: false, KeyQ: false, KeyE: false };
  
  // Esta función se ejecuta cada frame y hace la transición suave (lerp)
  function updateSmoothTransitions() {
    const lerpSpeed = 0.05; // Qué tan rápido se funde. 0.05 es suave, 0.2 es rápido.

    // Fundido de Tensión
    currentState.tension += (targetState.tension - currentState.tension) * lerpSpeed;
    params.tensionStrength.value = currentState.tension;

    // Fundido de Viento
    currentState.wind += (targetState.wind - currentState.wind) * lerpSpeed;
    params.windStrength.value = currentState.wind;

    // Fundido de Turbulencia
    currentState.turb += (targetState.turb - currentState.turb) * lerpSpeed;
    params.turbStrength.value = currentState.turb;

    // Si estamos en PERFORMANCE, el teclado sobreescribe los targets
    if (mode === 'PERFORMANCE') {
      if (keys.KeyA) targetState.tension = 30.0;
      else if (keys.KeyD) targetState.tension = 0.0;
      else targetState.tension = 8.0; // Base

      if (keys.KeyQ) targetState.turb = 20.0;
      else if (keys.KeyE) targetState.turb = 0.0;
      else targetState.turb = 0.0; // Base
    }
  }

  function triggerForceStrike(id) {
    if (id === '1') { targetState.tension = 50.0; setTimeout(() => targetState.tension = 8.0, 200); }
    if (id === '2') { targetState.wind = 30.0; setTimeout(() => targetState.wind = 0.0, 300); }
    if (id === '3') { targetState.turb = 40.0; setTimeout(() => targetState.turb = 0.0, 400); }
    if (id === '4') { 
      targetState.tension = 0.0; targetState.turb = 50.0; 
      setTimeout(() => { targetState.tension = 8.0; targetState.turb = 0.0; }, 500);
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
  
  renderer.setAnimationLoop(() => { 
    updateSmoothTransitions(); // Llamamos al fundido en cada frame
    simulation.stepSimulation(); 
    renderer.render(scene, camera); 
  });
}
main();