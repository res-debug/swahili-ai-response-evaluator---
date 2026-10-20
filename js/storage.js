/* localStorage persistence for evaluations. */
(function (global) {
  'use strict';

  const KEY = 'swahili-ai-evaluations-v1';

  function readAll() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return [];
      const data = JSON.parse(raw);
      return Array.isArray(data) ? data : [];
    } catch (e) {
      console.warn('Failed to read evaluations', e);
      return [];
    }
  }

  function writeAll(list) {
    localStorage.setItem(KEY, JSON.stringify(list));
  }

  function upsert(ev) {
    const list = readAll();
    const idx = list.findIndex(x => x.id === ev.id);
    if (idx >= 0) list[idx] = ev;
    else list.push(ev);
    writeAll(list);
    return ev;
  }

  function remove(id) {
    const list = readAll().filter(x => x.id !== id);
    writeAll(list);
  }

  function clear() {
    localStorage.removeItem(KEY);
  }

  function makeId() {
    return 'ev-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
  }

  global.Storage_ = { readAll, writeAll, upsert, remove, clear, makeId, KEY };
})(window);