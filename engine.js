// engine.js — reglas de la carrera (academia → prácticas → servicio). Sin DOM: se puede probar con Node.
(function (root, deps) {
  'use strict';

  const { clamp, pick, shuffle, round1 } = deps.Utils;
  const C = deps.Constants;

  const PASS = 5;
  const MAX_ATTEMPTS = 2;
  const PRACTICAS_TOTAL = 3;
  const CALLS_PER_TURN = 3;

  function newGame(name) {
    return {
      v: 1,
      name: (name || '').trim() || 'Agente',
      stage: 'academia',
      rank: 0,
      rep: 50,
      strikes: 0,
      suspended: 0,
      concealments: 0,
      academy: {
        grades: { teorico: null, fisico: null, practico: null },
        attempts: { teorico: 0, fisico: 0, practico: 0 }
      },
      practicas: { grades: [], round: 1 },
      servicio: { turn: 0, callsDone: 0, served: 0, turnScores: [] },
      end: null,
      history: [{ kind: 'info', title: 'Ingresas en la Academia', note: 'Comienza tu formación como aspirante.' }]
    };
  }

  function log(state, kind, title, note) {
    state.history.unshift({ kind, title, note });
    state.history = state.history.slice(0, 30);
  }

  // --- examen teórico ---
  function examQuestions(count = 8) {
    return shuffle(C.questions).slice(0, count).map((item) => {
      const options = shuffle(item.options.map((text, index) => ({ text, correct: index === item.answer })));
      return { q: item.q, why: item.why, options: options.map((o) => o.text), answer: options.findIndex((o) => o.correct) };
    });
  }

  function gradeExam(questions, answers) {
    const correct = questions.filter((question, index) => answers[index] === question.answer).length;
    return { correct, total: questions.length, score: round1((correct / questions.length) * 10) };
  }

  // --- prueba física: distancia recorrida (0-100 m) en el tiempo límite ---
  function gradeRun(distance) {
    return round1(clamp((distance / 90) * 10, 0, 10));
  }

  // --- avisos ---
  function pickIncident(state, forceMaxSev) {
    let maxSev = 3;
    if (state.stage === 'servicio') maxSev = state.rank >= 3 ? 5 : state.rank === 2 ? 4 : 3;
    if (forceMaxSev) maxSev = forceMaxSev;
    return pick(C.incidents.filter((incident) => incident.sev <= maxSev));
  }

  // Valora si la respuesta (refuerzos pedidos) se ajusta a la gravedad real.
  function responseScore(incident, support) {
    let score = 0;
    const notes = [];
    const has = (id) => support.includes(id);
    if (incident.sev >= 3) {
      if (has('apoyo') || has('uip')) score += 0.5; else { score -= 1; notes.push('Faltó pedir apoyo para un aviso de esta gravedad.'); }
    }
    if (incident.sev >= 4) {
      if (has('uip')) score += 0.5; else { score -= 1; notes.push('Con esta gravedad hacía falta un grupo UIP.'); }
    }
    if (incident.injured) {
      if (has('sanitario')) score += 0.5; else { score -= 1.5; notes.push('Había heridos y no pediste ambulancia.'); }
    }
    if (has('uip') && incident.sev <= 2) { score -= 1.5; notes.push('Enviar antidisturbios a un aviso menor es desproporcionado.'); }
    if (has('apoyo') && incident.sev <= 1) { score -= 0.5; notes.push('Para este aviso bastaba tu patrulla.'); }
    if (has('sanitario') && !incident.injured) { score -= 0.2; }
    return { score, notes };
  }

  function buildTruth(incident, support, outcome) {
    const escalated = outcome.result === 'escalated';
    const usedForce = outcome.disperseUsed || outcome.pushUsed;
    const injuries = incident.injured || (escalated && incident.crowd >= 8);
    let result = 'Resuelto sin incidencias';
    if (escalated) result = 'No resuelto / escalada';
    else if (outcome.result === 'partial' || usedForce || injuries) result = 'Resuelto con incidencias';
    return { type: incident.report, result, usedForce, injuries, escalated };
  }

  function gradeScene(incident, support, outcome) {
    const resp = responseScore(incident, support);
    const base = { calm: 8, partial: 6, escalated: 2 }[outcome.result] ?? 5;
    const notes = [];
    let score = base;
    if (outcome.result === 'calm') notes.push('Conseguiste calmar la situación.');
    else if (outcome.result === 'partial') notes.push('Cerraste el servicio con la tensión aún alta.');
    else notes.push('La situación se descontroló.');
    if (outcome.result === 'calm' && outcome.time < outcome.limit * 0.6) { score += 1; notes.push('Resolviste con rapidez.'); }
    score += resp.score;
    notes.push(...resp.notes);
    if (outcome.trustPenalty > 0) { score -= outcome.trustPenalty; notes.push('Dispersaste a la multitud: uso de fuerza que cuesta confianza.'); }
    if (outcome.pushUsed) { score -= 1; notes.push('Avanzaste sobre una multitud ya tensa y la provocaste.'); }
    if (outcome.disperseUsed && incident.sev <= 2) { score -= 2; notes.push('Dispersar a una multitud en un aviso menor es desproporcionado.'); }
    const truth = buildTruth(incident, support, outcome);
    return { score: round1(clamp(score, 0, 10)), notes, truth, response: resp.score };
  }

  // El informe se compara con lo que pasó de verdad.
  function gradeReport(truth, report) {
    let points = 0;
    const notes = [];
    let concealed = false;
    if (report.type === truth.type) points += 2; else notes.push(`Tipo de hecho incorrecto (era: ${truth.type}).`);
    if (report.result === truth.result) points += 2; else notes.push(`El resultado no coincide con lo ocurrido (era: ${truth.result}).`);
    if ((report.force === 'Sí') === truth.usedForce) points += 2;
    else if (truth.usedForce) { notes.push('Ocultaste el uso de la fuerza. Es una falta grave.'); concealed = true; }
    else notes.push('Declaraste un uso de fuerza que no hubo.');
    if ((report.injuries === 'Sí') === truth.injuries) points += 2;
    else if (truth.injuries) { notes.push('No declaraste que hubo heridos.'); concealed = true; }
    else notes.push('Declaraste heridos que no los hubo.');
    const length = (report.text || '').trim().length;
    if (length >= 70) points += 2;
    else if (length >= 30) { points += 1; notes.push('La narración es demasiado breve.'); }
    else notes.push('Falta la narración de los hechos.');
    return { score: points, notes, concealed };
  }

  // --- academia ---
  function passedAll(state) {
    return Object.values(state.academy.grades).every((grade) => grade !== null && grade >= PASS);
  }

  function applyAcademy(state, module, score) {
    const academy = state.academy;
    academy.attempts[module] += 1;
    const names = { teorico: 'examen teórico', fisico: 'prueba física', practico: 'prueba práctica' };
    if (score >= PASS) {
      academy.grades[module] = score;
      log(state, 'good', `Apto: ${names[module]}`, `Nota ${score}.`);
      if (passedAll(state)) {
        const values = Object.values(academy.grades);
        const final = round1(values.reduce((a, b) => a + b, 0) / values.length);
        state.stage = 'practicas';
        state.rank = 1;
        log(state, 'good', 'Te gradúas en la Academia', `Nota media ${final}. Pasas a prácticas con tutor.`);
        return { passed: true, graduated: true, final };
      }
      return { passed: true };
    }
    log(state, 'bad', `No apto: ${names[module]}`, `Nota ${score}.`);
    if (academy.attempts[module] >= MAX_ATTEMPTS) {
      state.end = { kind: 'baja', reason: `Has suspendido la ${names[module]} en las dos convocatorias. Causas baja en la Academia.` };
      state.stage = 'baja';
      return { passed: false, expelled: true };
    }
    return { passed: false, retry: true };
  }

  // --- prácticas ---
  function applyPractica(state, score) {
    state.practicas.grades.push(score);
    log(state, score >= PASS ? 'good' : 'bad', 'Servicio de prácticas', `El tutor te pone un ${score}.`);
    if (state.practicas.grades.length < PRACTICAS_TOTAL) return { done: false };
    const avg = round1(state.practicas.grades.reduce((a, b) => a + b, 0) / PRACTICAS_TOTAL);
    if (avg >= PASS) {
      state.stage = 'servicio';
      state.rank = 2;
      log(state, 'good', 'Terminas las prácticas', `Media ${avg}. Eres Policía con plaza.`);
      return { done: true, passed: true, avg };
    }
    if (state.practicas.round === 1) {
      state.practicas.round = 2;
      state.practicas.grades = [];
      log(state, 'bad', 'Prácticas no superadas', `Media ${avg}. Repites el periodo.`);
      return { done: true, passed: false, retry: true, avg };
    }
    state.end = { kind: 'baja', reason: 'No superas el periodo de prácticas en la segunda oportunidad. Se te da de baja.' };
    state.stage = 'baja';
    return { done: true, passed: false, expelled: true, avg };
  }

  // --- servicio ---
  function applyService(state, sceneGrade, reportGrade, incident, support, outcome) {
    const avg = (sceneGrade.score + reportGrade.score) / 2;
    const notes = [];
    let repDelta = Math.round((avg - 5) * 2);
    if (sceneGrade.truth.escalated) repDelta -= 3;
    state.rep = clamp(state.rep + repDelta, 0, 100);
    let strike = false;
    if (reportGrade.concealed) {
      strike = true;
      state.concealments += 1;
      notes.push('Expediente: informe con datos ocultados.');
    }
    if (sceneGrade.truth.escalated && sceneGrade.truth.injuries) { strike = true; notes.push('Expediente: escalada con heridos.'); }
    if (support.includes('uip') && incident.sev <= 2 && sceneGrade.truth.escalated) { strike = true; notes.push('Expediente: respuesta desproporcionada.'); }
    if (outcome.trustPenalty >= 2) { strike = true; notes.push('Expediente: uso reiterado de dispersión.'); }
    if (strike) state.strikes += 1;
    state.servicio.served += 1;
    state.servicio.callsDone += 1;
    state.servicio.turnScores.push(round1(avg));
    log(state, avg >= PASS ? 'good' : 'bad', incident.title, `Servicio ${round1(avg)} · reputación ${repDelta >= 0 ? '+' : ''}${repDelta}.`);

    const result = { repDelta, strike, notes, avg: round1(avg), turnEnded: false };

    if (state.concealments >= 2 || state.strikes >= 5) {
      state.end = {
        kind: 'expulsion',
        reason: state.concealments >= 2
          ? 'Dos informes con datos ocultados. Asuntos Internos te expulsa del cuerpo.'
          : 'Acumulas demasiadas sanciones. Se abre expediente de separación del servicio.'
      };
      state.stage = 'baja';
      result.expelled = true;
      return result;
    }
    if (state.strikes >= 3 && state.suspended === 0) {
      state.suspended = 2;
      log(state, 'bad', 'Suspensión de empleo', 'Acumulas 3 sanciones: quedas suspendido 2 turnos.');
      result.suspended = true;
    }

    if (state.servicio.callsDone >= CALLS_PER_TURN) {
      state.servicio.callsDone = 0;
      state.servicio.turn += 1;
      const scores = state.servicio.turnScores.slice(-CALLS_PER_TURN);
      result.turnEnded = true;
      result.turnAvg = round1(scores.reduce((a, b) => a + b, 0) / scores.length);
      if (state.rank < 3 && state.rep >= 75 && state.servicio.served >= 8 && state.strikes <= 1) {
        state.rank += 1;
        result.promoted = true;
        log(state, 'good', 'Ascenso', `Ascendes a ${C.ranks[state.rank]}.`);
      }
    }
    return result;
  }

  function serveSuspension(state) {
    if (state.suspended <= 0) return false;
    state.suspended -= 1;
    state.rep = clamp(state.rep - 3, 0, 100);
    if (state.suspended === 0) {
      state.strikes = 1;
      log(state, 'info', 'Fin de la suspensión', 'Vuelves al servicio con una sanción vigente.');
    }
    return true;
  }

  // --- guardado ---
  function save(state) {
    try { window.localStorage.setItem(C.SAVE_KEY, JSON.stringify(state)); return true; } catch (error) { return false; }
  }

  function load() {
    try {
      const raw = window.localStorage.getItem(C.SAVE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.v !== 1 || !parsed.academy) return null;
      return parsed;
    } catch (error) {
      return null;
    }
  }

  function clearSave() {
    try { window.localStorage.removeItem(C.SAVE_KEY); } catch (error) { /* sin almacenamiento */ }
  }

  const api = {
    PASS, MAX_ATTEMPTS, PRACTICAS_TOTAL, CALLS_PER_TURN,
    newGame, examQuestions, gradeExam, gradeRun, pickIncident, responseScore, buildTruth,
    gradeScene, gradeReport, applyAcademy, applyPractica, applyService, serveSuspension,
    save, load, clearSave
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Engine = api;
})(
  typeof window !== 'undefined' ? window : globalThis,
  typeof window !== 'undefined'
    ? { Utils: window.Utils, Constants: window.Constants }
    : { Utils: require('./utils.js'), Constants: require('./constants.js') }
);
