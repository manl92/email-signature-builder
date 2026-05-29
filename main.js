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

// --- helpers -------------------------------------------------------------

function escapeHtml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Read form values. When previewMode=true, fall back to the input's
// placeholder text so the preview always shows a full, complete signature.
function readForm(previewMode = false) {
  const data = {};
  FIELD_IDS.forEach((id) => {
    const el = els[id];
    const val = el.value.trim();
    data[id] = previewMode && !val ? el.placeholder : val;
  });
  return data;
}

// Render a template string against a data object.
// 1) Build a DOM to cleanly remove rows for blank fields.
// 2) Strip authoring attributes/comments that shouldn't travel into emails.
// 3) Replace {{tokens}} with escaped values.
function render(templateText, data) {
  const host = document.createElement('div');
  host.innerHTML = templateText;

  // Remove rows whose single token is blank.
  host.querySelectorAll('[data-show-if]').forEach((el) => {
    if (!data[el.getAttribute('data-show-if')]) el.remove();
  });
  // Remove rows where ALL listed tokens are blank.
  host.querySelectorAll('[data-show-if-any]').forEach((el) => {
    const tokens = el.getAttribute('data-show-if-any').split(',').map((t) => t.trim());
    if (tokens.every((t) => !data[t])) el.remove();
  });

  // Strip helper attributes from kept elements — they must not appear in the
  // pasted signature markup.
  host.querySelectorAll('[data-show-if], [data-show-if-any]').forEach((el) => {
    el.removeAttribute('data-show-if');
    el.removeAttribute('data-show-if-any');
  });

  let html = host.innerHTML;

  // Remove authoring comments but preserve Outlook MSO conditionals.
  html = html.replace(/<!--([\s\S]*?)-->/g, (m, inner) =>
    /\[if|endif/i.test(inner) ? m : ''
  );

  const replacements = {
    assetBase: resolveAssetBase(),
    titleSep: data.jobTitleLocal && data.jobTitleEng ? ' / ' : '',
  };
  FIELD_IDS.forEach((id) => (replacements[id] = escapeHtml(data[id])));

  return html
    .replace(/\{\{(\w+)\}\}/g, (match, token) =>
      Object.prototype.hasOwnProperty.call(replacements, token) ? replacements[token] : ''
    )
    .trim();
}

function updatePreview() {
  if (!currentTemplateText) return;
  // Pass previewMode=true so empty fields fall back to their placeholder text.
  const html = render(currentTemplateText, readForm(true));
  els.preview.innerHTML = html;
}

// --- validation ----------------------------------------------------------

function clearErrors() {
  FIELD_IDS.forEach((id) => {
    const input = els[id];
    const errEl = document.getElementById(`${id}-err`);
    input.classList.remove('field__input--error');
    if (errEl) errEl.textContent = '';
  });
}

// Returns true if all required fields are filled. Otherwise marks errors.
function validateForm() {
  clearErrors();
  let valid = true;
  FIELD_IDS.forEach((id) => {
    if (!els[id].value.trim()) {
      els[id].classList.add('field__input--error');
      const errEl = document.getElementById(`${id}-err`);
      if (errEl) errEl.textContent = 'Required';
      valid = false;
    }
  });
  return valid;
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

// Derive a plain-text fallback from what's currently visible in the preview.
function plainTextSignature() {
  return (els.preview.innerText || '').replace(/\n{3,}/g, '\n\n').trim();
}

// Fallback copy via a temporary contenteditable + execCommand.
function execCommandCopyHtml(html) {
  const holder = document.createElement('div');
  holder.setAttribute('contenteditable', 'true');
  Object.assign(holder.style, { position: 'fixed', left: '-9999px', top: '0' });
  holder.innerHTML = html;
  document.body.appendChild(holder);

  const range = document.createRange();
  range.selectNodeContents(holder);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);

  let ok = false;
  try { ok = document.execCommand('copy'); } catch (_) {}
  sel.removeAllRanges();
  holder.remove();
  return ok;
}

function showManualFallback(html) {
  els.manualStage.innerHTML = html;
  els.manual.hidden = false;
  els.copyStatus.textContent = '';
}

async function copySignature() {
  // Validate first — all fields required.
  if (!validateForm()) {
    // Scroll the form into view so the user sees the errors.
    document.querySelector('.form').scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }
  clearErrors();

  if (!currentTemplateText) return;

  // Re-render with real values only (no placeholder fallback) for the actual copy.
  const html = render(currentTemplateText, readForm(false));
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

  showManualFallback(html);
}

// --- init ----------------------------------------------------------------

async function init() {
  FIELD_IDS.forEach((id) => {
    els[id].addEventListener('input', () => {
      updatePreview();
      // Clear the error for this field as soon as the user starts typing.
      els[id].classList.remove('field__input--error');
      const errEl = document.getElementById(`${id}-err`);
      if (errEl) errEl.textContent = '';
    });
  });

  els.copyBtn.addEventListener('click', copySignature);

  let registry;
  try {
    registry = await loadRegistry();
  } catch (_) {
    els.preview.innerHTML = `<p class="preview-error">Could not load the template list. If you opened this file directly, serve it over a local web server (see README).</p>`;
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
