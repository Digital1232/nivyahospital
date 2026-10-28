(function () {
  'use strict';
  const index = document.querySelector('[data-blog-index]');
  if (!index) return;
  const form = document.querySelector('[data-blog-search]');
  const input = form.querySelector('input[name="q"]');
  const cards = Array.from(index.querySelectorAll('[data-blog-card]'));
  const status = document.querySelector('[data-blog-results]');
  const empty = document.querySelector('[data-blog-empty]');
  const params = new URLSearchParams(window.location.search);
  const category = params.get('category') || '';
  input.value = (params.get('q') || '').slice(0, 100);

  function filter(updateUrl) {
    const query = input.value.trim().toLowerCase();
    let count = 0;
    cards.forEach(card => {
      const matches = (!category || card.dataset.category === category) &&
        (!query || card.dataset.search.toLowerCase().includes(query));
      card.hidden = !matches;
      if (matches) count++;
    });
    const categoryLabel = cards.find(card => card.dataset.category === category);
    const label = categoryLabel ? categoryLabel.querySelector('.health-category').textContent : '';
    status.textContent = `${count} article${count === 1 ? '' : 's'}${label ? ' in ' + label : ''}${query ? ' matching "' + input.value.trim() + '"' : ' for you and your family'}`;
    empty.hidden = count > 0;
    if (updateUrl) {
      const url = new URL(window.location.href);
      if (query) url.searchParams.set('q', input.value.trim());
      else url.searchParams.delete('q');
      window.history.replaceState(null, '', url.pathname + url.search);
    }
    document.querySelectorAll('.health-view-switch a').forEach(link => {
      const target = new URL(link.getAttribute('href'), window.location.href);
      if (category) target.searchParams.set('category', category);
      if (query) target.searchParams.set('q', input.value.trim());
      link.href = target.pathname + target.search;
    });
  }
  form.addEventListener('submit', event => {
    event.preventDefault();
    filter(true);
  });
  input.addEventListener('search', () => filter(true));
  filter(false);
})();
