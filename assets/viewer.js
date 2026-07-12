(async function () {
  const loadingEl = document.getElementById('viewer-loading');
  const bookFrameEl = document.getElementById('book-frame');
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
  let pageAspect = 480 / 660; // fallback, overwritten below once we read the real PDF page size
  try {
    const pdf = await pdfjsLib.getDocument(book.pdf).promise;
    const RENDER_SCALE = 1.8; // higher = sharper but slower/larger
    images = [];
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: RENDER_SCALE });
      if (pageNum === 1) pageAspect = viewport.width / viewport.height;
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
  bookFrameEl.style.display = 'block';
  controlsEl.style.display = 'flex'; // must exist BEFORE PageFlip measures the container

  const isNarrow = window.innerWidth < 700;

  const stageEl = document.querySelector('.viewer-stage');

  // A "spread" shows two pages side by side (one page when narrow/portrait
  // mode kicks in). Fit that spread — at the PDF's real aspect ratio, not
  // an arbitrary guessed shape — inside the available stage box.
  function computePageDims() {
    const rect = stageEl.getBoundingClientRect();
    // getBoundingClientRect() reports the padding-box, but .viewer-stage has
    // its own CSS padding (1.25rem 4vw). That padding was never subtracted
    // here, so the computed spread could come out wider than #book-frame's
    // `max-width: 92vw` cap. PageFlip then locks #book-container to that
    // too-wide size regardless, and the overflow — always the right-hand
    // page — got silently sliced off by #book-frame's `overflow: hidden`.
    // Subtracting the real padding keeps this calculation and that CSS cap
    // in agreement at any viewport size.
    const cs = getComputedStyle(stageEl);
    const padX = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
    const padY = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
    const availW = Math.max(200, Math.floor(rect.width - padX) - 32);
    const availH = Math.max(260, Math.floor(rect.height - padY) - 32);
    const spreadMultiplier = isNarrow ? 1 : 2;
    const spreadAspect = pageAspect * spreadMultiplier; // width/height of the whole spread
    const containerAspect = availW / availH;

    let spreadW, spreadH;
    if (spreadAspect > containerAspect) {
      spreadW = availW;
      spreadH = spreadW / spreadAspect;
    } else {
      spreadH = availH;
      spreadW = spreadH * spreadAspect;
    }
    return {
      width: Math.max(60, Math.floor(spreadW / spreadMultiplier)),
      height: Math.max(60, Math.floor(spreadH))
    };
  }

  let currentDims = computePageDims();

  const pageFlip = new St.PageFlip(containerEl, {
    width: currentDims.width,
    height: currentDims.height,
    size: 'stretch',
    minWidth: currentDims.width,
    maxWidth: currentDims.width,
    minHeight: currentDims.height,
    maxHeight: currentDims.height,
    maxShadowOpacity: 0.5,
    showCover: true,
    usePortrait: isNarrow,
    mobileScrollSupport: true
  });

  pageFlip.loadFromImages(images);

  const totalPages = images.length;
  // The library always shows the very first page alone (a "hard" front
  // cover). The very last page ends up alone too whenever the page count
  // is even (so the pages after the cover pair up with none left over).
  function isSoloCover(pageIndex) {
    if (pageIndex === 0) return 'front';
    if (pageIndex === totalPages - 1 && (totalPages - 1) % 2 === 1) return 'back';
    return null;
  }

  // Show just the single cover page (no blank facing half) by clipping
  // the outer frame to half-width and sliding the (always full-spread-
  // sized) inner container so the cover side lands inside that window.
  function updateCoverClipping() {
    if (isNarrow) return; // already single-page mode, nothing to clip
    const solo = isSoloCover(pageFlip.getCurrentPageIndex());
    if (solo === 'front') {
      bookFrameEl.style.width = currentDims.width + 'px';
      containerEl.style.transform = 'translateX(-' + currentDims.width + 'px)';
    } else if (solo === 'back') {
      bookFrameEl.style.width = currentDims.width + 'px';
      containerEl.style.transform = 'translateX(0)';
    } else {
      bookFrameEl.style.width = (currentDims.width * 2) + 'px';
      containerEl.style.transform = 'translateX(0)';
    }
  }

  function updateIndicator() {
    const current = pageFlip.getCurrentPageIndex() + 1;
    const total = images.length;
    indicatorEl.textContent = current + ' / ' + total;
    prevBtn.disabled = current <= 1;
    nextBtn.disabled = current >= total;
  }

  pageFlip.on('flip', function () {
    updateIndicator();
    updateCoverClipping();
  });
  updateIndicator();
  updateCoverClipping();

  // On resize, re-measure and re-lock the bounds (at the correct aspect
  // ratio) so the hit area never drifts from what's actually visible.
  let resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      currentDims = computePageDims();
      if (pageFlip.getSettings) {
        const settings = pageFlip.getSettings();
        settings.minWidth = currentDims.width;
        settings.maxWidth = currentDims.width;
        settings.minHeight = currentDims.height;
        settings.maxHeight = currentDims.height;
      }
      if (typeof pageFlip.update === 'function') pageFlip.update();
      updateCoverClipping();
    }, 150);
  });

  prevBtn.addEventListener('click', function () { pageFlip.turnToPrevPage(); });
  nextBtn.addEventListener('click', function () { pageFlip.turnToNextPage(); });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowLeft') pageFlip.turnToPrevPage();
    if (e.key === 'ArrowRight') pageFlip.turnToNextPage();
  });
})();
