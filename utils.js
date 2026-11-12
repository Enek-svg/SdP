// utils.js — funciones pequeñas sin dependencias, usadas por el resto de archivos.
(function (root) {
  'use strict';

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function timeString(totalMinutes) {
    const safeTotal = Math.max(0, Math.floor(totalMinutes));
    const hours = Math.floor(safeTotal / 60) % 24;
    const minutes = safeTotal % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }

  function randomItem(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  function randomBetween(min, max) {
    return min + Math.random() * (max - min);
  }

  function uid(prefix) {
    return `${prefix}-${Math.random().toString(36).slice(2, 7)}`;
  }

  // Escapa texto antes de insertarlo con innerHTML. El estado se restaura desde
  // localStorage, así que cualquier texto guardado se trata como no confiable.
  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function numberOr(value, fallback) {
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  }

  const api = { clamp, timeString, randomItem, randomBetween, uid, escapeHtml, numberOr };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.Utils = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
