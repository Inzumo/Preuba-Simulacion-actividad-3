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
  if (!WebGPU.isAvailable()) { mount.appendChild(WebGPU.getErrorMessage()); throw new Error('Requiere WebGPU.'); }

  const scene = new THREE.Scene(); scene.background = new THREE.Color('#020005');
  const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.05, 100);
  camera.position.set(0, 10, 20); camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGPURenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight); mount.appendChild(renderer.domElement);
  await renderer.init();

  const orbit = new OrbitControls(camera, renderer.domElement);
  orbit.enableDamping = true; orbit.target.set(0, 0, 0);

  const params = createParameters();
  const simulation = createSimulation({ renderer, scene, params, count: PARTICLE_COUNT });

  let paused = false, mode = 'LAB', panel;
  const hud = document.createElement('div'); hud.className = 'hud'; document.body.append(hud);

  // --- 1. MODO LAB: Pruebas de Verificación ---
  const applyPreset = (id) => {
    params.windEnabled.value = 0; params.radialEnabled.value = 0;
    params.vortexEnabled.value = 0; params.dragEnabled.value = 0;
    params.gravityEnabled.value = 0; params.turbEnabled.value = 0;
    params.initialSpeed.value = 0;

    if (id === '1') { params.initialSpeed.value = 2.0; }
    else if (id === '2') { params.windEnabled.value = 1; params.wind.value.set(2.0, 0, 0); }
    else if (id === '3') { params.radialEnabled.value = 1; params.radialStrength.value = 5.0; }
    else if (id === '4') { params.radialEnabled.value = 1; params.radialStrength.value = -5.0; }
    else if (id === '5') { params.radialEnabled.value = 1; params.radialStrength.value = 1.0; params.vortexEnabled.value = 1; params.vortexStrength.value = 4.0; }
    else if (id === '6') { params.gravityEnabled.value = 1; params.gravityStrength.value = 12.0; params.turbEnabled.value = 1; params.turbStrength.value = 2.0; params.dragEnabled.value = 0.05; }
    simulation.reset();
  };

  const setMode = (next) => {
    mode = next; const lab = mode === 'LAB';
    panel.setVisible(lab);
    hud.innerHTML = lab ? '<strong>LAB</strong> · 1-6 Pruebas · P: PERFORMANCE' 
      : `<strong>PERFORMANCE</strong> · ¡Toca el sistema!<br>
         Mouse: Atraer · W/S: Gravedad · A/D: Giro · Q/E: Turbulencia<br>
         <b>Teclas 1-6: Golpes de Fuerza</b><br>
         R: Reset · P: LAB`;
  };

  panel = createLabPanel({ params, onReset: () => simulation.reset(), onPreset: applyPreset, onModeChange: () => setMode(mode === 'LAB' ? 'PERFORMANCE' : 'LAB') });
  setMode('LAB');

  // --- 2. INTERACCIÓN ---
  const pointerNdc = new THREE.Vector2(); const raycaster = new THREE.Raycaster();
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); const hit = new THREE.Vector3();
  addEventListener('pointermove', (e) => {
    pointerNdc.x = (e.clientX / innerWidth) * 2 - 1; pointerNdc.y = -(e.clientY / innerHeight) * 2 + 1;
    raycaster.setFromCamera(pointerNdc, camera);
    if (raycaster.ray.intersectPlane(plane, hit)) params.attractor.value.copy(hit);
  });

  const keys = { KeyW: false, KeyS: false, KeyA: false, KeyD: false, KeyQ: false, KeyE: false };
  
  // --- 3. PERFORMANCE: Teclado Continuo ---
  function updatePerformance() {
    if (mode !== 'PERFORMANCE') return;
    // W/S: Gravedad
    let gt = 8.0; if (keys.KeyW) gt = 25.0; else if (keys.KeyS) gt = 0.0;
    params.gravityStrength.value += (gt - params.gravityStrength.value) * 0.1; params.gravityEnabled.value = 1;

    // A/D: Giro
    let st = 4.0; if (keys.KeyA) st = 15.0; else if (keys.KeyD) st = -10.0;
    params.vortexStrength.value += (st - params.vortexStrength.value) * 0.1; params.vortexEnabled.value = 1;

    // Q/E: Turbulencia
    let tt = 0.0; if (keys.KeyQ) tt = 8.0; else if (keys.KeyE) tt = 0.0;
    params.turbStrength.value += (tt - params.turbStrength.value) * 0.1; params.turbEnabled.value = 1;
  }

  // --- 4. PERFORMANCE: Golpes de Fuerza (Números) ---
  function triggerForceStrike(id) {
    // 1: Pulso de Viento
    if (id === '1') {
      params.windEnabled.value = 1;
      params.wind.value.set((Math.random() - 0.5) * 20, (Math.random() - 0.5) * 20, 0);
      setTimeout(() => params.windEnabled.value = 0, 300); // El viento dura solo 300ms
    }
    // 2: Repulsión Explosiva
    else if (id === '2') {
      params.radialEnabled.value = 1;
      params.radialStrength.value = -50.0;
      setTimeout(() => params.radialEnabled.value = 0, 200); // Explosión de 200ms
    }
    // 3: Implosión (Atrae todo de golpe)
    else if (id === '3') {
      params.radialEnabled.value = 1;
      params.radialStrength.value = 50.0;
      setTimeout(() => params.radialEnabled.value = 0, 200);
    }
    // 4: Latigazo de Vórtice (Gira violentamente)
    else if (id === '4') {
      params.vortexEnabled.value = 1;
      params.vortexStrength.value = 40.0;
      setTimeout(() => params.vortexStrength.value = 4.0, 400); // Vuelve a la normalidad
    }
    // 5: Caos Cósmico
    else if (id === '5') {
      params.turbEnabled.value = 1;
      params.turbStrength.value = 25.0;
      setTimeout(() => params.turbStrength.value = 0.0, 500);
    }
    // 6: Agujero Negro Base
    else if (id === '6') {
      params.gravityEnabled.value = 1;
      params.gravityStrength.value = 15.0;
    }
  }

  addEventListener('keydown', (e) => {
    if (e.code in keys) { keys[e.code] = true; return; }
    if (e.code === 'KeyP') { setMode(mode === 'LAB' ? 'PERFORMANCE' : 'LAB'); return; }
    if (e.code === 'KeyR') { simulation.reset(); return; }

    // Si estamos en LAB, los números cambian el preset de prueba
    if (mode === 'LAB') {
      if (e.code === 'Digit1') applyPreset('1');
      if (e.code === 'Digit2') applyPreset('2');
      if (e.code === 'Digit3') applyPreset('3');
      if (e.code === 'Digit4') applyPreset('4');
      if (e.code === 'Digit5') applyPreset('5');
      if (e.code === 'Digit6') applyPreset('6');
    } 
    // Si estamos en PERFORMANCE, los números son GOLPES DE FUERZA
    else if (mode === 'PERFORMANCE') {
      if (e.code === 'Digit1') triggerForceStrike('1');
      if (e.code === 'Digit2') triggerForceStrike('2');
      if (e.code === 'Digit3') triggerForceStrike('3');
      if (e.code === 'Digit4') triggerForceStrike('4');
      if (e.code === 'Digit5') triggerForceStrike('5');
      if (e.code === 'Digit6') triggerForceStrike('6');
    }
  });

  addEventListener('keyup', (e) => { if (e.code in keys) keys[e.code] = false; });
  addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

  window.focus(); simulation.reset();

  renderer.setAnimationLoop(() => {
    if (!paused) { updatePerformance(); simulation.stepSimulation(); }
    orbit.update(); renderer.render(scene, camera);
  });
}
main().catch((error) => { console.error(error); const pre = document.createElement('pre'); pre.style.cssText = 'position:fixed;inset:16px;color:#fff;z-index:50'; pre.textContent = String(error?.stack || error); document.body.append(pre); });