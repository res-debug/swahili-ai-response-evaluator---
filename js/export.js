/* CSV and JSON export helpers. */
(function (global) {
  'use strict';

  const CSV_COLUMNS = [
    'id', 'taskId', 'taskCategory', 'taskLanguage', 'verdict', 'flagged',
    'justification', 'errorCategories',
    'a_factual', 'a_relevance', 'a_fluency', 'a_instruction', 'a_cultural', 'a_safety', 'a_weighted',
    'b_factual', 'b_relevance', 'b_fluency', 'b_instruction', 'b_cultural', 'b_safety', 'b_weighted',
    'createdAt', 'updatedAt'
  ];

  function csvEscape(v) {
    if (v === null || v === undefined) return '';
    const s = String(v);
    if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  function flatten(ev) {
    const a = global.Scoring.weightedScore(ev.scoresA);
    const b = global.Scoring.weightedScore(ev.scoresB);
    const row = {
      id: ev.id,
      taskId: ev.taskId,
      taskCategory: ev.taskCategory || '',
      taskLanguage: ev.taskLanguage || '',
      verdict: ev.verdict,
      flagged: ev.flagged ? 'yes' : 'no',
      justification: ev.justification,
      errorCategories: (ev.errorCategories || []).join('; '),
      createdAt: ev.createdAt,
      updatedAt: ev.updatedAt || ev.createdAt
    };
    ['factual', 'relevance', 'fluency', 'instruction', 'cultural', 'safety'].forEach(k => {
      row['a_' + k] = ev.scoresA ? ev.scoresA[k] : '';
      row['b_' + k] = ev.scoresB ? ev.scoresB[k] : '';
    });
    row.a_weighted = a.complete ? a.score : '';
    row.b_weighted = b.complete ? b.score : '';
    return row;
  }

  function toCSV(evaluations) {
    const lines = [CSV_COLUMNS.join(',')];
    for (const ev of evaluations) {
      const row = flatten(ev);
      lines.push(CSV_COLUMNS.map(c => csvEscape(row[c])).join(','));
    }
    return lines.join('\r\n');
  }

  function toJSON(evaluations) {
    return JSON.stringify({
      generatedAt: new Date().toISOString(),
      note: 'Synthetic demonstration data. Scores are subjective human judgments, not objective truths.',
      count: evaluations.length,
      evaluations
    }, null, 2);
  }

  function download(filename, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  global.Exporter = { toCSV, toJSON, download, CSV_COLUMNS, flatten };
})(window);