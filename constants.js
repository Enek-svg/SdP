// constants.js — datos fijos del juego: temario, avisos, unidades, órdenes y rangos.
(function (root) {
  'use strict';

  const SAVE_KEY = 'sdp-carrera-v1';

  const ranks = ['Alumno', 'Policía en prácticas', 'Policía', 'Oficial', 'Inspector'];

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

  const reportTypes = ['Alteración del orden', 'Accidente de tráfico', 'Auxilio a persona', 'Hurto', 'Robo', 'Reunión o manifestación', 'Riña', 'Violencia doméstica', 'Drogas', 'Emergencia'];
  const reportResults = ['Resuelto sin incidencias', 'Resuelto con incidencias', 'No resuelto / escalada'];

  // Avisos. sev = gravedad real (1-5); crowd = personas en la escena. La llamada
  // al 091 solo da pistas: la respuesta adecuada depende de la gravedad real.
  const incidents = [
    { id: 'ruido', title: 'Música alta de madrugada', place: 'Lavapiés', sev: 1, crowd: 6, injured: false, report: 'Alteración del orden', prop: 'speaker', call: 'Vecinos denuncian música muy alta en un local desde hace horas. El dueño no atiende. Sin violencia.' },
    { id: 'hurto', arrest: true, title: 'Carterista en la plaza', place: 'Plaza Mayor', sev: 2, crowd: 12, injured: false, report: 'Hurto', prop: 'stall', call: 'Un turista dice que le han robado la cartera y señala a un joven que se aleja entre la gente.' },
    { id: 'choque', title: 'Choque con discusión', place: 'Gran Vía', sev: 2, crowd: 7, injured: false, report: 'Accidente de tráfico', prop: 'car', call: 'Dos coches han chocado y los conductores discuten a gritos. Nadie parece herido.' },
    { id: 'crisis', title: 'Persona alterada', place: 'Atocha', sev: 3, crowd: 6, injured: false, report: 'Auxilio a persona', prop: 'figure', call: 'Un hombre desorientado grita en mitad del vestíbulo y rechaza que le ayuden. La gente se aparta.' },
    { id: 'atropello', title: 'Atropello leve', place: 'Calle de Alcalá', sev: 3, crowd: 9, injured: true, report: 'Accidente de tráfico', prop: 'car', call: 'Un peatón ha sido golpeado por un coche al cruzar. Está consciente pero no se levanta.' },
    { id: 'botellon', title: 'Aglomeración nocturna', place: 'Plaza de Santa Ana', sev: 2, crowd: 20, injured: false, report: 'Alteración del orden', prop: 'stall', call: 'Cientos de jóvenes beben en la plaza y hay botellas rotas. Vecinos piden que se calme.' },
    { id: 'rina', arrest: true, title: 'Pelea a la salida de un bar', place: 'Plaza de Santa Ana', sev: 3, crowd: 10, injured: false, report: 'Riña', prop: 'door', call: 'Dos grupos se pelean frente a un bar y un tercero intenta separarlos. Hay empujones y gritos.' },
    { id: 'concentracion', title: 'Concentración comunicada', place: 'Congreso de los Diputados', sev: 3, crowd: 30, injured: false, report: 'Reunión o manifestación', prop: 'banner', call: 'Concentración comunicada con previo aviso frente al Congreso. Ambiente tenso por algunos cánticos.' },
    { id: 'ultras', title: 'Aficiones enfrentadas', place: 'Paseo del Prado', sev: 4, crowd: 24, injured: false, report: 'Riña', prop: 'banner', call: 'Dos aficiones se cruzan tras un partido. Hay botellas y amenazas, y se acercan entre sí.' },
    { id: 'disturbios', title: 'Manifestación con bloque violento', place: 'Puerta del Sol', sev: 5, crowd: 36, injured: false, report: 'Reunión o manifestación', prop: 'banner', call: 'Manifestación no comunicada. Un bloque encapuchado lanza objetos. Cientos de personas en la plaza.' },
    { id: 'nino', title: 'Niño perdido', place: 'Parque del Retiro', sev: 1, crowd: 5, injured: false, report: 'Auxilio a persona', prop: 'figure', call: 'Una madre llora: ha perdido de vista a su hijo de cinco años en el Retiro hace unos minutos.' },
    { id: 'ebrio', title: 'Persona ebria en la acera', place: 'Malasaña', sev: 1, crowd: 5, injured: false, report: 'Auxilio a persona', prop: 'figure', call: 'Un hombre muy bebido está tumbado en plena acera y no responde bien. Los viandantes lo esquivan.' },
    { id: 'venta', title: 'Venta ambulante y protestas', place: 'Puerta del Sol', sev: 1, crowd: 14, injured: false, report: 'Alteración del orden', prop: 'stall', call: 'Varios vendedores ambulantes discuten con comerciantes de la zona. Se oyen gritos, pero no hay violencia.' },
    { id: 'bolso', arrest: true, title: 'Tirón de bolso', place: 'Calle de Fuencarral', sev: 2, crowd: 9, injured: false, report: 'Robo', prop: 'bag', call: 'Dos jóvenes han arrancado un bolso a una mujer y huyen. Ella está asustada pero en pie.' },
    { id: 'trapicheo', arrest: true, title: 'Trapicheo en la plaza', place: 'Plaza de Olavide', sev: 2, crowd: 8, injured: false, report: 'Drogas', prop: 'stall', call: 'Vecinos avisan de intercambios sospechosos de paquetitos entre varios jóvenes junto a un parque infantil.' },
    { id: 'contenedor', title: 'Contenedor ardiendo', place: 'Calle de Atocha', sev: 2, crowd: 10, injured: false, report: 'Emergencia', prop: 'fire', call: 'Un contenedor arde junto a un edificio. Hay curiosos grabando y algo de humo.' },
    { id: 'violencia', arrest: true, title: 'Gritos y golpes en un portal', place: 'Lavapiés', sev: 3, crowd: 4, injured: false, report: 'Violencia doméstica', prop: 'door', call: 'Vecinos oyen gritos y golpes en un piso. Una mujer pide ayuda desde el balcón y un hombre grita dentro.' },
    { id: 'piquetes', title: 'Piquetes en una huelga', place: 'Gran Vía', sev: 3, crowd: 26, injured: false, report: 'Reunión o manifestación', prop: 'banner', call: 'Piquetes bloquean la entrada de unos grandes almacenes. Algunos clientes protestan y hay empujones.' },
    { id: 'concierto', title: 'Salida de concierto', place: 'WiZink Center', sev: 3, crowd: 28, injured: false, report: 'Alteración del orden', prop: 'stall', call: 'Miles de personas salen a la vez de un concierto. Hay botellas, atascos y algún grupo alterado.' },
    { id: 'paquete', title: 'Paquete sospechoso', place: 'Estación de Atocha', sev: 4, crowd: 22, injured: false, report: 'Emergencia', prop: 'package', call: 'Un paquete abandonado en el andén. Nadie sabe de quién es y la gente empieza a ponerse nerviosa.' },
    { id: 'multiple', title: 'Accidente múltiple', place: 'Paseo de la Castellana', sev: 4, crowd: 14, injured: true, report: 'Accidente de tráfico', prop: 'car', call: 'Colisión entre tres vehículos. Varias personas heridas y conductores muy alterados.' },
    { id: 'discoteca', arrest: true, title: 'Pelea masiva en una discoteca', place: 'Calle de Atocha', sev: 4, crowd: 22, injured: false, report: 'Riña', prop: 'door', call: 'Una pelea ha estallado en la puerta de una discoteca y se extiende a la calle. Hay botellas y gritos.' }
  ];

  // --- detenciones, derechos y primeros auxilios ---
  const arrestClues = {
    clara: [
      'Varios testigos coinciden en señalar al sospechoso y se le ve nervioso, con el objeto a la vista.',
      'Una cámara ha grabado los hechos y el sospechoso no lo niega.',
      'La víctima lo identifica sin dudar y hay lesiones o daños visibles.'
    ],
    dudosa: [
      'Nadie ha visto con claridad qué hizo. Dos testigos se contradicen y no hay pruebas en su poder.',
      'La denuncia es vaga: el sospechoso lo niega, no lleva nada encima y hay otras personas que encajan con la descripción.',
      'Solo hay una sospecha. No hay testigos fiables ni indicios materiales.'
    ]
  };

  // Derechos del detenido: ok = es un derecho real.
  const rights = [
    { id: 'motivo', t: 'Ser informado de forma inmediata del motivo de la detención', ok: true },
    { id: 'silencio', t: 'Guardar silencio y no declarar si no quiere', ok: true },
    { id: 'confesar', t: 'No declarar contra sí mismo ni confesarse culpable', ok: true },
    { id: 'abogado', t: 'Ser asistido por un abogado', ok: true },
    { id: 'familiar', t: 'Que se comunique su detención a un familiar o persona que indique', ok: true },
    { id: 'medico', t: 'Ser reconocido por un médico', ok: true },
    { id: 'sinabogado', t: 'Ser interrogado sin abogado si no se queja', ok: false },
    { id: 'sinllamada', t: 'No tener derecho a ninguna comunicación con nadie', ok: false },
    { id: 'siete', t: 'Permanecer detenido hasta 7 días sin pasar ante un juez', ok: false }
  ];

  const firstAid = [
    {
      title: 'Peatón atropellado',
      intro: 'Un peatón ha sido atropellado. Está consciente, respira y tiene una pierna sangrando. Ordena los pasos.',
      steps: [
        'Asegurar la zona y señalizar el peligro',
        'Llamar al 112 y pedir ambulancia',
        'Comprobar que está consciente y respira',
        'Presionar la herida que sangra con un apósito',
        'Mantenerlo tranquilo y abrigado hasta que llegue la ambulancia'
      ]
    },
    {
      title: 'Persona inconsciente',
      intro: 'Encuentras a una persona tumbada que no responde. Ordena los pasos de actuación.',
      steps: [
        'Asegurar la zona y comprobar que no hay peligro',
        'Comprobar si responde y si respira',
        'Llamar al 112 y pedir un desfibrilador',
        'Iniciar compresiones en el centro del pecho',
        'Continuar hasta que lleguen los sanitarios o recupere la respiración'
      ]
    }
  ];

  // --- historia: personajes, capítulos, reacciones y dilemas ---
  const cast = {
    instructor: 'Instructor Mendoza',
    tutor: 'Tutor Ruiz',
    companera: 'Lucía Vega',
    jefe: 'Comisario Herrera'
  };

  const chapters = {
    academia: {
      title: 'Capítulo 1 · La Academia',
      lines: [
        { who: 'instructor', text: 'Bienvenido, {name}. Aquí no se premia la fuerza: se premia el criterio.' },
        { who: 'instructor', text: 'Cinco pruebas: teoría, físico, tiro, primeros auxilios y una intervención simulada. Si suspendes dos veces la misma, te vas a casa.' },
        { who: 'instructor', text: 'Y recuerda: lo que escribas en un informe te seguirá toda la carrera.' }
      ]
    },
    practicas: {
      title: 'Capítulo 2 · Prácticas',
      lines: [
        { who: 'instructor', text: 'Os gradúo. Ya no sois alumnos, pero tampoco policías: eso lo decidirá la calle.' },
        { who: 'tutor', text: 'Soy el agente Ruiz. Seré tu sombra durante tres servicios.' },
        { who: 'tutor', text: 'Yo observo, tú decides. Si te equivocas, lo hablamos después. Si mientes en un informe, lo sabré.' }
      ]
    },
    jefe: {
      title: 'Capítulo 4 · El despacho',
      lines: [
        { who: 'jefe', text: 'Inspector {name}: ya no basta con salir a la calle, ahora responde de toda la comisaría.' },
        { who: 'jefe', text: 'Tienes un presupuesto, cinco agentes y sus informes encima de la mesa. Revísalos: lo que firmes lo firmas tú.' },
        { who: 'jefe', text: 'Diez turnos. Quiero números en verde y la confianza de la gente por encima del 50. Sorpréndeme.' }
      ]
    },
    servicio: {
      title: 'Capítulo 3 · A la calle',
      lines: [
        { who: 'jefe', text: 'Placa nueva, {name}. En sala se oyen todas las radios y se lee todo lo que firmáis.' },
        { who: 'companera', text: 'Soy Lucía, tu compañera de patrulla. Me gusta trabajar con gente que piensa antes de actuar.' },
        { who: 'jefe', text: 'Tres avisos por turno. Cuida tu reputación y tu expediente: aquí se asciende o se cae.' }
      ]
    }
  };

  // Frases según cómo ha ido el servicio. conceal = datos ocultados en el informe.
  const reactions = {
    instructor: {
      great: ['Trabajo limpio. Así se hace.', 'Eso es criterio. Sigue por ahí.'],
      ok: ['Aprobable, pero afina el criterio con la fuerza.', 'Correcto, aunque tardaste en leer la situación.'],
      bad: ['Esto no vale. La calle no perdona.', 'Has perdido el control. Repasa lo que hemos visto.'],
      conceal: ['Tu informe no cuadra con lo que vi. En la Academia se aprende a decir la verdad.']
    },
    tutor: {
      great: ['Muy bien. Así quiero que actúes cuando yo no esté.', 'Buen servicio. Y buen informe.'],
      ok: ['Pasable. Piensa antes de dar la orden.', 'Ni bien ni mal. Mejora la lectura de la multitud.'],
      bad: ['Esto se te ha ido de las manos. Lo hablamos.', 'Mal servicio. Tienes que ser más prudente.'],
      conceal: ['Estuve allí, {name}. Tu informe omite cosas. No lo repitas.']
    },
    companera: {
      great: ['Bien jugado. La gente se fue tranquila.', 'Eso ha sido limpio. Invito yo al café.'],
      ok: ['Podría haber ido mejor, pero salimos de esta.', 'Aceptable. La próxima, antes de avanzar, hablamos.']
    },
    jefe: {
      bad: ['Se te ha ido de las manos. Quiero explicaciones en mi despacho.', 'Esto no es lo que esperamos de ti.'],
      conceal: ['Asuntos Internos va a leer ese informe dos veces. Piénsatelo.']
    }
  };

  // Dilemas tras cada turno. Cada opción puede mover reputación, sanciones y datos ocultados.
  const dilemmas = [
    {
      id: 'empujon', who: 'companera', title: 'Un compañero se pasó',
      text: 'Un compañero veterano dio un empujón de más a un detenido. Te pide que en el informe pongas que el detenido tropezó.',
      choices: [
        { label: 'Escribir lo que te pide', rep: -4, strikes: 1, concealments: 1, result: 'Firmas un informe falso. Si se descubre, caerás con él.' },
        { label: 'Negarte y decirle que lo comunique él', rep: 3, strikes: 0, concealments: 0, result: 'Se enfada, pero lo comunica. Lucía asiente en silencio.' },
        { label: 'Hablar con el jefe de sala', rep: 2, strikes: 0, concealments: 0, result: 'El jefe lo trata con discreción. Tu compañero no te habla en una semana.' }
      ]
    },
    {
      id: 'periodista', who: 'jefe', title: 'Un periodista pregunta',
      text: 'Un periodista pregunta por la intervención del último turno. Quiere declaraciones.',
      choices: [
        { label: 'Dar la versión oficial completa', rep: 2, strikes: 0, concealments: 0, result: 'Tu versión es clara y se publica sin incidentes.' },
        { label: 'No hacer declaraciones', rep: 0, strikes: 0, concealments: 0, result: 'Lo derivas a prensa. El asunto no pasa a más.' },
        { label: 'Quitar importancia a lo ocurrido', rep: -2, strikes: 1, concealments: 0, result: 'Tu versión no encaja con un vídeo posterior. Herrera te cita.' }
      ]
    },
    {
      id: 'cartera', who: 'companera', title: 'Una cartera con dinero',
      text: 'Al registrar el coche de un detenido aparece una cartera con mucho dinero. Nadie más lo ha visto.',
      choices: [
        { label: 'Entregarla con acta', rep: 3, strikes: 0, concealments: 0, result: 'Queda todo documentado. Lucía sonríe: así se hace.' },
        { label: 'Dejarla donde estaba', rep: -1, strikes: 0, concealments: 0, result: 'No pasa nada, pero la cadena de custodia queda coja.' },
        { label: 'Quedártela', rep: -8, strikes: 2, concealments: 1, result: 'Alguien lo vio. Esto va a tener consecuencias.' }
      ]
    },
    {
      id: 'video', who: 'jefe', title: 'Un vídeo en redes',
      text: 'Circula un vídeo parcial de tu último servicio. Sin contexto, parece mucho peor de lo que fue.',
      choices: [
        { label: 'Aportar tu informe a Asuntos Internos', rep: 3, strikes: 0, concealments: 0, result: 'Tu informe coincide con las cámaras. Caso cerrado.' },
        { label: 'Pedir que lo retiren de las redes', rep: -2, strikes: 0, concealments: 0, result: 'No sirve de nada y alimenta el ruido.' },
        { label: 'Ignorarlo', rep: -1, strikes: 0, concealments: 0, result: 'El vídeo se enfría solo, pero Herrera no está contento.' }
      ]
    }
  ];

  const api = {
    SAVE_KEY, ranks, questions, unitTypes, supportOptions, stances,
    reportTypes, reportResults, incidents, cast, chapters, reactions, dilemmas, arrestClues, rights, firstAid
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Constants = api;
})(typeof window !== 'undefined' ? window : globalThis);
