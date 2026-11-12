// main.js — hilo conductor: une Engine y Render y encadena las pantallas de cada actividad.
(function () {
  'use strict';

  const Engine = window.Engine;
  const Jefe = window.Jefe;
  const Render = window.Render;
  const C = window.Constants;
  const { round1, esc } = window.Utils;

  let state = null;

  Render.init();

  const startCallbacks = {
    onNew(name) {
      Engine.clearSave();
      state = Engine.newGame(name);
      hub();
    },
    onBoss(name) {
      Engine.clearSave();
      state = Engine.newGame(name);
      state.stage = 'jefe';
      state.rank = 4;
      state.rep = 75;
      Object.keys(state.academy.grades).forEach((key) => { state.academy.grades[key] = 7; });
      state.story.seen = { academia: true, practicas: true, servicio: true };
      state.history.unshift({ kind: 'good', title: 'Ascenso directo', note: 'Accedes al cargo de Inspector.' });
      state.jefe = Jefe.newJefe();
      hub();
    },
    onContinue() {
      state = Engine.load();
      if (state) hub(); else showStart();
    }
  };

  function showStart() {
    state = null;
    Render.renderStart(Boolean(Engine.load()), startCallbacks);
  }

  const hubCallbacks = {
    onModule(id) {
      if (id === 'teorico') runExam();
      else if (id === 'fisico') runPhysical();
      else if (id === 'tiro') runShooting();
      else if (id === 'auxilios') runFirstAid();
      else runAcademyPractical();
    },
    onPracticas: runPracticas,
    onService: runService,
    onJefeLevel(id, lv) { state.jefe.levels[id] = lv; Engine.save(state); hub(); },
    onJefeStart() {
      Jefe.startTurn(state, Engine.pickIncident);
      Engine.save(state);
      hub();
    },
    onJefeReview(id) {
      const rep = state.jefe.reports.find((item) => item.id === id);
      Render.renderReportReview(rep, (decision) => {
        const res = Jefe.review(state, id, decision);
        Engine.save(state);
        Render.renderHeader(state);
        Render.renderResult({
          title: DECISION_TITLES[decision],
          kind: res.flawed === (decision === 'aprobar') ? 'bad' : 'good',
          sections: [{ title: `Informe de ${rep.agent}`, notes: res.notes.map((t) => noteFrom(t, false)).concat(decision === 'aprobar' ? [] : rep.flaws.map((f) => noteFrom(`Fallo detectado: ${f.text}`, true))) }],
          button: 'Volver a la bandeja'
        }, hub);
      });
    },
    onJefeClose: closeJefeTurn,
    onJefePersonal: runJefePersonal,
    onSuspension() {
      Engine.serveSuspension(state);
      hub();
    },
    onNewCareer() {
      Engine.clearSave();
      showStart();
    }
  };

  const DECISION_TITLES = { aprobar: 'Informe aprobado', devolver: 'Informe devuelto', expediente: 'Expediente abierto' };

  function closeJefeTurn() {
    const res = Jefe.closeTurn(state);
    Engine.save(state);
    Render.renderHeader(state);
    const goHub = () => hub();
    const showSummary = () => Render.renderResult({
      title: res.end ? (res.end.kind === 'victoria' ? '¡Objetivo cumplido!' : 'Fin de tu mandato') : 'Turno cerrado',
      kind: res.end ? (res.end.kind === 'victoria' ? 'good' : 'bad') : 'good',
      sections: [{ title: 'Resumen del turno', notes: res.notes.length ? res.notes : [noteFrom('Turno sin sobresaltos.')] }],
      button: 'Continuar'
    }, res.end || state.jefe.eventDone ? goHub : runJefeEvent);
    showSummary();
  }

  function runJefeEvent() {
    const ev = Jefe.pickEvent(state);
    state.jefe.eventDone = true;
    Render.renderDilemma(ev, (index) => {
      const out = Jefe.applyEvent(state, ev.id, index);
      const end = Jefe.checkEnd(state);
      Engine.save(state);
      Render.renderHeader(state);
      Render.renderResult({
        title: ev.title, kind: out.bad ? 'bad' : 'good',
        sections: [{ title: 'Consecuencia', notes: [noteFrom(out.text, out.bad)].concat(end ? [noteFrom(end.reason, end.kind !== 'victoria')] : []) }],
        button: 'Continuar'
      }, hub);
    });
  }

  function runJefePersonal() {
    runIncident({
      label: 'Sales tú a la calle',
      speaker: C.cast.jefe,
      tip: 'Comisario: sales tú. Tu equipo es el que has financiado: si recortaste material o formación, la tensión subirá antes y tus órdenes calmarán menos.',
      mods: Jefe.sceneMods(state.jefe),
      maxSev: 5
    }, (data) => {
      const res = Jefe.applyPersonal(state, data.sceneGrade, data.reportGrade);
      Engine.save(state);
      Render.renderHeader(state);
      const notes = [noteFrom(`Reputación ${res.repDelta >= 0 ? '+' : ''}${res.repDelta}, confianza ${res.trustDelta >= 0 ? '+' : ''}${res.trustDelta}.`, res.avg < Engine.PASS)];
      if (data.reportGrade.concealed) notes.push(noteFrom('Ocultaste datos en tu propio informe.', true));
      Render.renderResult({ title: 'Servicio terminado', kind: res.avg >= Engine.PASS ? 'good' : 'bad', sections: incidentSections(data, null, null).concat([{ title: 'Consecuencias', score: res.avg, notes }]), button: 'Volver al despacho' }, hub);
    });
  }

  function hub() {
    if (state.stage === 'jefe' && !state.jefe) state.jefe = Jefe.newJefe();
    const chapter = Engine.nextChapter(state);
    Engine.save(state);
    if (chapter) {
      Render.renderHeader(state);
      Render.renderStory(chapter, hub);
      return;
    }
    Render.renderHub(state, hubCallbacks);
  }

  const noteFrom = (text, neg) => ({ t: text, neg: Boolean(neg) });
  const isGood = (text) => text.startsWith('Conseguiste') || text.startsWith('Resolviste');

  // --- Academia ---
  function academyResult(name, score, lines, result, extraHtml) {
    const notes = lines.map((line) => noteFrom(line));
    if (result.graduated) notes.push(noteFrom(`Nota media final de la Academia: ${result.final}. ¡Pasas a prácticas!`));
    if (result.retry) notes.push(noteFrom('No has superado la prueba. Te queda una última convocatoria.', true));
    if (result.expelled) notes.push(noteFrom('Has agotado las convocatorias.', true));
    Engine.save(state);
    Render.renderHeader(state);
    Render.renderResult({
      title: result.passed ? (result.graduated ? '¡Te has graduado!' : 'Apto') : result.expelled ? 'No apto: baja en la Academia' : 'No apto',
      kind: result.passed ? 'good' : 'bad',
      sections: [{ title: name, score, notes }],
      extraHtml,
      button: 'Volver a la Academia'
    }, hub);
  }

  function runExam() {
    const questions = Engine.examQuestions();
    Render.renderExam(questions, (answers) => {
      const graded = Engine.gradeExam(questions, answers);
      const result = Engine.applyAcademy(state, 'teorico', graded.score);
      academyResult('Examen teórico', graded.score, [`Aciertos: ${graded.correct} de ${graded.total}.`], result, Render.examReviewHtml(questions, answers));
    });
  }

  function runPhysical() {
    Render.renderRun((distance) => {
      const score = Engine.gradeRun(distance);
      const result = Engine.applyAcademy(state, 'fisico', score);
      academyResult('Prueba física', score, [`Recorriste ${Math.round(distance)} metros en el tiempo límite.`], result);
    });
  }

  function runShooting() {
    Render.renderShooting((res) => {
      const score = Engine.gradeShooting(res);
      const result = Engine.applyAcademy(state, 'tiro', score);
      academyResult('Tiro y decisión', score, [`Amenazas abatidas: ${res.hits} de ${res.valid}. Errores (fallos o civiles): ${res.errors}.`], result);
    });
  }

  function runFirstAid() {
    const scenario = Engine.firstAidScenario();
    Render.renderFirstAid(scenario, (order) => {
      const g = Engine.gradeFirstAid(scenario, order);
      const result = Engine.applyAcademy(state, 'auxilios', g.score);
      const extra = `<div class="divider"></div><div class="eyebrow">Orden correcto</div><ol class="notes">${scenario.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>`;
      academyResult('Primeros auxilios', g.score, [`Pasos en su sitio: ${g.right} de ${g.total}.`], result, extra);
    });
  }

  // Aviso completo: llamada → refuerzos → escena en tiempo real → informe.
  function runIncident({ label, tip, speaker, mods, maxSev }, onFinish) {
    const incident = Engine.pickIncident(state, maxSev);
    Render.renderCall({ incident, label, tip, speaker }, (support) => {
      Render.renderScene({ incident, support, label, mods }, (outcome) => {
        const finish = () => {
          const sceneGrade = Engine.gradeScene(incident, support, outcome);
          Render.renderReport({ incident, outcome, label }, (report) => {
            const reportGrade = Engine.gradeReport(sceneGrade.truth, report);
            onFinish({ incident, support, outcome, sceneGrade, reportGrade });
          });
        };
        if (incident.arrest && outcome.result !== 'escalated') {
          const info = Engine.newArrest();
          Render.renderArrest({ incident, clue: info.clue, label }, (arrested) => {
            outcome.arrest = { arrested, evidence: info.evidence, rightsScore: null };
            if (!arrested) { finish(); return; }
            Render.renderRights(Engine.rightsOptions(), (ids) => {
              outcome.arrest.rightsScore = Engine.gradeRights(ids).score;
              finish();
            });
          });
        } else finish();
      });
    });
  }

  function incidentSections(data, avgTitle, avg) {
    const sections = [
      { title: 'Intervención', score: data.sceneGrade.score, notes: data.sceneGrade.notes.map((text) => noteFrom(text, !isGood(text))) },
      { title: 'Informe', score: data.reportGrade.score, notes: (data.reportGrade.notes.length ? data.reportGrade.notes : ['Informe correcto y completo.']).map((text) => noteFrom(text, data.reportGrade.notes.length > 0)) }
    ];
    if (avgTitle) sections.push({ title: avgTitle, score: avg, notes: [] });
    return sections;
  }

  const avgOf = (data) => round1((data.sceneGrade.score + data.reportGrade.score) / 2);

  function runAcademyPractical() {
    runIncident({
      label: 'Prueba práctica',
      speaker: C.cast.instructor,
      tip: 'Instructor: tu patrulla acude siempre. Pide apoyo solo si la gravedad lo exige: un exceso de fuerza también penaliza. En la escena, alterna Mantener línea y Dialogar y evita Dispersar.'
    }, (data) => {
      const avg = avgOf(data);
      const result = Engine.applyAcademy(state, 'practico', avg);
      Engine.save(state);
      Render.renderHeader(state);
      const extra = [];
      if (data.reportGrade.concealed) extra.push(noteFrom('Ocultaste información en el informe. En el servicio real esto sería una falta muy grave.', true));
      if (result.graduated) extra.push(noteFrom(`Nota media final de la Academia: ${result.final}. ¡Pasas a prácticas!`));
      if (result.retry) extra.push(noteFrom('Te queda una última convocatoria.', true));
      if (result.expelled) extra.push(noteFrom('Has agotado las convocatorias.', true));
      const sections = incidentSections(data, 'Nota de la prueba práctica', avg);
      sections[2].notes = extra;
      Render.renderResult({
        title: result.passed ? (result.graduated ? '¡Te has graduado!' : 'Apto') : result.expelled ? 'No apto: baja en la Academia' : 'No apto',
        kind: result.passed ? 'good' : 'bad',
        quote: Engine.reaction(state, avg, { concealed: data.reportGrade.concealed }),
        sections,
        button: 'Volver a la Academia'
      }, hub);
    });
  }

  // --- Prácticas ---
  function runPracticas() {
    runIncident({
      label: 'Prácticas',
      speaker: C.cast.tutor,
      tip: 'Tutor: observo cómo respondes. Pide refuerzos acordes a la gravedad y redacta un informe sincero.'
    }, (data) => {
      const avg = avgOf(data);
      const result = Engine.applyPractica(state, avg);
      Engine.save(state);
      Render.renderHeader(state);
      const extra = [];
      if (result.done && result.passed) extra.push(noteFrom(`Media de prácticas ${result.avg}. Ya eres Policía con plaza.`));
      if (result.done && result.retry) extra.push(noteFrom(`Media de prácticas ${result.avg}: no llegas al 5. Repites el periodo.`, true));
      if (result.done && result.expelled) extra.push(noteFrom('No superas las prácticas en la segunda oportunidad.', true));
      const sections = incidentSections(data, 'Evaluación del tutor', avg);
      sections[2].notes = extra;
      Render.renderResult({
        title: result.done ? (result.passed ? 'Prácticas superadas' : result.expelled ? 'Baja en prácticas' : 'Prácticas no superadas') : 'Servicio evaluado',
        kind: avg >= Engine.PASS ? 'good' : 'bad',
        quote: Engine.reaction(state, avg, { concealed: data.reportGrade.concealed }),
        sections,
        button: 'Continuar'
      }, hub);
    });
  }

  // --- Servicio ---
  function runService() {
    runIncident({ label: `Turno ${state.servicio.turn + 1}` }, (data) => {
      const result = Engine.applyService(state, data.sceneGrade, data.reportGrade, data.incident, data.support, data.outcome);
      Engine.save(state);
      Render.renderHeader(state);
      const consequences = [noteFrom(`Reputación ${result.repDelta >= 0 ? '+' : ''}${result.repDelta}.`, result.repDelta < 0)];
      result.notes.forEach((text) => consequences.push(noteFrom(text, true)));
      if (result.suspended) consequences.push(noteFrom('Acumulas 3 sanciones: suspensión de empleo de 2 turnos.', true));
      if (result.turnEnded) consequences.push(noteFrom(`Fin de turno. Media del turno: ${result.turnAvg}.`));
      if (result.promoted) consequences.push(noteFrom(`¡Ascenso! Ahora eres ${C.ranks[state.rank]}.`));
      if (result.expelled) consequences.push(noteFrom('Asuntos Internos cierra tu caso: quedas fuera del cuerpo.', true));
      const sections = incidentSections(data, null, null);
      sections.push({ title: 'Consecuencias', score: result.avg, notes: consequences });
      Render.renderResult({
        title: result.expelled ? 'Expulsado del cuerpo' : result.avg >= Engine.PASS ? 'Servicio resuelto' : 'Servicio deficiente',
        kind: result.expelled || result.avg < Engine.PASS ? 'bad' : 'good',
        quote: Engine.reaction(state, result.avg, { concealed: data.reportGrade.concealed }),
        sections,
        button: 'Continuar'
      }, () => {
        if (result.turnEnded && state.stage === 'servicio') runDilemma(); else hub();
      });
    });
  }

  function runDilemma() {
    const dilemma = Engine.pickDilemma(state);
    Render.renderDilemma(dilemma, (index) => {
      const result = Engine.applyDilemma(state, dilemma.id, index);
      Engine.save(state);
      Render.renderHeader(state);
      const notes = [noteFrom(result.text)];
      if (result.repDelta) notes.push(noteFrom(`Reputación ${result.repDelta > 0 ? '+' : ''}${result.repDelta}.`, result.repDelta < 0));
      if (result.strikes) notes.push(noteFrom(`Sanción${result.strikes > 1 ? 'es' : ''} en tu expediente: +${result.strikes}.`, true));
      if (result.suspended) notes.push(noteFrom('Acumulas 3 sanciones: suspensión de empleo de 2 turnos.', true));
      if (result.expelled) notes.push(noteFrom('Asuntos Internos cierra tu caso: quedas fuera del cuerpo.', true));
      Render.renderResult({
        title: dilemma.title,
        kind: result.expelled || result.strikes || result.repDelta < 0 ? 'bad' : 'good',
        sections: [{ title: 'Consecuencia', notes }],
        button: 'Continuar'
      }, hub);
    });
  }

  showStart();
})();
