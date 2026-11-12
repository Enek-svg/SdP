// utils.js — funciones pequeñas sin dependencias.
(function (root) {
  'use strict';

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const rand = (min, max) => min + Math.random() * (max - min);
  const pick = (list) => list[Math.floor(Math.random() * list.length)];

  function shuffle(list) {
    const copy = list.slice();
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function esc(value) {
    return String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  const round1 = (value) => Math.round(value * 10) / 10;

  const api = { clamp, rand, pick, shuffle, esc, round1 };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Utils = api;
})(typeof window !== 'undefined' ? window : globalThis);
