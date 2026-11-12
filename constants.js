// constants.js — datos fijos del simulador: plantillas, unidades, mapa y ajustes.
(function (root) {
  'use strict';

  const STORAGE_KEY = 'sdp-sim-state-v2';

  const severityRank = { high: 3, medium: 2, low: 1 };

  const districtNames = ['Centro', 'San Miguel', 'La Estación', 'Ribera'];

  // Velocidad del reloj: minutos de juego por segundo real, antes de aplicar el multiplicador.
  const BASE_GAME_MINUTES_PER_SECOND = 1;
  const speedOptions = [
    { id: 1, label: '1×' },
    { id: 3, label: '3×' },
    { id: 6, label: '6×' }
  ];

  const difficultyConfig = {
    facil: { label: 'Fácil', callFactor: 0.7, trustBonus: 2, scoreMultiplier: 1.15, spawnMin: 9, spawnMax: 20 },
    media: { label: 'Media', callFactor: 1, trustBonus: 1, scoreMultiplier: 1, spawnMin: 6, spawnMax: 15 },
    dificil: { label: 'Difícil', callFactor: 1.35, trustBonus: 0, scoreMultiplier: 1.3, spawnMin: 4, spawnMax: 10 }
  };

  // Al llegar la unidad, se muestra una escena a pantalla completa con el texto
  // de la situación y varias opciones. Cada opción tiene un resultado normal y,
  // con cierta probabilidad, una complicación (failChance) con otro desenlace.
  const sceneScripts = {
    N: {
      title: 'Aviso de ruido',
      intro: 'Varios vecinos se quejan del volumen de la música en un local de {location}. El dueño insiste en que no molesta a nadie.',
      options: [
        { id: 'hablar', label: 'Hablar con el dueño', trust: 3, extraMinutes: 0, successText: 'El dueño baja el volumen y pide disculpas a los vecinos.', failChance: 0.15, failTrust: 0, failExtraMinutes: 5, failText: 'El dueño se enroca un rato, pero al final cede.' },
        { id: 'sancionar', label: 'Poner una sanción', trust: 5, extraMinutes: 5, successText: 'La sanción deja claro el mensaje; los vecinos lo agradecen.', failChance: 0.35, failTrust: -4, failExtraMinutes: 8, failText: 'El dueño se pone agresivo y la discusión escala antes de calmarse.' },
        { id: 'avisar', label: 'Aviso verbal y marcharte', trust: 1, extraMinutes: 0, successText: 'Un aviso rápido basta por ahora.', failChance: 0.2, failTrust: -1, failExtraMinutes: 3, failText: 'En cuanto te vas, vuelven a subir el volumen y hay que regresar.' }
      ]
    },
    A: {
      title: 'Persona que necesita ayuda',
      intro: 'Encuentras a una persona visiblemente afectada en {location} que necesita asistencia.',
      options: [
        { id: 'calmar', label: 'Hablar y tranquilizarla', trust: 4, extraMinutes: 0, successText: 'Consigues calmarla y la situación se resuelve bien.', failChance: 0.1, failTrust: 1, failExtraMinutes: 5, failText: 'Cuesta calmarla, pero al final lo consigues.' },
        { id: 'sanitario', label: 'Pedir apoyo sanitario', trust: 5, extraMinutes: 8, successText: 'La ambulancia llega y se hace cargo correctamente.', failChance: 0.1, failTrust: 3, failExtraMinutes: 12, failText: 'La ambulancia tarda más de lo esperado.' },
        { id: 'trasladar', label: 'Llevarla tú mismo a un lugar seguro', trust: 2, extraMinutes: 3, successText: 'La trasladas sin problema a un lugar seguro.', failChance: 0.3, failTrust: -2, failExtraMinutes: 6, failText: 'La persona se resiste y la situación se complica un momento.' }
      ]
    },
    T: {
      title: 'Incidente de tráfico',
      intro: 'Un incidente está complicando la circulación en {location}.',
      options: [
        { id: 'dirigir', label: 'Dirigir el tráfico manualmente', trust: 3, extraMinutes: 2, successText: 'Consigues coordinar el tráfico sin más incidentes.', failChance: 0.15, failTrust: 1, failExtraMinutes: 6, failText: 'Cuesta coordinar el tráfico, pero se resuelve.' },
        { id: 'gruas', label: 'Llamar a una grúa y cortar el carril', trust: 4, extraMinutes: 10, successText: 'La grúa retira el vehículo y todo vuelve a la normalidad.', failChance: 0.1, failTrust: 3, failExtraMinutes: 14, failText: 'La grúa tarda más de lo previsto.' },
        { id: 'rapido', label: 'Resolverlo rápido tú mismo', trust: 1, extraMinutes: 0, successText: 'Despejas la vía en un momento.', failChance: 0.25, failTrust: -2, failExtraMinutes: 5, failText: 'Al ir deprisa, la cosa se complica un poco más.' }
      ]
    },
    V: {
      title: 'Incidencia vecinal',
      intro: 'Un vecino reclama que intervengas en un conflicto menor en {location}.',
      options: [
        { id: 'mediar', label: 'Mediar entre las partes', trust: 4, extraMinutes: 0, successText: 'Ambas partes ceden y el conflicto se calma.', failChance: 0.15, failTrust: 1, failExtraMinutes: 4, failText: 'Cuesta que cedan, pero al final se calma.' },
        { id: 'informe', label: 'Levantar un informe oficial', trust: 2, extraMinutes: 5, successText: 'El informe deja constancia y ambas partes se calman.', failChance: 0.1, failTrust: 1, failExtraMinutes: 6, failText: 'El papeleo se alarga un poco más de la cuenta.' },
        { id: 'ignorar', label: 'Resolverlo de pasada', trust: 1, extraMinutes: 0, successText: 'Un vistazo rápido basta por ahora.', failChance: 0.3, failTrust: -2, failExtraMinutes: 3, failText: 'El conflicto vuelve a estallar poco después.' }
      ]
    },
    D: {
      title: 'Disturbios en la calle',
      intro: 'Varios grupos se enfrentan en {location}; la tensión sube por momentos.',
      options: [
        { id: 'dialogo', label: 'Intentar calmar con diálogo', trust: 5, extraMinutes: 5, successText: 'El diálogo funciona y los grupos se dispersan tranquilos.', failChance: 0.3, failTrust: -3, failExtraMinutes: 10, failText: 'El diálogo no cala y la tensión sube antes de bajar.' },
        { id: 'refuerzos', label: 'Pedir refuerzos y contener', trust: 2, extraMinutes: 10, successText: 'Con refuerzos consigues contener la situación.', failChance: 0.1, failTrust: 1, failExtraMinutes: 14, failText: 'Los refuerzos tardan en llegar.' },
        { id: 'dispersar', label: 'Dispersar al grupo directamente', trust: -1, extraMinutes: 3, successText: 'El grupo se dispersa, aunque con malestar.', failChance: 0.35, failTrust: -5, failExtraMinutes: 8, failText: 'La dispersión se complica y hay empujones.' }
      ]
    },
    I: {
      title: 'Intervención no urgente',
      intro: 'Un aviso de baja prioridad en {location} requiere una revisión rápida.',
      options: [
        { id: 'revisar', label: 'Revisar con calma', trust: 2, extraMinutes: 2, successText: 'Todo en orden tras revisarlo con calma.', failChance: 0.1, failTrust: 1, failExtraMinutes: 4, failText: 'Todo en orden, aunque tarda un poco más.' },
        { id: 'rapido', label: 'Resolver en dos minutos', trust: 1, extraMinutes: 0, successText: 'Lo resuelves sin complicaciones.', failChance: 0.2, failTrust: 0, failExtraMinutes: 3, failText: 'Se te escapa un detalle y tienes que volver a mirar.' },
        { id: 'delegar', label: 'Delegarlo y seguir con otra cosa', trust: 0, extraMinutes: 0, successText: 'Alguien se hace cargo sin más.', failChance: 0.15, failTrust: -1, failExtraMinutes: 2, failText: 'Nadie se hace cargo y el aviso vuelve a aparecer.' }
      ]
    },
    M: {
      title: 'Manifestación activa',
      intro: 'La manifestación en {location} sigue activa; la gente pide ser escuchada.',
      options: [
        { id: 'acompanar', label: 'Acompañar y garantizar seguridad', trust: 6, extraMinutes: 5, successText: 'La manifestación se desarrolla sin incidentes.', failChance: 0.2, failTrust: 2, failExtraMinutes: 10, failText: 'Cuesta coordinar con los manifestantes, pero se logra.' },
        { id: 'negociar', label: 'Negociar con los organizadores', trust: 4, extraMinutes: 8, successText: 'Los organizadores aceptan acortar el recorrido.', failChance: 0.15, failTrust: 2, failExtraMinutes: 12, failText: 'La negociación se alarga más de lo esperado.' },
        { id: 'disolver', label: 'Pedir que se disuelva', trust: -3, extraMinutes: 3, successText: 'El grupo se disuelve, aunque descontento.', failChance: 0.4, failTrust: -6, failExtraMinutes: 10, failText: 'La gente no quiere disolverse y la cosa se tensa.' }
      ]
    },
    default: {
      title: 'Decisión requerida',
      intro: 'La unidad ya está en {location} y necesita saber cómo proceder.',
      options: [
        { id: 'dialogo', label: 'Dialogar y mediar', trust: 4, extraMinutes: 0, successText: 'Resuelto mediante diálogo.', failChance: 0.15, failTrust: 1, failExtraMinutes: 5, failText: 'Cuesta un poco, pero se resuelve mediante diálogo.' },
        { id: 'apoyo', label: 'Pedir apoyo sanitario', trust: 3, extraMinutes: 5, successText: 'Resuelto con apoyo sanitario.', failChance: 0.1, failTrust: 2, failExtraMinutes: 10, failText: 'El apoyo sanitario tarda más de lo esperado.' },
        { id: 'refuerzos', label: 'Solicitar refuerzos', trust: 1, extraMinutes: 10, successText: 'Resuelto tras solicitar refuerzos.', failChance: 0.1, failTrust: 0, failExtraMinutes: 14, failText: 'Los refuerzos tardan más de lo esperado.' }
      ]
    }
  };

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
    { id: 'G1', type: 'Grupo UIP', location: 'Base Centro', status: 'free', x: 49, y: 48, color: 'lime', progress: 85 },
    { id: 'G2', type: 'Grupo UIP', location: 'Base Norte', status: 'free', x: 42, y: 22, color: 'lime', progress: 68 },
    { id: 'G3', type: 'Patrulla de proximidad', location: 'Base Ribera', status: 'free', x: 81, y: 58, color: 'cyan', progress: 92 },
    { id: 'G4', type: 'Patrulla de proximidad', location: 'Base Estación', status: 'free', x: 57, y: 78, color: 'cyan', progress: 74 }
  ];

  // Caja geográfica real (Puerta del Sol, Madrid) sobre la que se proyectan
  // las coordenadas porcentuales x/y (0-100) de avisos, unidades y puntos de interés.
  const mapBounds = { south: 40.4108, west: -3.7108, north: 40.4231, east: -3.6958 };
  const mapZoom = 16;

  const mapPoints = [
    { label: 'H', name: 'Hospital del Distrito', type: 'hospital', x: 25, y: 18 },
    { label: 'E', name: 'Estación Central', type: 'station', x: 82, y: 37 },
    { label: 'C', name: 'Comisaría Centro', type: 'policia', x: 53, y: 58 },
    { label: 'M', name: 'Mercado Municipal', type: 'civic', x: 82, y: 75 },
    { label: 'J', name: 'Jardines de la Ribera', type: 'green', x: 18, y: 76 },
    { label: 'B', name: 'Biblioteca de San Miguel', type: 'civic', x: 20, y: 38 },
    { label: 'P', name: 'Parque Norte', type: 'green', x: 36, y: 18 }
  ];

  // Turnos jugables, elegidos en la pantalla de inicio.
  const scenarios = {
    normal: {
      label: 'Día normal',
      description: 'Carga normal de avisos. Resuelve suficientes antes de que acabe el turno sin perder el control.',
      briefing: 'Inteligencia: jornada sin incidentes mayores previstos en el centro. Aforo alto por el buen tiempo y alguna aglomeración puntual. Se esperan avisos sueltos de convivencia, tráfico y asistencia a lo largo del turno.',
      shiftMinutes: 180,
      targetServed: 7,
      spawnMultiplier: 1,
      severityBoost: 1,
      failOnZeroTrust: true
    },
    disturbios: {
      label: 'Disturbios',
      description: 'Manifestación activa y avisos graves sin parar. Aguanta todo el turno sin que la confianza caiga a 0.',
      briefing: 'Inteligencia: manifestación no comunicada que confluye hacia el centro. Se esperan varios cientos de personas, con un bloque radical identificado. Prioriza contener antes de que se descontrole; la confianza vecinal puede desplomarse rápido si los avisos se acumulan.',
      shiftMinutes: 120,
      targetServed: 5,
      spawnMultiplier: 1.7,
      severityBoost: 1.6,
      failOnZeroTrust: true
    },
    libre: {
      label: 'Turno libre',
      description: 'Sin objetivo ni límite de tiempo. Practica a tu ritmo; la confianza a 0 no acaba la partida.',
      briefing: 'Sin parte de inteligencia para este turno. Juega sin límite de tiempo ni objetivo, a tu ritmo, para familiarizarte con los grupos y el mapa.',
      shiftMinutes: null,
      targetServed: 0,
      spawnMultiplier: 1,
      severityBoost: 1,
      failOnZeroTrust: false
    }
  };

  const crowdPositions = [
    [18, 30], [31, 16], [47, 22], [63, 18], [79, 32],
    [12, 49], [27, 44], [42, 48], [58, 42], [74, 52],
    [20, 67], [36, 76], [52, 68], [68, 77], [84, 67],
    [33, 59], [61, 58], [49, 31]
  ];

  const api = {
    STORAGE_KEY,
    severityRank,
    districtNames,
    BASE_GAME_MINUTES_PER_SECOND,
    speedOptions,
    difficultyConfig,
    scenarios,
    sceneScripts,
    callTemplates,
    baseCalls,
    baseUnits,
    mapPoints,
    mapBounds,
    mapZoom,
    crowdPositions
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.Constants = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
