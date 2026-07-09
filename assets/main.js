// Renders the light-table gallery on index.html from flipbooks.json
(async function () {
  const grid = document.getElementById('book-grid');

  let books = [];
  try {
    const res = await fetch('flipbooks.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('flipbooks.json not found (' + res.status + ')');
    books = await res.json();
  } catch (err) {
    grid.innerHTML = '<p class="empty-state">Could not load flipbooks.json — ' + err.message + '</p>';
    return;
  }

  if (!Array.isArray(books) || books.length === 0) {
    grid.innerHTML = '<p class="empty-state">No flipbooks yet. Add one to flipbooks.json.</p>';
    return;
  }

  grid.innerHTML = books.map(function (book) {
    const tint = book.tint || '#2b4a5c';
    const cover = book.cover
      ? '<img src="' + book.cover + '" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;">'
      : '';
    return (
      '<a class="slide-mount" href="viewer.html?book=' + encodeURIComponent(book.id) + '" aria-label="Open ' + book.title + '">' +
        '<div class="slide-window" style="background:' + tint + ';">' +
          cover +
          '<span class="slide-window-title">' + book.title + '</span>' +
        '</div>' +
        '<div class="slide-meta">' +
          '<span class="loc">' + (book.location || '') + '</span>' +
          '<span>' + (book.year || '') + '</span>' +
        '</div>' +
      '</a>'
    );
  }).join('');
})();
