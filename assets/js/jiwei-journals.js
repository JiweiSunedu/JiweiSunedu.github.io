/* SSCI journal ranking: client-side search, filters, sorting and paging.
   The table is rendered by Jekyll; this only reorders/hides rows. */
(() => {
  'use strict';

  const table = document.getElementById('journal-table');
  if (!table) return;

  const tbody = table.tBodies[0];
  const rows = [...tbody.rows];
  const searchInput = document.getElementById('journal-search');
  const quartileButtons = [...document.querySelectorAll('[data-quartile]')];
  const tagSelect = document.getElementById('journal-tag');
  const countEl = document.getElementById('journal-count');
  const pagerEl = document.getElementById('journal-pagination');
  const headers = [...table.tHead.rows[0].cells].filter((cell) => cell.dataset.sort);
  const PER_PAGE = 25;

  const state = {
    query: '',
    quartile: 'all',
    tag: 'all',
    sort: 'jif',
    dir: -1,
    page: 1,
  };

  const numeric = (value) => {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : -Infinity;
  };

  const sortValue = (row, key) => (key === 'name' ? row.dataset.name.toLowerCase() : numeric(row.dataset[key]));

  const matches = (row) => {
    if (state.quartile !== 'all' && row.dataset.quartile !== state.quartile) return false;
    if (state.tag !== 'all' && !(row.dataset.tags || '').split('|').includes(state.tag)) return false;
    if (!state.query) return true;
    const haystack = `${row.dataset.name} ${row.dataset.publisher} ${row.dataset.tags || ''}`.toLowerCase();
    return state.query.split(/\s+/).filter(Boolean).every((term) => haystack.includes(term));
  };

  const pages = (total) => {
    const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const set = new Set([1, totalPages, state.page, state.page - 1, state.page + 1]);
    return [...set].filter((page) => page >= 1 && page <= totalPages).sort((a, b) => a - b);
  };

  const render = () => {
    const visible = rows.filter(matches);
    visible.sort((a, b) => {
      const left = sortValue(a, state.sort);
      const right = sortValue(b, state.sort);
      if (left === right) return a.dataset.name.localeCompare(b.dataset.name);
      return left < right ? -state.dir : state.dir;
    });

    const totalPages = Math.max(1, Math.ceil(visible.length / PER_PAGE));
    state.page = Math.min(Math.max(1, state.page), totalPages);
    const start = (state.page - 1) * PER_PAGE;

    visible.forEach((row) => tbody.appendChild(row));
    rows.forEach((row) => {
      const index = visible.indexOf(row);
      row.hidden = index < 0 || index < start || index >= start + PER_PAGE;
    });

    if (countEl) {
      countEl.textContent = `${visible.length} journal${visible.length === 1 ? '' : 's'}${visible.length ? ` · page ${state.page} of ${totalPages}` : ''}`;
    }

    headers.forEach((cell) => {
      const active = cell.dataset.sort === state.sort;
      cell.classList.toggle('is-sorted', active);
      cell.setAttribute('aria-sort', active ? (state.dir === 1 ? 'ascending' : 'descending') : 'none');
    });

    if (pagerEl) {
      pagerEl.innerHTML = '';
      const addButton = (label, page, options = {}) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'journal-page';
        button.textContent = label;
        if (options.current) button.classList.add('is-current');
        if (options.disabled) {
          button.disabled = true;
        } else {
          button.addEventListener('click', () => {
            state.page = page;
            render();
            updateUrl();
          });
        }
        pagerEl.append(button);
      };
      addButton('‹', state.page - 1, { disabled: state.page <= 1 });
      let previous = 0;
      pages(visible.length).forEach((page) => {
        if (previous && page - previous > 1) {
          const gap = document.createElement('span');
          gap.className = 'journal-page-gap';
          gap.textContent = '…';
          pagerEl.append(gap);
        }
        addButton(String(page), page, { current: page === state.page });
        previous = page;
      });
      addButton('›', state.page + 1, { disabled: state.page >= totalPages });
    }
  };

  const updateUrl = () => {
    const url = new URL(window.location.href);
    if (state.page > 1) url.searchParams.set('page', String(state.page));
    else url.searchParams.delete('page');
    window.history.replaceState({}, '', url);
  };

  if (searchInput) {
    searchInput.addEventListener('input', () => {
      state.query = searchInput.value.trim().toLowerCase();
      state.page = 1;
      render();
    });
  }

  quartileButtons.forEach((button) => {
    button.addEventListener('click', () => {
      state.quartile = button.dataset.quartile;
      state.page = 1;
      quartileButtons.forEach((other) => {
        const active = other === button;
        other.classList.toggle('is-active', active);
        other.setAttribute('aria-pressed', String(active));
      });
      render();
    });
  });

  [[tagSelect, 'tag']].forEach(([select, key]) => {
    if (!select) return;
    select.addEventListener('change', () => {
      state[key] = select.value;
      state.page = 1;
      render();
    });
  });

  headers.forEach((cell) => {
    cell.addEventListener('click', () => {
      const key = cell.dataset.sort;
      if (state.sort === key) state.dir *= -1;
      else {
        state.sort = key;
        state.dir = key === 'name' ? 1 : -1;
      }
      state.page = 1;
      render();
    });
  });

  const initialPage = parseInt(new URL(window.location.href).searchParams.get('page'), 10);
  if (Number.isFinite(initialPage) && initialPage > 0) state.page = initialPage;

  render();
})();
