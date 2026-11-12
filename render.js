// render.js — todo lo que toca el DOM. No decide reglas del juego, solo pinta `state`.
(function (root, deps) {
  'use strict';

  const { timeString, escapeHtml } = deps.Utils;
  const Engine = deps.Engine;
  const C = deps.Constants;

  const dom = {};
  const unitPinEls = new Map();
  const incidentPinEls = new Map();

  function cacheDom() {
    dom.queue = document.getElementById('queue');
    dom.unitList = document.getElementById('units');
    dom.mapWorld = document.getElementById('map-world');
    dom.routeLayer = document.getElementById('route-layer');
    dom.clock = document.getElementById('clock');
    dom.callCount = document.getElementById('call-count');
    dom.unitCount = document.getElementById('unit-count');
    dom.selectionSummary = document.getElementById('selection-summary');
    dom.dispatchBtn = document.getElementById('dispatch');
    dom.decisionPanel = document.getElementById('decision-panel');
    dom.mapTip = document.getElementById('map-tip');
    dom.served = document.getElementById('served');
    dom.trust = document.getElementById('trust');
    dom.available = document.getElementById('available');
    dom.response = document.getElementById('response');
    dom.score = document.getElementById('score');
    dom.difficultyLabel = document.getElementById('difficulty');
    dom.difficultySelect = document.getElementById('difficulty-select');
    dom.districtFilter = document.getElementById('district-filter');
    dom.priorityFilter = document.getElementById('priority-filter');
    dom.historyList = document.getElementById('history-list');
    dom.log = document.getElementById('log');
    dom.toast = document.getElementById('toast');
    dom.attentionBanner = document.getElementById('attention-banner');
    dom.pauseBtn = document.getElementById('pause-toggle');
    dom.soundBtn = document.getElementById('sound-toggle');
    dom.speedButtons = Array.from(document.querySelectorAll('[data-speed]'));
    dom.patrolHint = document.getElementById('patrol-hint');
    dom.objectiveBanner = document.getElementById('objective-banner');
    dom.startOverlay = document.getElementById('start-overlay');
    dom.endOverlay = document.getElementById('end-overlay');
    dom.endTitle = document.getElementById('end-title');
    dom.endStats = document.getElementById('end-stats');
    dom.menuBtn = document.getElementById('menu-btn');
  }

  function notify(message) {
    dom.toast.textContent = message;
    dom.toast.classList.add('show');
    window.clearTimeout(notify.timeout);
    notify.timeout = window.setTimeout(() => dom.toast.classList.remove('show'), 2200);
  }

  function renderCalls(state, onSelectCall) {
    Engine.sortQueue(state);
    const visibleCalls = Engine.getVisibleCalls(state);
    dom.queue.innerHTML = '';
    if (!visibleCalls.length) {
      const empty = document.createElement('div');
      empty.className = 'empty-note';
      empty.textContent = 'No hay avisos con estos filtros.';
      dom.queue.append(empty);
    }
    visibleCalls.forEach((call) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `call${state.selectedCall === call.id ? ' selected' : ''}${call.status === 'done' ? ' done' : ''}`;
      button.setAttribute('aria-pressed', String(state.selectedCall === call.id));
      const statusLabel = call.status === 'done' ? 'resuelto' : call.status === 'awaiting_decision' ? 'decisión' : call.status === 'assigned' ? 'en curso' : call.severity;
      const metaLabel = call.status === 'awaiting_decision' ? 'Elige una respuesta' : call.status === 'assigned' ? 'Unidad en camino' : call.status === 'done' ? 'Atendido' : 'Pendiente';
      button.innerHTML = `<div class="call-top"><span class="call-id">${escapeHtml(call.id)}</span><span class="severity ${call.level}">${escapeHtml(statusLabel)}</span></div><h3>${escapeHtml(call.title)}</h3><div class="call-meta"><span class="location">${escapeHtml(call.location)}</span><span>${escapeHtml(metaLabel)}</span></div>`;
      button.addEventListener('click', () => onSelectCall(call.id));
      dom.queue.append(button);
    });
    dom.callCount.textContent = String(Engine.pendingCount(state));
  }

  function renderUnits(state, onSelectUnit) {
    dom.unitList.innerHTML = '';
    unitPinEls.clear();
    state.units.forEach((unit) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `unit${state.selectedUnit === unit.id ? ' selected' : ''}${unit.status === 'busy' ? ' busy' : ''}`;
      button.setAttribute('aria-pressed', String(state.selectedUnit === unit.id));
      button.disabled = unit.status === 'busy';
      button.innerHTML = `<div class="unit-top"><span class="unit-id">${escapeHtml(unit.id)}</span><span class="status ${unit.status === 'busy' ? 'busy' : ''}">${unit.status === 'busy' ? 'En servicio' : 'Disponible'}</span></div><div class="unit-bottom"><span class="unit-type">${escapeHtml(unit.type)}</span></div><div class="unit-bottom"><span>${escapeHtml(unit.location)}</span><span>${unit.progress}%</span></div><div class="unit-progress"><span style="width:${unit.progress}%"></span></div>`;
      button.addEventListener('click', () => onSelectUnit(unit.id));
      dom.unitList.append(button);
    });
    dom.unitCount.textContent = String(state.units.filter((unit) => unit.status === 'free').length);
  }

  function renderRoutes(state) {
    dom.routeLayer.replaceChildren();
    state.calls.filter((call) => call.status === 'assigned').forEach((call) => {
      const unit = state.units.find((item) => item.id === call.assignedTo);
      if (!unit) return;
      const startX = call.routeStartX * 10;
      const startY = call.routeStartY * 6;
      const cornerX = call.x * 10;
      const cornerY = startY;
      const targetX = call.x * 10;
      const targetY = call.y * 6;
      const track = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      track.classList.add('route-track');
      track.setAttribute('d', `M ${startX} ${startY} L ${cornerX} ${cornerY} L ${targetX} ${targetY}`);
      dom.routeLayer.append(track);
      const progress = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      progress.classList.add('route-progress');
      const passedCorner = Math.abs(unit.y - call.routeStartY) > 0.01;
      const progressPath = passedCorner
        ? `M ${startX} ${startY} L ${cornerX} ${cornerY} L ${unit.x * 10} ${unit.y * 6}`
        : `M ${startX} ${startY} L ${unit.x * 10} ${unit.y * 6}`;
      progress.setAttribute('d', progressPath);
      dom.routeLayer.append(progress);
    });
  }

  function renderCrowd(call) {
    const group = document.createElement('div');
    group.className = 'crowd-group';
    group.style.left = `${call.x}%`;
    group.style.top = `${call.y}%`;
    group.setAttribute('aria-hidden', 'true');
    C.crowdPositions.forEach((position, index) => {
      const person = document.createElement('span');
      person.className = 'crowd-person';
      person.style.left = `${position[0]}%`;
      person.style.top = `${position[1]}%`;
      person.style.setProperty('--drift-x', `${((index % 5) - 2) * 2.5}px`);
      person.style.setProperty('--drift-y', `${((index % 4) - 1.5) * 2.5}px`);
      person.style.setProperty('--pace', `${2.1 + (index % 4) * 0.35}s`);
      person.style.setProperty('--delay', `${-index * 0.14}s`);
      group.append(person);
    });
    dom.mapWorld.append(group);
  }

  function renderMap(state, handlers) {
    dom.mapWorld.querySelectorAll('.unit-pin, .incident-pin, .map-poi, .crowd-group').forEach((pin) => pin.remove());
    incidentPinEls.clear();
    unitPinEls.clear();
    renderRoutes(state);
    C.mapPoints.forEach((point) => {
      const poi = document.createElement('button');
      poi.type = 'button';
      poi.className = `map-poi ${point.type}`;
      poi.style.left = `${point.x}%`;
      poi.style.top = `${point.y}%`;
      poi.title = point.name;
      poi.setAttribute('aria-label', point.name);
      poi.textContent = point.label;
      poi.addEventListener('click', () => { dom.mapTip.textContent = point.name; });
      dom.mapWorld.append(poi);
    });
    state.calls.filter((call) => call.status !== 'done').forEach((call) => {
      if (call.crowd) renderCrowd(call);
      const pin = document.createElement('button');
      pin.type = 'button';
      pin.className = `incident-pin${state.selectedCall === call.id ? ' selected' : ''}`;
      pin.style.left = `${call.x}%`;
      pin.style.top = `${call.y}%`;
      pin.setAttribute('aria-label', `Aviso ${call.id}: ${call.title}`);
      pin.innerHTML = `<span>${escapeHtml(call.kind)}</span>`;
      pin.addEventListener('click', () => handlers.onSelectCall(call.id));
      dom.mapWorld.append(pin);
      incidentPinEls.set(call.id, pin);
    });
    state.units.forEach((unit) => {
      const pin = document.createElement('button');
      pin.type = 'button';
      pin.className = `unit-pin${unit.status === 'busy' ? ' busy' : ''}${state.selectedUnit === unit.id ? ' selected' : ''}${unit.patrolTarget ? ' patrolling' : ''}`;
      pin.style.left = `${unit.x}%`;
      pin.style.top = `${unit.y}%`;
      pin.textContent = unit.id;
      pin.setAttribute('aria-label', `Seleccionar unidad ${unit.id}`);
      pin.addEventListener('click', () => handlers.onSelectUnit(unit.id));
      dom.mapWorld.append(pin);
      unitPinEls.set(unit.id, pin);
    });
  }

  // Se llama en cada frame: solo mueve los pines ya existentes, sin reconstruir el DOM.
  function updatePositions(state) {
    state.units.forEach((unit) => {
      const pin = unitPinEls.get(unit.id);
      if (pin) {
        pin.style.left = `${unit.x}%`;
        pin.style.top = `${unit.y}%`;
        const shouldPatrol = Boolean(unit.patrolTarget);
        pin.classList.toggle('patrolling', shouldPatrol);
      }
    });
    renderRoutes(state);
  }

  function renderSummary(state, handlers) {
    const call = state.calls.find((item) => item.id === state.selectedCall);
    const unit = state.units.find((item) => item.id === state.selectedUnit);
    if (call && unit) {
      dom.selectionSummary.innerHTML = `<strong>${escapeHtml(call.id)} · ${escapeHtml(unit.id)}</strong>${escapeHtml(call.title)}`;
    } else if (call) {
      dom.selectionSummary.innerHTML = `<strong>${escapeHtml(call.id)} · ${escapeHtml(call.title)}</strong>Ahora elige una unidad disponible.`;
    } else if (unit) {
      dom.selectionSummary.innerHTML = `<strong>${escapeHtml(unit.id)} seleccionada</strong>Elige un aviso, o haz clic en el mapa para enviarla de patrulla.`;
    } else {
      dom.selectionSummary.innerHTML = '<strong>Sin intervención seleccionada</strong>Elige un aviso y una unidad disponible.';
    }
    dom.dispatchBtn.disabled = !(call && unit && call.status === 'pending' && unit.status === 'free');

    if (call && call.status === 'awaiting_decision') {
      dom.decisionPanel.hidden = false;
      dom.decisionPanel.innerHTML = `<div><div class="decision-title">Decisión requerida · ${escapeHtml(call.id)}</div><div class="decision-copy">${escapeHtml(call.prompt)}</div></div><div class="decision-options"><button type="button" data-choice="dialogue">Dialogar y mediar</button><button type="button" data-choice="support">Pedir apoyo sanitario</button><button type="button" data-choice="reinforcements">Solicitar refuerzos</button></div>`;
      dom.decisionPanel.querySelectorAll('[data-choice]').forEach((button) => {
        button.addEventListener('click', () => handlers.onDecision(call.id, button.dataset.choice));
      });
    } else {
      dom.decisionPanel.hidden = true;
      dom.decisionPanel.innerHTML = '';
    }

    const waiting = state.calls.filter((item) => item.status === 'awaiting_decision');
    if (waiting.length) {
      dom.attentionBanner.hidden = false;
      dom.attentionBanner.innerHTML = '';
      waiting.forEach((item) => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'attention-chip';
        chip.textContent = `⚠ ${item.id} esperando decisión`;
        chip.addEventListener('click', () => handlers.onSelectCall(item.id));
        dom.attentionBanner.append(chip);
      });
    } else {
      dom.attentionBanner.hidden = true;
      dom.attentionBanner.innerHTML = '';
    }

    dom.patrolHint.hidden = !(unit && !call);

    const activeCrowd = state.calls.some((item) => item.crowd && item.status !== 'done');
    dom.mapTip.textContent = call
      ? `${call.id} · ${call.location}${unit ? '  /  ' + unit.id + ' seleccionado' : '  /  selecciona una unidad'}`
      : unit
        ? `${unit.id} lista. Haz clic en el mapa para mandarla de patrulla.`
        : activeCrowd
          ? 'Manifestación activa · personas en movimiento. Las unidades siguen avanzando solas.'
          : 'Las unidades se mueven solas; elige avisos conforme lleguen.';

    dom.served.textContent = String(state.served);
    dom.trust.textContent = `${Math.round(state.trust)}%`;
    dom.trust.className = `metric-value ${state.trust >= 65 ? 'good' : 'warn'}`;
    dom.available.textContent = `${state.units.filter((item) => item.status === 'free').length} / ${state.units.length}`;
    dom.response.textContent = state.served ? `${Math.round(state.responseTotal / state.served)} min` : '—';
    dom.score.textContent = String(Math.round(state.score));
  }

  function renderLog(state) {
    dom.log.innerHTML = '';
    state.logEntries.slice(0, 5).forEach((entry) => {
      const row = document.createElement('div');
      row.className = 'log-row';
      row.innerHTML = `<span class="log-time">${escapeHtml(entry.time)}</span><span>${escapeHtml(entry.text)}</span>`;
      dom.log.append(row);
    });
  }

  function renderHistory(state) {
    dom.historyList.innerHTML = '';
    C.districtNames.forEach((district) => {
      const row = document.createElement('div');
      row.className = 'history-row';
      row.innerHTML = `<span>${escapeHtml(district)}</span><strong>${state.districtHistory[district] || 0}</strong>`;
      dom.historyList.append(row);
    });
  }

  function renderSpeedControls(state) {
    dom.speedButtons.forEach((button) => {
      const value = Number(button.dataset.speed);
      button.classList.toggle('active', value === state.speed);
    });
    dom.pauseBtn.textContent = state.paused ? 'Reanudar' : 'Pausa';
    dom.pauseBtn.setAttribute('aria-pressed', String(state.paused));
    dom.soundBtn.textContent = state.soundOn ? '🔊 Sonido' : '🔈 Sin sonido';
    dom.soundBtn.setAttribute('aria-pressed', String(!state.soundOn));
  }

  function renderClockOnly(state) {
    dom.clock.textContent = timeString(state.clockMinutes);
  }

  function renderObjective(state) {
    if (!dom.objectiveBanner) return;
    if (state.scenarioKey === 'libre' || state.shiftMinutes == null) {
      dom.objectiveBanner.hidden = true;
      return;
    }
    dom.objectiveBanner.hidden = false;
    const elapsed = state.clockMinutes - state.startClock;
    const remaining = Math.max(0, Math.round(state.shiftMinutes - elapsed));
    const label = C.scenarios[state.scenarioKey] ? C.scenarios[state.scenarioKey].label : 'Turno';
    dom.objectiveBanner.innerHTML = `<strong>${escapeHtml(label)}</strong> · Objetivo: ${state.served}/${state.targetServed} avisos resueltos · quedan ${remaining} min`;
  }

  function renderEndScreen(state) {
    if (!state.gameOver) {
      dom.endOverlay.hidden = true;
      return;
    }
    dom.endOverlay.hidden = false;
    dom.endTitle.textContent = state.gameOver.won ? '✅ Turno superado' : '❌ Turno fallido';
    dom.endTitle.className = state.gameOver.won ? 'end-title won' : 'end-title lost';
    const reasonText = state.gameOver.reason === 'confianza'
      ? 'La confianza vecinal llegó a 0.'
      : state.gameOver.won
        ? 'Cumpliste el objetivo antes de que acabara el turno.'
        : 'Se acabó el turno sin cumplir el objetivo.';
    dom.endStats.innerHTML = `<p>${escapeHtml(reasonText)}</p><div class="end-stat-grid">
      <div><span>Avisos atendidos</span><strong>${state.served}</strong></div>
      <div><span>Confianza final</span><strong>${Math.round(state.trust)}%</strong></div>
      <div><span>Puntuación</span><strong>${Math.round(state.score)}</strong></div>
    </div>`;
  }

  function renderStartOverlay(visible) {
    dom.startOverlay.hidden = !visible;
  }

  function renderDifficultyBox(state) {
    const config = C.difficultyConfig[state.difficulty];
    dom.difficultyLabel.textContent = config.label;
    if (dom.difficultySelect) dom.difficultySelect.value = state.difficulty;
  }

  function renderFilters(state) {
    if (dom.districtFilter) dom.districtFilter.value = state.filterState.district;
    if (dom.priorityFilter) dom.priorityFilter.value = state.filterState.priority;
  }

  function renderAll(state, handlers) {
    renderClockOnly(state);
    dom.mapWorld.style.transform = `scale(${state.zoom})`;
    renderCalls(state, handlers.onSelectCall);
    renderUnits(state, handlers.onSelectUnit);
    renderMap(state, handlers);
    renderSummary(state, handlers);
    renderLog(state);
    renderHistory(state);
    renderDifficultyBox(state);
    renderFilters(state);
    renderSpeedControls(state);
    renderObjective(state);
    renderEndScreen(state);
  }

  const api = { cacheDom, renderAll, updatePositions, renderClockOnly, notify, renderSpeedControls, renderObjective, renderEndScreen, renderStartOverlay };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.Render = api;
  }
})(
  typeof window !== 'undefined' ? window : globalThis,
  typeof window !== 'undefined'
    ? { Utils: window.Utils, Engine: window.Engine, Constants: window.Constants }
    : { Utils: require('./utils.js'), Engine: require('./engine.js'), Constants: require('./constants.js') }
);
