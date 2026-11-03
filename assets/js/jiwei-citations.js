/* Public Crossref counts; no API key or Google Scholar scraping. */
(() => {
  'use strict';
  const HOUR = 60 * 60 * 1000;
  const valid = (value) => value && Number.isSafeInteger(value.count) && value.count >= 0 &&
    Number.isFinite(Date.parse(value.retrieved_at)) && Date.parse(value.retrieved_at) <= Date.now() + 60000;
  const groups = new Map();
  document.querySelectorAll('.citation-metric[data-doi]').forEach((node) => {
    const doi = node.dataset.doi.trim().toLowerCase();
    if (!/^10\.\d{4,9}\/\S+$/.test(doi)) return;
    if (!groups.has(doi)) groups.set(doi, []);
    groups.get(doi).push(node);
  });
  const display = (doi, value, failed = false) => {
    const available = valid(value);
    groups.get(doi).forEach((node) => {
      node.querySelector('[data-citation-count]').textContent = available ? String(value.count) : '—';
      node.title = 'Crossref cited-by count; coverage differs from Google Scholar and Web of Science.';
    });
    document.querySelectorAll('[data-citation-status-for]').forEach((node) => {
      if (node.dataset.citationStatusFor !== doi) return;
      node.textContent = available
        ? `${failed ? 'Saved count · ' : ''}Citations checked ${new Date(value.retrieved_at).toLocaleDateString('en-GB', {day:'numeric',month:'short',year:'numeric',timeZone:'UTC'})}`
        : 'Citation count temporarily unavailable';
    });
  };
  let busy = false;
  const refresh = async () => {
    if (busy || document.hidden) return;
    busy = true;
    try {
      for (const [doi, nodes] of groups) {
        const first = nodes[0];
        let current = first.dataset.count !== '' ? {count:Number(first.dataset.count),retrieved_at:first.dataset.checked} : null;
        const key = 'jiwei-crossref-v1:' + doi;
        try {
          const stored = JSON.parse(localStorage.getItem(key));
          if (valid(stored) && (!valid(current) || Date.parse(stored.retrieved_at) > Date.parse(current.retrieved_at))) current = stored;
        } catch (_) {}
        display(doi, current);
        if (valid(current) && Date.now() - Date.parse(current.retrieved_at) < HOUR) continue;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        try {
          const response = await fetch('https://api.crossref.org/works/' + encodeURIComponent(doi), {
            signal:controller.signal,credentials:'omit',headers:{Accept:'application/json'}
          });
          if (!response.ok) throw new Error('Citation request failed');
          const payload = await response.json();
          if (String(payload.message?.DOI).toLowerCase() !== doi) throw new Error('DOI mismatch');
          const value = {count:payload.message['is-referenced-by-count'],retrieved_at:new Date().toISOString()};
          if (!valid(value)) throw new Error('Citation count unavailable');
          display(doi, value);
          nodes.forEach((node) => { node.dataset.count = String(value.count); node.dataset.checked = value.retrieved_at; });
          try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {}
        } catch (_) { display(doi, current, true); }
        finally { clearTimeout(timeout); }
      }
    } finally { busy = false; }
  };
  refresh();
  setInterval(refresh, HOUR);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
})();
