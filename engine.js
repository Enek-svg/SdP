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
      report: [],
      logEntries: [{ time: timeString(startClock), text: `Turno iniciado. ${C.baseUnits.length} grupos disponibles.` }],
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

  function newCallId(state) {
    let id = `AV-${String(220 + Math.floor(Math.random() * 60)).padStart(3, '0')}`;
    while (state.calls.some((call) => call.id === id)) {
      id = `AV-${String(220 + Math.floor(Math.random() * 60)).padStart(3, '0')}`;
    }
    return id;
  }

  const severityLabel = { low: 'prioridad baja', medium: 'media', high: 'alta' };

  function generateRandomCall(state, { silent = false } = {}) {
    if (state.gameOver) return { ok: false, reason: 'game_over' };
    if (pendingCount(state) >= 7) {
      return { ok: false, reason: 'queue_full' };
    }
    const template = randomItem(C.callTemplates);
    const id = newCallId(state);
    const difficultyFactor = C.difficultyConfig[state.difficulty].callFactor;
    const boost = numberOr(state.severityBoost, 1);
    const severityBias = Math.random() < 0.4 * difficultyFactor * boost ? 'high' : template.level;
    const call = {
      id,
      title: template.title,
      location: template.location,
      place: template.place || template.location,
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

  // Despacha uno o varios grupos libres a un mismo aviso. Cada grupo recorre
  // su propia ruta desde su posición actual (pueden venir de bases distintas
  // y llegar en momentos distintos); el aviso pasa a "awaiting_decision" solo
  // cuando TODOS los grupos asignados han llegado.
  function dispatchUnits(state, callId, unitIds) {
    if (state.gameOver) return { ok: false };
    const call = state.calls.find((item) => item.id === callId);
    if (!call || call.status !== 'pending' || !Array.isArray(unitIds) || !unitIds.length) {
      return { ok: false };
    }
    const units = unitIds
      .map((id) => state.units.find((item) => item.id === id))
      .filter((unit) => unit && unit.status === 'free');
    if (!units.length) return { ok: false };
    call.status = 'assigned';
    call.minutes = 0;
    call.assignedTo = units.map((unit) => unit.id);
    units.forEach((unit) => {
      unit.status = 'busy';
      unit.callId = call.id;
      unit.patrolTarget = null;
      unit.routeStartX = unit.x;
      unit.routeStartY = unit.y;
      const routeDistance = Math.abs(call.x - unit.x) + Math.abs(call.y - unit.y) * 0.6;
      const speed = (C.unitTypes[unit.type] || { speed: 1 }).speed;
      unit.travelMinutes = Math.max(3, Math.min(30, Math.ceil(routeDistance / 18) * 5 / speed));
      unit.travelElapsed = 0;
    });
    addLog(state, `${units.map((unit) => unit.id).join(', ')} en camino a ${call.id}.`);
    return { ok: true, call, units };
  }

  // Alias de un solo grupo, por comodidad/compatibilidad.
  function dispatchUnit(state, callId, unitId) {
    return dispatchUnits(state, callId, [unitId]);
  }

  // Al llegar la unidad se muestra una escena con texto y opciones (ver
  // C.sceneScripts). Esta función resuelve la opción elegida, con la
  // posibilidad de una complicación (failChance) que cambia el desenlace.
  function getSceneScript(callKind) {
    return C.sceneScripts[callKind] || C.sceneScripts.default;
  }

  function moodOf(tension) {
    return tension < 35 ? 'calm' : tension < 70 ? 'tense' : 'violent';
  }

  function assignedUnits(state, call) {
    const ids = Array.isArray(call.assignedTo) ? call.assignedTo : [call.assignedTo];
    return ids.map((id) => state.units.find((item) => item.id === id)).filter(Boolean);
  }

  function sceneStats(state, call) {
    const stats = { force: 0, dialogue: 0, command: 0 };
    assignedUnits(state, call).forEach((unit) => {
      const t = C.unitTypes[unit.type] || { force: 1, dialogue: 1, command: 0 };
      stats.force += t.force;
      stats.dialogue += t.dialogue;
      stats.command += t.command;
    });
    stats.command = Math.min(1, stats.command);
    return stats;
  }

  function initScene(call) {
    const base = { low: 18, medium: 32, high: 50 }[call.level] || 30;
    call.scene = {
      tension: clamp(base + (call.crowd ? 12 : 0) + Math.min(call.waiting || 0, 30) * 0.4, 0, 90),
      round: 0,
      lastOrder: null,
      trustPenalty: 0,
      extraMinutes: 0,
      pendingDrift: 0,
      orders: []
    };
  }

  // Cuando una intervención sale mal, el problema salta a otro punto.
  function spawnChain(state, call) {
    const kind = C.chainKinds[call.kind];
    if (!kind || state.calls.filter((item) => item.status !== 'done').length >= 10) return null;
    const options = C.callTemplates.filter((t) => t.kind === kind && (t.place || t.location) !== (call.place || call.location));
    if (!options.length) return null;
    options.sort((a, b) => Math.hypot(a.x - call.x, a.y - call.y) - Math.hypot(b.x - call.x, b.y - call.y));
    const template = options[0];
    const chain = {
      id: newCallId(state),
      title: `Escalada · ${template.title}`,
      location: template.location,
      place: template.place || template.location,
      severity: severityLabel.high,
      level: 'high',
      x: template.x,
      y: template.y,
      kind: template.kind,
      crowd: Boolean(template.crowd),
      status: 'pending',
      minutes: 0,
      waiting: 0
    };
    state.calls.push(chain);
    sortQueue(state);
    addLog(state, `${call.id} se ha descontrolado: nuevo aviso ${chain.id} en ${chain.place}.`);
    return chain;
  }

  // Cierre común: libera grupos, puntúa, anota el informe y encadena avisos.
  function finishScene(state, call, option, forcedFail) {
    const script = getSceneScript(call.kind);
    const scene = call.scene || { tension: 40, orders: [], trustPenalty: 0, extraMinutes: 0 };
    const units = assignedUnits(state, call);
    let failed;
    let trustDelta;
    let extraMinutes;
    let text;
    if (forcedFail || !option) {
      failed = true;
      trustDelta = -6;
      extraMinutes = 10;
      text = 'La multitud se ha descontrolado antes de que pudieras cerrar la intervención.';
    } else {
      const chance = clamp((option.failChance || 0) + (scene.tension - 40) / 160, 0.02, 0.92);
      failed = Math.random() < chance;
      trustDelta = failed ? option.failTrust : option.trust + (scene.tension < 30 ? 1 : 0);
      extraMinutes = failed ? option.failExtraMinutes : option.extraMinutes;
      text = failed ? option.failText : option.successText;
    }
    trustDelta -= scene.trustPenalty || 0;
    extraMinutes += scene.extraMinutes || 0;
    call.status = 'done';
    call.minutes += extraMinutes;
    state.served += 1;
    state.responseTotal += call.minutes;
    state.trust = clamp(state.trust + trustDelta + C.difficultyConfig[state.difficulty].trustBonus, 0, 99);
    state.districtHistory[call.location] = (state.districtHistory[call.location] || 0) + 1;
    units.forEach((unit) => {
      unit.status = 'free';
      unit.callId = null;
      unit.location = call.place || call.location;
      unit.progress = Math.min(100, unit.progress + 4);
      unit.routeStartX = null;
      unit.routeStartY = null;
      unit.travelMinutes = null;
      unit.travelElapsed = null;
    });
    addLog(state, `${units.map((unit) => unit.id).join(', ')} · ${call.id}: ${text}`);
    let chain = null;
    if (failed && (forcedFail || Math.random() < 0.7)) chain = spawnChain(state, call);
    if (!Array.isArray(state.report)) state.report = [];
    state.report.push({
      id: call.id,
      title: call.title,
      place: call.place || call.location,
      units: units.map((unit) => unit.id),
      orders: (scene.orders || []).map((o) => o.label),
      closing: option ? option.label : 'Escalada',
      tension: Math.round(scene.tension),
      failed,
      trustDelta,
      minutes: Math.round(call.minutes),
      chain: chain ? chain.id : null
    });
    state.report = state.report.slice(-40);
    if (state.selectedCall === call.id) state.selectedCall = null;
    return { ok: true, title: script.title, text, trustDelta, failed, chain, escalated: Boolean(forcedFail) };
  }

  function resolveScene(state, callId, optionId) {
    if (state.gameOver) return { ok: false };
    const call = state.calls.find((item) => item.id === callId);
    if (!call || call.status !== 'awaiting_decision') return { ok: false };
    const option = getSceneScript(call.kind).options.find((item) => item.id === optionId);
    if (!option) return { ok: false };
    if (!call.scene) initScene(call);
    return finishScene(state, call, option, false);
  }

  // Una orden durante la escena: mueve la tensión según los grupos presentes.
  function applyOrder(state, callId, orderId) {
    if (state.gameOver) return { ok: false };
    const call = state.calls.find((item) => item.id === callId);
    if (!call || call.status !== 'awaiting_decision') return { ok: false };
    const order = C.sceneOrders.find((item) => item.id === orderId);
    if (!order) return { ok: false };
    if (!call.scene) initScene(call);
    const scene = call.scene;
    const { force, dialogue, command } = sceneStats(state, call);
    const t = scene.tension;
    let delta = 0;
    if (orderId === 'linea') delta = -(2 + 2 * force);
    else if (orderId === 'dialogar') delta = t < 70 ? -(2 + 5 * dialogue) : -(1 + 1.5 * dialogue);
    else if (orderId === 'avanzar') delta = t < 35 ? -2 : 5 + t / 12 - force;
    else if (orderId === 'retroceder') { delta = -9; scene.extraMinutes += 2; scene.pendingDrift += 3; }
    else if (orderId === 'dispersar') {
      delta = t >= 65 ? 12 + (4 - Math.min(force, 4)) * 2 : -(18 + 3 * force);
      scene.trustPenalty += 2;
    }
    const levelFactor = call.level === 'high' ? 1.3 : call.level === 'low' ? 0.7 : 1;
    const drift = (randomBetween(-2, 5) * levelFactor * (call.crowd ? 1.2 : 1)) - command * 2.5 + scene.pendingDrift;
    scene.pendingDrift = 0;
    scene.tension = clamp(t + delta + drift, 0, 100);
    scene.round += 1;
    scene.lastOrder = orderId;
    scene.orders.push({ id: orderId, label: order.label, tension: Math.round(scene.tension) });
    addLog(state, `${call.id}: ${order.label.toLowerCase()} · tensión ${Math.round(scene.tension)}%.`);
    if (scene.tension >= 100) {
      return { ...finishScene(state, call, null, true), finished: true };
    }
    return { ok: true, finished: false, tension: scene.tension, mood: moodOf(scene.tension) };
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
      const assignedIds = Array.isArray(call.assignedTo) ? call.assignedTo : [call.assignedTo];
      const units = assignedIds.map((id) => state.units.find((item) => item.id === id)).filter(Boolean);
      let allArrived = units.length > 0;
      let maxElapsed = call.minutes || 0;
      units.forEach((unit) => {
        const travelMinutes = Math.max(3, Number(unit.travelMinutes) || 10);
        unit.travelElapsed = Math.min(travelMinutes, (unit.travelElapsed || 0) + deltaMinutes);
        const progress = unit.travelElapsed / travelMinutes;
        const position = routePositionAt(unit.routeStartX, unit.routeStartY, call.x, call.y, progress);
        unit.x = position.x;
        unit.y = position.y;
        if (unit.travelElapsed < travelMinutes) allArrived = false;
        maxElapsed = Math.max(maxElapsed, unit.travelElapsed);
      });
      call.minutes = maxElapsed;
      if (allArrived) {
        call.status = 'awaiting_decision';
        initScene(call);
        addLog(state, `${call.id}: ${units.map((unit) => unit.id).join(', ')} en el lugar. Se necesita una decisión.`);
        events.push({ type: 'arrived', callId: call.id });
      }
    });

    // Avisos desatendidos: se agravan con el tiempo.
    state.calls.filter((call) => call.status === 'pending').forEach((call) => {
      call.waiting = (call.waiting || 0) + deltaMinutes;
      if (call.waiting > 35 && call.level !== 'high') {
        call.level = call.level === 'low' ? 'medium' : 'high';
        call.severity = severityLabel[call.level];
        call.waiting = 0;
        addLog(state, `${call.id} se agrava por la espera (${call.place || call.location}).`);
        events.push({ type: 'worsen', callId: call.id });
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
      state.report = Array.isArray(parsed.report) ? parsed.report : [];
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
        const ids = Array.isArray(call.assignedTo) ? call.assignedTo : [call.assignedTo];
        call.assignedTo = ids;
        ids.forEach((id) => {
          const unit = state.units.find((item) => item.id === id);
          if (!unit) return;
          unit.routeStartX = numberOr(unit.routeStartX, unit.x);
          unit.routeStartY = numberOr(unit.routeStartY, unit.y);
          unit.travelMinutes = Math.max(3, numberOr(unit.travelMinutes, 10));
          unit.travelElapsed = numberOr(unit.travelElapsed, call.minutes || 0);
        });
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
    dispatchUnits,
    applyOrder,
    moodOf,
    updateScore,
    generateRandomCall,
    dispatchUnit,
    resolveScene,
    getSceneScript,
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
