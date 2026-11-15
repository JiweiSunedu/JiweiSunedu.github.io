/* Field-tag filters and the foldable year groups on /publications/.
   Each card declares its tags in data-publication-tags (pipe-separated);
   each chip declares data-field-filter. Year groups are native <details>,
   so they fold even without this script. */
(() => {
  'use strict';

  const chips = [...document.querySelectorAll('[data-field-filter]')];
  const entries = [...document.querySelectorAll('[data-publication-tags]')];
  const groups = [...document.querySelectorAll('[data-pub-year]')];
  const emptyState = document.querySelector('[data-empty-state]');

  if (chips.length && entries.length) {
    const tagsOf = (entry) =>
      (entry.dataset.publicationTags || '')
        .split('|')
        .map((tag) => tag.trim())
        .filter(Boolean);

    const counts = new Map();
    entries.forEach((entry) => {
      tagsOf(entry).forEach((tag) => counts.set(tag, (counts.get(tag) || 0) + 1));
    });

    document.querySelectorAll('[data-count-for]').forEach((node) => {
      const key = node.dataset.countFor;
      const count = key === 'all' ? entries.length : counts.get(key) || 0;
      node.textContent = String(count);
      const chip = node.closest('.filter-chip');
      if (chip) chip.classList.toggle('is-empty', count === 0);
    });

    const apply = (field) => {
      let visible = 0;
      entries.forEach((entry) => {
        const match = field === 'all' || tagsOf(entry).includes(field);
        entry.hidden = !match;
        if (match) visible += 1;
      });

      groups.forEach((group) => {
        const groupEntries = [...group.querySelectorAll('[data-publication-tags]')];
        const shown = groupEntries.filter((entry) => !entry.hidden).length;
        group.hidden = shown === 0;
        const counter = group.querySelector('.pub-year-count');
        if (counter) counter.textContent = String(shown);
        if (shown > 0) group.open = true;
      });

      chips.forEach((chip) => {
        const active = chip.dataset.fieldFilter === field;
        chip.classList.toggle('is-active', active);
        chip.setAttribute('aria-pressed', String(active));
      });

      if (emptyState) emptyState.hidden = visible > 0;
    };

    chips.forEach((chip) => {
      chip.addEventListener('click', () => apply(chip.dataset.fieldFilter));
    });

    apply('all');
  }

  /* Only the year label and the round toggle fold a group; clicks on the empty
     space of the header row do nothing. */
  document.querySelectorAll('.pub-year > summary').forEach((summary) => {
    summary.addEventListener('click', (event) => {
      // detail === 0 means the click came from the keyboard (Enter/Space), which
      // must keep toggling; only real pointer clicks on empty space are ignored.
      if (event.detail === 0) return;
      if (!event.target.closest('.pub-year-label, .pub-year-toggle')) {
        event.preventDefault();
      }
    });
  });

  /* Deep links such as /publications/#pub-sun2026scratchreview must open the
     year group that holds the paper. */
  if (location.hash.startsWith('#pub-')) {
    const target = document.querySelector(location.hash);
    if (target) {
      const group = target.closest('details');
      if (group) group.open = true;
      target.scrollIntoView();
    }
  }
})();
