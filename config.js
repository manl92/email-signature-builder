// Single source of truth for where signature images live.
//
// Signatures travel into recipients' inboxes, so their <img src> must be
// ABSOLUTE https URLs (relative paths would break once pasted). The render
// step replaces the {{assetBase}} token in templates with the value below.
//
// Leave this BLANK to auto-derive the base from wherever the app is hosted.
// That makes the app portable with zero edits: served from
// https://org.github.io/repo/ it produces https://org.github.io/repo/assets/...,
// and moving to Azure Static Web Apps or a custom domain "just works".
//
// Set it explicitly (no trailing slash) only if your assets live somewhere
// other than where the app is served, e.g.:
//   export const ASSET_BASE_URL = 'https://org.github.io/repo';
export const ASSET_BASE_URL = '';

// Resolves the effective base URL with no trailing slash.
export function resolveAssetBase() {
  const explicit = ASSET_BASE_URL.trim();
  if (explicit) return explicit.replace(/\/+$/, '');
  // Directory that contains index.html, as an absolute URL.
  return new URL('.', window.location.href).href.replace(/\/+$/, '');
}
