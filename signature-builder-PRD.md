# PRD — Internal Email Signature Builder (static web app)

> Paste this entire document into Claude Code as the brief. Create a **new GitHub repo**, work inside it, and structure the project however is cleanest within the constraints below. Deploy via **GitHub Pages**. Ask me nothing you can reasonably decide yourself; follow the hard rules exactly.

---

## 1. What we're building

A tiny, **static single-page web app** that lets ~200 employees generate a correct, on-brand HTML email signature themselves and copy it into their mail client. There is **no login, no backend, no database, no server code**. All logic runs in the browser.

The employee flow:
1. Open the app URL.
2. Type their own details into a short form (name, job title local, job title English, phone, email).
3. Pick a template from a dropdown (templates differ by company / department / season).
4. See a **live preview** of their signature update as they type.
5. Click **Copy signature** → the rendered signature lands on the clipboard as rich HTML, ready to paste into Outlook / Gmail / Apple Mail signature settings.

That's the whole product. Keep it minimal. Do **not** build an admin panel, template editor, or WYSIWYG builder — templates are authored as HTML files in the repo by hand.

---

## 2. Hard technical constraints (non-negotiable)

1. **Static SPA only.** Plain HTML/CSS/JS, or Vite + vanilla/React compiling to static files. No Node server at runtime. Output must be deployable as static files.
2. **No authentication, no Microsoft Graph, no external API calls.** Stateless.
3. **Relative asset paths everywhere in the app** (`./assets/...`, `./templates/...`). The app must run unchanged whether served from `https://org.github.io/repo-name/` (subpath) or a domain root. Do not hardcode a leading-`/` base URL. If using Vite, set `base: './'`.
4. **Deploy target: GitHub Pages** via a GitHub Actions workflow that builds and publishes on push to `main`. Must be portable to Azure Static Web Apps later with no code changes (only a different deploy target).
5. **No browser storage APIs** (localStorage/sessionStorage) — not needed; keep all state in memory.
6. Templates are **HTML files the app loads at runtime** (fetched as text) or imported as strings at build time — your choice, but adding a new template must be: drop in one HTML file + add one dropdown entry, nothing more.

---

## 3. Repo structure (suggested — adjust if you have a cleaner idea, but keep the separation)

```
/                       app source (index.html, main.js/.jsx, styles)
/templates/             one .html file per signature template (tokenized)
/templates/index.json   registry: list of {id, label, file} the dropdown reads
/assets/                logos + social icons (PNG, served by Pages = permanent public URLs)
/docs/RULES.md          the HTML-email ruleset + new-template checklist (section 6 below)
/.github/workflows/     Pages build+deploy workflow
README.md               setup, how to add a template, how to add assets
```

**Critical path distinction:**
- The **app** references assets with **relative** paths (so it's host-portable).
- The **signature template HTML** references images with **absolute `https://` URLs** (because the signature is pasted into an email and travels away from our domain — relative paths would break in recipients' inboxes). Templates should reference assets at the deployed Pages base URL, e.g. `https://ORG.github.io/REPO/assets/ld-logo.png`. Put that base URL in one constant / config value so it's easy to change when we move to Azure or a custom domain.

---

## 4. The form

Fields (all plain text inputs, all optional except name):
- `name` → "Name Surname"
- `jobTitleLocal` → job title in local language
- `jobTitleEng` → job title in English
- `phone`
- `email`

Plus a **template dropdown** populated from `/templates/index.json`.

Behaviour:
- Live preview re-renders on every keystroke / dropdown change.
- **Empty optional fields must collapse cleanly** — no empty lines, no orphaned separators (e.g. the `localTitle / engTitle` line must not leave a stray "`/`" if one side is blank). Implement token replacement so a blank value removes its surrounding line/separator gracefully.
- Token syntax in templates is double-curly: `{{name}}`, `{{jobTitleLocal}}`, `{{jobTitleEng}}`, `{{phone}}`, `{{email}}`. Replacement is simple, deterministic string substitution.

---

## 5. The Copy button — implement carefully, this is where these tools usually fail

- The button must place the **rendered HTML on the clipboard as `text/html`**, using the async Clipboard API with a `ClipboardItem` containing a `text/html` blob (and a `text/plain` fallback blob with a sensible plain-text version of the signature).
- It must **NOT** copy the raw HTML markup as plain text — if it does, the employee pastes visible angle-bracket source code into Outlook instead of a formatted signature. This is the #1 failure mode. Verify the copied content pastes as a *rendered* signature into a contenteditable target.
- Show a visible "Copied!" confirmation.
- Provide a graceful fallback for browsers without `ClipboardItem` support (e.g. a hidden contenteditable element + `document.execCommand('copy')`), and if all else fails, show the rendered signature in a selectable box with instructions to select-all and copy.
- Include short inline instructions near the button: "Paste into Outlook → File → Options → Mail → Signatures (or your mail client's signature settings)."

---

## 6. HTML EMAIL RULESET — applies to every template (put this in /docs/RULES.md)

Email clients render a restricted, ancient HTML/CSS subset. Outlook on Windows renders through the **Microsoft Word engine** and ignores modern CSS. Every template MUST follow these rules or it will break in someone's inbox.

**Layout**
- Use **nested `<table>` elements only** for layout. No `<div>` layout, no flexbox, no grid, no `float`, no `position`, no CSS `margin` for layout spacing.
- Every layout table: `cellpadding="0" cellspacing="0" border="0" role="presentation"`.
- Set widths as **both** an HTML attribute and inline CSS: `<table width="520" style="width:520px">`.
- Create spacing with **spacer cells or cell `padding`**, never CSS margins.

**CSS**
- **Inline every style** via `style="..."` on the element itself. No `<style>` blocks, no CSS classes (Gmail strips `<head>`/`<style>`; the signature has no `<head>` once pasted).
- Set `font-family`, `font-size`, `color`, and `line-height` **explicitly on every text-bearing cell**. Do not rely on inheritance — Outlook drops it.
- **System fonts only:** `font-family: Arial, Helvetica, sans-serif;`. No web fonts.

**Images**
- **Absolute `https://` URLs only** (Pages-hosted assets).
- **PNG or JPG only — never SVG** (Outlook's Word engine won't render SVG). Logo and social icons must be exported as **transparent PNG**.
- Export images at **2× display size**, then constrain with `width`/`height` attributes (crisp on retina).
- Every `<img>` needs explicit `width` and `height` **attributes** + meaningful `alt` text (images are blocked by default in Outlook until the user clicks download).
- Add `style="display:block;"` on images in cells to remove the gap browsers/Outlook add below inline images.
- **Never base64-embed images** — Outlook strips embedded base64. Link by URL only.

**Links**
- Plain `<a href="https://...">`. Force `style="color:#E8731C; text-decoration:none;"` inline — Outlook recolors unstyled links to its own blue/purple.
- Use `mailto:` for the email line, optionally `tel:` for phone.
- Absolute URLs only. No relative links, no JavaScript links.

**Tokens**
- Use only the standard token names (section 4). Write templates so a blank token leaves no empty line or stray separator.

**NEW-TEMPLATE CHECKLIST** (a template is "done" only when all true):
- [ ] Layout is nested tables only — no divs/flex/grid/float/position
- [ ] Every style is inlined; no `<style>` blocks or classes
- [ ] font-family / size / color / line-height set on every text cell
- [ ] System fonts only
- [ ] All images are absolute https URLs, PNG/JPG, exported at 2×, with width+height+alt and display:block
- [ ] No SVG, no base64 images
- [ ] All links have forced inline color + text-decoration
- [ ] Standard token names used; blank fields collapse with no orphan lines/separators
- [ ] Registered in /templates/index.json
- [ ] **Test-sent to one real account in EACH of: Outlook desktop (Windows), Outlook Mac, Outlook on the web, Gmail, Apple Mail** — and visually verified

---

## 7. First reference template — "LD signature" (build this as the worked example)

Reproduce the signature shown in our current LD Word template, as a fully compliant tokenized HTML template at `/templates/ld-default.html`, registered in `index.json` with label "Lieliska dāvana — default". This is both the first usable template AND the reference pattern the designer will match for future templates.

Layout (two-column table):
- **Left column:** stacked lines —
  - `{{name}}` — bold, dark grey (#333), ~15px
  - `{{jobTitleLocal}} / {{jobTitleEng}}` — regular, ~14px (collapse the `/` and the missing side if either is blank; if both blank, omit the line entirely)
  - `Tālr. {{phone}}` — regular (omit line if phone blank)
  - blank spacer
  - `SIA „Lieliska dāvana"` — regular
  - `Bērzaunes iela 7, Rīga` — regular
  - `www.lieliskadavana.lv` — link, forced orange (#E8731C), this is the only underlined element
- **Right column:** the orange "lieliska dāvana" elephant **logo** (PNG placeholder at `/assets/ld-logo.png`), and below it three social icons (Facebook, Instagram, LinkedIn) as orange circular **PNG** icons (`/assets/social-facebook.png`, `/assets/social-instagram.png`, `/assets/social-linkedin.png`) linking to the company's FB / IG / LinkedIn pages (use `https://example.com/REPLACE` placeholders for the three URLs and leave a clear comment to swap them).
- **Below both columns:** a thin horizontal rule, then the confidentiality disclaimer in small italic grey text:
  > The content of this email, including all attachments, is confidential. If you are not the intended recipient of "Lieliska dāvana", please notify us immediately and delete this email. Any disclosure, copying, distribution or any other use of its content is strictly prohibited.

Since the real logo/icon PNGs aren't available yet, generate **simple placeholder PNGs** of the right dimensions in `/assets/` (or commit clearly-named empty placeholders and document in README that the designer must replace them with 2× transparent PNG exports). Make the README explicit about exact pixel dimensions expected for each asset.

---

## 8. README must cover

- One-time setup (enable GitHub Pages, where the URL appears).
- **How to add a new template** (create tokenized HTML file → follow /docs/RULES.md → add entry to index.json).
- **How to add/replace images** (drop PNG in /assets/, requirements: PNG, transparent, 2× size, list the expected dimensions for the LD assets).
- The relative-vs-absolute path rule (app = relative, signature image src = absolute Pages URL) and the single config constant holding the asset base URL.
- The cross-client test checklist before shipping any template.
- A note that the app is portable to Azure Static Web Apps later by changing only the deploy workflow.

---

## 9. Definition of done

- Repo created, pushed, GitHub Pages live and reachable.
- App: form + dropdown + live preview + working copy-as-`text/html`.
- One real working template (`ld-default`) rendering correctly in the preview with placeholder assets.
- `/docs/RULES.md` and README complete.
- Empty-field collapsing verified.
- Copy button verified to paste as a *rendered* signature (not source code) into a contenteditable target.
