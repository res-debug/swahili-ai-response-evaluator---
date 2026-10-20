/* Main application logic. */
(function () {
  'use strict';

  const { CRITERIA } = Scoring;
  const ERROR_CATEGORIES = [
    'Factual error',
    'Hallucination / invented fact',
    'Irrelevant to question',
    'Ignored instruction',
    'Awkward / ungrammatical Swahili',
    'Code-switching issues',
    'Culturally inappropriate',
    'Unsafe advice',
    'Too vague / unhelpful',
    'Other'
  ];

  let currentIndex = 0;
  let editingId = null;

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  // ---------- Navigation ----------
  function showView(name) {
    $$('.view').forEach(v => { v.hidden = true; v.classList.remove('active'); });
    const target = document.getElementById('view-' + name);
    if (target) { target.hidden = false; target.classList.add('active'); }
    $$('.nav-btn').forEach(b => {
      const on = b.dataset.view === name;
      b.classList.toggle('active', on);
      if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    if (name === 'history') renderHistory();
    if (name === 'dashboard') renderDashboard();
  }

  // ---------- Scoring UI ----------
  function buildScoreGrid() {
    const grid = $('#score-grid');
    grid.innerHTML = '';
    for (const c of CRITERIA) {
      const block = document.createElement('div');
      block.className = 'score-block';
      block.innerHTML = `
        <div class="score-label">
          <strong>${c.label}</strong>
          <span class="weight">weight ${(c.weight * 100).toFixed(0)}%</span>
          <p class="score-desc">${c.description}</p>
        </div>
        <div class="score-rows">
          ${['A', 'B'].map(side => `
            <div class="score-row" data-criterion="${c.key}" data-side="${side}">
              <span class="side-tag side-${side}">${side}</span>
              <div class="stars" role="radiogroup" aria-label="${c.label} for Response ${side}">
                ${[1,2,3,4,5].map(n => `
                  <button type="button" class="star" data-value="${n}"
                    aria-label="${n} out of 5" aria-checked="false" role="radio">${n}</button>
                `).join('')}
              </div>
            </div>
          `).join('')}
        </div>
      `;
      grid.appendChild(block);
    }
    grid.addEventListener('click', onScoreClick);
  }

  function onScoreClick(e) {
    const btn = e.target.closest('.star');
    if (!btn) return;
    const row = btn.closest('.score-row');
    row.querySelectorAll('.star').forEach(s => {
      s.classList.remove('selected');
      s.setAttribute('aria-checked', 'false');
    });
    btn.classList.add('selected');
    btn.setAttribute('aria-checked', 'true');
    updateLiveBadges();
  }

  function getScore(criterionKey, side) {
    const row = document.querySelector(`.score-row[data-criterion="${criterionKey}"][data-side="${side}"]`);
    if (!row) return null;
    const sel = row.querySelector('.star.selected');
    return sel ? Number(sel.dataset.value) : null;
  }

  function collectScores(side) {
    const out = {};
    for (const c of CRITERIA) out[c.key] = getScore(c.key, side);
    return out;
  }

  function setScores(side, scores) {
    for (const c of CRITERIA) {
      const row = document.querySelector(`.score-row[data-criterion="${c.key}"][data-side="${side}"]`);
      if (!row) continue;
      row.querySelectorAll('.star').forEach(s => {
        const match = scores && scores[c.key] === Number(s.dataset.value);
        s.classList.toggle('selected', !!match);
        s.setAttribute('aria-checked', match ? 'true' : 'false');
      });
    }
    updateLiveBadges();
  }

  function updateLiveBadges() {
    const a = Scoring.weightedScore(collectScores('A'));
    const b = Scoring.weightedScore(collectScores('B'));
    $('#badge-a').textContent = a.complete ? `Weighted: ${a.score}` : `${a.missing.length} missing`;
    $('#badge-a').classList.toggle('warn', !a.complete);
    $('#badge-b').textContent = b.complete ? `Weighted: ${b.score}` : `${b.missing.length} missing`;
    $('#badge-b').classList.toggle('warn', !b.complete);
  }

  // ---------- Error categories ----------
  function buildErrorCategories() {
    const wrap = $('#error-category');
    wrap.innerHTML = ERROR_CATEGORIES.map(cat => `
      <label class="err-opt">
        <input type="checkbox" value="${cat}" />
        <span>${cat}</span>
      </label>
    `).join('');
  }

  function getErrorCategories() {
    return $$('#error-category input:checked').map(i => i.value);
  }

  function setErrorCategories(list) {
    const set = new Set(list || []);
    $$('#error-category input').forEach(i => { i.checked = set.has(i.value); });
  }

  // ---------- Task rendering ----------
  function renderTaskList() {
    const sel = $('#task-select');
    sel.innerHTML = TASKS.map((t, i) =>
      `<option value="${i}">${t.id} — ${t.category} (${t.language})</option>`
    ).join('');
  }

  function renderTask() {
    const t = TASKS[currentIndex];
    if (!t) return;
    $('#task-select').value = String(currentIndex);
    $('#task-category').textContent = t.category;
    $('#task-language').textContent = t.language;
    $('#task-id').textContent = t.id + (t.ambiguous ? ' · ambiguous' : '');
    $('#task-id').classList.toggle('warn', !!t.ambiguous);
    $('#task-question').textContent = t.question;
    const ctx = $('#task-context');
    if (t.context) { ctx.textContent = 'Context: ' + t.context; ctx.classList.remove('hidden'); }
    else ctx.classList.add('hidden');
    $('#task-reference').textContent = t.reference || 'No reference provided.';
    $('#response-a').textContent = t.responseA;
    $('#response-b').textContent = t.responseB;
    $('#task-meta').textContent = `Task ${currentIndex + 1} of ${TASKS.length}` + (t.ambiguous ? ' · flagged ambiguous by authors' : '');
    setScores('A', null);
    setScores('B', null);
  }

  // ---------- Form ----------
  function resetForm() {
    editingId = null;
    $$('input[name="verdict"]').forEach(r => { r.checked = false; });
    setScores('A', null);
    setScores('B', null);
    $('#justification').value = '';
    setErrorCategories([]);
    $('#flag-uncertain').checked = false;
    $('#btn-save').textContent = 'Save Evaluation';
    $('#form-status').textContent = '';
  }

  function collectForm() {
    const verdictEl = document.querySelector('input[name="verdict"]:checked');
    const t = TASKS[currentIndex];
    return {
      id: editingId || Storage_.makeId(),
      taskId: t.id,
      taskCategory: t.category,
      taskLanguage: t.language,
      taskQuestion: t.question,
      verdict: verdictEl ? verdictEl.value : null,
      scoresA: collectScores('A'),
      scoresB: collectScores('B'),
      justification: $('#justification').value.trim(),
      errorCategories: getErrorCategories(),
      flagged: $('#flag-uncertain').checked,
      createdAt: editingId ? (findEvaluation(editingId)?.createdAt || new Date().toISOString()) : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  function findEvaluation(id) {
    return Storage_.readAll().find(e => e.id === id);
  }

  function onSubmit(e) {
    e.preventDefault();
    const ev = collectForm();
    const errors = Scoring.validateEvaluation(ev);
    if (errors.length) {
      $('#form-status').textContent = '⚠ ' + errors.join('; ');
      return;
    }
    Storage_.upsert(ev);
    $('#form-status').textContent = '✓ Saved';
    editingId = null;
    $('#btn-save').textContent = 'Save Evaluation';
    setTimeout(() => { $('#form-status').textContent = ''; }, 2500);
  }

  // ---------- History ----------
  function renderHistory() {
    const list = Storage_.readAll().sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
    const wrap = $('#history-list');
    if (!list.length) {
      wrap.innerHTML = '<p class="empty">No evaluations saved yet. Go to the Evaluate tab to start.</p>';
      return;
    }
    wrap.innerHTML = list.map(ev => {
      const a = Scoring.weightedScore(ev.scoresA);
      const b = Scoring.weightedScore(ev.scoresB);
      return `
      <article class="history-item" data-id="${ev.id}">
        <header>
          <strong>${ev.taskId}</strong>
          <span class="chip subtle">${ev.taskCategory || ''}</span>
          <span class="chip subtle">${ev.verdict ? Scoring.verdictLabel(ev.verdict) : 'no verdict'}</span>
          ${ev.flagged ? '<span class="chip warn">flagged uncertain</span>' : ''}
          <span class="meta-text">${new Date(ev.updatedAt || ev.createdAt).toLocaleString()}</span>
        </header>
        <p class="history-q">${escapeHtml(ev.taskQuestion || '')}</p>
        <p class="history-just">${escapeHtml(ev.justification)}</p>
        <p class="history-scores">
          A: ${a.complete ? a.score : 'incomplete'} ·
          B: ${b.complete ? b.score : 'incomplete'}
          ${ev.errorCategories?.length ? '· errors: ' + ev.errorCategories.map(escapeHtml).join(', ') : ''}
        </p>
        <div class="history-actions">
          <button class="btn ghost small" data-act="edit">Edit</button>
          <button class="btn danger small" data-act="delete">Delete</button>
        </div>
      </article>`;
    }).join('');
    wrap.querySelectorAll('.history-item').forEach(item => {
      item.addEventListener('click', onHistoryAction);
    });
  }

  function onHistoryAction(e) {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    const id = btn.closest('.history-item').dataset.id;
    if (btn.dataset.act === 'delete') {
      if (confirm('Delete this evaluation?')) {
        Storage_.remove(id);
        renderHistory();
      }
    } else if (btn.dataset.act === 'edit') {
      loadForEdit(id);
    }
  }

  function loadForEdit(id) {
    const ev = findEvaluation(id);
    if (!ev) return;
    const idx = TASKS.findIndex(t => t.id === ev.taskId);
    if (idx >= 0) { currentIndex = idx; renderTask(); }
    editingId = id;
    $$('input[name="verdict"]').forEach(r => { r.checked = r.value === ev.verdict; });
    setScores('A', ev.scoresA);
    setScores('B', ev.scoresB);
    $('#justification').value = ev.justification || '';
    setErrorCategories(ev.errorCategories);
    $('#flag-uncertain').checked = !!ev.flagged;
    $('#btn-save').textContent = 'Update Evaluation';
    showView('evaluate');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ---------- Dashboard ----------
  function renderDashboard() {
    const evs = Storage_.readAll();
    const agg = Scoring.aggregate(evs);

    $('#kpi-row').innerHTML = `
      <div class="kpi"><span class="kpi-label">Evaluations</span><span class="kpi-value">${agg.total}</span></div>
      <div class="kpi"><span class="kpi-label">Flagged uncertain</span><span class="kpi-value">${agg.flagged}</span></div>
      <div class="kpi"><span class="kpi-label">Avg weighted A</span><span class="kpi-value">${agg.avgA ?? '—'}</span></div>
      <div class="kpi"><span class="kpi-label">Avg weighted B</span><span class="kpi-value">${agg.avgB ?? '—'}</span></div>
    `;

    barChart('#chart-verdict',
      Object.entries(agg.verdictCounts).map(([k, v]) => ({ label: Scoring.verdictLabel(k), value: v })),
      agg.total
    );

    barChart('#chart-scores',
      Object.entries(agg.scoreCounts).map(([k, v]) => ({ label: 'Score ' + k, value: v })),
      agg.total * CRITERIA.length * 2
    );

    const errors = Object.entries(agg.errorCounts).sort((a, b) => b[1] - a[1]);
    barChart('#chart-errors',
      errors.length ? errors.map(([k, v]) => ({ label: k, value: v })) : [{ label: 'No data', value: 0 }],
      Math.max(1, ...errors.map(e => e[1]))
    );

    barChart('#chart-criteria',
      CRITERIA.map(c => ({
        label: c.label,
        value: agg.criterionAverages[c.key] ?? 0,
        display: agg.criterionAverages[c.key] ?? '—'
      })),
      5
    );
  }

  function barChart(sel, rows, max) {
    const el = document.querySelector(sel);
    if (!el) return;
    const m = max || Math.max(1, ...rows.map(r => r.value));
    el.innerHTML = rows.map(r => {
      const pct = Math.min(100, (r.value / m) * 100);
      return `
        <div class="bar-row">
          <span class="bar-label">${escapeHtml(r.label)}</span>
          <div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div>
          <span class="bar-value">${r.display !== undefined ? r.display : r.value}</span>
        </div>`;
    }).join('');
  }

  // ---------- Rubric ----------
  function renderRubric() {
    const el = $('#rubric-grid');
    el.innerHTML = CRITERIA.map(c => `
      <div class="rubric-card">
        <h3>${c.label} <span class="weight">${(c.weight * 100).toFixed(0)}%</span></h3>
        <p>${c.description}</p>
        <ol class="rubric-levels">
          <li><strong>1</strong> — Very poor / harmful / factually wrong</li>
          <li><strong>2</strong> — Poor, major issues</li>
          <li><strong>3</strong> — Acceptable, noticeable issues</li>
          <li><strong>4</strong> — Good, minor issues</li>
          <li><strong>5</strong> — Excellent, no meaningful issues</li>
        </ol>
      </div>
    `).join('');
  }

  // ---------- Export / clear ----------
  function exportCSV() {
    const list = Storage_.readAll();
    Exporter.download('evaluations.csv', Exporter.toCSV(list), 'text/csv;charset=utf-8');
  }
  function exportJSON() {
    const list = Storage_.readAll();
    Exporter.download('evaluations.json', Exporter.toJSON(list), 'application/json');
  }
  function clearAll() {
    if (!Storage_.readAll().length) { alert('Nothing to delete.'); return; }
    if (confirm('Delete ALL saved evaluations? This cannot be undone.')) {
      Storage_.clear();
      renderHistory();
    }
  }

  // ---------- Utilities ----------
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, ch => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));
  }

  // ---------- Init ----------
  function init() {
    renderTaskList();
    buildScoreGrid();
    buildErrorCategories();
    renderRubric();
    renderTask();
    resetForm();

    $$('.nav-btn').forEach(b => b.addEventListener('click', () => showView(b.dataset.view)));
    $('#task-select').addEventListener('change', e => {
      currentIndex = Number(e.target.value);
      renderTask();
      resetForm();
    });
    $('#btn-prev').addEventListener('click', () => {
      currentIndex = (currentIndex - 1 + TASKS.length) % TASKS.length;
      renderTask(); resetForm();
    });
    $('#btn-next').addEventListener('click', () => {
      currentIndex = (currentIndex + 1) % TASKS.length;
      renderTask(); resetForm();
    });
    $('#eval-form').addEventListener('submit', onSubmit);
    $('#btn-clear').addEventListener('click', resetForm);
    $('#btn-export-csv').addEventListener('click', exportCSV);
    $('#btn-export-json').addEventListener('click', exportJSON);
    $('#btn-clear-all').addEventListener('click', clearAll);
  }

  document.addEventListener('DOMContentLoaded', init);
})();