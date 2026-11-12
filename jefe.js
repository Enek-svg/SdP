// jefe.js — modo Jefe: presupuesto, partidas, plantilla e informes de los agentes. Lógica pura, sin DOM.
(function (root, deps) {
  'use strict';

  const { clamp, pick, shuffle, round1 } = deps.Utils;
  const C = deps.Constants;

  const LEVELS = ['Bajo', 'Normal', 'Alto'];
  const TARGET = [15, 55, 90];
  const TURNS_GOAL = 10;

  const ITEMS = [
    { id: 'armas', name: 'Armamento y material', costs: [30, 60, 100], fx: ['Armas antiguas: más fallos y más riesgo.', 'Material correcto.', 'Material moderno: menos incidentes.'] },
    { id: 'vehiculos', name: 'Vehículos', costs: [30, 60, 100], fx: ['Averías: las unidades llegan peor.', 'Flota aceptable.', 'Flota nueva: respuesta rápida.'] },
    { id: 'proteccion', name: 'Protección (chalecos, escudos)', costs: [20, 40, 70], fx: ['Más agentes heridos.', 'Protección estándar.', 'Menos bajas entre tus agentes.'] },
    { id: 'formacion', name: 'Formación', costs: [15, 40, 80], fx: ['Más errores en los informes.', 'Formación básica.', 'Mejor rendimiento y menos errores.'] },
    { id: 'camaras', name: 'Cámaras y pruebas', costs: [10, 25, 50], fx: ['Casi nunca hay imágenes.', 'Algunas imágenes disponibles.', 'Casi siempre hay imágenes: detectas más mentiras.'] },
    { id: 'salarios', name: 'Salarios', costs: [100, 160, 220], fx: ['La moral cae cada turno.', 'Moral estable.', 'La moral sube cada turno.'] }
  ];

  const NAMES = ['Iturri', 'Salazar', 'Pardo', 'Mendiola', 'Vidal', 'Ortiz', 'Ferrer', 'Lasa', 'Arana', 'Beltrán', 'Cuesta', 'Durán'];
  const r = (a, b) => a + Math.random() * (b - a);

  function newAgent(taken) {
    const free = NAMES.filter((n) => !taken.includes(n));
    const name = pick(free.length ? free : NAMES);
    return { name, skill: Math.round(r(45, 80)), honesty: Math.round(r(35, 92)), morale: Math.round(r(55, 80)) };
  }

  function newJefe() {
    const quality = {}; const levels = {};
    ITEMS.forEach((item) => { quality[item.id] = 55; levels[item.id] = 1; });
    const agents = [];
    for (let i = 0; i < 5; i += 1) agents.push(newAgent(agents.map((a) => a.name)));
    return { budget: 300, turn: 0, phase: 'plan', trust: 60, quality, levels, agents, reports: [], personalDone: false, complaints: 0, eventDone: false };
  }

  const income = (state) => 250 + Math.round(state.rep * 2);
  const totalCost = (levels) => ITEMS.reduce((sum, item) => sum + item.costs[levels[item.id]], 0);
  const mod = (jefe, id) => (jefe.quality[id] - 55) / 45;

  // Modificadores que se aplican a la escena en tiempo real cuando el jefe sale él mismo.
  function sceneMods(jefe) {
    const gear = (jefe.quality.armas + jefe.quality.proteccion) / 2;
    return { rise: round1(1.25 - (gear / 100) * 0.5), calm: round1(0.8 + (jefe.quality.formacion / 100) * 0.4) };
  }

  const TEXTS = {
    calm: 'La situación se normaliza tras dialogar con los presentes.',
    partial: 'Se cierra el servicio con ánimos aún alterados en la zona.',
    escalated: 'La situación se descontrola y se pide refuerzo.'
  };

  function makeReport(state, agent, incident, id) {
    const j = state.jefe;
    const score = agent.skill + mod(j, 'formacion') * 14 + mod(j, 'vehiculos') * 8 + mod(j, 'armas') * 8
      + (agent.morale - 60) * 0.2 - incident.sev * 9 + (Math.random() - 0.5) * 30 + 12;
    const outcome = score >= 45 ? 'calm' : score >= 25 ? 'partial' : 'escalated';
    const usedForce = Math.random() < ({ calm: 0.15, partial: 0.45, escalated: 0.85 }[outcome]);
    const injuries = Boolean(incident.injured) || (outcome === 'escalated' && Math.random() < 0.6) || (outcome === 'partial' && Math.random() < 0.1);
    const result = outcome === 'escalated' ? 'No resuelto / escalada' : (outcome === 'partial' || usedForce || injuries) ? 'Resuelto con incidencias' : 'Resuelto sin incidencias';
    const truth = { type: incident.report, result, usedForce, injuries };

    const pHurt = ({ calm: 0.04, partial: 0.18, escalated: 0.5 }[outcome]) * (1.5 - (j.quality.proteccion / 100) * 1.2);
    const hurt = Math.random() < pHurt;
    if (hurt) { agent.morale = clamp(agent.morale - 6, 0, 100); j.budget -= 15; }

    const flaws = [];
    const report = { type: truth.type, result: truth.result, force: usedForce ? 'Sí' : 'No', injuries: injuries ? 'Sí' : 'No' };
    if (usedForce && Math.random() * 100 > agent.honesty * 0.8) { report.force = 'No'; flaws.push({ code: 'fuerza', serious: true, text: 'Oculta el uso de la fuerza.' }); }
    if (injuries && Math.random() * 100 > agent.honesty * 0.8) { report.injuries = 'No'; flaws.push({ code: 'heridos', serious: true, text: 'Oculta que hubo heridos.' }); }
    if (flaws.length && truth.result === 'Resuelto con incidencias') report.result = 'Resuelto sin incidencias';
    let text = `Se acude al aviso (${incident.title}). ${TEXTS[outcome]}${report.force === 'Sí' ? ' Se emplea la fuerza de forma proporcional.' : ''}${report.injuries === 'Sí' ? ' Hay personas heridas atendidas en el lugar.' : ''} Se identifica a los presentes y se da cuenta a la central.`;
    const pSloppy = clamp(0.35 - agent.skill / 400 + (55 - j.quality.formacion) / 300, 0.05, 0.4);
    if (Math.random() < pSloppy) {
      if (Math.random() < 0.5) {
        report.type = pick(C.reportTypes.filter((t) => t !== truth.type));
        flaws.push({ code: 'tipo', serious: false, text: 'El tipo de hecho no coincide con el aviso.' });
      } else {
        text = 'Todo normal, sin novedad.';
        flaws.push({ code: 'narracion', serious: false, text: 'Narración escasa e inútil.' });
      }
    }

    const clues = [{ label: 'Código de la central', text: `Aviso registrado como «${truth.type}»` }];
    if (Math.random() < 0.8) clues.push({ label: 'Servicio sanitario', text: injuries ? `SAMUR atendió a ${1 + Math.floor(Math.random() * 3)} persona(s)` : 'No se movilizó asistencia sanitaria' });
    if (Math.random() < 0.8) clues.push({ label: 'Cierre del aviso', text: `Cerrado como: ${truth.result}` });
    clues.push({
      label: 'Cámara corporal',
      text: Math.random() < 0.12 + (j.quality.camaras / 100) * 0.8
        ? (usedForce ? 'Imágenes: se aprecia uso de la fuerza' : 'Imágenes: sin uso de la fuerza')
        : 'Sin imágenes disponibles'
    });
    if (hurt) clues.push({ label: 'Parte médico', text: `${agent.name} resulta herido (baja médica: -15 k€)` });

    return { id, outcome, agent: agent.name, incident: incident.title, place: incident.place, report: { ...report, text }, clues, flaws, truth, decision: null, hurt };
  }

  function startTurn(state, pickIncident) {
    const j = state.jefe;
    const inc = income(state); const cost = totalCost(j.levels);
    j.budget += inc - cost;
    ITEMS.forEach((item) => { j.quality[item.id] = Math.round(j.quality[item.id] + (TARGET[j.levels[item.id]] - j.quality[item.id]) * 0.35); });
    const shift = [-7, 0, 5][j.levels.salarios];
    j.agents.forEach((a) => { a.morale = clamp(a.morale + shift, 0, 100); });
    j.turn += 1;
    j.eventDone = false;
    j.reports = [];
    for (let k = 0; k < 5; k += 1) {
      const agent = j.agents[k % j.agents.length];
      j.reports.push(makeReport(state, agent, pickIncident(state, 4), k + 1));
    }
    j.streetNotes = [];
    const esc = j.reports.filter((rep) => rep.outcome === 'escalated').length;
    const calm = j.reports.filter((rep) => rep.outcome === 'calm').length;
    if (esc) { j.budget -= 30 * esc; j.trust = clamp(j.trust - 4 * esc, 0, 100); j.streetNotes.push(`${esc} servicio(s) se descontrolaron: daños e indemnizaciones (-${30 * esc} k€) y confianza -${4 * esc}.`); }
    if (calm >= 3) { j.trust = clamp(j.trust + 2, 0, 100); j.streetNotes.push('Buen turno en la calle: la gente lo nota (confianza +2).'); }
    j.phase = 'review';
    return { income: inc, cost };
  }

  // Decisión sobre un informe: 'aprobar' | 'devolver' | 'expediente'.
  function review(state, id, decision) {
    const j = state.jefe;
    const rep = j.reports.find((item) => item.id === id);
    if (!rep || rep.decision) return null;
    const agent = j.agents.find((a) => a.name === rep.agent);
    const flawed = rep.flaws.length > 0;
    const serious = rep.flaws.some((f) => f.serious);
    rep.decision = decision;
    const notes = [];
    if (decision === 'aprobar') {
      if (!flawed) { agent.morale = clamp(agent.morale + 2, 0, 100); notes.push('Informe correcto. Aprobado.'); }
      else notes.push('Informe aprobado. Si tenía errores, puede salir a la luz al cerrar el turno.');
    } else if (decision === 'devolver') {
      if (flawed) {
        agent.morale = clamp(agent.morale - 3, 0, 100); agent.honesty = clamp(agent.honesty + 3, 0, 100); j.trust = clamp(j.trust + 1, 0, 100);
        notes.push('Devuelto: el agente lo corrige. Aprende la lección.');
      } else {
        agent.morale = clamp(agent.morale - 8, 0, 100); j.budget -= 5;
        notes.push('El informe estaba bien. Perdéis tiempo (-5 k€) y el agente se siente desconfiado.');
      }
    } else if (flawed && serious) {
      agent.morale = clamp(agent.morale - 10, 0, 100); agent.honesty = clamp(agent.honesty + 8, 0, 100); j.trust = clamp(j.trust + 3, 0, 100); state.rep = clamp(state.rep + 2, 0, 100);
      notes.push('Expediente justificado: ocultaba información. Transparencia y respeto en la plantilla.');
    } else if (flawed) {
      agent.morale = clamp(agent.morale - 12, 0, 100);
      notes.push('Era un descuido, no mala fe: el expediente es excesivo y baja la moral.');
    } else {
      agent.morale = clamp(agent.morale - 20, 0, 100); state.rep = clamp(state.rep - 4, 0, 100); j.complaints += 1;
      notes.push('El informe era correcto. El agente presenta una queja (se pagará al cerrar el turno) y pierdes reputación.');
    }
    return { notes, flawed };
  }

  function applyPersonal(state, sceneGrade, reportGrade) {
    const j = state.jefe;
    const avg = (sceneGrade.score + reportGrade.score) / 2;
    const repDelta = Math.round((avg - 5) * 1.5);
    const trustDelta = Math.round(avg - 5) - (reportGrade.concealed ? 3 : 0);
    state.rep = clamp(state.rep + repDelta, 0, 100);
    j.trust = clamp(j.trust + trustDelta, 0, 100);
    j.personalDone = true;
    return { avg: round1(avg), repDelta, trustDelta };
  }

  const EVENTS = [
    { id: 'recorte', who: 'Comisario Herrera', title: 'Recorte de Interior', text: 'Interior recorta tu presupuesto y pide ahorrar sin que se note.', choices: [
      { label: 'Aceptar el recorte', budget: -80, result: 'Pierdes 80 k€ este turno.' },
      { label: 'Protestar formalmente', budget: -40, rep: -3, result: 'Recuperas parte, pero quedas como conflictivo (-40 k€, reputación -3).' },
      { label: 'Pedir un adelanto', budget: 120, trust: -4, result: 'Obtienes 120 k€ pero la prensa lo critica (confianza -4).' } ] },
    { id: 'queja', who: 'Atención ciudadana', title: 'Queja ciudadana', text: 'Un vecino denuncia un trato abusivo en una intervención.', choices: [
      { label: 'Indemnizar y pedir disculpas', budget: -50, trust: 4, result: 'Pagas 50 k€. Recuperas confianza (+4).' },
      { label: 'Defender a tus agentes', trust: -6, rep: 2, morale: 4, result: 'La plantilla lo agradece (+moral), pero la confianza cae (-6).' },
      { label: 'Abrir una investigación', budget: -15, trust: 2, result: 'Investigación interna (-15 k€, confianza +2).' } ] },
    { id: 'falta', who: 'Jefe de sala', title: 'Un agente se pasa de la raya', text: 'Un agente ha cometido una falta menor fuera de servicio y alguien lo ha grabado.', choices: [
      { label: 'Arreglo discreto', budget: -30, strikes: 1, result: 'Lo tapas con dinero (-30 k€) pero acumulas riesgo (+1 sanción).' },
      { label: 'Abrir expediente', morale: -6, trust: 5, result: 'Sanción al agente. La confianza sube (+5) y la moral baja.' },
      { label: 'Ignorarlo', trust: -5, result: 'El vídeo se difunde. Confianza -5.' } ] },
    { id: 'sindicato', who: 'Delegado sindical', title: 'Presión sindical', text: 'El sindicato exige mejoras salariales o convoca una protesta.', choices: [
      { label: 'Subir sueldos este turno', budget: -60, morale: 10, result: 'Pagas 60 k€ y la moral sube.' },
      { label: 'Negarte', morale: -10, rep: 1, result: 'Mantienes el presupuesto, pero la moral cae.' },
      { label: 'Negociar un acuerdo', budget: -20, morale: 3, result: 'Acuerdo parcial: -20 k€ y un poco de moral.' } ] },
    { id: 'prensa', who: 'Periodista', title: 'El periodista llama', text: 'Un periódico pregunta por el último servicio y por la gestión de la comisaría.', choices: [
      { label: 'Transparencia total', trust: 5, rep: -2, result: 'Confianza +5; algo de ruido interno (reputación -2).' },
      { label: 'Sin comentarios', trust: -3, result: 'Se interpreta como opacidad. Confianza -3.' } ] },
    { id: 'donacion', who: 'Empresa vecina', title: 'Una donación sospechosa', text: 'Una empresa ofrece 80 k€ y a cambio quiere que sus locales tengan más patrullas.', choices: [
      { label: 'Aceptar el dinero', budget: 80, rep: -3, trust: -3, result: '+80 k€, pero la gente murmura (reputación -3, confianza -3).' },
      { label: 'Rechazarlo', rep: 2, result: 'Mantienes la independencia (reputación +2).' } ] }
  ];

  function pickEvent(state) {
    const j = state.jefe;
    const done = j.eventsSeen || [];
    let pool = EVENTS.filter((e) => !done.includes(e.id));
    if (!pool.length) { j.eventsSeen = []; pool = EVENTS; }
    const ev = pick(pool);
    j.eventsSeen = (j.eventsSeen || []).concat(ev.id);
    return ev;
  }

  function applyEvent(state, eventId, index) {
    const j = state.jefe;
    const ev = EVENTS.find((e) => e.id === eventId);
    const c = ev && ev.choices[index];
    if (!c) return null;
    j.budget += c.budget || 0;
    j.trust = clamp(j.trust + (c.trust || 0), 0, 100);
    state.rep = clamp(state.rep + (c.rep || 0), 0, 100);
    state.strikes += c.strikes || 0;
    if (c.morale) j.agents.forEach((a) => { a.morale = clamp(a.morale + c.morale, 0, 100); });
    return { text: c.result, bad: (c.budget || 0) < 0 || (c.trust || 0) < 0 || (c.rep || 0) < 0 || (c.strikes || 0) > 0 };
  }

  function checkEnd(state) {
    const j = state.jefe;
    let reason = null; let kind = 'destitucion';
    if (j.budget < -300) reason = 'Los números rojos son insostenibles. Interior te destituye.';
    else if (j.trust <= 10) reason = 'La confianza ciudadana se ha desplomado. Te relevan del cargo.';
    else if (state.strikes >= 3) reason = 'Asuntos Internos te abre expediente por tus sanciones acumuladas.';
    else if (j.turn >= TURNS_GOAL) {
      if (j.trust >= 50 && j.budget >= 0) { kind = 'victoria'; reason = `Tras ${TURNS_GOAL} turnos dejas la comisaría saneada y con la confianza de la gente. Te ofrecen el cargo de Comisario.`; }
      else reason = 'No alcanzas los objetivos del periodo (confianza 50+ y presupuesto positivo). No renuevan tu cargo.';
    }
    if (reason) { state.end = { kind, reason }; state.stage = 'baja'; }
    return reason ? { kind, reason } : null;
  }

  // Cierra el turno: AAII, bajas, quejas. Devuelve notas para mostrar.
  function closeTurn(state) {
    const j = state.jefe;
    const notes = [];
    j.reports.filter((rep) => rep.decision === 'aprobar' && rep.flaws.length).forEach((rep) => {
      const serious = rep.flaws.some((f) => f.serious);
      const agent = j.agents.find((a) => a.name === rep.agent);
      const p = 0.35 + j.quality.camaras / 200 + (serious ? 0.2 : 0);
      if (Math.random() < p) {
        if (serious) { j.trust = clamp(j.trust - 12, 0, 100); state.rep = clamp(state.rep - 10, 0, 100); j.budget -= 60; state.strikes += 1; notes.push({ t: `Asuntos Internos descubre un informe falso de ${rep.agent} que aprobaste: confianza -12, reputación -10, -60 k€ y una sanción para ti.`, neg: true }); }
        else { j.trust = clamp(j.trust - 5, 0, 100); state.rep = clamp(state.rep - 4, 0, 100); j.budget -= 15; notes.push({ t: `Un error en un informe de ${rep.agent} sale a la luz: confianza -5, reputación -4, -15 k€.`, neg: true }); }
      } else if (agent) agent.honesty = clamp(agent.honesty - 4, 0, 100);
    });
    if (j.complaints) { j.budget -= 40 * j.complaints; notes.push({ t: `Quejas de agentes tras expedientes injustos: -${40 * j.complaints} k€.`, neg: true }); j.complaints = 0; }
    j.agents.forEach((a, i) => {
      if (a.morale <= 15) {
        notes.push({ t: `${a.name} pide la baja voluntaria por la moral. Se incorpora un agente nuevo (-15 k€).`, neg: true });
        j.budget -= 15;
        j.agents[i] = newAgent(j.agents.map((x) => x.name));
      }
    });
    const approved = j.reports.filter((rep) => rep.decision === 'aprobar' && !rep.flaws.length).length;
    if (approved) { j.trust = clamp(j.trust + 1, 0, 100); }
    state.history.unshift({ kind: 'info', title: `Turno ${j.turn} de jefe`, note: `Presupuesto ${j.budget} k€ · confianza ${j.trust}.` });
    state.history = state.history.slice(0, 30);
    j.reports = []; j.phase = 'plan'; j.personalDone = false;
    return { notes, end: checkEnd(state) };
  }

  const api = { LEVELS, ITEMS, TURNS_GOAL, newJefe, income, totalCost, sceneMods, startTurn, review, applyPersonal, pickEvent, applyEvent, closeTurn, checkEnd, EVENTS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Jefe = api;
})(
  typeof window !== 'undefined' ? window : globalThis,
  typeof window !== 'undefined'
    ? { Utils: window.Utils, Constants: window.Constants }
    : { Utils: require('./utils.js'), Constants: require('./constants.js') }
);
