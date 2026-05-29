# HTML Email Ruleset — every signature template must follow this

Email clients render a restricted, ancient HTML/CSS subset. Outlook on Windows
renders through the **Microsoft Word engine** and ignores modern CSS. Every
template MUST follow these rules or it will break in someone's inbox.

## Layout
- Use **nested `<table>` elements only** for layout. No `<div>` layout, no
  flexbox, no grid, no `float`, no `position`, no CSS `margin` for spacing.
- Every layout table: `cellpadding="0" cellspacing="0" border="0" role="presentation"`.
- Set widths as **both** an HTML attribute and inline CSS:
  `<table width="520" style="width:520px">`.
- Create spacing with **spacer cells or cell `padding`**, never CSS margins.

## CSS
- **Inline every style** via `style="..."` on the element itself. No `<style>`
  blocks, no CSS classes (Gmail strips `<head>`/`<style>`; the signature has no
  `<head>` once pasted).
- Set `font-family`, `font-size`, `color`, and `line-height` **explicitly on
  every text-bearing cell**. Do not rely on inheritance — Outlook drops it.
- **System fonts only:** `font-family: Arial, Helvetica, sans-serif;`. No web fonts.

## Images
- **Absolute `https://` URLs only** (Pages-hosted assets). In templates, write
  the path as `{{assetBase}}/assets/your-image.png` — the app replaces
  `{{assetBase}}` with the configured absolute base URL (see `/config.js`).
- **PNG or JPG only — never SVG** (Outlook's Word engine won't render SVG).
- Export images at **2× display size**, then constrain with `width`/`height`
  attributes (crisp on retina).
- Every `<img>` needs explicit `width` and `height` **attributes** + meaningful
  `alt` text (images are blocked by default in Outlook until the user clicks
  download).
- Add `style="display:block;"` on images in cells to remove the gap below them.
- **Never base64-embed images** — Outlook strips embedded base64. Link by URL only.

## Links
- Plain `<a href="https://...">`. Force `style="color:#E8731C; text-decoration:none;"`
  inline — Outlook recolors unstyled links to its own blue/purple.
- Use `mailto:` for the email line, optionally `tel:` for phone.
- Absolute URLs only. No relative links, no JavaScript links.

## Tokens
Use only the standard token names. Replacement is deterministic string substitution.

| Token                | Filled with                                            |
|----------------------|--------------------------------------------------------|
| `{{name}}`           | Name Surname                                           |
| `{{jobTitleLocal}}`  | Job title in local language                            |
| `{{jobTitleEng}}`    | Job title in English                                   |
| `{{phone}}`          | Phone                                                  |
| `{{email}}`          | Email                                                  |
| `{{assetBase}}`      | Configured absolute asset base URL (auto)              |
| `{{titleSep}}`       | `" / "` only when BOTH titles are present, else `""`   |

### Empty-field collapsing (how to avoid orphan lines / stray separators)
Mark any element that should disappear when its field is blank:

- `data-show-if="phone"` — the element is removed if `{{phone}}` is blank.
- `data-show-if-any="jobTitleLocal,jobTitleEng"` — removed only if **all** the
  listed tokens are blank. Combine with `{{titleSep}}` so the `/` separator
  appears only when both titles are present:
  `{{jobTitleLocal}}{{titleSep}}{{jobTitleEng}}`.

This guarantees no empty lines and no orphaned `/` when one or both sides are blank.

---

## NEW-TEMPLATE CHECKLIST (a template is "done" only when ALL are true)
- [ ] Layout is nested tables only — no divs/flex/grid/float/position
- [ ] Every style is inlined; no `<style>` blocks or classes
- [ ] font-family / size / color / line-height set on every text cell
- [ ] System fonts only
- [ ] All images are absolute https URLs (`{{assetBase}}/assets/...`), PNG/JPG,
      exported at 2×, with width+height+alt and `display:block`
- [ ] No SVG, no base64 images
- [ ] All links have forced inline color + text-decoration
- [ ] Standard token names used; blank fields collapse with no orphan
      lines/separators (`data-show-if` / `data-show-if-any` + `{{titleSep}}`)
- [ ] Registered in `/templates/index.json`
- [ ] **Test-sent to one real account in EACH of: Outlook desktop (Windows),
      Outlook Mac, Outlook on the web, Gmail, Apple Mail** — and visually verified
