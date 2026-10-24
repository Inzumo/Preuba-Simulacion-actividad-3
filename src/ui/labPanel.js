function rangeRow(parent, label, param, min, max, step) {
  const wrap = document.createElement('div'); wrap.className = 'row';
  const lab = document.createElement('label'); const name = document.createElement('span');
  const value = document.createElement('span'); value.className = 'value';
  name.textContent = label; lab.append(name, value);
  const input = document.createElement('input');
  input.type = 'range'; input.min = String(min); input.max = String(max);
  input.step = String(step); input.value = String(param.value);
  const onInput = () => { param.value = Number(input.value); value.textContent = Number(input.value).toFixed(2); };
  input.addEventListener('input', onInput);
  const refresh = () => { input.value = String(param.value); value.textContent = Number(param.value).toFixed(2); };
  refresh(); wrap.append(lab, input); parent.append(wrap); return { input, refresh };
}

function checkRow(parent, label, param) {
  const wrap = document.createElement('div'); wrap.className = 'row';
  const lab = document.createElement('label'); const name = document.createElement('span');
  name.textContent = label; const input = document.createElement('input');
  input.type = 'checkbox'; input.checked = param.value > 0;
  input.addEventListener('change', () => { param.value = input.checked ? 1 : 0; });
  const refresh = () => { input.checked = param.value > 0; };
  lab.append(name, input); wrap.append(lab); parent.append(wrap); return { input, refresh };
}

function button(parent, label, onClick) {
  const b = document.createElement('button'); b.textContent = label;
  b.addEventListener('click', onClick); parent.append(b); return b;
}

export function createLabPanel({ params, onReset, onPreset, onModeChange }) {
  const refreshers = [];
  const panel = document.createElement('aside'); panel.className = 'panel';
  panel.innerHTML = `<h1>🧪 LAB · Verificación</h1><p>Prueba las fuerzas. Pasa a <strong>P</strong> para interpretar.</p>`;

  const tests = document.createElement('div'); tests.className = 'group';
  tests.innerHTML = '<h2>Pruebas Base</h2>';
  panel.append(tests);
  for (const [id, label] of [
    ['1', '1 · Inercia'], ['2', '2 · Fuerza +X'], ['3', '3 · Atracción'], 
    ['4', '4 · Repulsión'], ['5', '5 · Vórtice'], ['6', '6 · Agujero Negro']
  ]) button(tests, label, () => onPreset(id));

  const actions = document.createElement('div'); actions.className = 'group';
  actions.innerHTML = '<h2>Acciones</h2>'; panel.append(actions);
  button(actions, 'Reiniciar (R)', onReset);
  button(actions, 'Ir a PERFORMANCE (P)', () => onModeChange());
  document.body.append(panel);
  return { element: panel, setVisible: (v) => panel.classList.toggle('hidden', !v), refresh: () => {} };
}