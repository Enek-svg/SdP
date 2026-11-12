// main.js — hilo conductor: une Engine y Render y encadena las pantallas de cada actividad.
(function () {
  'use strict';

  const Engine = window.Engine;
  const Render = window.Render;
  const C = window.Constants;
  const { round1 } = window.Utils;

  let state = null;

  Render.init();

  const startCallbacks = {
    onNew(name) {
      Engine.clearSave();
      state = Engine.newGame(name);
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
      else runAcademyPractical();
    },
    onPracticas: runPracticas,
    onService: runService,
    onSuspension() {
      Engine.serveSuspension(state);
      hub();
    },
    onNewCareer() {
      Engine.clearSave();
      showStart();
    }
  };

  function hub() {
    Engine.save(state);
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

  // Aviso completo: llamada → refuerzos → escena en tiempo real → informe.
  function runIncident({ label, tip }, onFinish) {
    const incident = Engine.pickIncident(state);
    Render.renderCall({ incident, label, tip }, (support) => {
      Render.renderScene({ incident, support, label }, (outcome) => {
        const sceneGrade = Engine.gradeScene(incident, support, outcome);
        Render.renderReport({ incident, outcome, label }, (report) => {
          const reportGrade = Engine.gradeReport(sceneGrade.truth, report);
          onFinish({ incident, support, outcome, sceneGrade, reportGrade });
        });
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
        sections,
        button: 'Volver a la Academia'
      }, hub);
    });
  }

  // --- Prácticas ---
  function runPracticas() {
    runIncident({
      label: 'Prácticas',
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
        sections,
        button: 'Continuar'
      }, hub);
    });
  }

  showStart();
})();
