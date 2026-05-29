# Email Signature Builder

A tiny **static, single-page web app** that lets employees generate a correct,
on-brand HTML email signature and copy it into their mail client. No login, no
backend, no database — everything runs in the browser.

Flow: open the URL → type your details → pick a template → see the live preview →
click **Copy signature** → paste into Outlook / Gmail / Apple Mail.

## Project layout

```
/                       app source (index.html, main.js, styles.css, config.js)
/templates/             one .html file per signature template (tokenized)
/templates/index.json   registry the dropdown reads: [{id, label, file}]
/assets/                logos + social icons (PNG, served by Pages as public URLs)
/docs/RULES.md          the HTML-email ruleset + new-template checklist
/.github/workflows/     Pages build + deploy workflow
```

There is **no build step** — the repo is published as-is.

## Run locally

ES modules and `fetch()` don't work from `file://`, so serve over a local
web server:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

(Any static server works, e.g. `npx serve`.)

> Before the assets are live on a host, the preview may show broken image icons
> (you'll see the `alt` text). That's expected — see the path rule below.

## One-time setup (GitHub Pages)

1. Create a GitHub repo and push this project to the `main` branch.
2. In the repo: **Settings → Pages → Build and deployment → Source = GitHub Actions**.
3. Push to `main`. The workflow in `.github/workflows/deploy.yml` builds and
   publishes automatically. The live URL appears in **Settings → Pages** and on
   the Actions run summary (typically `https://ORG.github.io/REPO/`).

## Relative vs. absolute paths (important)

- **The app** references its own files with **relative** paths (`./styles.css`,
  `./templates/...`, `./assets/...`) so it runs unchanged from a Pages subpath,
  a domain root, or Azure later.
- **Signature templates** reference images with **absolute `https://` URLs**,
  because the signature travels into recipients' inboxes where relative paths
  would break. Templates write image paths as `{{assetBase}}/assets/...`.

`{{assetBase}}` comes from a single config value in [`config.js`](config.js):

- Leave `ASSET_BASE_URL` **blank** (default) and it auto-derives from wherever
  the app is hosted. Deployed at `https://org.github.io/repo/`, copied
  signatures get `https://org.github.io/repo/assets/...` with zero edits. This
  is also why moving to **Azure Static Web Apps** needs no code change.
- Or set it explicitly (no trailing slash) if assets live elsewhere:
  `export const ASSET_BASE_URL = 'https://org.github.io/repo';`

> Note: only copy a signature for real use from the **deployed** site. Copying
> while running on `localhost` would embed `localhost` image URLs.

## How to add a new template

1. Create a tokenized HTML file in `/templates/`, following **every rule** in
   [`docs/RULES.md`](docs/RULES.md). Use [`templates/ld-default.html`](templates/ld-default.html)
   as the reference pattern.
2. Add one entry to [`templates/index.json`](templates/index.json):
   ```json
   { "id": "my-template", "label": "Shown in dropdown", "file": "my-template.html" }
   ```
3. Done. The dropdown reads the registry at runtime — nothing else to wire up.

## How to add / replace images

Drop PNG files into `/assets/`. Requirements:

- **PNG, transparent background, exported at 2× display size.**
- No SVG, no base64.

Expected dimensions for the LD assets (replace the generated placeholders):

| File                     | Export size (2×) | Displayed at |
|--------------------------|------------------|--------------|
| `ld-logo.png`            | 240 × 240 px     | 120 × 120 px |
| `social-facebook.png`    | 48 × 48 px       | 24 × 24 px   |
| `social-instagram.png`   | 48 × 48 px       | 24 × 24 px   |
| `social-linkedin.png`    | 48 × 48 px       | 24 × 24 px   |

> The PNGs currently in `/assets/` are **plain orange placeholders**. The
> designer must replace them with the real transparent 2× exports at the sizes
> above. Also replace the three `https://example.com/REPLACE` social URLs in
> `templates/ld-default.html` with the real Facebook / Instagram / LinkedIn pages.

## The Copy button

Places the rendered signature on the clipboard as **`text/html`** (with a
`text/plain` fallback) using the async Clipboard API + `ClipboardItem`, so it
pastes as a *formatted* signature — not visible HTML source. If the browser
lacks `ClipboardItem`, it falls back to a hidden contenteditable + `execCommand`,
and finally to a select-all-and-copy box.

Inline hint shown in the app:
*"Paste into Outlook → File → Options → Mail → Signatures (or your mail client's
signature settings)."*

## Cross-client test checklist before shipping any template

Test-send to one real account in **each** of: Outlook desktop (Windows),
Outlook Mac, Outlook on the web, Gmail, Apple Mail — and visually verify. Full
checklist in [`docs/RULES.md`](docs/RULES.md).

## Portability to Azure later

The app is host-agnostic. Moving to Azure Static Web Apps requires changing
**only** the deploy workflow — no application code changes.
