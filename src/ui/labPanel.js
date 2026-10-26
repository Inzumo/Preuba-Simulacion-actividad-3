export function createLabPanel({ params, onReset, onPreset, onModeChange }) {
  const panel = document.createElement('aside'); panel.className = 'panel';
  panel.innerHTML = `
    <h1>🧪 LAB · Verificación</h1>
    <p>Prueba las 5 fuerzas base. <strong>P</strong> para interpretar.</p>
    <div class="group"><h2>5 Fuerzas Base</h2>
      <button id="b1">1 · Inercia</button>
      <button id="b2">2 · Viento (Fuerza +X)</button>
      <button id="b3">3 · Atracción</button>
      <button id="b4">4 · Repulsión</button>
      <button id="b5">5 · Vórtice</button>
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

  document.body.append(panel);
  return { element: panel, setVisible: (v) => panel.classList.toggle('hidden', !v), refresh: () => {} };
}