(async function () {
  const loadingEl = document.getElementById('viewer-loading');
  const containerEl = document.getElementById('book-container');
  const controlsEl = document.getElementById('viewer-controls');
  const prevBtn = document.getElementById('prev-btn');
  const nextBtn = document.getElementById('next-btn');
  const indicatorEl = document.getElementById('page-indicator');
  const capTitle = document.getElementById('cap-title');
  const capMeta = document.getElementById('cap-meta');

  function fail(msg) {
    loadingEl.textContent = msg;
    console.error(msg);
  }

  // ---- 1. Which book was requested? ----
  const params = new URLSearchParams(window.location.search);
  const bookId = params.get('book');
  if (!bookId) return fail('No flipbook specified (missing ?book= in URL).');

  let books;
  try {
    const res = await fetch('flipbooks.json', { cache: 'no-store' });
    books = await res.json();
  } catch (err) {
    return fail('Could not load flipbooks.json — ' + err.message);
  }

  const book = books.find(function (b) { return b.id === bookId; });
  if (!book) return fail('Flipbook "' + bookId + '" not found in flipbooks.json.');

  capTitle.textContent = book.title;
  capMeta.textContent = [book.location, book.year].filter(Boolean).join(' · ');
  document.title = book.title + ' — Lens & Luggage';

  // ---- 2. Render every PDF page to a canvas image ----
  if (typeof pdfjsLib === 'undefined') {
    return fail('pdf.js failed to load (check your internet connection / CDN link in viewer.html).');
  }
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

  let images;
  try {
    const pdf = await pdfjsLib.getDocument(book.pdf).promise;
    const RENDER_SCALE = 1.8; // higher = sharper but slower/larger
    images = [];
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: RENDER_SCALE });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      await page.render({ canvasContext: ctx, viewport: viewport }).promise;
      images.push(canvas.toDataURL('image/jpeg', 0.88));
    }
  } catch (err) {
    return fail('Could not read the PDF at "' + book.pdf + '" — ' + err.message);
  }

  if (images.length === 0) return fail('This PDF has no pages.');

  // ---- 3. Build the page-flip book from those images ----
  if (typeof St === 'undefined' || !St.PageFlip) {
    return fail('page-flip library failed to load (check the CDN link in viewer.html).');
  }

  loadingEl.style.display = 'none';
  containerEl.style.display = 'block';
  controlsEl.style.display = 'flex'; // must exist BEFORE PageFlip measures the container

  const isNarrow = window.innerWidth < 700;

  // Lock PageFlip's stretch bounds to the exact measured container box.
  // (A loose min/max range here previously let PageFlip's own internal
  // "is this click inside the book" hit-area grow past the visible book
  // and swallow clicks on the button row below it.)
  const containerRect = containerEl.getBoundingClientRect();
  const boundW = Math.max(200, Math.floor(containerRect.width));
  const boundH = Math.max(260, Math.floor(containerRect.height));

  const pageFlip = new St.PageFlip(containerEl, {
    width: boundW,
    height: boundH,
    size: 'stretch',
    minWidth: boundW,
    maxWidth: boundW,
    minHeight: boundH,
    maxHeight: boundH,
    maxShadowOpacity: 0.5,
    showCover: true,
    usePortrait: isNarrow,
    mobileScrollSupport: true
  });

  pageFlip.loadFromImages(images);

  function updateIndicator() {
    const current = pageFlip.getCurrentPageIndex() + 1;
    const total = images.length;
    indicatorEl.textContent = current + ' / ' + total;
    prevBtn.disabled = current <= 1;
    nextBtn.disabled = current >= total;
  }

  pageFlip.on('flip', updateIndicator);
  updateIndicator();

  // On resize, re-measure and re-lock the bounds so the hit area never
  // drifts from what's actually visible.
  let resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      const r = containerEl.getBoundingClientRect();
      const w = Math.max(200, Math.floor(r.width));
      const h = Math.max(260, Math.floor(r.height));
      if (pageFlip.getSettings) {
        const settings = pageFlip.getSettings();
        settings.minWidth = w;
        settings.maxWidth = w;
        settings.minHeight = h;
        settings.maxHeight = h;
      }
      if (typeof pageFlip.update === 'function') pageFlip.update();
    }, 150);
  });

  prevBtn.addEventListener('click', function () { pageFlip.turnToPrevPage(); });
  nextBtn.addEventListener('click', function () { pageFlip.turnToNextPage(); });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowLeft') pageFlip.turnToPrevPage();
    if (e.key === 'ArrowRight') pageFlip.turnToNextPage();
  });
})();
