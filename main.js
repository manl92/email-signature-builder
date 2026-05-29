import { resolveAssetBase } from './config.js';

const FIELD_IDS = ['name', 'jobTitleLocal', 'jobTitleEng', 'phone', 'email'];

const els = {
  template: document.getElementById('template'),
  preview: document.getElementById('preview'),
  copyBtn: document.getElementById('copyBtn'),
  copyStatus: document.getElementById('copyStatus'),
  manual: document.getElementById('manualFallback'),
  manualStage: document.getElementById('manualStage'),
};
FIELD_IDS.forEach((id) => (els[id] = document.getElementById(id)));

// Raw template HTML, keyed by template id, fetched lazily.
const templateCache = new Map();
let currentTemplateText = '';
let lastRenderedHtml = '';

// --- helpers -------------------------------------------------------------

function escapeHtml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function readForm() {
  const data = {};
  FIELD_IDS.forEach((id) => (data[id] = els[id].value.trim()));
  return data;
}

// Render a template string against form data.
// 1) Build a DOM so we can drop rows for blank fields cleanly.
// 2) Replace tokens with escaped values (assetBase/titleSep are computed).
function render(templateText, data) {
  const host = document.createElement('div');
  host.innerHTML = templateText;

  // Collapse single-token rows.
  host.querySelectorAll('[data-show-if]').forEach((el) => {
    const token = el.getAttribute('data-show-if');
    if (!data[token]) el.remove();
  });
  // Collapse rows that depend on several tokens (drop only if ALL are blank).
  host.querySelectorAll('[data-show-if-any]').forEach((el) => {
    const tokens = el.getAttribute('data-show-if-any').split(',').map((t) => t.trim());
    if (tokens.every((t) => !data[t])) el.remove();
  });

  // Strip our authoring-only attributes from the rows we kept so the copied
  // signature carries no app-specific markup into recipients' inboxes.
  host.querySelectorAll('[data-show-if], [data-show-if-any]').forEach((el) => {
    el.removeAttribute('data-show-if');
    el.removeAttribute('data-show-if-any');
  });

  let html = host.innerHTML;

  // Remove authoring comments, but preserve Outlook/MSO conditional comments.
  html = html.replace(/<!--([\s\S]*?)-->/g, (m, inner) =>
    /\[if|endif/i.test(inner) ? m : ''
  );

  const replacements = {
    assetBase: resolveAssetBase(),
    titleSep: data.jobTitleLocal && data.jobTitleEng ? ' / ' : '',
  };
  FIELD_IDS.forEach((id) => (replacements[id] = escapeHtml(data[id])));

  html = html.replace(/\{\{(\w+)\}\}/g, (match, token) =>
    Object.prototype.hasOwnProperty.call(replacements, token) ? replacements[token] : ''
  );

  return html.trim();
}

function updatePreview() {
  if (!currentTemplateText) return;
  lastRenderedHtml = render(currentTemplateText, readForm());
  els.preview.innerHTML = lastRenderedHtml;
}

// --- template loading ----------------------------------------------------

async function loadRegistry() {
  const res = await fetch('./templates/index.json', { cache: 'no-cache' });
  if (!res.ok) throw new Error(`registry ${res.status}`);
  return res.json();
}

async function loadTemplate(entry) {
  if (templateCache.has(entry.id)) return templateCache.get(entry.id);
  const res = await fetch(`./templates/${entry.file}`, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`template ${res.status}`);
  const text = await res.text();
  templateCache.set(entry.id, text);
  return text;
}

async function selectTemplate(entry) {
  try {
    currentTemplateText = await loadTemplate(entry);
    updatePreview();
  } catch (err) {
    els.preview.innerHTML = `<p class="preview-error">Could not load template "${escapeHtml(entry.file)}". If you opened this file directly, serve it over a local web server instead (see README).</p>`;
  }
}

// --- copy ----------------------------------------------------------------

function showCopied(message = 'Copied!') {
  els.copyStatus.textContent = message;
  clearTimeout(showCopied._t);
  showCopied._t = setTimeout(() => (els.copyStatus.textContent = ''), 2500);
}

// Plain-text rendition for the text/plain clipboard flavor.
function plainTextSignature() {
  const text = els.preview.innerText || '';
  return text.replace(/\n{3,}/g, '\n\n').trim();
}

// Fallback copy via a temporary contenteditable + execCommand.
function execCommandCopyHtml(html) {
  const holder = document.createElement('div');
  holder.setAttribute('contenteditable', 'true');
  holder.style.position = 'fixed';
  holder.style.left = '-9999px';
  holder.style.top = '0';
  holder.innerHTML = html;
  document.body.appendChild(holder);

  const range = document.createRange();
  range.selectNodeContents(holder);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);

  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch (_) {
    ok = false;
  }
  sel.removeAllRanges();
  holder.remove();
  return ok;
}

function showManualFallback() {
  els.manualStage.innerHTML = lastRenderedHtml;
  els.manual.hidden = false;
  els.copyStatus.textContent = '';
}

async function copySignature() {
  if (!lastRenderedHtml) return;
  const html = lastRenderedHtml;
  const text = plainTextSignature();

  if (navigator.clipboard && typeof window.ClipboardItem !== 'undefined') {
    try {
      const item = new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([text], { type: 'text/plain' }),
      });
      await navigator.clipboard.write([item]);
      showCopied();
      return;
    } catch (_) {
      // fall through to execCommand
    }
  }

  if (execCommandCopyHtml(html)) {
    showCopied();
    return;
  }

  showManualFallback();
}

// --- init ----------------------------------------------------------------

async function init() {
  FIELD_IDS.forEach((id) => els[id].addEventListener('input', updatePreview));
  els.copyBtn.addEventListener('click', copySignature);

  let registry;
  try {
    registry = await loadRegistry();
  } catch (err) {
    els.preview.innerHTML = `<p class="preview-error">Could not load the template list. If you opened this file directly, serve it over a local web server instead (see README).</p>`;
    return;
  }

  registry.forEach((entry) => {
    const opt = document.createElement('option');
    opt.value = entry.id;
    opt.textContent = entry.label;
    els.template.appendChild(opt);
  });

  els.template.addEventListener('change', () => {
    const entry = registry.find((e) => e.id === els.template.value);
    if (entry) selectTemplate(entry);
  });

  if (registry.length) await selectTemplate(registry[0]);
}

init();
