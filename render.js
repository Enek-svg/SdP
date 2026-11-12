// render.js — todo lo que toca el DOM y el mapa Leaflet. No decide reglas del juego, solo pinta `state`.
(function (root, deps) {
  'use strict';

  const { timeString, escapeHtml, percentToLatLng } = deps.Utils;
  const Engine = deps.Engine;
  const C = deps.Constants;

  const dom = {};
  let leafletMap = null;
  const unitMarkers = new Map();
  const incidentMarkers = new Map();
  const crowdMarkers = new Map();
  let routeLayers = [];

  function cacheDom() {
    dom.unitList = document.getElementById('units');
    dom.clock = document.getElementById('clock');
    dom.unitCount = document.getElementById('unit-count');
    dom.mapTip = document.getElementById('map-tip');
    dom.served = document.getElementById('served');
    dom.trust = document.getElementById('trust');
    dom.available = document.getElementById('available');
    dom.response = document.getElementById('response');
    dom.score = document.getElementById('score');
    dom.difficultyLabel = document.getElementById('difficulty');
    dom.difficultySelect = document.getElementById('difficulty-select');
    dom.historyList = document.getElementById('history-list');
    dom.log = document.getElementById('log');
    dom.toast = document.getElementById('toast');
    dom.pauseBtn = document.getElementById('pause-toggle');
    dom.soundBtn = document.getElementById('sound-toggle');
    dom.speedButtons = Array.from(document.querySelectorAll('[data-speed]'));
    dom.patrolHint = document.getElementById('patrol-hint');
    dom.objectiveBanner = document.getElementById('objective-banner');
    dom.startOverlay = document.getElementById('start-overlay');
    dom.menuSelect = document.getElementById('menu-select');
    dom.menuBrief = document.getElementById('menu-brief');
    dom.briefTitle = document.getElementById('brief-title');
    dom.briefText = document.getElementById('brief-text');
    dom.briefMeta = document.getElementById('brief-meta');
    dom.endOverlay = document.getElementById('end-overlay');
    dom.endTitle = document.getElementById('end-title');
    dom.endStats = document.getElementById('end-stats');
    dom.sceneOverlay = document.getElementById('scene-overlay');
    dom.dispatchOverlay = document.getElementById('dispatch-overlay');
  }

  // --- mapa Leaflet, sobre calles reales (Madrid · Puerta del Sol) ---
  function initMap() {
    leafletMap = L.map('map-canvas', { zoomControl: false, attributionControl: true })
      .setView([(C.mapBounds.north + C.mapBounds.south) / 2, (C.mapBounds.east + C.mapBounds.west) / 2], C.mapZoom);
    // OpenStreetMap estándar (sin API key); se oscurece con un filtro CSS en .leaflet-tile-pane
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      subdomains: 'abc',
      maxZoom: 19
    }).addTo(leafletMap);
    C.mapPoints.forEach((point) => {
      const ll = percentToLatLng(C.mapBounds, point.x, point.y);
      L.marker([ll.lat, ll.lng], {
        icon: L.divIcon({ className: '', html: `<div class="poi-marker ${point.type}">${escapeHtml(point.label)}</div>`, iconSize: [20, 20] }),
        interactive: false
      }).bindTooltip(point.name).addTo(leafletMap);
    });
    // peatones ambientales: vida de fondo por toda la ciudad, siempre en marcha
    C.crowdPositions.forEach((pos, i) => {
      const ll = percentToLatLng(C.mapBounds, pos[0], pos[1]);
      L.marker([ll.lat, ll.lng], {
        icon: L.divIcon({ className: '', html: `<div class="ambient-pedestrian" style="${wanderStyle(i, 4)}"></div>`, iconSize: [8, 8] }),
        interactive: false
      }).addTo(leafletMap);
    });
    return leafletMap;
  }

  // genera un estilo inline con variables CSS para que cada punto "deambule" de forma
  // distinta pero estable (sin Math.random, para no saltar entre renders)
  function wanderStyle(seed, range) {
    const driftX = (Math.sin(seed * 12.9898) * range).toFixed(1);
    const driftY = (Math.cos(seed * 78.233) * range).toFixed(1);
    const delay = ((seed * 0.53) % 3).toFixed(2);
    const pace = (2.4 + (seed % 5) * 0.45).toFixed(2);
    return `--drift-x:${driftX}px; --drift-y:${driftY}px; --delay:${delay}s; --pace:${pace}s;`;
  }

  function crowdPersonDots(count) {
    return C.crowdPositions.slice(0, count).map((pos, i) => (
      `<div class="crowd-person" style="left:${pos[0]}%; top:${pos[1]}%; ${wanderStyle(i, 6)}"></div>`
    )).join('');
  }

  function getMap() {
    return leafletMap;
  }

  function zoomIn() { if (leafletMap) leafletMap.zoomIn(); }
  function zoomOut() { if (leafletMap) leafletMap.zoomOut(); }

  function clearDynamicLayers() {
    unitMarkers.forEach((marker) => leafletMap.removeLayer(marker));
    incidentMarkers.forEach((marker) => leafletMap.removeLayer(marker));
    crowdMarkers.forEach((marker) => leafletMap.removeLayer(marker));
    unitMarkers.clear();
    incidentMarkers.clear();
    crowdMarkers.clear();
    routeLayers.forEach((layer) => leafletMap.removeLayer(layer));
    routeLayers = [];
  }

  function renderRoute(state) {
    routeLayers.forEach((layer) => leafletMap.removeLayer(layer));
    routeLayers = [];
    state.calls.filter((item) => item.status === 'assigned').forEach((call) => {
      const ids = Array.isArray(call.assignedTo) ? call.assignedTo : [call.assignedTo];
      ids.forEach((id) => {
        const unit = state.units.find((item) => item.id === id);
        if (!unit || unit.routeStartX == null) return;
        const start = percentToLatLng(C.mapBounds, unit.routeStartX, unit.routeStartY);
        const corner = percentToLatLng(C.mapBounds, call.x, unit.routeStartY);
        const target = percentToLatLng(C.mapBounds, call.x, call.y);
        const current = percentToLatLng(C.mapBounds, unit.x, unit.y);
        routeLayers.push(L.polyline([[start.lat, start.lng], [corner.lat, corner.lng], [target.lat, target.lng]], {
          color: '#f0bc65', weight: 3, opacity: 0.45, dashArray: '6 8', interactive: false
        }).addTo(leafletMap));
        const passedCorner = Math.abs(unit.y - unit.routeStartY) > 0.01;
        const pts = passedCorner
          ? [[start.lat, start.lng], [corner.lat, corner.lng], [current.lat, current.lng]]
          : [[start.lat, start.lng], [current.lat, current.lng]];
        routeLayers.push(L.polyline(pts, { color: '#f0bc65', weight: 3, interactive: false }).addTo(leafletMap));
      });
    });
  }

  function unitIcon(unit, selected) {
    const classes = `unit-marker${unit.status === 'busy' ? ' busy' : ''}${selected ? ' selected' : ''}${unit.patrolTarget ? ' patrolling' : ''}`;
    return L.divIcon({ className: '', html: `<div class="${classes}">${escapeHtml(unit.id)}</div>`, iconSize: [30, 25] });
  }

  function incidentIcon(call, selected) {
    const classes = `incident-marker severity-${call.level}${selected ? ' selected' : ''}`;
    return L.divIcon({ className: '', html: `<div class="${classes}"><span>${escapeHtml(call.kind)}</span></div>`, iconSize: [23, 23] });
  }

  function renderMap(state, handlers) {
    clearDynamicLayers();
    state.calls.filter((call) => call.status !== 'done').forEach((call) => {
      const ll = percentToLatLng(C.mapBounds, call.x, call.y);
      if (call.crowd) {
        const crowdMarker = L.marker([ll.lat, ll.lng], {
          icon: L.divIcon({ className: '', html: `<div class="crowd-marker">${crowdPersonDots(12)}</div>`, iconSize: [70, 70] }),
          interactive: false
        }).addTo(leafletMap);
        crowdMarkers.set(call.id, crowdMarker);
      }
      const marker = L.marker([ll.lat, ll.lng], { icon: incidentIcon(call, state.selectedCall === call.id) })
        .addTo(leafletMap)
        .on('click', (event) => {
          L.DomEvent.stopPropagation(event);
          handlers.onIncidentClick(call.id);
        });
      incidentMarkers.set(call.id, marker);
    });
    state.units.forEach((unit) => {
      const ll = percentToLatLng(C.mapBounds, unit.x, unit.y);
      const marker = L.marker([ll.lat, ll.lng], { icon: unitIcon(unit, state.selectedUnit === unit.id), zIndexOffset: 500 })
        .addTo(leafletMap)
        .on('click', (event) => {
          L.DomEvent.stopPropagation(event);
          handlers.onSelectUnit(unit.id);
        });
      unitMarkers.set(unit.id, marker);
    });
    renderRoute(state);
  }

  // Se llama en cada frame: solo mueve los marcadores ya existentes, sin reconstruir el mapa.
  function updatePositions(state) {
    state.units.forEach((unit) => {
      const marker = unitMarkers.get(unit.id);
      if (marker) {
        const ll = percentToLatLng(C.mapBounds, unit.x, unit.y);
        marker.setLatLng([ll.lat, ll.lng]);
      }
    });
    renderRoute(state);
  }

  function renderUnits(state, onSelectUnit) {
    dom.unitList.innerHTML = '';
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

  function renderSummary(state) {
    const unit = state.units.find((item) => item.id === state.selectedUnit);
    dom.patrolHint.hidden = !unit;
    const activeCrowd = state.calls.some((item) => item.crowd && item.status !== 'done');
    dom.mapTip.textContent = unit
      ? `${unit.id} lista. Toca un aviso para despacharla o el mapa para patrulla.`
      : activeCrowd
        ? 'Manifestación activa · toca un grupo libre y después un aviso.'
        : 'Toca un grupo libre y después un aviso para despacharlo.';
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
    if (visible) showMenuStep('select');
  }

  function showMenuStep(step) {
    dom.menuSelect.hidden = step !== 'select';
    dom.menuBrief.hidden = step !== 'brief';
  }

  function renderBriefing(scenarioKey) {
    const scenario = C.scenarios[scenarioKey];
    if (!scenario) return;
    dom.briefTitle.textContent = scenario.label;
    dom.briefText.textContent = scenario.briefing;
    const metaParts = [];
    if (scenario.shiftMinutes != null) {
      metaParts.push(`Duración: ${Math.round(scenario.shiftMinutes / 60 * 10) / 10}h de turno`);
      metaParts.push(`Objetivo: ${scenario.targetServed} avisos resueltos`);
    } else {
      metaParts.push('Sin límite de tiempo ni objetivo');
    }
    dom.briefMeta.textContent = metaParts.join(' · ');
    showMenuStep('brief');
  }

  function renderDifficultyBox(state) {
    const config = C.difficultyConfig[state.difficulty];
    dom.difficultyLabel.textContent = config.label;
    if (dom.difficultySelect) dom.difficultySelect.value = state.difficulty;
  }

  // Escena a pantalla completa cuando una unidad llega a un aviso: texto de la
  // situación y opciones. Solo se reconstruye por un evento discreto (no en
  // cada frame), así que es seguro reescribir el innerHTML.
  function renderSceneOverlay(state, handlers) {
    const call = state.calls.find((item) => item.status === 'awaiting_decision');
    if (!call) {
      dom.sceneOverlay.hidden = true;
      dom.sceneOverlay.innerHTML = '';
      return;
    }
    const script = Engine.getSceneScript(call.kind);
    const intro = script.intro.replace('{location}', call.location);
    const optionsHtml = script.options
      .map((option) => `<button type="button" class="scene-option" data-option="${escapeHtml(option.id)}">${escapeHtml(option.label)}</button>`)
      .join('');
    dom.sceneOverlay.hidden = false;
    dom.sceneOverlay.innerHTML = `<div class="overlay-card scene-card">
      <div class="eyebrow">${escapeHtml(call.id)} · ${escapeHtml(call.location)}</div>
      <h2>${escapeHtml(script.title)}</h2>
      <div class="scene-units">${(Array.isArray(call.assignedTo) ? call.assignedTo : [call.assignedTo]).map((id) => `<span class="scene-unit-chip">${escapeHtml(id)}</span>`).join('')}</div>
      <p class="scene-intro">${escapeHtml(intro)}</p>
      <div class="scene-options">${optionsHtml}</div>
    </div>`;
    dom.sceneOverlay.querySelectorAll('[data-option]').forEach((button) => {
      button.addEventListener('click', () => handlers.onSceneChoice(call.id, button.dataset.option));
    });
  }

  function showSceneResult({ callId, title, text, trustDelta, failed }, onContinue) {
    const sign = trustDelta > 0 ? '+' : '';
    dom.sceneOverlay.hidden = false;
    dom.sceneOverlay.innerHTML = `<div class="overlay-card scene-card">
      <div class="eyebrow">${escapeHtml(callId)} · ${failed ? 'complicación' : 'resultado'}</div>
      <h2>${escapeHtml(title)}</h2>
      <p class="scene-intro">${escapeHtml(text)}</p>
      <p class="scene-trust ${trustDelta >= 0 ? 'good' : 'warn'}">Confianza vecinal: ${sign}${trustDelta}%</p>
      <div class="scene-options"><button type="button" class="primary" id="scene-continue">Continuar</button></div>
    </div>`;
    document.getElementById('scene-continue').addEventListener('click', onContinue);
  }

  function renderDispatchPanel(call, freeUnits, onConfirm, onCancel) {
    if (!call) { hideDispatchPanel(); return; }
    const rows = freeUnits.map((unit) => `
      <label class="dispatch-unit-row">
        <input type="checkbox" value="${escapeHtml(unit.id)}" />
        <span class="dispatch-unit-id">${escapeHtml(unit.id)}</span>
        <span class="dispatch-unit-type">${escapeHtml(unit.type)} · ${escapeHtml(unit.location)}</span>
      </label>`).join('');
    dom.dispatchOverlay.hidden = false;
    dom.dispatchOverlay.innerHTML = `<div class="overlay-card dispatch-card">
      <div class="eyebrow">${escapeHtml(call.id)} · ${escapeHtml(call.location)}</div>
      <h2>${escapeHtml(call.title)}</h2>
      <p class="scene-intro">Elige qué grupos enviar a este aviso.</p>
      <div class="dispatch-unit-list">${rows || '<p class="scene-intro">No hay grupos libres.</p>'}</div>
      <div class="scene-options dispatch-actions-row">
        <button type="button" class="mini-btn" id="dispatch-cancel">Cancelar</button>
        <button type="button" class="primary" id="dispatch-confirm" disabled>Enviar grupos</button>
      </div>
    </div>`;
    const boxes = Array.from(dom.dispatchOverlay.querySelectorAll('input[type="checkbox"]'));
    const confirmBtn = document.getElementById('dispatch-confirm');
    boxes.forEach((cb) => cb.addEventListener('change', () => { confirmBtn.disabled = !boxes.some((x) => x.checked); }));
    confirmBtn.addEventListener('click', () => onConfirm(boxes.filter((x) => x.checked).map((x) => x.value)));
    document.getElementById('dispatch-cancel').addEventListener('click', onCancel);
  }

  function hideDispatchPanel() {
    dom.dispatchOverlay.hidden = true;
    dom.dispatchOverlay.innerHTML = '';
  }

  function notify(message) {
    dom.toast.textContent = message;
    dom.toast.classList.add('show');
    window.clearTimeout(notify.timeout);
    notify.timeout = window.setTimeout(() => dom.toast.classList.remove('show'), 2200);
  }

  function renderAll(state, handlers) {
    renderClockOnly(state);
    renderMap(state, handlers);
    renderUnits(state, handlers.onSelectUnit);
    renderSummary(state);
    renderLog(state);
    renderHistory(state);
    renderDifficultyBox(state);
    renderSpeedControls(state);
    renderObjective(state);
    renderEndScreen(state);
    renderSceneOverlay(state, handlers);
  }

  const api = {
    cacheDom, initMap, getMap, zoomIn, zoomOut,
    renderAll, updatePositions, renderClockOnly, renderObjective, renderSpeedControls,
    renderStartOverlay, renderBriefing, showMenuStep,
    showSceneResult, notify, renderDispatchPanel, hideDispatchPanel
  };

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
