function button(parent, label, onClick) {
  const b = document.createElement('button'); b.textContent = label;
  b.addEventListener('click', onClick); parent.append(b); return b;
}

export function createLabPanel({ params, onReset, onPreset, onModeChange }) {
  const panel = document.createElement('aside'); panel.className = 'panel';
  panel.innerHTML = `<h1>🔬 LAB · Verificación Nova</h1><p>Prueba la nueva física. Pasa a <strong>P</strong> para tocar.</p>`;

  const tests = document.createElement('div'); tests.className = 'group';
  tests.innerHTML = '<h2>Fuerzas</h2>';
  panel.append(tests);
  for (const [id, label] of [
    ['1', '1 · Vórtice Base'], 
    ['2', '2 · Ondas de Resonancia'], 
    ['3', '3 · Turbulencia Magnética'], 
    ['4', '4 · Tormenta Total']
  ]) button(tests, label, () => onPreset(id));

  const actions = document.createElement('div'); actions.className = 'group';
  actions.innerHTML = '<h2>Acciones</h2>'; panel.append(actions);
  button(actions, 'Reiniciar (R)', onReset);
  button(actions, 'Ir a PERFORMANCE (P)', () => onModeChange());
  document.body.append(panel);
  return { element: panel, setVisible: (v) => panel.classList.toggle('hidden', !v), refresh: () => {} };
}