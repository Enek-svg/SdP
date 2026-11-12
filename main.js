// main.js — conecta Engine + Render, maneja eventos de la interfaz y el bucle en tiempo real.
(function () {
  'use strict';

  const Utils = window.Utils;
  const C = window.Constants;
  const Engine = window.Engine;
  const Render = window.Render;

  const restored = Engine.restoreState();
  let state = restored || Engine.createState('libre');
  let menuOpen = !restored; // reabre el menú solo si no había sesión guardada
  let pendingScenario = null;
  let audioCtx = null;

  Render.cacheDom();
  Render.initMap();

  function startScenario(scenarioKey) {
    state = Engine.createState(scenarioKey);
    menuOpen = false;
    Render.renderStartOverlay(false);
    refreshAll();
  }

  function goToMenu() {
    menuOpen = true;
    Render.renderStartOverlay(true);
  }

  document.querySelectorAll('[data-scenario]').forEach((button) => {
    button.addEventListener('click', () => {
      pendingScenario = button.dataset.scenario;
      Render.renderBriefing(pendingScenario);
    });
  });
  document.getElementById('brief-back-btn').addEventListener('click', () => Render.showMenuStep('select'));
  document.getElementById('brief-start-btn').addEventListener('click', () => {
    if (pendingScenario) startScenario(pendingScenario);
  });
  document.getElementById('menu-btn').addEventListener('click', goToMenu);
  document.getElementById('retry-btn').addEventListener('click', () => {
    startScenario(state.scenarioKey);
  });
  document.getElementById('end-menu-btn').addEventListener('click', goToMenu);

  Render.renderStartOverlay(menuOpen);

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

  // --- selección de grupo y despacho tocando el mapa ---
  function selectUnit(unitId) {
    const unit = state.units.find((item) => item.id === unitId);
    if (!unit || unit.status !== 'free') return;
    state.selectedUnit = unitId;
    refreshAll();
  }

  // Tocar un aviso: si hay un grupo libre seleccionado, se despacha al momento;
  // si no, solo avisa de que hace falta elegir un grupo primero.
  function onIncidentClick(callId) {
    if (!state.selectedUnit) {
      Render.notify('Selecciona primero un grupo libre.');
      return;
    }
    const result = Engine.dispatchUnit(state, callId, state.selectedUnit);
    if (!result.ok) return;
    Render.notify(`${result.unit.id} en camino a ${result.call.location}.`);
    beep(660, 120);
    state.selectedUnit = null;
    refreshAll();
  }

  // El resultado se muestra primero dentro de la escena (con "Continuar"); el
  // refresco completo (que puede abrir la siguiente escena, si hay otra) se
  // hace solo cuando el jugador pulsa continuar.
  function onSceneChoice(callId, optionId) {
    const result = Engine.resolveScene(state, callId, optionId);
    if (!result.ok) return;
    beep(result.failed ? 300 : 880, result.failed ? 260 : 150);
    Render.showSceneResult({ callId, title: result.title, text: result.text, trustDelta: result.trustDelta, failed: result.failed }, () => {
      refreshAll();
    });
  }

  const handlers = { onSelectUnit: selectUnit, onIncidentClick, onSceneChoice };

  function refreshAll() {
    Render.renderAll(state, handlers);
    if (!menuOpen) Engine.saveState(state);
  }

  // --- clic en el mapa (fuera de un marcador): mandar el grupo seleccionado de patrulla ---
  const map = Render.getMap();
  map.on('click', (event) => {
    if (!state.selectedUnit) return;
    const unit = state.units.find((item) => item.id === state.selectedUnit);
    if (!unit || unit.status !== 'free') return;
    const percent = Utils.latLngToPercent(C.mapBounds, event.latlng.lat, event.latlng.lng);
    Engine.startPatrol(state, unit.id, percent.x, percent.y);
    Render.notify(`${unit.id} en patrulla hacia la zona indicada.`);
    refreshAll();
  });

  // --- botones fijos ---
  document.getElementById('new-call').addEventListener('click', () => {
    const result = Engine.generateRandomCall(state);
    if (!result.ok) {
      Render.notify('Hay demasiados avisos pendientes. Espera a que se resuelvan algunos.');
    } else {
      Render.notify(`Aviso ${result.call.id} registrado en ${result.call.location}.`);
      beep(520, 120);
    }
    refreshAll();
  });

  document.getElementById('reset-turn').addEventListener('click', () => {
    Engine.resetTurn(state, state.scenarioKey);
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

  document.getElementById('zoom-in').addEventListener('click', () => Render.zoomIn());
  document.getElementById('zoom-out').addEventListener('click', () => Render.zoomOut());

  function handleEvents(events) {
    events.forEach((event) => {
      if (event.type === 'arrived') {
        beep(740, 160);
      } else if (event.type === 'spawn') {
        beep(520, 120);
      } else if (event.type === 'gameover') {
        beep(event.won ? 920 : 220, event.won ? 260 : 400);
      }
    });
  }

  // --- bucle de animación en tiempo real ---
  let lastTimestamp = null;

  function loop(timestamp) {
    if (lastTimestamp === null) lastTimestamp = timestamp;
    const deltaRealSeconds = Math.min((timestamp - lastTimestamp) / 1000, 0.25);
    lastTimestamp = timestamp;

    const sceneOpen = state.calls.some((call) => call.status === 'awaiting_decision');
    if (!state.paused && !menuOpen && !sceneOpen) {
      const deltaGameMinutes = deltaRealSeconds * C.BASE_GAME_MINUTES_PER_SECOND * state.speed;
      const events = Engine.tick(state, deltaGameMinutes);
      if (events.length) {
        handleEvents(events);
        refreshAll();
      } else {
        Render.updatePositions(state);
        Render.renderClockOnly(state);
        Render.renderObjective(state);
      }
    }
    window.requestAnimationFrame(loop);
  }

  window.requestAnimationFrame(loop);

  // Autoguardado periódico (además de guardar en cada evento discreto).
  window.setInterval(() => { if (!menuOpen) Engine.saveState(state); }, 4000);
  window.addEventListener('beforeunload', () => { if (!menuOpen) Engine.saveState(state); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && !menuOpen) Engine.saveState(state);
  });

  refreshAll();
})();
