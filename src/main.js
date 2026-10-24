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
    throw new Error('Requiere WebGPU.');
  }

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#020005'); // Fondo ultra oscuro para más contraste

  const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.05, 100);
  camera.position.set(0, 15, 15); // Vista más elevada para ver la espiral
  camera.lookAt(0, 0, 0);

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
    new THREE.SphereGeometry(0.2, 16, 16),
    new THREE.MeshBasicMaterial({ color: '#ffffff' })
  );
  scene.add(attractorHelper);

  let paused = false;
  let mode = 'LAB';
  let panel;

  // Lógica para el PERFORMANCE (Interacción fluida)
  const keys = { KeyW: false, KeyS: false, KeyA: false, KeyD: false };

  function updatePerformance() {
    if (mode !== 'PERFORMANCE') return;

    // W/S: Fuerza Gravedad
    let gravTarget = 8.0;
    if (keys.KeyW && !keys.KeyS) gravTarget = 20.0;
    else if (keys.KeyS && !keys.KeyW) gravTarget = 0.0;
    params.gravityStrength.value += (gravTarget - params.gravityStrength.value) * 0.05;

    // A/D: Torbellino
    let swirlTarget = 3.0;
    if (keys.KeyA && !keys.KeyD) swirlTarget = 10.0;
    else if (keys.KeyD && !keys.KeyA) swirlTarget = 0.0;
    params.swirlStrength.value += (swirlTarget - params.swirlStrength.value) * 0.05;
  }

  const hud = document.createElement('div');
  hud.className = 'hud';
  document.body.append(hud);

  const setMode = (next) => {
    mode = next;
    const lab = mode === 'LAB';
    panel.setVisible(lab);
    attractorHelper.visible = lab;
    hud.innerHTML = lab
      ? '<strong>LAB</strong> · P: performance · R: reiniciar materia'
      : `<strong>PERFORMANCE</strong><br>
         Mouse · mover agujero negro<br>
         W/S · aumentar/disminuir gravedad<br>
         A/D · aumentar/disminuir torbellino<br>
         R · reiniciar materia &nbsp;&nbsp; P · LAB`;
  };

  panel = createLabPanel({
    params,
    onReset: () => simulation.reset(),
    onPreset: () => {},
    onModeChange: () => setMode(mode === 'LAB' ? 'PERFORMANCE' : 'LAB'),
    onPauseChange: () => (paused = !paused)
  });

  setMode('LAB');

  // MOVER EL AGUJERO NEGRO CON EL MOUSE
  const pointerNdc = new THREE.Vector2();
  const raycaster = new THREE.Raycaster();
  const interactionPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); // Plano horizontal
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

  addEventListener('keydown', (event) => {
    if (event.code in keys) {
      keys[event.code] = true;
      return;
    }
    if (event.code === 'KeyP') {
      setMode(mode === 'LAB' ? 'PERFORMANCE' : 'LAB');
      return;
    }
    if (event.code === 'KeyR') {
      simulation.reset();
      return;
    }
  });

  addEventListener('keyup', (event) => {
    if (event.code in keys) keys[event.code] = false;
  });

  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

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