// constants.js — datos fijos del juego: temario, avisos, unidades, órdenes y rangos.
(function (root) {
  'use strict';

  const SAVE_KEY = 'sdp-carrera-v1';

  const ranks = ['Alumno', 'Policía en prácticas', 'Policía', 'Oficial'];

  // Temario del examen teórico (contenido de juego, no asesoramiento legal).
  const questions = [
    { q: '¿Cuál es el plazo máximo de detención preventiva antes de poner a la persona a disposición judicial?', options: ['24 horas', '48 horas', '72 horas', '7 días'], answer: 2, why: 'La Constitución fija un máximo de 72 horas.' },
    { q: '¿Qué tres principios debe cumplir siempre el uso de la fuerza?', options: ['Rapidez, dureza y eficacia', 'Congruencia, oportunidad y proporcionalidad', 'Sorpresa, número y superioridad', 'Autoridad, castigo y ejemplaridad'], answer: 1, why: 'Congruencia, oportunidad y proporcionalidad: solo la fuerza necesaria, en el momento justo.' },
    { q: 'Al detener a una persona, ¿qué debes hacer respecto a sus derechos?', options: ['Informarla solo si lo pide', 'Informarla de forma inmediata y comprensible de sus derechos y del motivo', 'Leerlos al llegar a comisaría', 'Informar solo a su familia'], answer: 1, why: 'La información sobre derechos y motivos debe ser inmediata y comprensible.' },
    { q: 'Una manifestación en la vía pública requiere:', options: ['Autorización previa del Gobierno', 'Comunicación previa a la autoridad', 'Ninguna comunicación nunca', 'Permiso del ayuntamiento y de la policía'], answer: 1, why: 'Se exige comunicación previa, no autorización.' },
    { q: 'Primera actuación ante un accidente con heridos:', options: ['Mover a los heridos cuanto antes', 'Asegurar la zona, avisar a emergencias y atender sin mover al herido salvo peligro', 'Retirar los vehículos', 'Tomar declaración a los testigos'], answer: 1, why: 'Primero seguridad de la zona y aviso a emergencias; no se mueve al herido salvo peligro.' },
    { q: 'Ante una persona alterada que no se deja ayudar, lo más adecuado es:', options: ['Reducirla de inmediato', 'Hablar con calma, mantener distancia segura y pedir apoyo si hace falta', 'Ignorarla', 'Gritar para que obedezca'], answer: 1, why: 'La desescalada verbal y la distancia segura son lo primero.' },
    { q: 'Un informe o atestado debe ser:', options: ['Breve aunque falten datos', 'Veraz, objetivo y detallar los hechos', 'Favorable al agente', 'Escrito de memoria días después'], answer: 1, why: 'Debe ser veraz y objetivo; ocultar el uso de la fuerza es una falta grave.' },
    { q: 'Antes de dispersar una concentración, hay que:', options: ['Cargar para ganar tiempo', 'Advertir y dar oportunidad de que se disuelva', 'Cortar todas las calles sin avisar', 'Esperar a que se vayan solos siempre'], answer: 1, why: 'Se debe advertir y dar tiempo a la disolución antes de actuar.' },
    { q: 'El arma de fuego solo se usa:', options: ['Para intimidar', 'Como último recurso ante un peligro grave para la vida o integridad', 'Siempre que haya una pelea', 'Cuando alguien huye'], answer: 1, why: 'Solo como último recurso, agotados los medios menos lesivos.' },
    { q: 'La cadena de custodia sirve para:', options: ['Controlar los turnos', 'Preservar y documentar las pruebas sin alterarlas', 'Archivar partes antiguos', 'Registrar detenidos'], answer: 1, why: 'Garantiza que las pruebas no se alteran y se pueden documentar.' },
    { q: 'En un servicio, los agentes deben ir:', options: ['Sin identificación para evitar problemas', 'Con su número de identificación profesional visible', 'Solo con el uniforme', 'Con identificación solo en comisaría'], answer: 1, why: 'El número de identificación profesional debe ser visible.' },
    { q: 'Discusión vecinal por ruido, sin violencia. ¿Primer paso?', options: ['Detenerla', 'Dialogar y mediar, y sancionar solo si hace falta', 'Llamar a los antidisturbios', 'Marcharse'], answer: 1, why: 'Mediación primero; respuesta proporcionada al problema.' }
  ];

  // Tipos de unidad que pueden aparecer en la escena.
  const unitTypes = {
    patrulla: { name: 'Mi patrulla', agents: 2, force: 0.8, dialogue: 1.3, speed: 16, color: '#4fa3f7' },
    apoyo: { name: 'Patrulla de apoyo', agents: 2, force: 0.8, dialogue: 1.2, speed: 16, color: '#58c9a0' },
    uip: { name: 'Grupo UIP', agents: 4, force: 1.7, dialogue: 0.5, speed: 13, color: '#8a7cf0' }
  };

  const supportOptions = [
    { id: 'apoyo', label: 'Patrulla de apoyo', desc: '+2 agentes, buena para dialogar' },
    { id: 'uip', label: 'Grupo UIP', desc: '+4 antidisturbios, mucha fuerza' },
    { id: 'sanitario', label: 'Ambulancia', desc: 'Atiende heridos' }
  ];

  const stances = [
    { id: 'hold', label: 'Mantener línea', key: '1' },
    { id: 'talk', label: 'Dialogar', key: '2' },
    { id: 'advance', label: 'Avanzar', key: '3' },
    { id: 'retreat', label: 'Retroceder', key: '4' },
    { id: 'disperse', label: 'Dispersar', key: '5' }
  ];

  const reportTypes = ['Alteración del orden', 'Accidente de tráfico', 'Auxilio a persona', 'Hurto', 'Reunión o manifestación', 'Riña'];
  const reportResults = ['Resuelto sin incidencias', 'Resuelto con incidencias', 'No resuelto / escalada'];

  // Avisos. sev = gravedad real (1-5); crowd = personas en la escena. La llamada
  // al 091 solo da pistas: la respuesta adecuada depende de la gravedad real.
  const incidents = [
    { id: 'ruido', title: 'Música alta de madrugada', place: 'Lavapiés', sev: 1, crowd: 6, injured: false, report: 'Alteración del orden', prop: 'speaker', call: 'Vecinos denuncian música muy alta en un local desde hace horas. El dueño no atiende. Sin violencia.' },
    { id: 'hurto', title: 'Carterista en la plaza', place: 'Plaza Mayor', sev: 2, crowd: 12, injured: false, report: 'Hurto', prop: 'stall', call: 'Un turista dice que le han robado la cartera y señala a un joven que se aleja entre la gente.' },
    { id: 'choque', title: 'Choque con discusión', place: 'Gran Vía', sev: 2, crowd: 7, injured: false, report: 'Accidente de tráfico', prop: 'car', call: 'Dos coches han chocado y los conductores discuten a gritos. Nadie parece herido.' },
    { id: 'crisis', title: 'Persona alterada', place: 'Atocha', sev: 3, crowd: 6, injured: false, report: 'Auxilio a persona', prop: 'figure', call: 'Un hombre desorientado grita en mitad del vestíbulo y rechaza que le ayuden. La gente se aparta.' },
    { id: 'atropello', title: 'Atropello leve', place: 'Calle de Alcalá', sev: 3, crowd: 9, injured: true, report: 'Accidente de tráfico', prop: 'car', call: 'Un peatón ha sido golpeado por un coche al cruzar. Está consciente pero no se levanta.' },
    { id: 'botellon', title: 'Aglomeración nocturna', place: 'Plaza de Santa Ana', sev: 2, crowd: 20, injured: false, report: 'Alteración del orden', prop: 'stall', call: 'Cientos de jóvenes beben en la plaza y hay botellas rotas. Vecinos piden que se calme.' },
    { id: 'rina', title: 'Pelea a la salida de un bar', place: 'Plaza de Santa Ana', sev: 3, crowd: 10, injured: false, report: 'Riña', prop: 'door', call: 'Dos grupos se pelean frente a un bar y un tercero intenta separarlos. Hay empujones y gritos.' },
    { id: 'concentracion', title: 'Concentración comunicada', place: 'Congreso de los Diputados', sev: 3, crowd: 30, injured: false, report: 'Reunión o manifestación', prop: 'banner', call: 'Concentración comunicada con previo aviso frente al Congreso. Ambiente tenso por algunos cánticos.' },
    { id: 'ultras', title: 'Aficiones enfrentadas', place: 'Paseo del Prado', sev: 4, crowd: 24, injured: false, report: 'Riña', prop: 'banner', call: 'Dos aficiones se cruzan tras un partido. Hay botellas y amenazas, y se acercan entre sí.' },
    { id: 'disturbios', title: 'Manifestación con bloque violento', place: 'Puerta del Sol', sev: 5, crowd: 36, injured: false, report: 'Reunión o manifestación', prop: 'banner', call: 'Manifestación no comunicada. Un bloque encapuchado lanza objetos. Cientos de personas en la plaza.' }
  ];

  const api = {
    SAVE_KEY, ranks, questions, unitTypes, supportOptions, stances,
    reportTypes, reportResults, incidents
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Constants = api;
})(typeof window !== 'undefined' ? window : globalThis);
