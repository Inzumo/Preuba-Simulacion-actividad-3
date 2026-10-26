export function createLabPanel({ params, onReset, onPreset, onModeChange }) {
  const panel = document.createElement('aside'); panel.className = 'panel';
  panel.innerHTML = `
    <h1>⚡ Núcleo de Plasma</h1>
    <p>Aísla las fuerzas. <strong>P</strong> para interpretar.</p>
    <div class="group"><h2>Pruebas de Fuerza</h2>
      <button id="b1">1 · Tensión Magnética</button>
      <button id="b2">2 · Viento Estelar</button>
      <button id="b3">3 · Turbulencia Caótica</button>
      <button id="b4">4 · Supernova (Todo)</button>
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
  panel.querySelector('#br').onclick = onReset;
  panel.querySelector('#bp').onclick = onModeChange;

  document.body.append(panel);
  return { element: panel, setVisible: (v) => panel.classList.toggle('hidden', !v), refresh: () => {} };
}