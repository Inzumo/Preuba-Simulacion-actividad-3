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

  // --- FUNCIÓN PARA CAMBIAR FUERZAS DIRECTAMENTE (Sin lag) ---
  const applyForceState = (w, r, v, i) => {
    params.windStrength.value = w;
    params.radialStrength.value = r;
    params.vortexStrength.value = v;
    params.initialSpeed.value = i;

    // Encendemos todas las fuerzas (el valor 0 hace que no afecten)
    params.windEnabled.value = 1;
    params.radialEnabled.value = 1;
    params.vortexEnabled.value = 1;
    params.dragEnabled.value = 1;
  };

  // Las 5 pruebas base para el LAB
  const applyPreset = (id) => {
    if (id === '1') { applyForceState(0, 0, 0, 6.0); }       // Inercia
    if (id === '2') { applyForceState(15.0, 0, 0, 0); }      // Viento
    if (id === '3') { applyForceState(0, 20.0, 0, 0); }      // Atracción
    if (id === '4') { applyForceState(0, -20.0, 0, 0); }     // Repulsión
    if (id === '5') { applyForceState(0, 5.0, 25.0, 0); }    // Vórtice
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
  
  // Variables para el suavizado en PERFORMANCE
  let pTarget = { wind: 0, radial: 10.0, vortex: 15.0 };

  function updatePerformanceSmoothly() {
    if (mode !== 'PERFORMANCE') return;
    
    const lerpSpeed = 0.08;

    // W/S: Viento
    if (keys.KeyW) pTarget.wind = 30.0;
    else if (keys.KeyS) pTarget.wind = -30.0;
    else pTarget.wind = 0.0;

    // A/D: Atracción / Repulsión
    if (keys.KeyA) pTarget.radial = 40.0;
    else if (keys.KeyD) pTarget.radial = -25.0;
    else pTarget.radial = 10.0;

    // Q/E: Vórtice
    if (keys.KeyQ) pTarget.vortex = 50.0;
    else if (keys.KeyE) pTarget.vortex = 0.0;
    else pTarget.vortex = 15.0;

    // Suavizado matemático
    params.windStrength.value += (pTarget.wind - params.windStrength.value) * lerpSpeed;
    params.radialStrength.value += (pTarget.radial - params.radialStrength.value) * lerpSpeed;
    params.vortexStrength.value += (pTarget.vortex - params.vortexStrength.value) * lerpSpeed;
  }

  function triggerForceStrike(id) {
    // Explosiones rápidas usando el teclado (No bloquean el sistema)
    if (id === '1') { params.radialStrength.value = 100.0; }
    if (id === '2') { params.windStrength.value = 80.0; }
    if (id === '3') { params.vortexStrength.value = 120.0; }
    if (id === '4') { params.radialStrength.value = -80.0; }
    
    // Después de un instante, volvemos al estado normal
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
  addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

  // Iniciamos en modo Viento por defecto
  applyForceState(0, 0, 0, 2.0);

  renderer.setAnimationLoop(() => { 
    updatePerformanceSmoothly(); // Solo actúa en PERFORMANCE
    simulation.stepSimulation(); 
    renderer.render(scene, camera); 
  });
}
main();