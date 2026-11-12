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

  // Cómo abordar el aviso al despachar la unidad. Cada enfoque es algo más rápido
  // o más lento, y da un extra de confianza si coincide con la decisión final.
  const approachConfig = {
    'diálogo': { label: 'Mediación y diálogo', travelFactor: 1, matchesDecision: 'dialogue', bonusTrust: 2 },
    'tráfico': { label: 'Apoyo de tráfico', travelFactor: 0.85, matchesDecision: 'reinforcements', bonusTrust: 2 },
    'asistencia': { label: 'Asistencia ciudadana', travelFactor: 1.1, matchesDecision: 'support', bonusTrust: 2 }
  };

  const decisionOutcomes = {
    dialogue: { text: 'resuelta mediante diálogo', trust: 4, extraMinutes: 0 },
    support: { text: 'resuelta con apoyo sanitario', trust: 3, extraMinutes: 5 },
    reinforcements: { text: 'resuelta tras solicitar refuerzos', trust: 1, extraMinutes: 10 }
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
    approachConfig,
    decisionOutcomes,
    callTemplates,
    baseCalls,
    baseUnits,
    mapPoints,
    crowdPositions
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.Constants = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
