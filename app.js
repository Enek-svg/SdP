    const callTemplates = [
      { title: 'Ruidosos en local cerrado', location: 'Centro', severity: 'media', level: 'medium', x: 36, y: 56, kind: 'N' },
      { title: 'Persona en situación de riesgo', location: 'San Miguel', severity: 'alta', level: 'high', x: 18, y: 30, kind: 'A' },
      { title: 'Colisión menor en vía secundaria', location: 'Ribera', severity: 'media', level: 'medium', x: 70, y: 72, kind: 'T' },
      { title: 'Falta de asistencia vecinal', location: 'La Estación', severity: 'prioridad baja', level: 'low', x: 68, y: 22, kind: 'V' },
      { title: 'Varios disturbios en calle', location: 'Centro', severity: 'alta', level: 'high', x: 54, y: 40, kind: 'D' },
      { title: 'Intervención no urgente', location: 'San Miguel', severity: 'prioridad baja', level: 'low', x: 26, y: 62, kind: 'I' },
      { title: 'Auxilio en estación de buses', location: 'La Estación', severity: 'media', level: 'medium', x: 78, y: 44, kind: 'A' },
      { title: 'Peatones bloqueando tráfico', location: 'Ribera', severity: 'prioridad baja', level: 'low', x: 59, y: 76, kind: 'T' },
      { title: 'Manifestación vecinal · Plaza Mayor', location: 'Centro', severity: 'alta', level: 'high', x: 44, y: 49, kind: 'M', crowd: true }
    ];
    const baseCalls = [
      { id: 'AV-204', title: 'Incidencia vecinal · Plaza Mayor', location: 'Centro', severity: 'media', level: 'medium', x: 32, y: 62, kind: 'V', status: 'pending', minutes: 0 },
      { id: 'AV-203', title: 'Apoyo a persona mayor', location: 'San Miguel', severity: 'prioridad baja', level: 'low', x: 22, y: 31, kind: 'A', status: 'pending', minutes: 0 },
      { id: 'AV-202', title: 'Congestión · Puente de Ribera', location: 'Ribera', severity: 'media', level: 'medium', x: 72, y: 72, kind: 'T', status: 'pending', minutes: 0 },
      { id: 'AV-201', title: 'Aviso de ruido · Estación', location: 'La Estación', severity: 'prioridad baja', level: 'low', x: 70, y: 30, kind: 'N', status: 'pending', minutes: 0 },
      { id: 'AV-205', title: 'Manifestación vecinal · Plaza Mayor', location: 'Centro', severity: 'alta', level: 'high', x: 40, y: 51, kind: 'M', crowd: true, status: 'pending', minutes: 0 }
    ];
    const baseUnits = [
      { id: 'UIP-01', type: 'Intervención · UIP', location: 'Base Centro', status: 'free', x: 49, y: 48, color: 'lime', progress: 85 },
      { id: 'UIP-02', type: 'Intervención · UIP', location: 'Base Norte', status: 'free', x: 42, y: 22, color: 'lime', progress: 68 },
      { id: 'P-14', type: 'Patrulla de proximidad', location: 'Base Ribera', status: 'free', x: 81, y: 58, color: 'cyan', progress: 92 },
      { id: 'P-08', type: 'Patrulla de proximidad', location: 'Base Estación', status: 'free', x: 57, y: 78, color: 'cyan', progress: 74 }
    ];
    const mapPoints = [
      { label: 'H', name: 'Hospital del Distrito', type: 'hospital', x: 25, y: 18 },
      { label: 'E', name: 'Estación Central', type: 'station', x: 82, y: 37 },
      { label: 'C', name: 'Comisaría Centro', type: 'policia', x: 53, y: 58 },
      { label: 'M', name: 'Mercado Municipal', type: 'civic', x: 82, y: 75 },
      { label: 'J', name: 'Jardines de la Ribera', type: 'green', x: 18, y: 76 },
      { label: 'B', name: 'Biblioteca de San Miguel', type: 'civic', x: 20, y: 38 },
      { label: 'P', name: 'Parque Norte', type: 'green', x: 36, y: 18 }
    ];
    const STORAGE_KEY = 'sdp-sim-state-v1';
    const severityRank = { high: 3, medium: 2, low: 1 };
    const difficultyConfig = {
      facil: { label: 'Fácil', callFactor: 0.7, trustBonus: 2, scoreMultiplier: 1.15 },
      media: { label: 'Media', callFactor: 1, trustBonus: 1, scoreMultiplier: 1 },
      dificil: { label: 'Difícil', callFactor: 1.35, trustBonus: 0, scoreMultiplier: 1.3 }
    };
    const districtNames = ['Centro', 'San Miguel', 'La Estación', 'Ribera'];
    let calls = JSON.parse(JSON.stringify(baseCalls));
    let units = JSON.parse(JSON.stringify(baseUnits));
    let selectedCall = null;
    let selectedUnit = null;
    let clockMinutes = 8 * 60 + 42;
    let served = 0;
    let trust = 78;
    let zoom = 1;
    let responseTotal = 0;
    let autoTimer = null;
    let gameTicks = 0;
    let logEntries = [];
    let score = 0;
    let difficulty = 'media';
    let districtHistory = Object.fromEntries(districtNames.map((name) => [name, 0]));
    let filterState = { district: 'all', priority: 'all' };
    const queue = document.getElementById('queue');
    const unitList = document.getElementById('units');
    const mapWorld = document.getElementById('map-world');
    const routeLayer = document.getElementById('route-layer');
    const pendingUnitMoves = new Map();

    function getPriorityValue(level) {
      return severityRank[level] || 0;
    }

    function sortQueue() {
      calls.sort((a, b) => {
        const aState = a.status === 'pending' ? 0 : a.status === 'assigned' ? 1 : a.status === 'awaiting_decision' ? 2 : 3;
        const bState = b.status === 'pending' ? 0 : b.status === 'assigned' ? 1 : b.status === 'awaiting_decision' ? 2 : 3;
        if (aState !== bState) return aState - bState;
        return getPriorityValue(b.level) - getPriorityValue(a.level);
      });
    }

    function createInitialLog() {
      logEntries = [{ time: timeString(), text: 'Turno iniciado. Cuatro unidades disponibles.' }];
    }

    function saveState() {
      try {
        const payload = {
          calls,
          units,
          selectedCall,
          selectedUnit,
          clockMinutes,
          served,
          trust,
          responseTotal,
          gameTicks,
          zoom,
          logEntries,
          score,
          difficulty,
          districtHistory,
          filterState
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      } catch (error) {
        console.warn('No se pudo guardar la sesión', error);
      }
    }

    function restoreState() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return false;
        const parsed = JSON.parse(raw);
        if (!parsed || !Array.isArray(parsed.calls) || !Array.isArray(parsed.units)) return false;
        calls = parsed.calls;
        units = parsed.units;
        if (!calls.some((call) => call.crowd)) {
          const demonstration = baseCalls.find((call) => call.crowd);
          const pendingCount = calls.filter((call) => call.status === 'pending').length;
          if (demonstration && pendingCount < 7 && !calls.some((call) => call.id === demonstration.id)) {
            calls.push(JSON.parse(JSON.stringify(demonstration)));
          }
        }
        calls.filter((call) => call.status === 'assigned').forEach((call) => {
          const unit = units.find((item) => item.id === call.assignedTo);
          call.routeStartX = Number.isFinite(call.routeStartX) ? call.routeStartX : unit ? unit.x : call.x;
          call.routeStartY = Number.isFinite(call.routeStartY) ? call.routeStartY : unit ? unit.y : call.y;
          call.travelMinutes = Math.max(5, Number(call.travelMinutes) || 10);
        });
        selectedCall = parsed.selectedCall || null;
        selectedUnit = parsed.selectedUnit || null;
        clockMinutes = Number(parsed.clockMinutes) || 8 * 60 + 42;
        served = Number(parsed.served) || 0;
        trust = Number(parsed.trust) || 78;
        responseTotal = Number(parsed.responseTotal) || 0;
        gameTicks = Number(parsed.gameTicks) || 0;
        zoom = Number(parsed.zoom) || 1;
        score = Number(parsed.score) || 0;
        difficulty = parsed.difficulty && difficultyConfig[parsed.difficulty] ? parsed.difficulty : 'media';
        districtHistory = parsed.districtHistory && typeof parsed.districtHistory === 'object' ? { ...Object.fromEntries(districtNames.map((name) => [name, 0])), ...parsed.districtHistory } : Object.fromEntries(districtNames.map((name) => [name, 0]));
        filterState = parsed.filterState && typeof parsed.filterState === 'object' ? { ...filterState, ...parsed.filterState } : { ...filterState };
        logEntries = Array.isArray(parsed.logEntries) && parsed.logEntries.length ? parsed.logEntries.slice(0, 5) : [{ time: timeString(), text: 'Turno recuperado.' }];
        return true;
      } catch (error) {
        console.warn('No se pudo restaurar la sesión', error);
        return false;
      }
    }

    function timeString(total = clockMinutes) {
      const hours = Math.floor(total / 60) % 24;
      const minutes = total % 60;
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    }

    function setDifficulty(nextDifficulty) {
      if (!difficultyConfig[nextDifficulty]) return;
      difficulty = nextDifficulty;
      const select = document.getElementById('difficulty-select');
      if (select) select.value = difficulty;
      applyDifficultySettings();
      renderAll();
    }

    function applyDifficultySettings() {
      const config = difficultyConfig[difficulty];
      const difficultyLabel = document.getElementById('difficulty');
      if (difficultyLabel) difficultyLabel.textContent = config.label;
      const scoreLabel = document.getElementById('score');
      if (scoreLabel) scoreLabel.textContent = String(Math.round(score));
      const select = document.getElementById('difficulty-select');
      if (select) select.value = difficulty;
    }

    function updateScore() {
      const config = difficultyConfig[difficulty];
      const pendingPenalty = calls.filter((call) => call.status === 'pending').length * 14;
      score = Math.max(0, Math.round((served * 180 + trust * 2 + responseTotal * 3 - pendingPenalty) * config.scoreMultiplier));
      applyDifficultySettings();
    }

    function renderHistory() {
      const historyList = document.getElementById('history-list');
      if (!historyList) return;
      historyList.innerHTML = '';
      districtNames.forEach((district) => {
        const row = document.createElement('div');
        row.className = 'history-row';
        row.innerHTML = `<span>${district}</span><strong>${districtHistory[district] || 0}</strong>`;
        historyList.append(row);
      });
    }

    function getVisibleCalls() {
      return calls.filter((call) => {
        const districtMatch = filterState.district === 'all' || call.location === filterState.district;
        const priorityMatch = filterState.priority === 'all' || call.level === filterState.priority;
        return districtMatch && priorityMatch;
      });
    }

    function resetTurn() {
      calls = JSON.parse(JSON.stringify(baseCalls));
      units = JSON.parse(JSON.stringify(baseUnits));
      selectedCall = null;
      selectedUnit = null;
      clockMinutes = 8 * 60 + 42;
      served = 0;
      trust = 78;
      responseTotal = 0;
      gameTicks = 0;
      score = 0;
      districtHistory = Object.fromEntries(districtNames.map((name) => [name, 0]));
      createInitialLog();
      stopAutoTime();
      document.getElementById('clock').textContent = timeString();
      renderAll();
    }

    function generateRandomCall(shouldRender = true) {
      if (calls.filter((call) => call.status === 'pending').length >= 7) {
        notify('Hay demasiados avisos pendientes. Revisa la cola antes de añadir más.');
        return;
      }
      const template = callTemplates[Math.floor(Math.random() * callTemplates.length)];
      let id = `AV-${String(220 + Math.floor(Math.random() * 60)).padStart(3, '0')}`;
      while (calls.some((call) => call.id === id)) {
        id = `AV-${String(220 + Math.floor(Math.random() * 60)).padStart(3, '0')}`;
      }
      const difficultyFactor = difficultyConfig[difficulty].callFactor;
      const severityBias = Math.random() < 0.4 * difficultyFactor ? 'high' : template.level;
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
      calls.push(call);
      districtHistory[call.location] = (districtHistory[call.location] || 0) + 1;
      sortQueue();
      addLog(`Nuevo aviso ${id} recibido en ${call.location}.`);
      notify(`Aviso ${id} registrado en ${call.location}.`);
      if (shouldRender) renderAll();
    }

    function renderCalls() {
      sortQueue();
      const visibleCalls = getVisibleCalls();
      queue.innerHTML = '';
      visibleCalls.forEach((call) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `call${selectedCall === call.id ? ' selected' : ''}${call.status === 'done' ? ' done' : ''}`;
        button.setAttribute('aria-pressed', selectedCall === call.id);
        button.innerHTML = `<div class="call-top"><span class="call-id">${call.id}</span><span class="severity ${call.level}">${call.status === 'done' ? 'resuelto' : call.status === 'awaiting_decision' ? 'decisión' : call.status === 'assigned' ? 'en curso' : call.severity}</span></div><h3>${call.title}</h3><div class="call-meta"><span class="location">${call.location}</span><span>${call.status === 'awaiting_decision' ? 'Elige una respuesta' : call.status === 'assigned' ? 'Unidad en camino' : call.status === 'done' ? 'Atendido' : 'Pendiente'}</span></div>`;
        button.addEventListener('click', () => {
          if (call.status === 'done') return;
          selectedCall = call.id;
          if (call.status === 'pending') selectedUnit = null;
          renderAll();
        });
        queue.append(button);
      });
      document.getElementById('call-count').textContent = calls.filter((call) => call.status === 'pending').length;
    }

    function renderUnits() {
      unitList.innerHTML = '';
      units.forEach((unit) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `unit${selectedUnit === unit.id ? ' selected' : ''}${unit.status === 'busy' ? ' busy' : ''}`;
        button.setAttribute('aria-pressed', selectedUnit === unit.id);
        button.disabled = unit.status === 'busy';
        button.innerHTML = `<div class="unit-top"><span class="unit-id">${unit.id}</span><span class="status ${unit.status === 'busy' ? 'busy' : ''}">${unit.status === 'busy' ? 'En servicio' : 'Disponible'}</span></div><div class="unit-bottom"><span class="unit-type">${unit.type}</span></div><div class="unit-bottom"><span>${unit.location}</span><span>${unit.progress}%</span></div><div class="unit-progress"><span style="width:${unit.progress}%"></span></div>`;
        button.addEventListener('click', () => {
          selectedUnit = unit.id;
          renderAll();
        });
        unitList.append(button);
      });
      document.getElementById('unit-count').textContent = units.filter((unit) => unit.status === 'free').length;
    }

    function routePositionAt(call, progress) {
      const startX = call.routeStartX;
      const startY = call.routeStartY;
      const horizontalDistance = Math.abs(call.x - startX);
      const verticalDistance = Math.abs(call.y - startY);
      const distance = horizontalDistance + verticalDistance;
      if (distance === 0) return { x: call.x, y: call.y };
      const traveled = distance * progress;
      if (traveled <= horizontalDistance) {
        const direction = Math.sign(call.x - startX);
        return { x: startX + direction * traveled, y: startY };
      }
      const direction = Math.sign(call.y - startY);
      return { x: call.x, y: startY + direction * Math.min(verticalDistance, traveled - horizontalDistance) };
    }

    function renderRoutes() {
      routeLayer.replaceChildren();
      calls.filter((call) => call.status === 'assigned').forEach((call) => {
        const unit = units.find((item) => item.id === call.assignedTo);
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
        routeLayer.append(track);
        const progress = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        progress.classList.add('route-progress');
        const passedCorner = Math.abs(unit.y - call.routeStartY) > 0.01;
        const progressPath = passedCorner
          ? `M ${startX} ${startY} L ${cornerX} ${cornerY} L ${unit.x * 10} ${unit.y * 6}`
          : `M ${startX} ${startY} L ${unit.x * 10} ${unit.y * 6}`;
        progress.setAttribute('d', progressPath);
        routeLayer.append(progress);
      });
    }

    const crowdPositions = [
      [18, 30], [31, 16], [47, 22], [63, 18], [79, 32],
      [12, 49], [27, 44], [42, 48], [58, 42], [74, 52],
      [20, 67], [36, 76], [52, 68], [68, 77], [84, 67],
      [33, 59], [61, 58], [49, 31]
    ];

    function renderCrowd(call) {
      const group = document.createElement('div');
      group.className = 'crowd-group';
      group.style.left = `${call.x}%`;
      group.style.top = `${call.y}%`;
      group.setAttribute('aria-hidden', 'true');
      crowdPositions.forEach((position, index) => {
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
      mapWorld.append(group);
    }

    function renderMap() {
      mapWorld.querySelectorAll('.unit-pin, .incident-pin, .map-poi, .crowd-group').forEach((pin) => pin.remove());
      renderRoutes();
      mapPoints.forEach((point) => {
        const poi = document.createElement('button');
        poi.type = 'button';
        poi.className = `map-poi ${point.type}`;
        poi.style.left = `${point.x}%`;
        poi.style.top = `${point.y}%`;
        poi.title = point.name;
        poi.setAttribute('aria-label', point.name);
        poi.textContent = point.label;
        poi.addEventListener('click', () => {
          document.getElementById('map-tip').textContent = point.name;
        });
        mapWorld.append(poi);
      });
      calls.filter((call) => call.status !== 'done').forEach((call) => {
        if (call.crowd) renderCrowd(call);
        const pin = document.createElement('button');
        pin.type = 'button';
        pin.className = `incident-pin${selectedCall === call.id ? ' selected' : ''}`;
        pin.style.left = `${call.x}%`;
        pin.style.top = `${call.y}%`;
        pin.setAttribute('aria-label', `Aviso ${call.id}: ${call.title}`);
        pin.innerHTML = `<span>${call.kind}</span>`;
        pin.addEventListener('click', () => {
          selectedCall = call.id;
          if (call.status === 'pending') selectedUnit = null;
          renderAll();
        });
        mapWorld.append(pin);
      });
      units.forEach((unit) => {
        const pin = document.createElement('button');
        pin.type = 'button';
        pin.className = `unit-pin${unit.status === 'busy' ? ' busy' : ''}${selectedUnit === unit.id ? ' selected' : ''}`;
        pin.style.left = `${unit.x}%`;
        pin.style.top = `${unit.y}%`;
        pin.textContent = unit.id;
        pin.setAttribute('aria-label', `Seleccionar unidad ${unit.id}`);
        pin.addEventListener('click', () => {
          if (unit.status === 'free') { selectedUnit = unit.id; renderAll(); }
        });
        mapWorld.append(pin);
        const movementFrom = pendingUnitMoves.get(unit.id);
        if (movementFrom && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
          pin.animate([
            { left: `${movementFrom.x}%`, top: `${movementFrom.y}%` },
            { left: `${unit.x}%`, top: `${unit.y}%` }
          ], { duration: 900, easing: 'ease-in-out' });
        }
        pendingUnitMoves.delete(unit.id);
      });
    }

    function renderSummary() {
      const call = calls.find((item) => item.id === selectedCall);
      const unit = units.find((item) => item.id === selectedUnit);
      const dispatch = document.getElementById('dispatch');
      const summary = document.getElementById('selection-summary');
      if (call && unit) {
        summary.innerHTML = `<strong>${call.id} · ${unit.id}</strong>${call.title}`;
      } else if (call) {
        summary.innerHTML = `<strong>${call.id} · ${call.title}</strong>Ahora elige una unidad disponible.`;
      } else if (unit) {
        summary.innerHTML = `<strong>${unit.id} seleccionada</strong>Ahora elige un aviso pendiente.`;
      } else {
        summary.innerHTML = '<strong>Sin intervención seleccionada</strong>Elige un aviso y una unidad disponible.';
      }
      dispatch.disabled = !(call && unit && call.status === 'pending' && unit.status === 'free');
      const decisionPanel = document.getElementById('decision-panel');
      if (call && call.status === 'awaiting_decision') {
        decisionPanel.hidden = false;
        decisionPanel.innerHTML = `<div><div class="decision-title">Decisión requerida · ${call.id}</div><div class="decision-copy">${call.prompt}</div></div><div class="decision-options"><button type="button" data-choice="dialogue">Dialogar y mediar</button><button type="button" data-choice="support">Pedir apoyo sanitario</button><button type="button" data-choice="reinforcements">Solicitar refuerzos</button></div>`;
        decisionPanel.querySelectorAll('[data-choice]').forEach((button) => {
          button.addEventListener('click', () => resolveDecision(call, button.dataset.choice));
        });
      } else {
        decisionPanel.hidden = true;
        decisionPanel.innerHTML = '';
      }
      const activeCrowd = calls.some((item) => item.crowd && item.status !== 'done');
      document.getElementById('map-tip').textContent = call
        ? `${call.id} · ${call.location}${unit ? `  /  ${unit.id} seleccionado` : '  /  selecciona una unidad'}`
        : activeCrowd
          ? 'Manifestación activa · personas en movimiento. Avanza el turno para mover las unidades.'
          : 'Avanza el turno para mover las unidades por sus rutas.';
      document.getElementById('served').textContent = served;
      document.getElementById('trust').textContent = `${trust}%`;
      document.getElementById('trust').className = `metric-value ${trust >= 65 ? 'good' : 'warn'}`;
      document.getElementById('available').textContent = `${units.filter((item) => item.status === 'free').length} / ${units.length}`;
      document.getElementById('response').textContent = served ? `${Math.round(responseTotal / served)} min` : '—';
    }

    function renderLog() {
      const log = document.getElementById('log');
      log.innerHTML = '';
      logEntries.slice(0, 4).forEach((entry) => {
        const row = document.createElement('div');
        row.className = 'log-row';
        row.innerHTML = `<span class="log-time">${entry.time}</span><span>${entry.text}</span>`;
        log.append(row);
      });
    }

    function renderAll() {
      updateScore();
      document.getElementById('clock').textContent = timeString();
      mapWorld.style.transform = `scale(${zoom})`;
      renderCalls();
      renderUnits();
      renderMap();
      renderSummary();
      renderLog();
      renderHistory();
      applyDifficultySettings();
      saveState();
    }

    function addLog(message) {
      logEntries.unshift({ time: timeString(), text: message });
      logEntries = logEntries.slice(0, 5);
      renderLog();
    }

    function notify(message) {
      const toast = document.getElementById('toast');
      toast.textContent = message;
      toast.classList.add('show');
      window.clearTimeout(notify.timeout);
      notify.timeout = window.setTimeout(() => toast.classList.remove('show'), 2200);
    }

    function stopAutoTime() {
      window.clearInterval(autoTimer);
      autoTimer = null;
      const button = document.getElementById('toggle-time');
      if (button) {
        button.textContent = 'Iniciar tiempo automático';
        button.setAttribute('aria-pressed', 'false');
      }
    }

    function toggleAutoTime() {
      if (autoTimer) {
        stopAutoTime();
        return;
      }
      autoTimer = window.setInterval(advanceTime, 5000);
      const button = document.getElementById('toggle-time');
      button.textContent = 'Pausar tiempo automático';
      button.setAttribute('aria-pressed', 'true');
    }

    function resolveDecision(call, choice) {
      if (call.status !== 'awaiting_decision') return;
      const unit = units.find((item) => item.id === call.assignedTo);
      const outcomes = {
        dialogue: { text: 'resuelta mediante diálogo', trust: 4, extraMinutes: 0 },
        support: { text: 'resuelta con apoyo sanitario', trust: 3, extraMinutes: 5 },
        reinforcements: { text: 'resuelta tras solicitar refuerzos', trust: 1, extraMinutes: 10 }
      };
      const outcome = outcomes[choice];
      call.status = 'done';
      call.minutes += outcome.extraMinutes;
      served += 1;
      responseTotal += call.minutes;
      trust = Math.min(99, trust + outcome.trust + difficultyConfig[difficulty].trustBonus);
      districtHistory[call.location] = (districtHistory[call.location] || 0) + 1;
      if (unit) {
        unit.status = 'free';
        unit.callId = null;
        unit.location = call.location;
        unit.progress = Math.min(100, unit.progress + 4);
      }
      addLog(`${call.assignedTo} ${outcome.text} (${call.id}).`);
      notify(`${call.id}: ${outcome.text}.`);
      selectedCall = null;
      renderAll();
    }

    document.getElementById('new-call').addEventListener('click', () => generateRandomCall());
    document.getElementById('reset-turn').addEventListener('click', resetTurn);
    document.getElementById('save-session').addEventListener('click', () => {
      saveState();
      notify('Sesión guardada en el navegador.');
    });
    document.getElementById('difficulty-select').addEventListener('change', (event) => {
      setDifficulty(event.target.value);
    });
    document.getElementById('district-filter').addEventListener('change', (event) => {
      filterState.district = event.target.value;
      renderAll();
    });
    document.getElementById('priority-filter').addEventListener('change', (event) => {
      filterState.priority = event.target.value;
      renderAll();
    });

    document.getElementById('dispatch').addEventListener('click', () => {
      const call = calls.find((item) => item.id === selectedCall);
      const unit = units.find((item) => item.id === selectedUnit);
      if (!call || !unit || call.status !== 'pending' || unit.status !== 'free') return;
      call.status = 'assigned';
      call.minutes = 0;
      call.assignedTo = unit.id;
      call.approach = document.getElementById('approach').value;
      call.routeStartX = unit.x;
      call.routeStartY = unit.y;
      const routeDistance = Math.abs(call.x - unit.x) + Math.abs(call.y - unit.y) * 0.6;
      call.travelMinutes = Math.max(5, Math.min(30, Math.ceil(routeDistance / 18) * 5));
      unit.status = 'busy';
      unit.callId = call.id;
      addLog(`${unit.id} asignada a ${call.id}: ${call.approach}.`);
      notify(`${unit.id} en camino a ${call.location}.`);
      selectedCall = null;
      selectedUnit = null;
      renderAll();
    });

    function advanceTime() {
      clockMinutes += 5;
      gameTicks += 1;
      document.getElementById('clock').textContent = timeString();
      calls.filter((call) => call.status === 'assigned').forEach((call) => {
        const travelMinutes = Math.max(5, Number(call.travelMinutes) || 10);
        call.minutes = Math.min(travelMinutes, call.minutes + 5);
        const unit = units.find((item) => item.id === call.assignedTo);
        if (unit) {
          pendingUnitMoves.set(unit.id, { x: unit.x, y: unit.y });
          const position = routePositionAt(call, call.minutes / travelMinutes);
          unit.x = position.x;
          unit.y = position.y;
        }
        if (call.minutes >= travelMinutes) {
          call.status = 'awaiting_decision';
          call.prompt = `La unidad ${call.assignedTo} ya está en ${call.location}. ¿Cómo quieres gestionar el aviso?`;
          addLog(`${call.id}: la unidad ha llegado. Se necesita una decisión.`);
          notify(`Decisión pendiente para ${call.id}.`);
        }
      });
      const pendingCount = calls.filter((call) => call.status === 'pending').length;
      const spawnChance = difficultyConfig[difficulty].callFactor * (gameTicks % 3 === 0 ? 0.85 : 0.55);
      if (gameTicks % 6 === 0 && pendingCount < 6 && Math.random() < spawnChance) generateRandomCall(false);
      if (pendingCount > 4 && trust > 0 && Math.random() < 0.25) {
        trust = Math.max(0, trust - 1);
      }
      renderAll();
    }

    document.getElementById('advance').addEventListener('click', advanceTime);
    document.getElementById('toggle-time').addEventListener('click', toggleAutoTime);

    document.getElementById('zoom-in').addEventListener('click', () => {
      zoom = Math.min(1.25, zoom + .05);
      renderAll();
    });
    document.getElementById('zoom-out').addEventListener('click', () => {
      zoom = Math.max(.8, zoom - .05);
      renderAll();
    });

    window.addEventListener('beforeunload', saveState);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') saveState();
    });

    const hasSavedState = restoreState();
    if (!hasSavedState) {
      createInitialLog();
    }
    const districtFilter = document.getElementById('district-filter');
    const priorityFilter = document.getElementById('priority-filter');
    if (districtFilter) districtFilter.value = filterState.district;
    if (priorityFilter) priorityFilter.value = filterState.priority;
    renderAll();

