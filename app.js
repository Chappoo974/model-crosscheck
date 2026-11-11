const API = 'https://gen.pollinations.ai';
const $ = (selector) => document.querySelector(selector);
const question = $('#question');
const modelGrid = $('#models');
const runButton = $('#run-button');
const notice = $('#notice');
const dialog = $('#settings-dialog');
const selected = new Set();
let models = [];
let apiKey = null;
let lastAnswers = [];
let identitiesRevealed = false;

const exampleQuestions = [
  'What is a common belief about success that you think is wrong?',
  'How might a city make public spaces feel safer without adding more policing?',
  'What should a beginner learn first to understand how the internet works?'
];
$('#example-button').addEventListener('click', () => {
  const current = question.value;
  const options = exampleQuestions.filter((item) => item !== current);
  question.value = options[Math.floor(Math.random() * options.length)];
  question.dispatchEvent(new Event('input'));
});
question.addEventListener('input', () => {
  $('#char-count').textContent = `${question.value.length} / 1200`;
  updateRunState();
});
$('#settings-open').addEventListener('click', () => dialog.showModal());
$('#settings-footer').addEventListener('click', () => dialog.showModal());
$('#clear-models').addEventListener('click', () => { selected.clear(); renderModels(); updateRunState(); });
$('#select-panel').addEventListener('click', () => {
  selected.clear();
  const byLab = new Map();
  for (const model of models.filter(isTextModel).filter(isUsable)) {
    const lab = publisher(model);
    if (!byLab.has(lab)) byLab.set(lab, model);
  }
  [...byLab.values()].slice(0, 6).forEach((model) => selected.add(model.name));
  renderModels(); updateRunState();
});
$('#run-button').addEventListener('click', runComparison);
$('#use-key').addEventListener('click', () => {
  const value = $('#manual-key').value.trim();
  if (!value) return;
  if (value.startsWith('pk_')) {
    notice.textContent = 'That is the app’s publishable key, not an API key. Use the Polli Connect button above, or enter your personal sk_ key here.';
    return;
  }
  if (!value.startsWith('sk_')) {
    notice.textContent = 'Use Polli Connect above, or enter a personal Pollinations key beginning with sk_.';
    return;
  }
  apiKey = value;
  notice.textContent = '';
  setConnected(true);
  dialog.close();
  $('#manual-key').value = '';
});

function setConnected(connected) {
  $('#connection-label').textContent = connected ? 'Connected for this tab' : 'Not connected';
  $('.live-dot').classList.toggle('on', connected);
  updateRunState();
}
const connectWidget = $('#polli-connect');
connectWidget?.addEventListener('change', () => {
  apiKey = connectWidget.apiKey || null;
  setConnected(Boolean(apiKey));
});
function publisher(model) { return model.publisher || model.provider || model.name.split('/')[0] || 'Other'; }
function isTextModel(model) { return (model.input_modalities || []).includes('text') && (model.output_modalities || []).includes('text'); }
function isUsable(model) { return (model.supported_endpoints || []).includes('/v1/chat/completions') && !model.is_specialized; }
function shortName(model) { return model.title || model.name.split('/').at(-1); }
function escapeHtml(value) { return String(value).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function inlineMarkdown(value) {
  const code = [];
  let result = escapeHtml(value).replace(/`([^`]+)`/g, (_, text) => {
    const marker = `\u0000${code.length}\u0000`;
    code.push(`<code>${text}</code>`);
    return marker;
  });
  result = result
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')
    .replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '<em>$1</em>')
    .replace(/(^|\s)_([^_\n]+)_(?=\s|[.,!?;:]|$)/g, '$1<em>$2</em>');
  return result.replace(/\u0000(\d+)\u0000/g, (_, index) => code[Number(index)]);
}
function markdownToHtml(markdown) {
  const output = [];
  let paragraph = [];
  let list = '';
  let inCode = false;
  let codeLines = [];
  const closeList = () => { if (list) { output.push(`</${list}>`); list = ''; } };
  const flushParagraph = () => {
    if (paragraph.length) output.push(`<p>${paragraph.map(inlineMarkdown).join('<br>')}</p>`);
    paragraph = [];
  };
  for (const line of String(markdown).split(/\r?\n/)) {
    if (/^\s*```/.test(line)) {
      if (inCode) {
        output.push(`<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`);
        codeLines = [];
        inCode = false;
      } else { flushParagraph(); closeList(); inCode = true; }
      continue;
    }
    if (inCode) { codeLines.push(line); continue; }
    const heading = line.match(/^\s{0,3}(#{1,6})\s+(.+)$/);
    const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/);
    const unordered = line.match(/^\s*[-*+]\s+(.+)$/);
    if (!line.trim() || heading || ordered || unordered || /^\s*>/.test(line)) {
      flushParagraph();
      if (!ordered && !unordered) closeList();
    }
    if (!line.trim()) continue;
    if (heading) { const level = heading[1].length; output.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`); }
    else if (ordered || unordered) {
      const kind = ordered ? 'ol' : 'ul';
      if (list !== kind) { closeList(); output.push(`<${kind}>`); list = kind; }
      output.push(`<li>${inlineMarkdown((ordered || unordered)[1])}</li>`);
    } else if (/^\s*>/.test(line)) output.push(`<blockquote>${inlineMarkdown(line.replace(/^\s*>\s?/, ''))}</blockquote>`);
    else paragraph.push(line);
  }
  flushParagraph();
  closeList();
  if (inCode) output.push(`<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`);
  return output.join('');
}

async function loadModels() {
  try {
    const response = await fetch(`${API}/models`);
    if (!response.ok) throw new Error(`Model list returned ${response.status}`);
    const payload = await response.json();
    models = Array.isArray(payload) ? payload : (payload.data || payload.models || []);
    models = models.filter(isTextModel).filter(isUsable).filter((model) => !model.paid_only);
    models.sort((a,b) => publisher(a).localeCompare(publisher(b)) || shortName(a).localeCompare(shortName(b)));
    renderModels();
    $('#model-count').textContent = `${models.length} text models available`;
  } catch (error) {
    modelGrid.innerHTML = `<div class="loading">Could not load the model list. ${escapeHtml(error.message)} <button class="text-button" id="retry-models">Try again</button></div>`;
    $('#retry-models').addEventListener('click', loadModels);
    $('#model-count').textContent = 'Offline';
  }
}
function renderModels() {
  if (!models.length) return;
  modelGrid.innerHTML = '';
  for (const model of models) {
    const checked = selected.has(model.name);
    const label = document.createElement('label');
    label.className = `model-option${checked ? ' selected' : ''}`;
    label.innerHTML = `<input type="checkbox" ${checked ? 'checked' : ''} aria-label="Select ${escapeHtml(shortName(model))}"/><span class="check"></span><span class="model-name" title="${escapeHtml(model.name)}">${escapeHtml(shortName(model))}</span><span class="model-meta"><span class="lab">${escapeHtml(publisher(model))}</span>${model.community ? '<span>· community</span>' : ''}</span>`;
    label.querySelector('input').addEventListener('change', (event) => {
      event.target.checked ? selected.add(model.name) : selected.delete(model.name);
      label.classList.toggle('selected', event.target.checked);
      updateRunState();
    });
    modelGrid.append(label);
  }
}
function updateRunState() {
  runButton.disabled = !apiKey || !question.value.trim() || selected.size < 2 || selected.size > 8;
  if (!apiKey) notice.textContent = 'Connect Pollinations to run a comparison.';
  else if (selected.size > 8) notice.textContent = 'Choose up to 8 models per comparison.';
  else if (selected.size === 1) notice.textContent = 'Choose at least 2 models.';
  else notice.textContent = '';
}
function costEstimate(model) {
  const perMillion = Number(model.pricing?.completionTextTokens || 0);
  return perMillion ? ` · ~${(perMillion * 1200).toFixed(4)} Pollen / 1.2k output tokens` : '';
}
async function askModel(model, prompt) {
  const started = performance.now();
  const supports = model.supported_parameters || [];
  const body = { model: model.name, messages: [{ role: 'user', content: prompt }], max_tokens: 1200, temperature: 0.7 };
  if (supports.includes('reasoning_effort')) body.reasoning_effort = 'low';
  const response = await fetch(`${API}/v1/chat/completions`, {
    method: 'POST', headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data.error?.message || data.message || `Request failed (${response.status})`;
    if (/publishable keys \(pk_/i.test(message)) throw new Error('A publishable App Key was used for the request. Connect through Polli Connect, or enter a personal sk_ API key.');
    throw new Error(message);
  }
  const content = data.choices?.[0]?.message?.content;
  const answer = Array.isArray(content) ? content.map((part) => part.text || '').join('') : content;
  if (!answer) throw new Error('The model returned an empty answer.');
  return { model, answer, elapsed: Math.round(performance.now() - started), usage: data.usage };
}
async function runComparison() {
  notice.textContent = '';
  runButton.disabled = true;
  runButton.querySelector('span:first-child').textContent = 'Asking the panel…';
  const picked = models.filter((model) => selected.has(model.name));
  $('#results-section').classList.remove('hidden');
  $('#answer-grid').innerHTML = picked.map((model, i) => `<article class="answer-card"><header><div><h3>Voice ${i + 1}</h3><div class="lab">Waiting for ${escapeHtml(publisher(model))}…</div></div><span class="latency">IN FLIGHT</span></header><div class="answer-body">Thinking…</div></article>`).join('');
  $('#results-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
  lastAnswers = await Promise.all(picked.map(async (model) => {
    try { return await askModel(model, question.value.trim()); }
    catch (error) { return { model, error: error.message }; }
  }));
  identitiesRevealed = false;
  renderAnswers();
  const successes = lastAnswers.filter((item) => item.answer).length;
  $('#run-summary').textContent = `${successes} of ${picked.length} responses · independently generated`;
  $('#insight').innerHTML = `<div class="insight-title">Blind read</div><p>Compare the answers before attaching model names. Which response seems most useful? Notice where several voices point in a similar direction, and where they make different assumptions.</p><div class="blind-actions"><button id="reveal-identities" class="text-button">Reveal model identities ↗</button></div>`;
  $('#insight').classList.remove('hidden');
  $('#reveal-identities').addEventListener('click', () => { identitiesRevealed = true; renderAnswers(); $('#reveal-identities')?.remove(); });
  runButton.querySelector('span:first-child').textContent = 'Run comparison';
  updateRunState();
}
function renderAnswers() {
  const grid = $('#answer-grid');
  grid.innerHTML = '';
  lastAnswers.forEach((result, index) => {
    const card = document.createElement('article');
    card.className = `answer-card${result.error ? ' error' : ''}`;
    const identity = identitiesRevealed ? `${escapeHtml(shortName(result.model))}<div class="lab">${escapeHtml(publisher(result.model))} · ${escapeHtml(result.model.name)}</div>` : `Voice ${index + 1}<div class="lab">Model hidden for blind comparison</div>`;
    const body = result.error ? `Could not get an answer: ${escapeHtml(result.error)}` : markdownToHtml(result.answer);
    card.innerHTML = `<header><div><h3>${identity}</h3></div><span class="latency">${result.error ? 'FAILED' : `${result.elapsed} ms`}</span></header><div class="answer-body">${body}</div>${result.answer ? `<div class="vote-row"><span>Most useful?</span><button class="vote-button" aria-label="Vote for Voice ${index + 1}">♡</button></div>` : ''}`;
    const vote = card.querySelector('.vote-button');
    vote?.addEventListener('click', () => {
      document.querySelectorAll('.vote-button').forEach((button) => { button.textContent = '♡'; button.classList.remove('voted'); });
      vote.textContent = '♥'; vote.classList.add('voted');
      $('#run-summary').textContent = `Your pick: Voice ${index + 1} · ${lastAnswers.filter((item) => item.answer).length} responses`;
    });
    grid.append(card);
  });
}

loadModels();
setConnected(false);
