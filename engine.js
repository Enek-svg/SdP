// engine.js — estado y lógica del juego, sin tocar el DOM. Así se puede probar con Node.
(function (root, deps) {
  'use strict';

  const { clamp, timeString, randomItem, randomBetween, numberOr } = deps.Utils;
  const C = deps.Constants;

  function cloneData(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function freshDistrictHistory() {
    return Object.fromEntries(C.districtNames.map((name) => [name, 0]));
  }

  function createState(scenarioKey) {
    const key = C.scenarios[scenarioKey] ? scenarioKey : 'libre';
    const scenario = C.scenarios[key];
    const startClock = 8 * 60 + 42;
    return {
      scenarioKey: key,
      shiftMinutes: scenario.shiftMinutes,
      targetServed: scenario.targetServed,
      spawnMultiplier: scenario.spawnMultiplier,
      severityBoost: scenario.severityBoost,
      failOnZeroTrust: scenario.failOnZeroTrust,
      startClock,
      gameOver: null,
      calls: cloneData(C.baseCalls),
      units: cloneData(C.baseUnits),
      selectedCall: null,
      selectedUnit: null,
      clockMinutes: startClock,
      served: 0,
      trust: 78,
      responseTotal: 0,
      gameTicks: 0,
      score: 0,
      difficulty: 'media',
      districtHistory: freshDistrictHistory(),
      filterState: { district: 'all', priority: 'all' },
      zoom: 1,
      speed: 3,
      paused: false,
      soundOn: true,
      logEntries: [{ time: timeString(startClock), text: 'Turno iniciado. Cuatro unidades disponibles.' }],
      spawnTimer: randomBetween(C.difficultyConfig.media.spawnMin, C.difficultyConfig.media.spawnMax) / scenario.spawnMultiplier,
      trustCheckAcc: 0
    };
  }

  function getPriorityValue(level) {
    return C.severityRank[level] || 0;
  }

  function sortQueue(state) {
    state.calls.sort((a, b) => {
      const order = { pending: 0, assigned: 1, awaiting_decision: 2, done: 3 };
      const aState = order[a.status] ?? 3;
      const bState = order[b.status] ?? 3;
      if (aState !== bState) return aState - bState;
      return getPriorityValue(b.level) - getPriorityValue(a.level);
    });
  }

  function getVisibleCalls(state) {
    return state.calls.filter((call) => {
      const districtMatch = state.filterState.district === 'all' || call.location === state.filterState.district;
      const priorityMatch = state.filterState.priority === 'all' || call.level === state.filterState.priority;
      return districtMatch && priorityMatch;
    });
  }

  function pendingCount(state) {
    return state.calls.filter((call) => call.status === 'pending').length;
  }

  function addLog(state, text) {
    state.logEntries.unshift({ time: timeString(state.clockMinutes), text });
    state.logEntries = state.logEntries.slice(0, 6);
  }

  // Posición a lo largo de la ruta en L (horizontal y luego vertical) según el progreso 0..1.
  function routePositionAt(startX, startY, targetX, targetY, progress) {
    const horizontalDistance = Math.abs(targetX - startX);
    const verticalDistance = Math.abs(targetY - startY);
    const distance = horizontalDistance + verticalDistance;
    if (distance === 0) return { x: targetX, y: targetY };
    const traveled = distance * clamp(progress, 0, 1);
    if (traveled <= horizontalDistance) {
      const direction = Math.sign(targetX - startX);
      return { x: startX + direction * traveled, y: startY };
    }
    const direction = Math.sign(targetY - startY);
    return { x: targetX, y: startY + direction * Math.min(verticalDistance, traveled - horizontalDistance) };
  }

  function updateScore(state) {
    const config = C.difficultyConfig[state.difficulty];
    const avgResponse = state.served ? state.responseTotal / state.served : 0;
    const pendingPenalty = pendingCount(state) * 14;
    const raw = state.served * 180 + state.trust * 2 - avgResponse * 2 - pendingPenalty;
    state.score = Math.max(0, Math.round(raw * config.scoreMultiplier));
  }

  function generateRandomCall(state, { silent = false } = {}) {
    if (state.gameOver) return { ok: false, reason: 'game_over' };
    if (pendingCount(state) >= 7) {
      return { ok: false, reason: 'queue_full' };
    }
    const template = randomItem(C.callTemplates);
    let id = `AV-${String(220 + Math.floor(Math.random() * 60)).padStart(3, '0')}`;
    while (state.calls.some((call) => call.id === id)) {
      id = `AV-${String(220 + Math.floor(Math.random() * 60)).padStart(3, '0')}`;
    }
    const difficultyFactor = C.difficultyConfig[state.difficulty].callFactor;
    const boost = numberOr(state.severityBoost, 1);
    const severityBias = Math.random() < 0.4 * difficultyFactor * boost ? 'high' : template.level;
    const call = {
      id,
      title: template.title,
      location: template.location,
      severity: template.severity,
      level: severityBias,
      x: template.x,
      y: template.y,
      kind: template.kind,
      crowd: Boolean(template.crowd),
      status: 'pending',
      minutes: 0
    };
    state.calls.push(call);
    sortQueue(state);
    if (!silent) addLog(state, `Nuevo aviso ${id} recibido en ${call.location}.`);
    return { ok: true, call };
  }

  function dispatchUnit(state, callId, unitId, approachKey) {
    if (state.gameOver) return { ok: false };
    const call = state.calls.find((item) => item.id === callId);
    const unit = state.units.find((item) => item.id === unitId);
    if (!call || !unit || call.status !== 'pending' || unit.status !== 'free') {
      return { ok: false };
    }
    const approach = C.approachConfig[approachKey] || C.approachConfig['diálogo'];
    call.status = 'assigned';
    call.minutes = 0;
    call.travelElapsed = 0;
    call.assignedTo = unit.id;
    call.approach = approachKey;
    call.routeStartX = unit.x;
    call.routeStartY = unit.y;
    const routeDistance = Math.abs(call.x - unit.x) + Math.abs(call.y - unit.y) * 0.6;
    const baseTravel = Math.max(5, Math.min(30, Math.ceil(routeDistance / 18) * 5));
    call.travelMinutes = Math.max(3, Math.round(baseTravel * approach.travelFactor));
    unit.status = 'busy';
    unit.callId = call.id;
    unit.patrolTarget = null;
    addLog(state, `${unit.id} asignada a ${call.id}: ${approach.label}.`);
    return { ok: true, call, unit };
  }

  function resolveDecision(state, callId, choice) {
    if (state.gameOver) return { ok: false };
    const call = state.calls.find((item) => item.id === callId);
    if (!call || call.status !== 'awaiting_decision') return { ok: false };
    const unit = state.units.find((item) => item.id === call.assignedTo);
    const outcome = C.decisionOutcomes[choice];
    if (!outcome) return { ok: false };
    const approach = C.approachConfig[call.approach];
    const bonus = approach && approach.matchesDecision === choice ? approach.bonusTrust : 0;
    call.status = 'done';
    call.minutes += outcome.extraMinutes;
    state.served += 1;
    state.responseTotal += call.minutes;
    state.trust = clamp(state.trust + outcome.trust + bonus + C.difficultyConfig[state.difficulty].trustBonus, 0, 99);
    state.districtHistory[call.location] = (state.districtHistory[call.location] || 0) + 1;
    if (unit) {
      unit.status = 'free';
      unit.callId = null;
      unit.location = call.location;
      unit.progress = Math.min(100, unit.progress + 4);
    }
    const bonusText = bonus ? ' (enfoque acertado, +confianza)' : '';
    addLog(state, `${call.assignedTo} ${outcome.text} (${call.id}).${bonusText}`);
    if (state.selectedCall === call.id) state.selectedCall = null;
    return { ok: true, call, outcomeText: outcome.text, bonus };
  }

  function startPatrol(state, unitId, x, y) {
    if (state.gameOver) return { ok: false };
    const unit = state.units.find((item) => item.id === unitId);
    if (!unit || unit.status !== 'free') return { ok: false };
    unit.patrolTarget = { x: clamp(x, 2, 98), y: clamp(y, 2, 98) };
    return { ok: true, unit };
  }

  // Avanza el estado `deltaMinutes` minutos de juego (puede ser fraccionario).
  // Devuelve una lista de eventos para que quien dibuje decida si necesita un
  // refresco completo o solo mover los pines.
  function tick(state, deltaMinutes) {
    const events = [];
    if (state.gameOver || deltaMinutes <= 0) return events;
    state.clockMinutes += deltaMinutes;
    state.gameTicks += deltaMinutes;

    state.calls.filter((call) => call.status === 'assigned').forEach((call) => {
      const travelMinutes = Math.max(3, Number(call.travelMinutes) || 10);
      call.travelElapsed = Math.min(travelMinutes, (call.travelElapsed || 0) + deltaMinutes);
      call.minutes = call.travelElapsed;
      const unit = state.units.find((item) => item.id === call.assignedTo);
      if (unit) {
        const progress = call.travelElapsed / travelMinutes;
        const position = routePositionAt(call.routeStartX, call.routeStartY, call.x, call.y, progress);
        unit.x = position.x;
        unit.y = position.y;
      }
      if (call.travelElapsed >= travelMinutes) {
        call.status = 'awaiting_decision';
        call.prompt = `La unidad ${call.assignedTo} ya está en ${call.location}. ¿Cómo quieres gestionar el aviso?`;
        addLog(state, `${call.id}: la unidad ha llegado. Se necesita una decisión.`);
        events.push({ type: 'arrived', callId: call.id });
      }
    });

    // Patrullas libres: unidades sin aviso que el jugador movió manualmente por el mapa.
    state.units.filter((unit) => unit.status === 'free' && unit.patrolTarget).forEach((unit) => {
      const speed = 1.4; // % del mapa por minuto de juego
      const dx = unit.patrolTarget.x - unit.x;
      const dy = unit.patrolTarget.y - unit.y;
      const distance = Math.hypot(dx, dy);
      const step = speed * deltaMinutes;
      if (distance <= step || distance === 0) {
        unit.x = unit.patrolTarget.x;
        unit.y = unit.patrolTarget.y;
        unit.patrolTarget = null;
      } else {
        unit.x += (dx / distance) * step;
        unit.y += (dy / distance) * step;
      }
    });

    state.spawnTimer -= deltaMinutes;
    if (state.spawnTimer <= 0) {
      const config = C.difficultyConfig[state.difficulty];
      const multiplier = numberOr(state.spawnMultiplier, 1);
      state.spawnTimer = randomBetween(config.spawnMin, config.spawnMax) / multiplier;
      const result = generateRandomCall(state);
      if (result.ok) events.push({ type: 'spawn', callId: result.call.id });
    }

    state.trustCheckAcc += deltaMinutes;
    if (state.trustCheckAcc >= 10) {
      state.trustCheckAcc = 0;
      if (pendingCount(state) > 4 && state.trust > 0 && Math.random() < 0.3) {
        state.trust = Math.max(0, state.trust - 1);
        events.push({ type: 'trust_drop' });
      }
    }

    if (state.failOnZeroTrust && state.trust <= 0) {
      state.gameOver = { won: false, reason: 'confianza' };
      state.paused = true;
      addLog(state, 'La confianza vecinal se ha derrumbado. Turno fallido.');
      events.push({ type: 'gameover', won: false });
    } else if (state.shiftMinutes != null && state.clockMinutes - state.startClock >= state.shiftMinutes) {
      const won = state.served >= state.targetServed;
      state.gameOver = { won, reason: 'tiempo' };
      state.paused = true;
      addLog(state, won ? 'Fin del turno: objetivo cumplido.' : 'Fin del turno: objetivo no alcanzado.');
      events.push({ type: 'gameover', won });
    }

    updateScore(state);
    return events;
  }

  function setDifficulty(state, nextDifficulty) {
    if (!C.difficultyConfig[nextDifficulty]) return;
    state.difficulty = nextDifficulty;
    updateScore(state);
  }

  function resetTurn(state, scenarioKey) {
    const fresh = createState(scenarioKey || state.scenarioKey);
    Object.assign(state, fresh);
  }

  function saveState(state) {
    try {
      window.localStorage.setItem(C.STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch (error) {
      console.warn('No se pudo guardar la sesión', error);
      return false;
    }
  }

  function restoreState() {
    try {
      const raw = window.localStorage.getItem(C.STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.calls) || !Array.isArray(parsed.units)) return null;
      const state = createState(parsed.scenarioKey);
      state.gameOver = parsed.gameOver && typeof parsed.gameOver === 'object' ? parsed.gameOver : null;
      state.startClock = numberOr(parsed.startClock, state.startClock);
      state.calls = parsed.calls;
      state.units = parsed.units;
      // Asegura que no falte la manifestación si se perdió por algún motivo.
      if (!state.calls.some((call) => call.crowd)) {
        const demonstration = C.baseCalls.find((call) => call.crowd);
        if (demonstration && pendingCount(state) < 7 && !state.calls.some((call) => call.id === demonstration.id)) {
          state.calls.push(cloneData(demonstration));
        }
      }
      state.calls.filter((call) => call.status === 'assigned').forEach((call) => {
        const unit = state.units.find((item) => item.id === call.assignedTo);
        call.routeStartX = numberOr(call.routeStartX, unit ? unit.x : call.x);
        call.routeStartY = numberOr(call.routeStartY, unit ? unit.y : call.y);
        call.travelMinutes = Math.max(3, numberOr(call.travelMinutes, 10));
        call.travelElapsed = numberOr(call.travelElapsed, call.minutes || 0);
      });
      state.selectedCall = parsed.selectedCall || null;
      state.selectedUnit = parsed.selectedUnit || null;
      state.clockMinutes = numberOr(parsed.clockMinutes, state.clockMinutes);
      state.served = numberOr(parsed.served, 0);
      state.trust = numberOr(parsed.trust, 78);
      state.responseTotal = numberOr(parsed.responseTotal, 0);
      state.gameTicks = numberOr(parsed.gameTicks, 0);
      state.zoom = numberOr(parsed.zoom, 1);
      state.speed = numberOr(parsed.speed, 3);
      state.paused = Boolean(parsed.paused);
      state.soundOn = parsed.soundOn !== false;
      state.score = numberOr(parsed.score, 0);
      state.difficulty = parsed.difficulty && C.difficultyConfig[parsed.difficulty] ? parsed.difficulty : 'media';
      state.districtHistory = parsed.districtHistory && typeof parsed.districtHistory === 'object'
        ? { ...freshDistrictHistory(), ...parsed.districtHistory }
        : freshDistrictHistory();
      state.filterState = parsed.filterState && typeof parsed.filterState === 'object'
        ? { district: 'all', priority: 'all', ...parsed.filterState }
        : { district: 'all', priority: 'all' };
      state.logEntries = Array.isArray(parsed.logEntries) && parsed.logEntries.length
        ? parsed.logEntries.slice(0, 6)
        : [{ time: timeString(state.clockMinutes), text: 'Turno recuperado.' }];
      state.spawnTimer = numberOr(parsed.spawnTimer, randomBetween(6, 15));
      state.trustCheckAcc = numberOr(parsed.trustCheckAcc, 0);
      return state;
    } catch (error) {
      console.warn('No se pudo restaurar la sesión', error);
      return null;
    }
  }

  const api = {
    createState,
    sortQueue,
    getVisibleCalls,
    pendingCount,
    addLog,
    routePositionAt,
    updateScore,
    generateRandomCall,
    dispatchUnit,
    resolveDecision,
    startPatrol,
    tick,
    setDifficulty,
    resetTurn,
    saveState,
    restoreState
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.Engine = api;
  }
})(
  typeof window !== 'undefined' ? window : globalThis,
  typeof window !== 'undefined'
    ? { Utils: window.Utils, Constants: window.Constants }
    : { Utils: require('./utils.js'), Constants: require('./constants.js') }
);
