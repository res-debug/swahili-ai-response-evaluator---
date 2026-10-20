# Swahili AI Response Evaluator

A static, browser-only dashboard for **human evaluation of AI-generated responses** in Kenyan Swahili and English. It runs entirely client-side — no backend, no API keys, no build step — and deploys to GitHub Pages.

> ⚠️ **All tasks and responses are synthetic.** All scores and statistics are **demonstration results** only. Subjective judgments are not objective truths.

## Features

- **40 original synthetic evaluation tasks** across customer service, education, mobile money, transport, agriculture, technology, and everyday Kenyan conversations.
- Side-by-side **Response A / Response B** comparison.
- Six-criterion scoring (1–5): factual accuracy, relevance, Swahili fluency, instruction following, cultural appropriateness, safety.
- Documented, transparent **weighted scoring rubric** (weights visible in the UI and in `js/scoring.js`).
- Verdicts: **A / B / both acceptable / neither acceptable**.
- Written justification + multi-select **error categories**.
- **Flag uncertain** evaluations.
- **localStorage** persistence; **edit** and **delete** saved evaluations.
- **Dashboard** with verdict distribution, score distribution, common error categories, and per-criterion averages.
- **Export** to CSV and JSON.
- Responsive, keyboard-accessible UI.
- Automated tests in `tests/test-runner.html`.

## Project structure
