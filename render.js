// render.js — pinta cada pantalla del juego. No decide reglas: solo muestra y avisa de lo que hace el jugador.
(function (root, deps) {
  'use strict';

  const { esc, round1 } = deps.Utils;
  const C = deps.Constants;
  const Scene = deps.Scene;
  const Engine = deps.Engine;

  let view = null;
  let topbar = null;
  let cleanup = null;

  function init() {
    view = document.getElementById('view');
    topbar = document.getElementById('topbar');
  }

  function setView(html) {
    if (cleanup) { cleanup(); cleanup = null; }
    view.innerHTML = html;
    window.scrollTo(0, 0);
  }

  const $ = (selector) => view.querySelector(selector);
  const $$ = (selector) => Array.from(view.querySelectorAll(selector));

  function renderHeader(state) {
    if (!state) {
      topbar.innerHTML = '<div class="brand">SdP <span>Carrera policial</span></div>';
      return;
    }
    const strikes = '●'.repeat(Math.min(state.strikes, 5)) + '○'.repeat(Math.max(0, 3 - state.strikes));
    topbar.innerHTML = `<div class="brand">SdP <span>Carrera policial</span></div>
      <div class="agent-info">
        <div><strong>${esc(state.name)}</strong><br><small class="muted">${esc(C.ranks[state.rank])}</small></div>
        <div class="meter"><small>Reputación ${state.rep}</small><div class="meter-bar"><span style="width:${state.rep}%"></span></div></div>
        <div class="meter"><small>Expediente</small><span class="strikes" title="Sanciones">${strikes}</span></div>
      </div>`;
  }

  function renderStart(hasSave, cb) {
    renderHeader(null);
    setView(`<section class="card">
      <div class="eyebrow">Simulador</div>
      <h2>Tu carrera en la policía</h2>
      <p class="lead">Entra en la Academia, supera las pruebas, haz las prácticas y sal a la calle. Cada decisión cuenta: lo que haces en los servicios y lo que escribes en tus informes decide si asciendes, te sancionan o acabas fuera del cuerpo.</p>
      <label class="field">Nombre de tu agente
        <input type="text" id="name" maxlength="24" placeholder="Ej. García">
      </label>
      <div class="row">
        <button class="btn primary" id="new">Empezar carrera</button>
        ${hasSave ? '<button class="btn" id="continue">Continuar partida guardada</button>' : ''}
      </div>
    </section>`);
    $('#new').addEventListener('click', () => cb.onNew($('#name').value));
    if (hasSave) $('#continue').addEventListener('click', cb.onContinue);
  }

  function historyHtml(state) {
    const rows = state.history.slice(0, 8).map((entry) => `<div class="history-row ${esc(entry.kind)}">${esc(entry.title)}<small>${esc(entry.note)}</small></div>`).join('');
    return `<div class="eyebrow" style="margin-top:16px">Expediente</div><div class="history">${rows}</div>`;
  }

  function renderHub(state, cb) {
    renderHeader(state);
    if (state.stage === 'baja') { renderEnd(state, cb); return; }
    if (state.stage === 'academia') {
      const defs = [
        { id: 'teorico', name: 'Examen teórico', desc: '8 preguntas tipo test sobre legislación y protocolos.' },
        { id: 'fisico', name: 'Prueba física', desc: 'Carrera de 12 segundos alternando dos teclas.' },
        { id: 'practico', name: 'Prueba práctica', desc: 'Intervención simulada con un instructor, y después tu informe.' }
      ];
      const cards = defs.map((def) => {
        const grade = state.academy.grades[def.id];
        const attempts = state.academy.attempts[def.id];
        const tag = grade !== null ? `<span class="tag good">Apto · ${grade}</span>`
          : attempts > 0 ? `<span class="tag bad">No apto · ${attempts}/${Engine.MAX_ATTEMPTS}</span>` : '<span class="tag">Pendiente</span>';
        const last = attempts === Engine.MAX_ATTEMPTS - 1 && grade === null;
        return `<div class="module"><h3>${esc(def.name)}</h3>${tag}<p class="muted">${esc(def.desc)}</p>
          <button class="btn primary" data-module="${def.id}" ${grade !== null ? 'disabled' : ''}>${grade !== null ? 'Superado' : last ? 'Última convocatoria' : 'Empezar'}</button></div>`;
      }).join('');
      setView(`<section class="card"><div class="eyebrow">Academia de Policía</div><h2>Fase de formación</h2>
        <p class="lead">Debes aprobar las tres pruebas (nota mínima 5). Tienes dos convocatorias por prueba: si suspendes dos veces la misma, causas baja.</p>
        <div class="module-grid">${cards}</div>${historyHtml(state)}</section>`);
      $$('[data-module]').forEach((button) => button.addEventListener('click', () => cb.onModule(button.dataset.module)));
      return;
    }
    if (state.stage === 'practicas') {
      const done = state.practicas.grades.length;
      setView(`<section class="card"><div class="eyebrow">Periodo de prácticas · intento ${state.practicas.round}/2</div><h2>Servicios con tu tutor</h2>
        <p class="lead">Atiendes ${Engine.PRACTICAS_TOTAL} avisos con un tutor que evalúa cómo respondes, cómo actúas y cómo informas. Necesitas una media de 5 o más.</p>
        <div class="progress"><span style="width:${(done / Engine.PRACTICAS_TOTAL) * 100}%"></span></div>
        <p class="muted">Servicios hechos: ${done}/${Engine.PRACTICAS_TOTAL}${done ? ` · notas: ${state.practicas.grades.join(', ')}` : ''}</p>
        <div class="row" style="margin-top:14px"><button class="btn primary" id="go">Salir de servicio con el tutor</button></div>${historyHtml(state)}</section>`);
      $('#go').addEventListener('click', cb.onPracticas);
      return;
    }
    const sv = state.servicio;
    const suspended = state.suspended > 0;
    setView(`<section class="card"><div class="eyebrow">Servicio activo · turno ${sv.turn + 1}</div><h2>${suspended ? 'Suspendido de empleo' : 'En la calle'}</h2>
      <p class="lead">${suspended
        ? `Estás suspendido ${state.suspended} turno(s) más. No puedes atender avisos hasta cumplir la suspensión.`
        : `Llevas ${sv.callsDone}/${Engine.CALLS_PER_TURN} avisos en este turno y ${sv.served} atendidos en total. Para ascender: reputación 75 o más, 8 servicios y como máximo 1 sanción.`}</p>
      <div class="row"><button class="btn primary" id="go">${suspended ? 'Cumplir turno de suspensión' : 'Atender nuevo aviso'}</button></div>${historyHtml(state)}</section>`);
    $('#go').addEventListener('click', suspended ? cb.onSuspension : cb.onService);
  }

  // --- examen ---
  function renderExam(questions, onFinish) {
    const answers = [];
    let index = 0;
    function show() {
      const question = questions[index];
      setView(`<section class="card"><div class="eyebrow">Examen teórico · ${index + 1}/${questions.length}</div>
        <div class="progress"><span style="width:${(index / questions.length) * 100}%"></span></div>
        <h2 style="font-size:1.2rem;margin-bottom:14px">${esc(question.q)}</h2>
        ${question.options.map((option, i) => `<button class="option" data-i="${i}">${esc(option)}</button>`).join('')}</section>`);
      $$('[data-i]').forEach((button) => button.addEventListener('click', () => {
        answers[index] = Number(button.dataset.i);
        index += 1;
        if (index >= questions.length) onFinish(answers); else show();
      }));
    }
    show();
  }

  function examReviewHtml(questions, answers) {
    return `<div class="review">${questions.map((question, i) => {
      const ok = answers[i] === question.answer;
      return `<div class="review-item ${ok ? 'ok' : ''}"><strong>${esc(question.q)}</strong><br>${ok ? 'Correcto' : `Tu respuesta: ${esc(question.options[answers[i]] ?? '—')}`}<br><span class="muted">${ok ? '' : `Correcta: ${esc(question.options[question.answer])}. `}${esc(question.why)}</span></div>`;
    }).join('')}</div>`;
  }

  // --- prueba física ---
  function renderRun(onFinish) {
    const DURATION = 12;
    setView(`<section class="card"><div class="eyebrow">Prueba física</div><h2>Carrera de 12 segundos</h2>
      <p class="lead">Alterna <strong>←</strong> y <strong>→</strong> (o <strong>A</strong> y <strong>D</strong>, o los botones) lo más rápido que puedas. Si pulsas dos veces el mismo lado, trompicas y pierdes metros. Con 90 m sacas un 10.</p>
      <div class="track"><div class="runner" id="runner"></div><div class="finish"></div></div>
      <div class="row"><span class="big-number" id="meters">0 m</span><span class="muted" id="clock">12.0 s</span></div>
      <div class="run-pads"><button id="pad-l">←</button><button id="pad-r">→</button></div>
      <div class="row"><button class="btn primary" id="start">Preparado, ¡ya!</button></div></section>`);
    let distance = 0;
    let last = null;
    let running = false;
    let endsAt = 0;
    let timer = null;
    function press(side) {
      if (!running) return;
      if (last === side) distance = Math.max(0, distance - 0.6); else distance += 1.3;
      last = side;
      distance = Math.min(distance, 100);
      $('#runner').style.left = `calc(${distance}% - ${distance * 0.28}px)`;
      $('#meters').textContent = `${Math.round(distance)} m`;
    }
    function onKey(event) {
      if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') { event.preventDefault(); press('l'); }
      if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') { event.preventDefault(); press('r'); }
    }
    document.addEventListener('keydown', onKey);
    cleanup = () => { document.removeEventListener('keydown', onKey); if (timer) clearInterval(timer); };
    $('#pad-l').addEventListener('pointerdown', () => press('l'));
    $('#pad-r').addEventListener('pointerdown', () => press('r'));
    $('#start').addEventListener('click', () => {
      $('#start').disabled = true;
      let count = 3;
      $('#clock').textContent = `${count}…`;
      const countdown = setInterval(() => {
        count -= 1;
        if (count > 0) { $('#clock').textContent = `${count}…`; return; }
        clearInterval(countdown);
        running = true;
        endsAt = performance.now() + DURATION * 1000;
        timer = setInterval(() => {
          const left = Math.max(0, (endsAt - performance.now()) / 1000);
          $('#clock').textContent = `${left.toFixed(1)} s`;
          if (left <= 0) {
            running = false;
            clearInterval(timer);
            timer = null;
            onFinish(distance);
          }
        }, 80);
      }, 800);
    });
  }

  // --- llamada y envío de refuerzos ---
  function renderCall({ incident, label, tip }, onSend) {
    const options = C.supportOptions.map((option) => `<label class="support"><input type="checkbox" value="${option.id}"><div>${esc(option.label)}<small>${esc(option.desc)}</small></div></label>`).join('');
    setView(`<section class="card"><div class="eyebrow">${esc(label)} · llamada al 091</div><h2>${esc(incident.title)}</h2>
      <p class="muted">${esc(incident.place)}</p>
      <div class="call-box">${esc(incident.call)}</div>
      ${tip ? `<div class="tip">${esc(tip)}</div>` : ''}
      <p class="lead" style="margin-bottom:8px">Tu patrulla acude siempre. ¿Qué refuerzos envías?</p>
      <div class="support-grid">${options}</div>
      <div class="row"><button class="btn primary" id="send">Acudir al lugar</button></div></section>`);
    $('#send').addEventListener('click', () => onSend($$('.support input:checked').map((input) => input.value)));
  }

  // --- escena en tiempo real ---
  function renderScene({ incident, support, label }, onDone) {
    const sim = Scene.create({ incident, support });
    const selected = new Set(sim.squads.map((squad) => squad.id));
    setView(`<section class="card">
      <div class="scene-head"><div><div class="eyebrow">${esc(label)} · ${esc(incident.place)}</div><h2>${esc(incident.title)}</h2></div></div>
      <div class="canvas-wrap"><canvas id="sc-canvas" width="800" height="480"></canvas>
        <div class="canvas-overlay" id="sc-intro"><div>
          <p class="lead">Elige a qué grupos das órdenes (botones de arriba) y usa las órdenes o las teclas <strong>1-5</strong>. Mantén baja la tensión: si llega al 100% se descontrola. Los civiles rojos están agitados.</p>
          <button class="btn primary" id="sc-start">Comenzar intervención</button></div></div>
        <div class="canvas-overlay" id="sc-end" hidden><div class="banner" id="sc-banner"></div></div></div>
      <div class="hud">
        <div><div class="hud-label"><span>Tensión</span><strong id="sc-tlabel"></strong></div><div class="bar"><span id="sc-tbar"></span></div></div>
        <div><div class="hud-label"><span>Tiempo</span><span id="sc-clock"></span></div><div class="bar"><span id="sc-timebar" style="background:var(--blue)"></span></div></div>
      </div>
      <div class="squads" id="sc-squads">${sim.squads.map((squad) => `<button class="chip on" data-squad="${squad.id}">${esc(squad.type.name)}<small id="st-${squad.id}">Mantener línea</small></button>`).join('')}</div>
      <div class="stances">${C.stances.map((stance) => `<button class="stance" data-stance="${stance.id}"><kbd>${stance.key}</kbd>${esc(stance.label)}</button>`).join('')}</div>
      <div class="feed" id="sc-feed"></div></section>`);

    const canvas = $('#sc-canvas');
    const ctx = canvas.getContext('2d');
    Scene.draw(ctx, sim, canvas.width, canvas.height);
    const stanceLabel = (id) => C.stances.find((item) => item.id === id).label;

    function give(stanceId) {
      Scene.setStance(sim, Array.from(selected), stanceId);
      sim.squads.forEach((squad) => { $(`#st-${squad.id}`).textContent = stanceLabel(sim.stance[squad.id]); });
    }
    $$('[data-squad]').forEach((button) => button.addEventListener('click', () => {
      const id = button.dataset.squad;
      if (selected.has(id)) { if (selected.size > 1) selected.delete(id); } else selected.add(id);
      button.classList.toggle('on', selected.has(id));
    }));
    $$('[data-stance]').forEach((button) => button.addEventListener('click', () => give(button.dataset.stance)));

    let raf = null;
    let last = null;
    let started = false;
    function onKey(event) {
      const stance = C.stances.find((item) => item.key === event.key);
      if (stance && started && !sim.done) give(stance.id);
    }
    document.addEventListener('keydown', onKey);
    cleanup = () => { document.removeEventListener('keydown', onKey); if (raf) cancelAnimationFrame(raf); };

    function hud() {
      const mood = Scene.moodOf(sim.tension);
      const label = mood === 'calm' ? 'Calmada' : mood === 'tense' ? 'Tensa' : 'Violenta';
      $('#sc-tlabel').textContent = `${label} · ${Math.round(sim.tension)}%`;
      const bar = $('#sc-tbar');
      bar.style.width = `${Math.round(sim.tension)}%`;
      bar.className = `t-${mood}`;
      $('#sc-clock').textContent = `${Math.max(0, Math.ceil(sim.limit - sim.time))} s`;
      $('#sc-timebar').style.width = `${Math.min(100, (sim.time / sim.limit) * 100)}%`;
      $('#sc-feed').innerHTML = sim.feed.map((line) => `<div>${esc(line)}</div>`).join('');
    }

    function frame(timestamp) {
      if (last === null) last = timestamp;
      Scene.step(sim, (timestamp - last) / 1000);
      last = timestamp;
      Scene.draw(ctx, sim, canvas.width, canvas.height);
      hud();
      if (sim.done) {
        const banner = { calm: 'Situación calmada', partial: 'Fin del servicio', escalated: '¡Se ha descontrolado!' }[sim.done];
        $('#sc-banner').textContent = banner;
        $('#sc-end').hidden = false;
        raf = null;
        setTimeout(() => onDone(Scene.outcome(sim)), 1400);
        return;
      }
      raf = requestAnimationFrame(frame);
    }
    hud();
    $('#sc-start').addEventListener('click', () => {
      $('#sc-intro').hidden = true;
      started = true;
      raf = requestAnimationFrame(frame);
    });
  }

  // --- informe ---
  function renderReport({ incident, outcome, label }, onSubmit) {
    const orders = outcome.orders.length ? outcome.orders.slice(-8).map((line) => `<li>${esc(line)}</li>`).join('') : '<li>No diste ninguna orden.</li>';
    setView(`<section class="card"><div class="eyebrow">${esc(label)} · informe</div><h2>Redacta el informe</h2>
      <p class="lead">Debe ser veraz y completo. Se contrasta con lo que ocurrió de verdad. Ocultar el uso de la fuerza o los heridos es una falta grave.</p>
      <div class="tip"><strong>Tus órdenes durante el servicio:</strong><ul class="notes" style="margin:6px 0 0">${orders}</ul></div>
      <label class="field">Tipo de hecho<select id="r-type"><option value="">— elige —</option>${C.reportTypes.map((t) => `<option>${esc(t)}</option>`).join('')}</select></label>
      <label class="field">Resultado del servicio<select id="r-result"><option value="">— elige —</option>${C.reportResults.map((t) => `<option>${esc(t)}</option>`).join('')}</select></label>
      <div class="field">¿Se usó la fuerza (avance sobre la multitud o dispersión)?<div class="fieldset-row"><label><input type="radio" name="force" value="Sí"> Sí</label><label><input type="radio" name="force" value="No"> No</label></div></div>
      <div class="field">¿Hubo heridos?<div class="fieldset-row"><label><input type="radio" name="inj" value="Sí"> Sí</label><label><input type="radio" name="inj" value="No"> No</label></div></div>
      <label class="field">Narración de los hechos<textarea id="r-text" placeholder="Qué ocurrió, qué hicisteis y cómo terminó (mínimo 70 caracteres para nota completa)."></textarea></label>
      <div class="row end"><button class="btn primary" id="r-send" disabled>Firmar y entregar</button></div></section>`);
    function check() {
      const ok = $('#r-type').value && $('#r-result').value && $('input[name=force]:checked') && $('input[name=inj]:checked');
      $('#r-send').disabled = !ok;
    }
    $$('select, input').forEach((el) => el.addEventListener('change', check));
    $('#r-send').addEventListener('click', () => onSubmit({
      type: $('#r-type').value,
      result: $('#r-result').value,
      force: $('input[name=force]:checked').value,
      injuries: $('input[name=inj]:checked').value,
      text: $('#r-text').value
    }));
  }

  // --- resultados genéricos ---
  function notesHtml(notes) {
    return `<ul class="notes">${notes.map((note) => `<li class="${note.neg ? 'neg' : ''}">${esc(note.t)}</li>`).join('')}</ul>`;
  }

  function renderResult({ title, kind, sections, extraHtml, button }, onContinue) {
    const blocks = sections.map((section) => `<div class="divider"></div>
      <div class="eyebrow">${esc(section.title)}</div>
      ${section.score != null ? `<div class="score-row"><span class="score ${section.score >= Engine.PASS ? 'good' : 'bad'}">${round1(section.score)}</span><span class="muted">/ 10</span></div>` : ''}
      ${section.notes && section.notes.length ? notesHtml(section.notes) : ''}`).join('');
    setView(`<section class="card"><h2 class="end-title ${kind || ''}">${esc(title)}</h2>${blocks}${extraHtml || ''}
      <div class="row end" style="margin-top:14px"><button class="btn primary" id="continue">${esc(button || 'Continuar')}</button></div></section>`);
    $('#continue').addEventListener('click', onContinue);
  }

  function renderEnd(state, cb) {
    renderHeader(state);
    const expelled = state.end && state.end.kind === 'expulsion';
    setView(`<section class="card"><div class="eyebrow">Fin de la carrera</div>
      <h2 class="end-title bad">${expelled ? 'Expulsado del cuerpo' : 'Baja en el cuerpo'}</h2>
      <p class="lead">${esc(state.end ? state.end.reason : '')}</p>
      <p class="muted">Llegaste a ${esc(C.ranks[state.rank])} con ${state.servicio.served} servicios atendidos.</p>
      ${historyHtml(state)}
      <div class="row end" style="margin-top:14px"><button class="btn primary" id="again">Empezar una nueva carrera</button></div></section>`);
    $('#again').addEventListener('click', cb.onNewCareer);
  }

  const api = {
    init, renderHeader, renderStart, renderHub, renderExam, examReviewHtml, renderRun,
    renderCall, renderScene, renderReport, renderResult, renderEnd
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Render = api;
})(
  typeof window !== 'undefined' ? window : globalThis,
  typeof window !== 'undefined'
    ? { Utils: window.Utils, Constants: window.Constants, Scene: window.Scene, Engine: window.Engine }
    : { Utils: require('./utils.js'), Constants: require('./constants.js'), Scene: require('./scene.js'), Engine: require('./engine.js') }
);
