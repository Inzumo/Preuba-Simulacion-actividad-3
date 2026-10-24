function rangeRow(parent, label, param, min, max, step) {
  const wrap = document.createElement('div');
  wrap.className = 'row';
  const lab = document.createElement('label');
  const name = document.createElement('span');
  const value = document.createElement('span');
  value.className = 'value';
  name.textContent = label;
  lab.append(name, value);

  const input = document.createElement('input');
  input.type = 'range';
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  input.value = String(param.value);

  const onInput = () => {
    param.value = Number(input.value);
    value.textContent = Number(input.value).toFixed(step < 0.01 ? 3 : 2);
  };
  input.addEventListener('input', onInput);

  const refresh = () => {
    input.value = String(param.value);
    value.textContent = Number(param.value).toFixed(step < 0.01 ? 3 : 2);
  };

  refresh();
  wrap.append(lab, input);
  parent.append(wrap);
  return { input, refresh };
}

function button(parent, label, onClick) {
  const b = document.createElement('button');
  b.textContent = label;
  b.addEventListener('click', onClick);
  parent.append(b);
  return b;
}

export function createLabPanel({ params, onReset, onPreset, onModeChange, onPauseChange }) {
  const refreshers = [];
  const panel = document.createElement('aside');
  panel.className = 'panel';
  panel.innerHTML = `
    <h1>🔥 Singularity Engine</h1>
    <p>Atrae la materia. <strong>P</strong> cambia a PERFORMANCE.</p>
  `;

  const sim = document.createElement('div');
  sim.className = 'group';
  sim.innerHTML = '<h2>Gravedad</h2>';
  panel.append(sim);
  refreshers.push(rangeRow(sim, 'Fuerza Gravedad', params.gravityStrength, 0, 20, 0.1));
  refreshers.push(rangeRow(sim, 'Fuerza Torbellino', params.swirlStrength, 0, 10, 0.1));
  refreshers.push(rangeRow(sim, 'Horizonte de Sucesos', params.eventHorizon, 0.1, 5.0, 0.1));

  const vis = document.createElement('div');
  vis.className = 'group';
  vis.innerHTML = '<h2>Visuales</h2>';
  panel.append(vis);
  refreshers.push(rangeRow(vis, 'Tamaño Núcleo', params.particleSize, 0.01, 0.2, 0.001));

  const actions = document.createElement('div');
  actions.className = 'group';
  actions.innerHTML = '<h2>Acciones</h2>';
  panel.append(actions);
  button(actions, 'Reiniciar Materia', onReset);
  button(actions, 'LAB / PERFORMANCE', () => onModeChange());

  document.body.append(panel);

  return {
    element: panel,
    setVisible(visible) { panel.classList.toggle('hidden', !visible); },
    refresh() { for (const item of refreshers) item.refresh(); }
  };
}