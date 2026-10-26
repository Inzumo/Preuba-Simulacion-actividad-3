import * as THREE from 'three/webgpu';
import WebGPU from 'three/addons/capabilities/WebGPU.js';
import './styles.css';
import { createParameters } from './simulation/parameters.js';
import { createSimulation } from './simulation/createSimulation.js';
import { createLabPanel } from './ui/labPanel.js';

async function main() {
  const mount = document.querySelector('#app');
  if (!WebGPU.isAvailable()) throw new Error('Requiere WebGPU.');

  const scene = new THREE.Scene(); 
  // Fondo casi negro con un levísimo tono azul
  scene.background = new THREE.Color('#010008');
  
  const camera = new THREE.PerspectiveCamera(65, innerWidth / innerHeight, 0.1, 1000);
  // Cámara lejana para efecto inmersivo
  camera.position.set(0, 0, 45); 
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGPURenderer({ antialias: true });
  renderer.setSize(innerWidth, innerHeight); mount.appendChild(renderer.domElement);
  await renderer.init();

  const params = createParameters();
  const simulation = createSimulation({ renderer, scene, params });

  let mode = 'LAB', panel;
  const hud = document.createElement('div'); hud.className = 'hud'; document.body.append(hud);

  const applyForceState = (w, r, v, i) => {
    params.windStrength.value = w;
    params.radialStrength.value = r;
    params.vortexStrength.value = v;
    params.initialSpeed.value = i;
    params.windEnabled.value = 1;
    params.radialEnabled.value = 1;
    params.vortexEnabled.value = 1;
    params.dragEnabled.value = 1;
  };

  const applyPreset = (id) => {
    if (id === '1') { applyForceState(0, 0, 0, 8.0); } 
    if (id === '2') { applyForceState(15.0, 0, 0, 0); } 
    if (id === '3') { applyForceState(0, 25.0, 0, 0); } 
    if (id === '4') { applyForceState(0, -25.0, 0, 0); } 
    if (id === '5') { applyForceState(0, 5.0, 30.0, 0); } 
  };

  const setMode = (next) => {
    mode = next; panel.setVisible(mode === 'LAB');
    hud.innerHTML = mode === 'LAB' 
      ? '<strong>LAB</strong> · 1-5 Pruebas · P: PERFORMANCE' 
      : `<strong>PERFORMANCE</strong> · ¡Toca el sistema!<br>W/S: Viento · A/D: Atracción/Repulsión<br>Q/E: Torbellino · 1-4: Explosiones · R: Reiniciar`;
  };

  panel = createLabPanel({ params, onReset: () => simulation.reset(), onPreset: applyPreset, onModeChange: () => setMode(mode === 'LAB' ? 'PERFORMANCE' : 'LAB') });
  setMode('LAB');

  const keys = { KeyW: false, KeyS: false, KeyA: false, KeyD: false, KeyQ: false, KeyE: false };
  let pTarget = { wind: 0, radial: 10.0, vortex: 15.0 };

  function updatePerformanceSmoothly() {
    if (mode !== 'PERFORMANCE') return;
    const lerp = 0.08;

    if (keys.KeyW) pTarget.wind = 40.0;
    else if (keys.KeyS) pTarget.wind = -40.0;
    else pTarget.wind = 0.0;

    if (keys.KeyA) pTarget.radial = 50.0;
    else if (keys.KeyD) pTarget.radial = -30.0;
    else pTarget.radial = 10.0;

    if (keys.KeyQ) pTarget.vortex = 60.0;
    else if (keys.KeyE) pTarget.vortex = 0.0;
    else pTarget.vortex = 15.0;

    params.windStrength.value += (pTarget.wind - params.windStrength.value) * lerp;
    params.radialStrength.value += (pTarget.radial - params.radialStrength.value) * lerp;
    params.vortexStrength.value += (pTarget.vortex - params.vortexStrength.value) * lerp;
  }

  function triggerForceStrike(id) {
    if (id === '1') { params.radialStrength.value = 150.0; }
    if (id === '2') { params.windStrength.value = 120.0; }
    if (id === '3') { params.vortexStrength.value = 180.0; }
    if (id === '4') { params.radialStrength.value = -120.0; }
    
    setTimeout(() => {
      if (mode === 'PERFORMANCE') {
        params.radialStrength.value = 10.0;
        params.windStrength.value = 0.0;
        params.vortexStrength.value = 15.0;
      }
    }, 300);
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
  addEventListener('resize', () => { 
    camera.aspect = innerWidth / innerHeight; 
    camera.updateProjectionMatrix(); 
    renderer.setSize(innerWidth, innerHeight); 
  });

  applyForceState(0, 0, 0, 2.0);

  renderer.setAnimationLoop(() => { 
    updatePerformanceSmoothly(); 
    simulation.stepSimulation(); 
    renderer.render(scene, camera); 
  });
}
main();