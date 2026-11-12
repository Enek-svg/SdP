// main.js — conecta Engine + Render, maneja eventos de la interfaz y el bucle en tiempo real.
(function () {
  'use strict';

  const Utils = window.Utils;
  const C = window.Constants;
  const Engine = window.Engine;
  const Render = window.Render;

  let state = Engine.restoreState() || Engine.createState();
  let audioCtx = null;

  Render.cacheDom();

  // --- sonido (beeps simples con WebAudio, sin ficheros de audio) ---
  function ensureAudio() {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) audioCtx = new AudioContext();
    }
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  }

  function beep(frequency, durationMs) {
    if (!state.soundOn || !audioCtx) return;
    const oscillator = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    oscillator.frequency.value = frequency;
    oscillator.type = 'sine';
    gain.gain.value = 0.05;
    oscillator.connect(gain);
    gain.connect(audioCtx.destination);
    oscillator.start();
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + durationMs / 1000);
    oscillator.stop(audioCtx.currentTime + durationMs / 1000);
  }

  document.addEventListener('pointerdown', ensureAudio, { once: true });

  // --- selección de aviso / unidad ---
  function selectCall(callId) {
    const call = state.calls.find((item) => item.id === callId);
    if (!call || call.status === 'done') return;
    state.selectedCall = callId;
    if (call.status === 'pending') state.selectedUnit = null;
    refreshAll();
  }

  function selectUnit(unitId) {
    const unit = state.units.find((item) => item.id === unitId);
    if (!unit || unit.status !== 'free') return;
    state.selectedUnit = unitId;
    refreshAll();
  }

  function onDecision(callId, choice) {
    const result = Engine.resolveDecision(state, callId, choice);
    if (!result.ok) return;
    Render.notify(`${callId}: ${result.outcomeText}.`);
    beep(880, 140);
    Engine.updateScore(state);
    refreshAll();
  }

  const handlers = { onSelectCall: selectCall, onSelectUnit: selectUnit, onDecision };

  function refreshAll() {
    Render.renderAll(state, handlers);
    Engine.saveState(state);
  }

  // --- clic en el mapa: despachar unidad a un aviso, o mandarla de patrulla libre ---
  const mapWorld = document.getElementById('map-world');
  mapWorld.addEventListener('click', (event) => {
    if (event.target.closest('.unit-pin, .incident-pin, .map-poi')) return; // ya gestionado por su propio listener
    if (!state.selectedUnit) return;
    const unit = state.units.find((item) => item.id === state.selectedUnit);
    if (!unit || unit.status !== 'free') return;
    const rect = mapWorld.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    Engine.startPatrol(state, unit.id, x, y);
    Render.notify(`${unit.id} en patrulla hacia la zona indicada.`);
    refreshAll();
  });

  // --- botones fijos ---
  document.getElementById('new-call').addEventListener('click', () => {
    const result = Engine.generateRandomCall(state);
    if (!result.ok) {
      Render.notify('Hay demasiados avisos pendientes. Revisa la cola antes de añadir más.');
    } else {
      Render.notify(`Aviso ${result.call.id} registrado en ${result.call.location}.`);
      beep(520, 120);
    }
    refreshAll();
  });

  document.getElementById('reset-turn').addEventListener('click', () => {
    Engine.resetTurn(state);
    refreshAll();
  });

  document.getElementById('save-session').addEventListener('click', () => {
    Engine.saveState(state);
    Render.notify('Sesión guardada en el navegador.');
  });

  document.getElementById('difficulty-select').addEventListener('change', (event) => {
    Engine.setDifficulty(state, event.target.value);
    refreshAll();
  });

  document.getElementById('district-filter').addEventListener('change', (event) => {
    state.filterState.district = event.target.value;
    refreshAll();
  });

  document.getElementById('priority-filter').addEventListener('change', (event) => {
    state.filterState.priority = event.target.value;
    refreshAll();
  });

  document.getElementById('dispatch').addEventListener('click', () => {
    const approach = document.getElementById('approach').value;
    const result = Engine.dispatchUnit(state, state.selectedCall, state.selectedUnit, approach);
    if (!result.ok) return;
    Render.notify(`${result.unit.id} en camino a ${result.call.location}.`);
    beep(660, 120);
    state.selectedCall = null;
    state.selectedUnit = null;
    refreshAll();
  });

  document.getElementById('advance').addEventListener('click', () => {
    const events = Engine.tick(state, 15);
    handleEvents(events);
    refreshAll();
  });

  document.getElementById('pause-toggle').addEventListener('click', () => {
    state.paused = !state.paused;
    Render.renderSpeedControls(state);
    Engine.saveState(state);
  });

  document.getElementById('sound-toggle').addEventListener('click', () => {
    ensureAudio();
    state.soundOn = !state.soundOn;
    Render.renderSpeedControls(state);
    Engine.saveState(state);
  });

  document.querySelectorAll('[data-speed]').forEach((button) => {
    button.addEventListener('click', () => {
      state.speed = Number(button.dataset.speed);
      Render.renderSpeedControls(state);
      Engine.saveState(state);
    });
  });

  document.getElementById('zoom-in').addEventListener('click', () => {
    state.zoom = Math.min(1.25, state.zoom + 0.05);
    refreshAll();
  });
  document.getElementById('zoom-out').addEventListener('click', () => {
    state.zoom = Math.max(0.8, state.zoom - 0.05);
    refreshAll();
  });

  function handleEvents(events) {
    events.forEach((event) => {
      if (event.type === 'arrived') {
        Render.notify(`Decisión pendiente para ${event.callId}.`);
        beep(740, 160);
      } else if (event.type === 'spawn') {
        beep(520, 120);
      }
    });
  }

  // --- bucle de animación en tiempo real ---
  let lastTimestamp = null;

  function loop(timestamp) {
    if (lastTimestamp === null) lastTimestamp = timestamp;
    const deltaRealSeconds = Math.min((timestamp - lastTimestamp) / 1000, 0.25);
    lastTimestamp = timestamp;

    if (!state.paused) {
      const deltaGameMinutes = deltaRealSeconds * C.BASE_GAME_MINUTES_PER_SECOND * state.speed;
      const events = Engine.tick(state, deltaGameMinutes);
      if (events.length) {
        handleEvents(events);
        refreshAll();
      } else {
        Render.updatePositions(state);
        Render.renderClockOnly(state);
      }
    }
    window.requestAnimationFrame(loop);
  }

  window.requestAnimationFrame(loop);

  // Autoguardado periódico (además de guardar en cada evento discreto).
  window.setInterval(() => Engine.saveState(state), 4000);
  window.addEventListener('beforeunload', () => Engine.saveState(state));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') Engine.saveState(state);
  });

  refreshAll();
})();
