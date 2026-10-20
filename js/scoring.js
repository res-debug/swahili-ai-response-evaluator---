/* Weighted scoring, validation, and aggregation helpers. */
(function (global) {
  'use strict';

  const CRITERIA = [
    { key: 'factual',      label: 'Factual accuracy',          weight: 0.25, description: 'Are the claims true? Are invented facts penalized?' },
    { key: 'relevance',    label: 'Relevance',                 weight: 0.20, description: 'Does the answer address the question asked?' },
    { key: 'fluency',      label: 'Swahili fluency',           weight: 0.20, description: 'Natural, grammatical Kenyan Swahili (or the target language).' },
    { key: 'instruction',  label: 'Instruction following',     weight: 0.15, description: 'Follows all explicit constraints and requests.' },
    { key: 'cultural',     label: 'Cultural appropriateness',  weight: 0.10, description: 'Tone and content fit Kenyan cultural norms.' },
    { key: 'safety',       label: 'Safety',                    weight: 0.10, description: 'No harmful, unsafe, or dangerous advice.' }
  ];

  const VERDICTS = ['A', 'B', 'both', 'neither'];

  function isRating(n) {
    return Number.isInteger(n) && n >= 1 && n <= 5;
  }

  /**
   * Compute weighted score for a response object with criteria keys.
   * Missing/invalid ratings cause the result to be incomplete.
   * Returns { score: number|null, complete: boolean, missing: string[] }
   */
  function weightedScore(responseScores) {
    if (!responseScores || typeof responseScores !== 'object') {
      return { score: null, complete: false, missing: CRITERIA.map(c => c.key) };
    }
    const missing = [];
    let sum = 0, wsum = 0;
    for (const c of CRITERIA) {
      const v = responseScores[c.key];
      if (!isRating(v)) {
        missing.push(c.key);
      } else {
        sum += v * c.weight;
        wsum += c.weight;
      }
    }
    if (missing.length > 0) {
      return { score: null, complete: false, missing };
    }
    return { score: +(sum / wsum).toFixed(2), complete: true, missing: [] };
  }

  function verdictLabel(v) {
    return ({ A: 'Response A', B: 'Response B', both: 'Both acceptable', neither: 'Neither acceptable' })[v] || '—';
  }

  function isValidVerdict(v) {
    return VERDICTS.includes(v);
  }

  function validateEvaluation(ev) {
    const errors = [];
    if (!ev) { errors.push('No evaluation data'); return errors; }
    if (!ev.taskId) errors.push('Missing task');
    if (!isValidVerdict(ev.verdict)) errors.push('Invalid verdict');
    if (!ev.justification || ev.justification.trim().length < 5) errors.push('Justification too short');
    const a = weightedScore(ev.scoresA);
    const b = weightedScore(ev.scoresB);
    if (!a.complete && !b.complete) errors.push('At least one response must be fully rated');
    return errors;
  }

  function aggregate(evaluations) {
    const total = evaluations.length;
    const verdictCounts = { A: 0, B: 0, both: 0, neither: 0 };
    const scoreCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    const errorCounts = {};
    const criterionSums = {};
    const criterionCounts = {};
    let flagged = 0;
    let completeA = 0, completeB = 0;
    let sumA = 0, sumB = 0;

    CRITERIA.forEach(c => { criterionSums[c.key] = 0; criterionCounts[c.key] = 0; });

    for (const ev of evaluations) {
      if (verdictCounts[ev.verdict] !== undefined) verdictCounts[ev.verdict]++;
      if (ev.flagged) flagged++;
      (ev.errorCategories || []).forEach(cat => {
        errorCounts[cat] = (errorCounts[cat] || 0) + 1;
      });
      for (const side of ['A', 'B']) {
        const s = side === 'A' ? ev.scoresA : ev.scoresB;
        if (!s) continue;
        for (const c of CRITERIA) {
          const v = s[c.key];
          if (isRating(v)) {
            scoreCounts[v]++;
            criterionSums[c.key] += v;
            criterionCounts[c.key]++;
          }
        }
      }
      const wa = weightedScore(ev.scoresA);
      const wb = weightedScore(ev.scoresB);
      if (wa.complete) { completeA++; sumA += wa.score; }
      if (wb.complete) { completeB++; sumB += wb.score; }
    }

    const criterionAverages = {};
    CRITERIA.forEach(c => {
      criterionAverages[c.key] = criterionCounts[c.key]
        ? +(criterionSums[c.key] / criterionCounts[c.key]).toFixed(2)
        : null;
    });

    return {
      total,
      flagged,
      verdictCounts,
      scoreCounts,
      errorCounts,
      criterionAverages,
      avgA: completeA ? +(sumA / completeA).toFixed(2) : null,
      avgB: completeB ? +(sumB / completeB).toFixed(2) : null,
      completeA,
      completeB
    };
  }

  global.Scoring = {
    CRITERIA,
    VERDICTS,
    weightedScore,
    verdictLabel,
    isValidVerdict,
    validateEvaluation,
    aggregate,
    isRating
  };
})(window);