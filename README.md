# Lens & Luggage — personal site (flipbooks)

A plain static site: no build step, no framework, no server. Just HTML/CSS/JS,
which is exactly what GitHub Pages wants.

## What's here

```
index.html          the "light table" gallery of all your flipbooks
viewer.html          the page-turning viewer for a single flipbook
flipbooks.json       the list of flipbooks — edit this to add/remove books
flipbooks/           one folder per flipbook, containing its PDF
assets/style.css     all styling
assets/main.js       builds the gallery grid from flipbooks.json
assets/viewer.js     loads a PDF, rasterises pages, drives the page-flip animation
```

There's one demo flipbook in `flipbooks/sample-demo/book.pdf` — a 6-page
placeholder so you can see the page-turn effect working before you drop in
a real export from Lens & Luggage.

## How it works

1. `index.html` reads `flipbooks.json` and draws one "slide mount" card per
   book.
2. Clicking a card opens `viewer.html?book=<id>`.
3. `viewer.js` looks up that `id` in `flipbooks.json`, fetches the matching
   PDF, and uses **pdf.js** to render every page onto a canvas image.
4. Those images are handed to **page-flip** (the `St.PageFlip` library),
   which does the actual page-turning animation.

Both libraries are loaded from CDN links in `viewer.html` — nothing to
install, nothing to build.

## Adding a new flipbook

1. Export the PDF from Lens & Luggage.
2. Make a new folder under `flipbooks/`, e.g. `flipbooks/patagonia-2026/`,
   and put the PDF inside it.
3. Add an entry to `flipbooks.json`:

```json
{
  "id": "patagonia-2026",
  "title": "Patagonia",
  "location": "Torres del Paine, Chile",
  "year": "2026",
  "pdf": "flipbooks/patagonia-2026/book.pdf",
  "accent": "#8a5a34",
  "tint": "#3a4a3f"
}
```

- `id` must be unique and match the folder name (used in the URL).
- `tint` is the background colour of that book's slide-mount card on the
  home page — pick something that echoes the album's palette.
- `cover` (optional) — path to a JPG/PNG to use as the card thumbnail
  instead of a flat colour, e.g. `"cover": "flipbooks/patagonia-2026/cover.jpg"`.

That's it — no rebuild needed, just add the folder + PDF + JSON entry.

## Running it locally before you push

Browsers block `fetch()` on `file://` pages, so you need a tiny local
server to test:

```bash
cd site
python3 -m http.server 8000
```

Then open `http://localhost:8000` in your browser.

## Deploying to GitHub Pages

1. Create a new GitHub repo (e.g. `lens-and-luggage-site`).
2. Push the contents of this `site/` folder to the repo root (or to a
   `/docs` folder — either works, you just configure it in step 3).
3. In the repo: **Settings → Pages → Source**, pick the branch and folder
   you pushed to.
4. Your site will be live at `https://<username>.github.io/<repo-name>/`
   within a minute or two.
5. Later, for a custom domain: add a `CNAME` file with your domain name at
   the site root, and point your domain's DNS at GitHub Pages (an `A`
   record to GitHub's IPs, or a `CNAME` record if using a subdomain).
   GitHub's docs walk through the exact records needed.

## Things to watch

- **PDF file size**: each page is rasterised client-side, so a 40-page,
  huge-resolution PDF will be slow to open and heavy to download. If a
  flipbook feels sluggish, try re-exporting at a slightly lower resolution,
  or lower `RENDER_SCALE` in `assets/viewer.js` (currently `1.8`).
- **CDN versions**: `viewer.html` pins pdf.js `3.11.174` and page-flip
  `2.0.7` (both current at time of writing). If either library ever stops
  loading, check the browser console — a 404 there almost always means a
  version number needs bumping. cdnjs.com/libraries/pdf.js and
  npmjs.com/package/page-flip list current versions.
- **Large videos** (for later, when you add that section): don't put these
  in the GitHub repo — GitHub Pages isn't built for serving big media
  files. Use unlisted YouTube/Vimeo, or object storage like Cloudflare R2 /
  Bunny.net, and just link/embed from your static pages.
