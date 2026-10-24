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

  // --- SISTEMA DE PRESETS PARA EL LAB (Verificación) ---
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
      : `<strong>PERFORMANCE</strong><br>Mouse: Atraer · W/S: Gravedad · A/D: Giro · Q/E: Turbulencia<br>R: Reset · P: LAB`;
  };

  panel = createLabPanel({ params, onReset: () => simulation.reset(), onPreset: applyPreset, onModeChange: () => setMode(mode === 'LAB' ? 'PERFORMANCE' : 'LAB') });
  setMode('LAB');

  // --- INTERACCIÓN ---
  const pointerNdc = new THREE.Vector2(); const raycaster = new THREE.Raycaster();
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); const hit = new THREE.Vector3();
  addEventListener('pointermove', (e) => {
    pointerNdc.x = (e.clientX / innerWidth) * 2 - 1; pointerNdc.y = -(e.clientY / innerHeight) * 2 + 1;
    raycaster.setFromCamera(pointerNdc, camera);
    if (raycaster.ray.intersectPlane(plane, hit)) params.attractor.value.copy(hit);
  });

  const keys = { KeyW: false, KeyS: false, KeyA: false, KeyD: false, KeyQ: false, KeyE: false };
  function updatePerformance() {
    if (mode !== 'PERFORMANCE') return;
    let gt = 8.0; if (keys.KeyW) gt = 25.0; else if (keys.KeyS) gt = 0.0;
    params.gravityStrength.value += (gt - params.gravityStrength.value) * 0.1; params.gravityEnabled.value = 1;

    let st = 4.0; if (keys.KeyA) st = 15.0; else if (keys.KeyD) st = -10.0;
    params.vortexStrength.value += (st - params.vortexStrength.value) * 0.1; params.vortexEnabled.value = 1;

    let tt = 0.0; if (keys.KeyQ) tt = 8.0; else if (keys.KeyE) tt = 0.0;
    params.turbStrength.value += (tt - params.turbStrength.value) * 0.1; params.turbEnabled.value = 1;
  }

  addEventListener('keydown', (e) => {
    if (e.code in keys) { keys[e.code] = true; return; }
    if (e.code === 'KeyP') { setMode(mode === 'LAB' ? 'PERFORMANCE' : 'LAB'); return; }
    if (e.code === 'KeyR') { simulation.reset(); return; }
    if (mode === 'LAB') {
      if (e.code === 'Digit1') applyPreset('1');
      if (e.code === 'Digit2') applyPreset('2');
      if (e.code === 'Digit3') applyPreset('3');
      if (e.code === 'Digit4') applyPreset('4');
      if (e.code === 'Digit5') applyPreset('5');
      if (e.code === 'Digit6') applyPreset('6');
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