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
  camera.position.set(0, 0, 30); camera.lookAt(0, 0, 0);

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

  // --- LAB: Nuevas Fuerzas ---
  const applyPreset = (id) => {
    params.tensionEnabled.value = 1;
    params.bubbleEnabled.value = 1;
    params.fluidEnabled.value = 0;
    
    if (id === '1') {
      params.tensionStrength.value = 15.0;
      params.bubbleStrength.value = 5.0;
    } else if (id === '2') {
      params.tensionStrength.value = 2.0;
      params.bubbleStrength.value = 25.0;
    } else if (id === '3') {
      params.tensionStrength.value = 8.0;
      params.fluidEnabled.value = 1;
      params.fluidStrength.value = 6.0;
    } else if (id === '4') {
      params.tensionStrength.value = 20.0;
      params.bubbleStrength.value = 15.0;
      params.fluidEnabled.value = 1;
      params.fluidStrength.value = 10.0;
    }
    simulation.reset();
  };

  const setMode = (next) => {
    mode = next; const lab = mode === 'LAB';
    panel.setVisible(lab);
    hud.innerHTML = lab ? '<strong>LAB</strong> · 1-4 Fuerzas · P: PERFORMANCE' 
      : `<strong>COLAPSO ESTELAR</strong><br>
         A/D: Tensión · Q/E: Fluidos<br>
         <b>1-4: Detonadores (Golpes)</b><br>
         R: Reiniciar · P: LAB`;
  };

  panel = createLabPanel({ params, onReset: () => simulation.reset(), onPreset: applyPreset, onModeChange: () => setMode(mode === 'LAB' ? 'PERFORMANCE' : 'LAB') });
  setMode('LAB');

  // El centro se mueve solo (o con el mouse)
  const pointerNdc = new THREE.Vector2(); const raycaster = new THREE.Raycaster();
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0); const hit = new THREE.Vector3();
  addEventListener('pointermove', (e) => {
    pointerNdc.x = (e.clientX / innerWidth) * 2 - 1; pointerNdc.y = -(e.clientY / innerHeight) * 2 + 1;
    raycaster.setFromCamera(pointerNdc, camera);
    if (raycaster.ray.intersectPlane(plane, hit)) params.attractor.value.copy(hit);
  });

  const keys = { KeyA: false, KeyD: false, KeyQ: false, KeyE: false };
  
  function updatePerformance() {
    if (mode !== 'PERFORMANCE') return;
    
    // A/D: Tensión (Atracción)
    let tt = 12.0; if (keys.KeyA) tt = 40.0; else if (keys.KeyD) tt = 0.0;
    params.tensionStrength.value += (tt - params.tensionStrength.value) * 0.1; params.tensionEnabled.value = 1;

    // Q/E: Fluidos (Caos)
    let ft = 0.0; if (keys.KeyQ) ft = 15.0; else if (keys.KeyE) ft = 0.0;
    params.fluidStrength.value += (ft - params.fluidStrength.value) * 0.1; params.fluidEnabled.value = 1;
  }

  function triggerForceStrike(id) {
    if (id === '1') {
      // 1: Onda de Choque (Burbuja Explosiva)
      params.bubbleStrength.value = 60.0;
      setTimeout(() => params.bubbleStrength.value = 8.0, 250);
    } else if (id === '2') {
      // 2: Súper Atracción (Latigazo al centro)
      params.tensionStrength.value = 80.0;
      setTimeout(() => params.tensionStrength.value = 12.0, 300);
    } else if (id === '3') {
      // 3: Terremoto de Fluidos
      params.fluidStrength.value = 40.0;
      params.fluidEnabled.value = 1;
      setTimeout(() => params.fluidStrength.value = 5.0, 500);
    } else if (id === '4') {
      // 4: Big Bang
      params.bubbleStrength.value = 100.0;
      params.tensionStrength.value = 0.0;
      params.fluidStrength.value = 50.0;
      setTimeout(() => { params.bubbleStrength.value = 8.0; params.tensionStrength.value = 12.0; params.fluidStrength.value = 5.0; }, 400);
    }
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
    } else if (mode === 'PERFORMANCE') {
      if (e.code === 'Digit1') triggerForceStrike('1');
      if (e.code === 'Digit2') triggerForceStrike('2');
      if (e.code === 'Digit3') triggerForceStrike('3');
      if (e.code === 'Digit4') triggerForceStrike('4');
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