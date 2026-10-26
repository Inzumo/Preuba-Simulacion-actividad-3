export function createLabPanel({ params, onReset, onPreset, onModeChange }) {
  const panel = document.createElement('aside'); panel.className = 'panel';
  panel.innerHTML = `
    <h1 style="color:#00E5FF; text-shadow:0 0 12px rgba(0,229,255,.7), 0 0 28px rgba(138,43,226,.6);">
      Versión neón cargada
    </h1>
    <p>Prueba las 5 fuerzas base. <strong>P</strong> para tocar.</p>
    <div class="group"><h2>5 Fuerzas Base</h2>
      <button id="b1">1 · Inercia</button>
      <button id="b2">2 · Viento</button>
      <button id="b3">3 · Atracción</button>
      <button id="b4">4 · Repulsión</button>
      <button id="b5">5 · Vórtice</button>
    </div>
    <div class="group"><h2>Estética</h2>
      <label>Largo de estela <input id="s-trail" type="range" min="0" max="12" step="0.5" value="${params.trailLength.value}"></label>
      <label>Tamaño <input id="s-size" type="range" min="0.05" max="0.4" step="0.01" value="${params.particleSize.value}"></label>
      <label>Brillo <input id="s-opacity" type="range" min="0.1" max="1" step="0.05" value="${params.globalOpacity.value}"></label>
    </div>
    <div class="group"><h2>Acciones</h2>
      <button id="br">Reiniciar (R)</button>
      <button id="bp">Ir a PERFORMANCE (P)</button>
    </div>
  `;

  panel.querySelector('#b1').onclick = () => onPreset('1');
  panel.querySelector('#b2').onclick = () => onPreset('2');
  panel.querySelector('#b3').onclick = () => onPreset('3');
  panel.querySelector('#b4').onclick = () => onPreset('4');
  panel.querySelector('#b5').onclick = () => onPreset('5');
  panel.querySelector('#br').onclick = onReset;
  panel.querySelector('#bp').onclick = onModeChange;

  const bind = (id, uniformNode) => {
    panel.querySelector(id).addEventListener('input', (e) => {
      uniformNode.value = parseFloat(e.target.value);
    });
  };
  bind('#s-trail', params.trailLength);
  bind('#s-size', params.particleSize);
  bind('#s-opacity', params.globalOpacity);

  document.body.append(panel);
  return { element: panel, setVisible: (v) => panel.classList.toggle('hidden', !v), refresh: () => {} };
}