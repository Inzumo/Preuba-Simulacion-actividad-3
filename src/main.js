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
  camera.position.set(0, 0, 45);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGPURenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  mount.appendChild(renderer.domElement);
  await renderer.init();

  // Viñeta: oscurece suavemente los bordes para dar profundidad (no afecta el rendimiento de la simulación)
  const vignette = document.createElement('div');
  Object.assign(vignette.style, {
    position: 'fixed', inset: '0', pointerEvents: 'none', zIndex: '1',
    background: 'radial-gradient(ellipse at center, rgba(0,0,0,0) 45%, rgba(1,0,12,0.65) 100%)'
  });
  document.body.append(vignette);

  const params = createParameters();

  // Ajusta el volumen de partículas a lo que realmente ve la cámara.
  // Antes boundsSize era 22: las partículas quedaban en un cuadro pequeño al centro.
  function fitBounds() {
    const depth = params.boundsSize.value.z;
    const farthest = camera.position.z + depth / 2;           // plano más lejano
    const h = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * farthest;
    params.boundsSize.value.set(h * camera.aspect, h, depth);
  }
  fitBounds();

  const simulation = createSimulation({ renderer, scene, params });

  let mode = 'LAB', panel;
  const hud = document.createElement('div'); hud.className = 'hud'; document.body.append(hud);

  const applyForceState = (w, r, v, i, t = 0) => {
    params.windStrength.value = w;
    params.turbulenceStrength.value = t;
    params.turbulenceEnabled.value = 1;
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
    if (id === '6') { applyForceState(0, 0, 0, 0, 12.0); }
  };

  const setMode = (next) => {
    mode = next; panel.setVisible(mode === 'LAB');
    hud.innerHTML = mode === 'LAB'
      ? '<strong>LAB</strong> · 1-6 Pruebas · P: PERFORMANCE'
      : `<strong>PERFORMANCE</strong> · ¡Toca el sistema!<br>W/S: Viento · A/D: Atracción/Repulsión<br>Q/E: Torbellino · T/G: Turbulencia · 1-4: Explosiones · R: Reiniciar`;
  };

  panel = createLabPanel({
    params,
    onReset: () => simulation.reset(),
    onPreset: applyPreset,
    onModeChange: () => setMode(mode === 'LAB' ? 'PERFORMANCE' : 'LAB')
  });
  setMode('LAB');

  const keys = { KeyW: false, KeyS: false, KeyA: false, KeyD: false, KeyQ: false, KeyE: false, KeyT: false, KeyG: false };
  let pTarget = { wind: 0, radial: 10.0, vortex: 15.0, turb: 4.0 };

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

    if (keys.KeyT) pTarget.turb = 30.0;
    else if (keys.KeyG) pTarget.turb = 0.0;
    else pTarget.turb = 4.0;

    params.turbulenceStrength.value += (pTarget.turb - params.turbulenceStrength.value) * lerp;
    params.windStrength.value += (pTarget.wind - params.windStrength.value) * lerp;
    params.radialStrength.value += (pTarget.radial - params.radialStrength.value) * lerp;
    params.vortexStrength.value += (pTarget.vortex - params.vortexStrength.value) * lerp;
  }

  let strikeTimer = null;
  function triggerForceStrike(id) {
    if (id === '1') { params.radialStrength.value = 150.0; }
    if (id === '2') { params.windStrength.value = 120.0; }
    if (id === '3') { params.vortexStrength.value = 180.0; }
    if (id === '4') { params.radialStrength.value = -120.0; }

    // Evita que un timer viejo apague una explosión nueva
    clearTimeout(strikeTimer);
    strikeTimer = setTimeout(() => {
      if (mode === 'PERFORMANCE') {
        params.radialStrength.value = 10.0;
        params.windStrength.value = 0.0;
        params.vortexStrength.value = 15.0;
        params.turbulenceStrength.value = 4.0;
      }
    }, 300);
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
    } else {
      if (e.code === 'Digit1') triggerForceStrike('1');
      if (e.code === 'Digit2') triggerForceStrike('2');
      if (e.code === 'Digit3') triggerForceStrike('3');
      if (e.code === 'Digit4') triggerForceStrike('4');
    }
  });

  addEventListener('keyup', (e) => { if (e.code in keys) keys[e.code] = false; });

  let resizeTimer = null;
  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    fitBounds();
    // Reparte de nuevo las partículas en el nuevo volumen (con pausa para no hacerlo en cada píxel)
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => simulation.reset(), 200);
  });

  applyForceState(0, 0, 0, 2.0);
  // Antes no había reset inicial: todas las partículas empezaban en el origen hasta pulsar R
  simulation.reset();

  renderer.setAnimationLoop(() => {
    updatePerformanceSmoothly();
    simulation.stepSimulation();
    renderer.render(scene, camera);
  });
}
main();