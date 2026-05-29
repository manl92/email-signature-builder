import { resolveAssetBase } from './config.js';

const FIELD_IDS = ['name', 'jobTitleLocal', 'jobTitleEng', 'phone', 'email'];

const els = {
  thumbRow:    document.getElementById('thumbRow'),
  preview:     document.getElementById('preview'),
  skeleton:    document.getElementById('skeleton'),
  copyBtn:     document.getElementById('copyBtn'),
  actionsRow:  document.getElementById('actionsRow'),
  editHint:    document.getElementById('editHint'),
  manual:      document.getElementById('manualFallback'),
  manualStage: document.getElementById('manualStage'),
};

// ─── State ─────────────────────────────────────────────────────────────────

let currentTemplateText = '';
const templateCache = new Map();

// Typed values — persists when switching templates
const fieldValues = {
  name: '', jobTitleLocal: '', jobTitleEng: '', phone: '', email: '',
};

// Placeholder text — updated per template
let fieldPlaceholders = {
  name:          'Name Surname',
  jobTitleLocal: 'Job title in local language',
  jobTitleEng:   'Job title in English language',
  phone:         '+371 20 000 000',
  email:         'name@example.com',
};

let hintFaded = false;

// ─── Helpers ───────────────────────────────────────────────────────────────

function escapeHtml(v) {
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── Editable render ───────────────────────────────────────────────────────
// Attribute tokens (src, href) are resolved via DOM walk first so they never
// get wrapped in <span> tags. Text-content tokens become contenteditable .fz spans.

function renderEditable() {
  if (!currentTemplateText) return;

  const host = document.createElement('div');
  host.innerHTML = currentTemplateText;

  const assetBase = resolveAssetBase();

  // Pass 1 — fix attribute tokens via DOM (safe, no regex-on-HTML)
  host.querySelectorAll('*').forEach((el) => {
    Array.from(el.attributes).forEach((attr) => {
      if (!attr.value.includes('{{')) return;
      let val = attr.value.replace(/\{\{assetBase\}\}/g, assetBase);
      FIELD_IDS.forEach((id) => {
        val = val.replace(
          new RegExp(`\\{\\{${id}\\}\\}`, 'g'),
          fieldValues[id] || fieldPlaceholders[id] || ''
        );
      });
      val = val.replace(/\{\{\w+\}\}/g, ''); // strip any remaining tokens
      attr.value = val;
    });
  });

  let html = host.innerHTML;

  // Strip authoring comments (keep MSO conditionals)
  html = html.replace(/<!--([\s\S]*?)-->/g, (m, inner) =>
    /\[if|endif/i.test(inner) ? m : ''
  );

  // Pass 2 — separator tokens → live updatable spans
  html = html
    .replace(/\{\{slashSuffix\}\}/g, `<span class="fz-sep" data-sep="slash"></span>`)
    .replace(/\{\{titleSep\}\}/g,    `<span class="fz-sep" data-sep="title"></span>`);

  // Pass 3 — field tokens in text content → contenteditable .fz spans
  FIELD_IDS.forEach((id) => {
    const re    = new RegExp(`\\{\\{${id}\\}\\}`, 'g');
    const value = escapeHtml(fieldValues[id] || '');
    const ph    = escapeHtml(fieldPlaceholders[id] || '');
    html = html.replace(re,
      `<span class="fz" data-field="${id}" contenteditable="true" spellcheck="false" data-placeholder="${ph}">${value}</span>`
    );
  });

  els.preview.innerHTML = html;
  if (els.skeleton) els.skeleton.hidden = true;

  updateSeparators();
  attachFieldListeners();
}

// ─── Separator logic ───────────────────────────────────────────────────────

function updateSeparators() {
  const hasBoth = !!(fieldValues.jobTitleLocal && fieldValues.jobTitleEng);
  els.preview.querySelectorAll('[data-sep="slash"]').forEach((s) => {
    s.textContent = hasBoth ? ' /' : '';
  });
  els.preview.querySelectorAll('[data-sep="title"]').forEach((s) => {
    s.textContent = hasBoth ? ' / ' : '';
  });
}

// ─── Field listeners + edit-icon injection ─────────────────────────────────
// Each .fz span gets wrapped in .fz-wrap alongside a pencil icon.
// .fz-wrap:hover / :focus-within in CSS handles icon visibility reliably
// because hovering anywhere over the parent keeps :hover true.

const PENCIL_SVG = `<svg width="11" height="11" viewBox="0 0 11 11" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <path d="M7.5 1L10 3.5L3.5 10H1V7.5L7.5 1Z" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M6 2.5L8.5 5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
</svg>`;

function attachFieldListeners() {
  els.preview.querySelectorAll('.fz').forEach((span) => {
    const field = span.dataset.field;

    // Wrap span + inject icon as a sibling inside the wrapper.
    // Hover on .fz-wrap (parent) stays true whether mouse is on text or icon.
    const wrap = document.createElement('span');
    wrap.className = 'fz-wrap';
    span.parentNode.insertBefore(wrap, span);
    wrap.appendChild(span);

    const icon = document.createElement('span');
    icon.className = 'fz-icon';
    icon.innerHTML = PENCIL_SVG;
    icon.addEventListener('click', () => span.focus()); // clicking icon = focus field
    wrap.appendChild(icon);

    // ── Event handlers ──────────────────────────────────────────────────

    span.addEventListener('focus', () => {
      fadeHint();
      span.classList.remove('fz--error');
    });

    span.addEventListener('input', () => {
      fieldValues[field] = span.innerText.replace(/[\r\n]/g, '').trim();
      if (field === 'jobTitleLocal' || field === 'jobTitleEng') {
        updateSeparators();
      }
    });

    // No newlines — Enter blurs, Tab moves to next/prev field
    span.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        navigateField(span, +1);
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        navigateField(span, e.shiftKey ? -1 : +1);
      }
    });

    // Strip HTML on paste — plain text only
    span.addEventListener('paste', (e) => {
      e.preventDefault();
      const text = (e.clipboardData.getData('text/plain') || '')
        .replace(/[\r\n]/g, ' ')
        .trim();
      document.execCommand('insertText', false, text);
    });
  });
}

function navigateField(currentSpan, direction) {
  const spans = [...els.preview.querySelectorAll('.fz')];
  const next  = spans[spans.indexOf(currentSpan) + direction];
  if (next) next.focus();
  else currentSpan.blur();
}

function fadeHint() {
  if (hintFaded || !els.editHint) return;
  hintFaded = true;
  els.editHint.classList.add('edit-hint--faded');
}

// ─── Copy-time render ─────────────────────────────────────────────────────
// Fresh render from original template text — handles data-show-if, slashSuffix.
// No contenteditable or helper classes in the output.

function render(templateText, data) {
  const host = document.createElement('div');
  host.innerHTML = templateText;

  host.querySelectorAll('[data-show-if]').forEach((el) => {
    if (!data[el.getAttribute('data-show-if')]) el.remove();
  });
  host.querySelectorAll('[data-show-if-any]').forEach((el) => {
    const tokens = el.getAttribute('data-show-if-any').split(',').map((t) => t.trim());
    if (tokens.every((t) => !data[t])) el.remove();
  });
  host.querySelectorAll('[data-show-if], [data-show-if-any]').forEach((el) => {
    el.removeAttribute('data-show-if');
    el.removeAttribute('data-show-if-any');
  });

  let html = host.innerHTML;
  html = html.replace(/<!--([\s\S]*?)-->/g, (m, inner) =>
    /\[if|endif/i.test(inner) ? m : ''
  );

  const replacements = {
    assetBase:   resolveAssetBase(),
    titleSep:    data.jobTitleLocal && data.jobTitleEng ? ' / ' : '',
    slashSuffix: data.jobTitleLocal && data.jobTitleEng ? ' /' : '',
  };
  FIELD_IDS.forEach((id) => (replacements[id] = escapeHtml(data[id] || '')));

  return html
    .replace(/\{\{(\w+)\}\}/g, (m, t) =>
      Object.prototype.hasOwnProperty.call(replacements, t) ? replacements[t] : ''
    )
    .trim();
}

// ─── Validation ────────────────────────────────────────────────────────────

function readEditableValues() {
  const data = {};
  FIELD_IDS.forEach((id) => {
    const span = els.preview.querySelector(`[data-field="${id}"]`);
    data[id] = span ? span.innerText.replace(/[\r\n]/g, '').trim() : '';
  });
  return data;
}

function validateAndHighlight(data) {
  let valid = true;
  FIELD_IDS.forEach((id) => {
    if (!data[id]) {
      const span = els.preview.querySelector(`[data-field="${id}"]`);
      if (span) {
        span.classList.remove('fz--error');
        requestAnimationFrame(() => span.classList.add('fz--error'));
      }
      valid = false;
    }
  });
  return valid;
}

// ─── Template loading ──────────────────────────────────────────────────────

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

async function selectTemplate(entry, thumbEl) {
  document.querySelectorAll('.thumb').forEach((t) => t.classList.remove('thumb--active'));
  if (thumbEl) thumbEl.classList.add('thumb--active');

  if (entry.placeholders) Object.assign(fieldPlaceholders, entry.placeholders);

  try {
    currentTemplateText = await loadTemplate(entry);
    renderEditable();
  } catch (_) {
    if (els.skeleton) els.skeleton.hidden = true;
    els.preview.innerHTML = `<p class="preview-error">Could not load template — serve over a local web server.</p>`;
  }
}

// ─── Copy ──────────────────────────────────────────────────────────────────

function showCopied() {
  els.copyBtn.dataset.state = 'copied';
  clearTimeout(showCopied._t);
  showCopied._t = setTimeout(() => { els.copyBtn.dataset.state = 'idle'; }, 2200);
}

function showCopyError() {
  els.copyBtn.dataset.state = 'error';
  els.actionsRow.classList.add('actions--error');
  clearTimeout(showCopyError._t);
  showCopyError._t = setTimeout(() => {
    els.copyBtn.dataset.state = 'idle';
    els.actionsRow.classList.remove('actions--error');
  }, 2000);
}

function plainText() {
  return (els.preview.innerText || '').replace(/\n{3,}/g, '\n\n').trim();
}

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
}

async function copySignature() {
  if (!currentTemplateText) return;

  const data = readEditableValues();
  if (!validateAndHighlight(data)) {
    showCopyError();
    const firstError = els.preview.querySelector('.fz--error');
    if (firstError) firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  const html  = render(currentTemplateText, data);
  const text  = plainText();

  if (navigator.clipboard && typeof window.ClipboardItem !== 'undefined') {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html':  new Blob([html],  { type: 'text/html' }),
          'text/plain': new Blob([text], { type: 'text/plain' }),
        }),
      ]);
      showCopied();
      return;
    } catch (_) {}
  }

  if (execCommandCopyHtml(html)) { showCopied(); return; }
  showManualFallback(html);
}

// ─── Init ──────────────────────────────────────────────────────────────────

async function init() {
  els.copyBtn.addEventListener('click', copySignature);

  let registry;
  try {
    registry = await loadRegistry();
  } catch (_) {
    if (els.skeleton) els.skeleton.hidden = true;
    els.preview.innerHTML = `<p class="preview-error">Could not load templates — serve over a local web server.</p>`;
    return;
  }

  const assetBase = resolveAssetBase();

  registry.forEach((entry, i) => {
    const prefix    = entry.id.split('-')[0];              // "ld" / "gd" / "sp"
    const logoSrc   = `${assetBase}/assets/${prefix}-logo.png`;
    const brandName = entry.label.split(' — ')[0];         // "Lieliska dāvana"

    const btn = document.createElement('button');
    btn.className = 'thumb';
    btn.type = 'button';
    btn.style.setProperty('--i', i);
    btn.innerHTML = `
      <span class="thumb__logo-wrap">
        <img class="thumb__logo" src="${logoSrc}" alt="${escapeHtml(brandName)}" />
      </span>
      <span class="thumb__label">${escapeHtml(brandName)}</span>
    `;
    btn.addEventListener('click', () => selectTemplate(entry, btn));
    els.thumbRow.appendChild(btn);
  });

  if (registry.length) {
    const firstThumb = els.thumbRow.querySelector('.thumb');
    await selectTemplate(registry[0], firstThumb);
  }
}

init();
