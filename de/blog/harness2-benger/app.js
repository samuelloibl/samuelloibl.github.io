'use strict';

for (const node of document.querySelectorAll('.prose details')) node.open = false;

const charts = [];
let data;
const number = new Intl.NumberFormat('de-AT', {maximumFractionDigits: 1});
const integer = new Intl.NumberFormat('de-DE', {maximumFractionDigits: 0});
const mean = new Intl.NumberFormat('de-AT', {minimumFractionDigits: 1, maximumFractionDigits: 1});
const tooltipValue = value => Array.isArray(value) ? number.format(value[1]) : typeof value === 'number' ? (value >= 10000 ? integer.format(value) : number.format(value)) : value;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const color = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

// The website's security policy blocks inline style attributes, so tooltip content uses classes from article.css only.
const escapeHtml = text => String(text).replace(/[&<>"]/g, char => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[char]));
function tooltipFormatter(format) {
  return params => {
    const list = (Array.isArray(params) ? params : [params]).filter(p => p.value !== '-' && p.value != null);
    if (!list.length) return '';
    const title = `<div class="chart-tip-title">${escapeHtml(String(list[0].axisValueLabel ?? list[0].name).replace(/\n/g, ' '))}</div>`;
    return title + list.map(p => `<div class="chart-tip-row"><span>${escapeHtml(p.seriesName)}</span><strong>${escapeHtml(format(p.value))}</strong></div>`).join('');
  };
}

function baseOption(format = tooltipValue) {
  return {animation: !reducedMotion, animationDuration: 250, textStyle: {fontFamily: 'IBM Plex Sans, sans-serif', color: color('--ink-soft')},
    tooltip: {trigger: 'axis', confine: true, formatter: tooltipFormatter(format), className: 'chart-tip', backgroundColor: color('--paper'), borderColor: color('--line'), textStyle: {color: color('--ink'), fontSize: 13}},
    aria: {enabled: true}, grid: {left: 6, right: 34, top: 18, bottom: 10, containLabel: true}};
}

function axis() {
  return {type: 'value', min: 0, max: 100, axisLabel: {color: color('--muted')}, splitLine: {lineStyle: {color: color('--line')}}, axisLine: {show: false}};
}

function meanOption() {
  const rows = data.mean_rows;
  return {...baseOption(value => mean.format(value)), xAxis: axis(), yAxis: {type: 'category', inverse: true,
    data: rows.map(row => row.label), axisTick: {show: false}, axisLine: {show: false}, axisLabel: {fontSize: 11, width: 125, overflow: 'break', color: label => color(label.startsWith('GPT-6.1 Sol') ? '--muted' : '--ink-soft')}},
    series: [{name: 'Rohpunkte von 100', type: 'bar', barMaxWidth: 24,
      // GPT-6.1 Sol is a different model; it stays visibly apart from the GPT-5.6 Terra bars.
      data: rows.map(row => {
        const other = row.label.startsWith('GPT-6.1 Sol');
        return {value: row.value, itemStyle: {color: color(other ? '--faint' : row.label.startsWith('Versuch 3\n') ? '--ink' : '--ink-soft')},
          label: {fontWeight: row.label.startsWith('Versuch 3\n') ? 600 : 400, color: color(other ? '--muted' : '--ink')}};
      }),
      label: {show: true, position: 'right', color: color('--ink'), formatter: p => mean.format(p.value)}}]};
}

function selectedCase() {
  const study = document.getElementById('study-select');
  const variants = {first: data.historical_k1_cases, historical: data.historical_cases, current: data.cases};
  const cases = variants[study ? study.value : 'current'];
  return cases.find(row => String(row.number) === document.getElementById('case-select').value);
}

function roundsOption() {
  let row = selectedCase();
  // Versuch 1 had a single Harness² round: its final answer sits at round 1, rounds 2 and 3 stay empty.
  if (document.getElementById('study-select').value === 'first') row = {...row, c1: row.selected, c2: '-', c3: '-', selected_checkpoint: 'c1'};
  const baselineName = 'Direktantwort';
  const selectedIndex = Number(row.selected_checkpoint.slice(1)) - 1;
  const option = {...baseOption(), grid: {left: 5, right: 15, top: 60, bottom: 12, containLabel: true},
    legend: {top: 0, textStyle: {color: color('--ink-soft'), fontSize: 11}, itemWidth: 17, itemHeight: 9,
      data: ['Harness²', baselineName, 'Eigenkorrektur nach Runde 3']},
    xAxis: {type: 'category', data: ['Runde 1', 'Runde 2', 'Runde 3'], boundaryGap: true, axisLabel: {color: color('--muted')}, axisLine: {lineStyle: {color: color('--line')}}}, yAxis: axis(),
    series: [
      {name: 'Harness²', type: 'line', data: [row.c1, row.c2, row.c3], symbolSize: 9, itemStyle: {color: color('--ink')}, lineStyle: {width: 2.5}, label: {show: true, position: 'top', color: color('--ink'), formatter: p => number.format(p.value)},
       markPoint: {symbol: 'pin', symbolSize: 39, data: [{coord: [selectedIndex, row.selected], value: row.selected}], label: {fontSize: 11, color: color('--paper'), formatter: p => number.format(p.value)}, itemStyle: {color: color('--ink')}}},
      {name: baselineName, type: 'line', data: [row.baseline, row.baseline, row.baseline], symbol: 'none', lineStyle: {type: 'dashed', color: color('--faint')}, itemStyle: {color: color('--faint')}},
      {name: 'Eigenkorrektur nach Runde 3', type: 'scatter', data: [[2, row.control3]], symbol: 'diamond', symbolSize: 13, itemStyle: {color: color('--muted')}, label: {show: true, position: 'right', color: color('--muted'), formatter: p => number.format(p.value[1])}}]};
  return option;
}

function updateCase() {
  const row = selectedCase();
  const baselineName = 'Direktantwort';
  charts[1].setOption(roundsOption(), true);
  const first = document.getElementById('study-select').value === 'first';
  document.getElementById('case-observation').textContent = first
    ? `Fall ${row.number}. Versuch 1: Direktantwort ${number.format(row.baseline)}, Harness² ${number.format(row.selected)}, drei Eigenkorrekturen ${number.format(row.control3)} Rohpunkte.`
    : `Fall ${row.number}. ${row.observation ? row.observation + ' ' : ''}GPT-5.6 Terra wählte die Antwort aus Runde ${row.selected_checkpoint.slice(1)} mit ${number.format(row.selected)} Punkten. Die ${baselineName} erhielt ${number.format(row.baseline)} Punkte, die Antwort nach drei Eigenkorrekturen ${number.format(row.control3)}.`;
  document.getElementById('case-chart-note').textContent = first
    ? 'Versuch 1 hatte nur eine Harness²-Runde, für Runde 2 und 3 gibt es daher keinen Harness²-Wert. Bei der freien Eigenkorrektur wurde nur die Endantwort nach Runde 3 bewertet.'
    : 'Die Markierung zeigt, welche Fassung GPT-5.6 Terra am Ende gewählt hat. Bei der freien Eigenkorrektur wurde nur die Endantwort nach Runde 3 bewertet.';
  document.getElementById('rounds-chart').setAttribute('aria-label', first
    ? 'Rohpunkte in Versuch 1: Harness² nach seiner einzigen Runde, die Direktantwort und die freie Eigenkorrektur nach Runde 3.'
    : 'Rohpunkte der drei Harness-Antworten, der Direktantwort und der freien Eigenkorrektur.');
  for (const button of document.querySelectorAll('button[data-case]')) button.setAttribute('aria-pressed', String(Number(button.dataset.case) === row.number));
  document.getElementById('rounds-chart').dataset.case = String(row.number);
}

function costOption() {
  const option = {...baseOption(), grid: {left: 6, right: 78, top: 18, bottom: 10, containLabel: true},
    xAxis: {...axis(), max: Math.ceil(Math.max(...data.costs.total) * 1.15 / 500000) * 500000, axisLabel: {color: color('--muted'), formatter: value => number.format(value / 1000000) + ' Mio.'}},
    yAxis: {type: 'category', inverse: true, data: ['Direktantwort', 'Drei\nEigenkorrekturen', 'Harness²'], axisTick: {show: false}, axisLine: {show: false}, axisLabel: {fontSize: 11, color: color('--ink-soft')}},
    series: [{name: 'Gesamttokens ohne Bewertung', type: 'bar', barMaxWidth: 24, data: data.costs.total,
      itemStyle: {color: color('--muted')}, label: {show: true, fontSize: 11, position: 'right', color: color('--ink'), formatter: p => integer.format(p.value)}}]};
  document.getElementById('cost-note').textContent = data.cost_note;
  document.getElementById('cost-chart').dataset.metric = 'total';
  return option;
}

function recolor() {
  if (!data) return;
  charts[0].setOption(meanOption(), true);
  updateCase();
  charts[2].setOption(costOption(), true);
}

const themeButton = document.getElementById('theme-toggle');
function setTheme(dark) {
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  themeButton.setAttribute('aria-pressed', String(dark));
  themeButton.setAttribute('aria-label', dark ? 'Hellmodus' : 'Dunkelmodus');
  themeButton.title = dark ? 'Hellmodus' : 'Dunkelmodus';
  recolor();
}
try { setTheme(localStorage.getItem('theme') === 'dark'); } catch { setTheme(false); }
themeButton.hidden = false;
themeButton.addEventListener('click', () => {
  const dark = document.documentElement.dataset.theme !== 'dark';
  setTheme(dark);
  try { if (dark) localStorage.setItem('theme', 'dark'); else localStorage.removeItem('theme'); } catch {}
});

// The chart library is large; load it and the data only shortly before the first chart scrolls into view.
const chartIds = ['means-chart', 'rounds-chart', 'cost-chart'];

function loadChartLibrary() {
  if (window.echarts) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = '/assets/echarts-6.1.0.min.js?v=b66b25aeb4df';
    script.onload = resolve;
    script.onerror = () => reject(new Error('Diagrammbibliothek ist nicht verfügbar'));
    document.head.append(script);
  });
}

function whenChartsNear() {
  return new Promise(resolve => {
    if (!('IntersectionObserver' in window)) return resolve();
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { observer.disconnect(); resolve(); }
    }, {rootMargin: '1200px 0px'});
    for (const id of chartIds) observer.observe(document.getElementById(id));
  });
}

whenChartsNear().then(() => Promise.all([
  Promise.resolve({"status": "final", "sample_size": 10, "unit": "BenGER raw points /100, not accuracy percent", "solver": "gpt-5.6-terra", "effort": "high", "judge": "gpt-6-astra high", "means": {"baseline": 73.0, "c1": 72.7, "c2": 74.5, "c3": 76.0, "selected": 74.6, "control3": 78.4, "sol61": 89.9}, "cases": [{"number": 1, "task": "case-1", "case_id": "benger-36da0ce5ee6ba6acfa5382afeac424906528b6e78c47427f5452cbc0d698a68b", "area": "Zivilrecht", "baseline": 63.0, "control3": 68.0, "c1": 54.0, "c2": 74.0, "c3": 72.0, "selected_checkpoint": "c2", "selected": 74.0, "harness_delta": 11.0, "control_delta": 5.0, "title": "Ernährungs-App", "sol61": 90.0, "observation": ""}, {"number": 2, "task": "case-2", "case_id": "benger-6f59c37d62355584890a49e0cd783b2115a1b097e104001519bf40b72efb5c47", "area": "Öffentliches Recht", "baseline": 83.0, "control3": 86.0, "c1": 75.0, "c2": 84.0, "c3": 86.0, "selected_checkpoint": "c3", "selected": 86.0, "harness_delta": 3.0, "control_delta": 3.0, "title": "Baugenehmigung", "sol61": 93.0, "observation": ""}, {"number": 3, "task": "case-3", "case_id": "benger-bc878cd292e5e4cba1dfae5b9864ad64575c6ce4151a76551ba4ec7657688d29", "area": "Strafrecht", "baseline": 62.0, "control3": 77.0, "c1": 69.0, "c2": 68.0, "c3": 66.0, "selected_checkpoint": "c1", "selected": 69.0, "harness_delta": 7.0, "control_delta": 15.0, "title": "Bildaufnahme und Polizeianruf", "sol61": 95.0, "observation": ""}, {"number": 4, "task": "case-4", "case_id": "benger-4daeb83f54355affa9e903e108808fe9f30a7281c1bec48750cb8d3dc5906b93", "area": "Zivilrecht", "baseline": 76.0, "control3": 87.0, "c1": 79.0, "c2": 82.0, "c3": 79.0, "selected_checkpoint": "c2", "selected": 82.0, "harness_delta": 6.0, "control_delta": 11.0, "title": "Vollmacht", "sol61": 83.0, "observation": ""}, {"number": 5, "task": "case-5", "case_id": "benger-a1d45fcf9a3ee60037fe2302769c0015fa8cb94acb79a8cb28bd382b4e6c27d6", "area": "Zivilrecht", "baseline": 88.0, "control3": 92.0, "c1": 88.0, "c2": 86.0, "c3": 85.0, "selected_checkpoint": "c1", "selected": 88.0, "harness_delta": 0.0, "control_delta": 4.0, "title": "Angehörigenbürgschaft", "sol61": 96.0, "observation": ""}, {"number": 6, "task": "case-6", "case_id": "benger-ae1cb399e7c69d8afe067c79561ffb623ccdf3325bd5092971ecc5bd0211303b", "area": "Zivilrecht", "baseline": 68.0, "control3": 76.0, "c1": 73.0, "c2": 53.0, "c3": 74.0, "selected_checkpoint": "c2", "selected": 53.0, "harness_delta": -15.0, "control_delta": 8.0, "title": "Besitzschutz und Katze", "sol61": 88.0, "observation": ""}, {"number": 7, "task": "case-7", "case_id": "benger-95fa545ebc08c3d66e0d93e31781d392aa65a7875bc32738087f06fb1c3c705d", "area": "Öffentliches Recht", "baseline": 64.0, "control3": 71.0, "c1": 57.0, "c2": 63.0, "c3": 67.0, "selected_checkpoint": "c3", "selected": 67.0, "harness_delta": 3.0, "control_delta": 7.0, "title": "Stolpersteine", "sol61": 81.0, "observation": ""}, {"number": 8, "task": "case-8", "case_id": "benger-8ea03fdf33de11db73c8bee93b520ddd7ff5fa5d9f71665c5f685a0def43fa4d", "area": "Öffentliches Recht", "baseline": 83.0, "control3": 71.0, "c1": 82.0, "c2": 83.0, "c3": 86.0, "selected_checkpoint": "c1", "selected": 82.0, "harness_delta": -1.0, "control_delta": -12.0, "title": "Exmatrikulation", "sol61": 92.0, "observation": ""}, {"number": 9, "task": "case-9", "case_id": "benger-0f7f841f19809e2674f8e36edbabd5f25663a78ab8e97a860538b925e768a1e6", "area": "Strafrecht", "baseline": 76.0, "control3": 82.0, "c1": 77.0, "c2": 85.0, "c3": 78.0, "selected_checkpoint": "c3", "selected": 78.0, "harness_delta": 2.0, "control_delta": 6.0, "title": "Champagner und Ferrari", "sol61": 97.0, "observation": ""}, {"number": 10, "task": "case-10", "case_id": "benger-ce3aa7982785aa9f08f21891d604a9054a8e313eb162a6282673cdd96818d93a", "area": "Strafrecht", "baseline": 67.0, "control3": 74.0, "c1": 73.0, "c2": 67.0, "c3": 67.0, "selected_checkpoint": "c2", "selected": 67.0, "harness_delta": 0.0, "control_delta": 7.0, "title": "K.-o.-Tropfen und E-Scooter", "sol61": 84.0, "observation": ""}], "historical_k1": {"baseline": {"raw_score": 68.2, "grade_points": 9.1, "passed_count": 9, "cases": 10}, "harness2": {"raw_score": 72.6, "grade_points": 10.5, "passed_count": 9, "cases": 10}, "budget_control": {"raw_score": 74.9, "grade_points": 10.9, "passed_count": 9, "cases": 10}}, "retrospective_best_checkpoint_mean": 78.4, "costs": {"total": [147793, 1152298, 5203513], "labels": ["Direktantwort", "Drei Eigenkorrekturen", "Harness²"]}, "cost_note": "Die gemeinsame Direktantwort zählt in jedem Verfahren einmal mit. Die technische Vorprüfung zählt nicht mit.", "source_hashes": {"k3_scores": "9ae29893ef518e861525bf8f00289ad246ce3b49243600e1ac63c07cdb5506d1", "k3_usage": "225870b205897bcc9281405d163b7aae06d0d99f40e658938682abec231a1d79", "k3_freeze": "fbffc3c2e5336043339559171f4edcd380a3c584eea481eb58148deb610f519e", "sol_scores": "55f79cc9c78a8356729271afb57f08be7e1b44076b7c113dc1ac180dc5447403", "sol_usage": "43ed0dd724483d3ccc5195970dc85ec7778a8f87f297215755b1d004057526f9", "k1_scores": "bb1dd45154190ddf01fe37e07ba3ff5800dccbdba59ecfb6ad1dc72dbf6a5a04"}, "guarded_current": true, "article_title": "Wie gut verbessert KI ihre eigenen Falllösungen?", "mean_rows": [{"label": "Versuch 1\nDirektantwort", "value": 68.2}, {"label": "Versuch 1\nHarness²", "value": 72.6}, {"label": "Versuch 1\nEigenkorrektur", "value": 74.9}, {"label": "Versuch 2\nDirektantwort", "value": 75.8}, {"label": "Versuch 2\nHarness²", "value": 72.6}, {"label": "Versuch 2\nEigenkorrektur", "value": 78.4}, {"label": "Versuch 3\nDirektantwort", "value": 73.0}, {"label": "Versuch 3\nHarness²", "value": 74.6}, {"label": "Versuch 3\nEigenkorrektur", "value": 78.4}, {"label": "GPT-6.1 Sol (Reasoning-Stufe: Medium)\nDirektantwort", "value": 89.9}], "historical_k3": {"baseline": 75.8, "c1": 73.5, "c2": 72.1, "c3": 72.9, "selected": 72.6, "control3": 78.4, "sol61": 89.9}, "historical_cases": [{"number": 1, "case_id": "benger-36da0ce5ee6ba6acfa5382afeac424906528b6e78c47427f5452cbc0d698a68b", "title": "Ernährungs-App", "area": "Zivilrecht", "baseline": 78.0, "c1": 56.0, "c2": 54.0, "c3": 58.0, "selected_checkpoint": "c3", "selected": 58.0, "control3": 64.0, "sol61": 90.0, "observation": ""}, {"number": 2, "case_id": "benger-6f59c37d62355584890a49e0cd783b2115a1b097e104001519bf40b72efb5c47", "title": "Baugenehmigung", "area": "Öffentliches Recht", "baseline": 85.0, "c1": 84.0, "c2": 84.0, "c3": 87.0, "selected_checkpoint": "c1", "selected": 84.0, "control3": 83.0, "sol61": 93.0, "observation": ""}, {"number": 3, "case_id": "benger-bc878cd292e5e4cba1dfae5b9864ad64575c6ce4151a76551ba4ec7657688d29", "title": "Bildaufnahme und Polizeianruf", "area": "Strafrecht", "baseline": 68.0, "c1": 66.0, "c2": 72.0, "c3": 73.0, "selected_checkpoint": "c2", "selected": 72.0, "control3": 78.0, "sol61": 95.0, "observation": ""}, {"number": 4, "case_id": "benger-4daeb83f54355affa9e903e108808fe9f30a7281c1bec48750cb8d3dc5906b93", "title": "Vollmacht", "area": "Zivilrecht", "baseline": 64.0, "c1": 79.0, "c2": 81.0, "c3": 84.0, "selected_checkpoint": "c3", "selected": 84.0, "control3": 83.0, "sol61": 83.0, "observation": ""}, {"number": 5, "case_id": "benger-a1d45fcf9a3ee60037fe2302769c0015fa8cb94acb79a8cb28bd382b4e6c27d6", "title": "Angehörigenbürgschaft", "area": "Zivilrecht", "baseline": 87.0, "c1": 90.0, "c2": 87.0, "c3": 86.0, "selected_checkpoint": "c3", "selected": 86.0, "control3": 96.0, "sol61": 96.0, "observation": ""}, {"number": 6, "case_id": "benger-ae1cb399e7c69d8afe067c79561ffb623ccdf3325bd5092971ecc5bd0211303b", "title": "Besitzschutz und Katze", "area": "Zivilrecht", "baseline": 79.0, "c1": 73.0, "c2": 75.0, "c3": 74.0, "selected_checkpoint": "c2", "selected": 75.0, "control3": 79.0, "sol61": 88.0, "observation": ""}, {"number": 7, "case_id": "benger-95fa545ebc08c3d66e0d93e31781d392aa65a7875bc32738087f06fb1c3c705d", "title": "Stolpersteine", "area": "Öffentliches Recht", "baseline": 73.0, "c1": 54.0, "c2": 64.0, "c3": 64.0, "selected_checkpoint": "c2", "selected": 64.0, "control3": 72.0, "sol61": 81.0, "observation": ""}, {"number": 8, "case_id": "benger-8ea03fdf33de11db73c8bee93b520ddd7ff5fa5d9f71665c5f685a0def43fa4d", "title": "Exmatrikulation", "area": "Öffentliches Recht", "baseline": 85.0, "c1": 82.0, "c2": 79.0, "c3": 84.0, "selected_checkpoint": "c3", "selected": 84.0, "control3": 76.0, "sol61": 92.0, "observation": ""}, {"number": 9, "case_id": "benger-0f7f841f19809e2674f8e36edbabd5f25663a78ab8e97a860538b925e768a1e6", "title": "Champagner und Ferrari", "area": "Strafrecht", "baseline": 76.0, "c1": 81.0, "c2": 80.0, "c3": 80.0, "selected_checkpoint": "c2", "selected": 80.0, "control3": 80.0, "sol61": 97.0, "observation": ""}, {"number": 10, "case_id": "benger-ce3aa7982785aa9f08f21891d604a9054a8e313eb162a6282673cdd96818d93a", "title": "K.-o.-Tropfen und E-Scooter", "area": "Strafrecht", "baseline": 63.0, "c1": 70.0, "c2": 45.0, "c3": 39.0, "selected_checkpoint": "c3", "selected": 39.0, "control3": 73.0, "sol61": 84.0, "observation": ""}], "historical_k1_cases": [{"number": 1, "case_id": "benger-36da0ce5ee6ba6acfa5382afeac424906528b6e78c47427f5452cbc0d698a68b", "title": "Ernährungs-App", "baseline": 77.0, "selected": 65.0, "control3": 59.0}, {"number": 2, "case_id": "benger-6f59c37d62355584890a49e0cd783b2115a1b097e104001519bf40b72efb5c47", "title": "Baugenehmigung", "baseline": 78.0, "selected": 79.0, "control3": 86.0}, {"number": 3, "case_id": "benger-bc878cd292e5e4cba1dfae5b9864ad64575c6ce4151a76551ba4ec7657688d29", "title": "Bildaufnahme und Polizeianruf", "baseline": 79.0, "selected": 69.0, "control3": 73.0}, {"number": 4, "case_id": "benger-4daeb83f54355affa9e903e108808fe9f30a7281c1bec48750cb8d3dc5906b93", "title": "Vollmacht", "baseline": 73.0, "selected": 79.0, "control3": 87.0}, {"number": 5, "case_id": "benger-a1d45fcf9a3ee60037fe2302769c0015fa8cb94acb79a8cb28bd382b4e6c27d6", "title": "Angehörigenbürgschaft", "baseline": 52.0, "selected": 88.0, "control3": 89.0}, {"number": 6, "case_id": "benger-ae1cb399e7c69d8afe067c79561ffb623ccdf3325bd5092971ecc5bd0211303b", "title": "Besitzschutz und Katze", "baseline": 71.0, "selected": 77.0, "control3": 76.0}, {"number": 7, "case_id": "benger-95fa545ebc08c3d66e0d93e31781d392aa65a7875bc32738087f06fb1c3c705d", "title": "Stolpersteine", "baseline": 63.0, "selected": 70.0, "control3": 70.0}, {"number": 8, "case_id": "benger-8ea03fdf33de11db73c8bee93b520ddd7ff5fa5d9f71665c5f685a0def43fa4d", "title": "Exmatrikulation", "baseline": 83.0, "selected": 78.0, "control3": 79.0}, {"number": 9, "case_id": "benger-0f7f841f19809e2674f8e36edbabd5f25663a78ab8e97a860538b925e768a1e6", "title": "Champagner und Ferrari", "baseline": 69.0, "selected": 83.0, "control3": 83.0}, {"number": 10, "case_id": "benger-ce3aa7982785aa9f08f21891d604a9054a8e313eb162a6282673cdd96818d93a", "title": "K.-o.-Tropfen und E-Scooter", "baseline": 37.0, "selected": 38.0, "control3": 47.0}], "historical_k3_retrospective_best_checkpoint_mean": 76.6, "selection_audit": {"better_discarded_answer_cases": 4, "retrospective_best_checkpoint_mean": 78.4, "baseline_better_than_all_checkpoints_cases": 0, "selected_checkpoint_counts": {"c2": 4, "c3": 3, "c1": 3}, "notice": "The actual result is the pregrading choice. Retrospective comparisons use later Astra grades and are descriptive only."}, "benchmark_subset": "Benchathon", "public_source_cases": 15, "figure_caption": "GPT-5.6 Terra (Reasoning-Stufe: High) auf zehn öffentlichen Benchathon-Fällen.\nInnerhalb jedes Versuchs dient dieselbe erste Direktantwort als Vergleichswert beider Verfahren.\nVersuch 1 mit einer, Versuch 2 und 3 mit drei Harness²-Runden. GPT-6 Astra (Reasoning-Stufe: High) nach BenGER-Rubrik. Kein offizieller Score.", "guarded_source_hashes": {"terra-harness-k3-fixed-de-v3\\completion-audit.json": "98562b9c0b0a1db5a90d9aef1510e700ccd69387dab238cc1fc2056875b866d1", "terra-control3-fixed-de-v1\\completion-audit.json": "4dc8bdf31c5600adea75ed0e8af2959175b70cbc22992cf464f24c1b5ec3732f", "terra-harness-k3-fixed-de-v3\\scores.json": "b98a8c9f047336a2f786faa5e72acf71baf6e4b38405bda19934e037063e9d0b", "terra-control3-fixed-de-v1\\scores.json": "b97ab96bd7ac6c62af205b7497c92081840d21d1c6a066ade1dbc36bebf26e6d"}}),
  loadChartLibrary()
])).then(([payload]) => {
  data = payload;
  if (!window.echarts) throw new Error('Diagrammbibliothek ist nicht verfügbar');
  if (data.mean_rows) document.getElementById('means-chart').style.height = Math.max(450, data.mean_rows.length * 60) + 'px';
  for (const id of ['means-chart', 'rounds-chart', 'cost-chart']) charts.push(echarts.init(document.getElementById(id), null, {renderer: 'svg'}));
  recolor();
  document.getElementById('case-select').addEventListener('change', updateCase);
  const study = document.getElementById('study-select');
  if (study) study.addEventListener('change', updateCase);
  for (const button of document.querySelectorAll('button[data-case]')) button.addEventListener('click', () => {
    document.getElementById('case-select').value = button.dataset.case;
    updateCase();
  });
  const observer = new ResizeObserver(() => charts.forEach(chart => chart.resize()));
  window.addEventListener('resize', () => charts.forEach(chart => chart.resize()));
  for (const id of ['means-chart', 'rounds-chart', 'cost-chart']) observer.observe(document.getElementById(id));
  for (const node of document.querySelectorAll('.chart-controls, .case-shortcuts')) node.hidden = false;
  document.documentElement.dataset.chartsReady = 'true';
}).catch(error => {
  document.documentElement.dataset.chartsReady = 'false';
  for (const id of ['means-chart', 'rounds-chart', 'cost-chart']) {
    const node = document.getElementById(id);
    node.textContent = `${error.message}. Die Zahlen bleiben in den Tabellen lesbar.`;
    node.style.height = 'auto';
  }
});

// Footnotes: a small panel with the note text on hover or keyboard focus; a click jumps to the list and opens it.
const footnoteList = document.getElementById('fussnoten');
const footnoteTip = document.createElement('div');
footnoteTip.className = 'fn-tip';
footnoteTip.id = 'fn-tip';
footnoteTip.setAttribute('role', 'tooltip');
footnoteTip.hidden = true;
document.body.append(footnoteTip);
let footnoteTimer;

function showFootnote(link) {
  const entry = document.getElementById(link.hash.slice(1));
  if (!entry) return;
  clearTimeout(footnoteTimer);
  footnoteTip.innerHTML = entry.querySelector('.fn-text').innerHTML;
  footnoteTip.hidden = false;
  link.setAttribute('aria-describedby', 'fn-tip');
  const box = link.getBoundingClientRect();
  const width = Math.min(352, document.documentElement.clientWidth - 32);
  footnoteTip.style.width = width + 'px';
  const left = Math.max(16, Math.min(box.left + box.width / 2 - width / 2, document.documentElement.clientWidth - 16 - width));
  footnoteTip.style.left = left + scrollX + 'px';
  const below = box.bottom + 8;
  const top = below + footnoteTip.offsetHeight > innerHeight && box.top > footnoteTip.offsetHeight + 8 ? box.top - footnoteTip.offsetHeight - 8 : below;
  footnoteTip.style.top = top + scrollY + 'px';
}

function hideFootnote(delay = 150) {
  clearTimeout(footnoteTimer);
  footnoteTimer = setTimeout(() => { footnoteTip.hidden = true; }, delay);
}

for (const link of document.querySelectorAll('.fn-ref a')) {
  link.addEventListener('mouseenter', () => showFootnote(link));
  link.addEventListener('focus', () => showFootnote(link));
  link.addEventListener('mouseleave', () => hideFootnote());
  link.addEventListener('blur', () => hideFootnote());
  link.addEventListener('click', () => { if (footnoteList) footnoteList.open = true; hideFootnote(0); });
}
footnoteTip.addEventListener('mouseenter', () => clearTimeout(footnoteTimer));
footnoteTip.addEventListener('mouseleave', () => hideFootnote());
document.addEventListener('keydown', event => { if (event.key === 'Escape') hideFootnote(0); });

function openFootnoteTarget() {
  const target = location.hash && document.getElementById(decodeURIComponent(location.hash.slice(1)));
  if (target && footnoteList && footnoteList.contains(target)) {
    footnoteList.open = true;
    target.scrollIntoView({block: 'center'});
  }
}
addEventListener('hashchange', openFootnoteTarget);
openFootnoteTarget();

// Table of contents: mark the section being read while scrolling. Colour and a line only, no weight change, so nothing shifts.
const tocLinks = [...document.querySelectorAll('.article-toc a[href^="#"]')];
const tocTargets = tocLinks.map(link => document.getElementById(decodeURIComponent(link.hash.slice(1)))).filter(Boolean);
let tocScheduled = false;
function updateTocPosition() {
  tocScheduled = false;
  // At the end of the page the last heading may never reach the top; then the lowest visible heading counts.
  const atEnd = innerHeight + scrollY >= document.documentElement.scrollHeight - 4;
  const current = (atEnd && [...tocTargets].reverse().find(target => target.getBoundingClientRect().top < innerHeight * 0.75))
    || [...tocTargets].reverse().find(target => target.getBoundingClientRect().top <= 140) || tocTargets[0];
  const parentItem = current && tocLinks.find(link => link.hash === '#' + current.id)?.closest('ol')?.closest('li');
  for (const link of tocLinks) {
    const active = !!current && link.hash === '#' + current.id;
    link.classList.toggle('is-active', active);
    link.classList.toggle('is-section', !active && !!parentItem && link.parentElement === parentItem);
    if (active) link.setAttribute('aria-current', 'location'); else link.removeAttribute('aria-current');
  }
}
addEventListener('scroll', () => { if (!tocScheduled) { tocScheduled = true; requestAnimationFrame(updateTocPosition); } }, {passive: true});
updateTocPosition();
// Charts that load during a jump can still move the target; after the scroll ends, bring the heading back to the top once.
for (const link of tocLinks) link.addEventListener('click', () => {
  const target = document.getElementById(decodeURIComponent(link.hash.slice(1)));
  if (!target) return;
  const realign = () => {
    if (Math.abs(target.getBoundingClientRect().top - parseFloat(getComputedStyle(target).scrollMarginTop)) > 8) target.scrollIntoView();
    updateTocPosition();
  };
  if ('onscrollend' in window) addEventListener('scrollend', realign, {once: true}); else setTimeout(realign, 1000);
});

// The case chart always opens on the current comparison, even if the browser restores an earlier form state.
for (const [id, value] of [['study-select', 'current'], ['case-select', '1']]) {
  const select = document.getElementById(id);
  if (select) select.value = value;
}

// Change the contents layout only when crossing the same boundary as the CSS.
const sideContents = matchMedia('(min-width: 62rem)');
const contentsDetails = document.querySelector('.article-toc details');
if (contentsDetails) {
  const syncContentsLayout = () => { contentsDetails.open = sideContents.matches; };
  syncContentsLayout();
  sideContents.addEventListener('change', syncContentsLayout);
}

let printDetails = [];
addEventListener('beforeprint', () => {
  printDetails = [...document.querySelectorAll('.prose details')].map(node => [node, node.open]);
  for (const [node] of printDetails) node.open = true;
});
addEventListener('afterprint', () => {
  for (const [node, open] of printDetails) node.open = open;
  printDetails = [];
});
