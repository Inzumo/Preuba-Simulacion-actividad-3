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
  
  const refresh = () => {
    param.value = Number(input.value);
    value.textContent = Number(input.value).toFixed(step < 0.01 ? 3 : 2);
  };
  
  input.addEventListener('input', refresh);
  refresh();
  
  wrap.append(lab, input);
  parent.append(wrap);
  
  return { input, refresh };
}

function checkRow(parent, label, param) {
  const wrap = document.createElement('div');
  wrap.className = 'row';
  
  const lab = document.createElement('label');
  const name = document.createElement('span');
  name.textContent = label;
  
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = param.value > 0;
  
  input.addEventListener('change', () => {
    param.value = input.checked ? 1 : 0;
  });
  
  lab.append(name, input);
  wrap.append(lab);
  parent.append(wrap);
  
  return { input, refresh: () => { input.checked = param.value > 0; } };
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
    <h1>🎵 Forces Instrument</h1>
    <p>LAB: aísla fuerzas, predice y prueba. <strong>P</strong> → PERFORMANCE</p>
  `;

  // ============================================================
  // SIMULACIÓN
  // ============================================================
  const sim = document.createElement('div');
  sim.className = 'group';
  sim.innerHTML = '<h2>⚙️ Simulación</h2>';
  panel.append(sim);

  refreshers.push(rangeRow(sim, 'Escala tiempo', params.timeScale, 0, 2, 0.01));
  refreshers.push(rangeRow(sim, 'Vel. máxima', params.maxSpeed, 0.2, 12, 0.1));
  refreshers.push(rangeRow(sim, 'Tamaño partícula', params.particleSize, 0.005, 0.1, 0.001));

  // ============================================================
  // FUERZAS
  // ============================================================
  const force = document.createElement('div');
  force.className = 'group';
  force.innerHTML = '<h2>🌀 Fuerzas</h2>';
  panel.append(force);

  refreshers.push(checkRow(force, 'Radial', params.radialEnabled));
  refreshers.push(rangeRow(force, 'Intensidad radial', params.radialStrength, -8, 8, 0.05));

  refreshers.push(checkRow(force, 'Vórtice', params.vortexEnabled));
  refreshers.push(rangeRow(force, 'Intensidad vórtice', params.vortexStrength, -8, 8, 0.05));

  refreshers.push(checkRow(force, 'Drag', params.dragEnabled));
  refreshers.push(rangeRow(force, 'Coef. rozamiento', params.dragCoefficient, 0, 1, 0.01));

  refreshers.push(checkRow(force, 'Viento', params.windEnabled));
  refreshers.push(rangeRow(force, 'Viento X', params.windX, -4, 4, 0.05));
  refreshers.push(rangeRow(force, 'Viento Y', params.windY, -4, 4, 0.05));

  // ============================================================
  // PRUEBAS
  // ============================================================
  const tests = document.createElement('div');
  tests.className = 'group';
  tests.innerHTML = '<h2>🧪 Pruebas</h2>';
  panel.append(tests);

  const presets = [
    ['inertia', '1 · Inercia'],
    ['wind', '2 · Viento +X'],
    ['attract', '3 · Atracción'],
    ['repel', '4 · Repulsión'],
    ['vortex', '5 · Vórtice']
  ];
  for (const [id, label] of presets) {
    button(tests, label, () => onPreset(id));
  }

  // ============================================================
  // ACCIONES
  // ============================================================
  const actions = document.createElement('div');
  actions.className = 'group';
  actions.innerHTML = '<h2>🎮 Acciones</h2>';
  panel.append(actions);

  button(actions, '⟳ Reset', onReset);
  button(actions, '⏸ Pausa', onPauseChange);
  button(actions, '🔄 LAB / PERFORMANCE', onModeChange);

  document.body.append(panel);

  return {
    element: panel,
    setVisible(visible) {
      panel.classList.toggle('hidden', !visible);
    },
    refresh() {
      for (const item of refreshers) {
        try { item.refresh(); } catch (e) {}
      }
    }
  };
}
