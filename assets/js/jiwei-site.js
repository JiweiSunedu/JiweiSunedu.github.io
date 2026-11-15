/* Shared behaviour for the custom pages: colour theme, 中/EN language toggle,
   mobile menu, WeChat popover and the command-K search dialog. */
(() => {
  'use strict';

  const root = document.documentElement;

  const state = {
    lang: root.dataset.lang === 'zh' ? 'zh' : 'en',
    theme: root.dataset.theme === 'dark' ? 'dark' : 'light',
  };

  const store = {
    get(key) {
      try {
        return localStorage.getItem(key);
      } catch (error) {
        return null;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, value);
      } catch (error) {}
    },
  };

  const themeButton = document.querySelector('.theme-toggle');
  const langButton = document.getElementById('lang-toggle');
  let searchRender = null;

  function applyTheme(theme, persist) {
    state.theme = theme === 'dark' ? 'dark' : 'light';
    const dark = state.theme === 'dark';
    root.dataset.theme = state.theme;

    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', dark ? '#211a15' : '#fff5eb');

    if (themeButton) {
      const zh = state.lang === 'zh';
      const label = dark
        ? zh
          ? themeButton.dataset.zhDarkLabel
          : themeButton.dataset.enDarkLabel
        : zh
          ? themeButton.dataset.zhLightLabel
          : themeButton.dataset.enLightLabel;
      themeButton.setAttribute('aria-pressed', String(dark));
      if (label) {
        themeButton.setAttribute('aria-label', label);
        themeButton.title = label;
      }
    }
    if (persist) store.set('jiwei-home-theme', state.theme);
  }

  function applyLang(lang, persist) {
    state.lang = lang === 'zh' ? 'zh' : 'en';
    const zh = state.lang === 'zh';
    root.dataset.lang = state.lang;
    root.lang = zh ? 'zh-Hans' : 'en';

    document.querySelectorAll('[data-zh]').forEach((node) => {
      const value = zh ? node.dataset.zh : node.dataset.en;
      if (typeof value === 'string') node.textContent = value;
    });
    document.querySelectorAll('[data-zh-label]').forEach((node) => {
      const value = zh ? node.dataset.zhLabel : node.dataset.enLabel;
      if (typeof value === 'string') {
        node.setAttribute('aria-label', value);
        node.title = value;
      }
    });
    document.querySelectorAll('[data-zh-placeholder]').forEach((node) => {
      const value = zh ? node.dataset.zhPlaceholder : node.dataset.enPlaceholder;
      if (typeof value === 'string') node.placeholder = value;
    });

    if (langButton) {
      const label = zh ? langButton.dataset.zhLabel : langButton.dataset.enLabel;
      if (label) {
        langButton.setAttribute('aria-label', label);
        langButton.title = label;
      }
      langButton.setAttribute('aria-pressed', String(zh));
    }

    applyTheme(state.theme, false);
    if (searchRender) searchRender();
    if (persist) store.set('jiwei-lang', state.lang);
  }

  if (themeButton) {
    themeButton.addEventListener('click', () => applyTheme(state.theme === 'dark' ? 'light' : 'dark', true));
  }
  if (langButton) {
    langButton.addEventListener('click', () => applyLang(state.lang === 'zh' ? 'en' : 'zh', true));
  }

  const preference = window.matchMedia('(prefers-color-scheme: dark)');
  preference.addEventListener('change', (event) => {
    if (store.get('jiwei-home-theme')) return;
    applyTheme(event.matches ? 'dark' : 'light', false);
  });

  /* Mobile navigation */
  const menuButton = document.querySelector('.menu-toggle');
  const navigation = document.querySelector('.main-navigation');
  function closeMenu() {
    if (!navigation || !menuButton) return;
    navigation.classList.remove('is-open');
    menuButton.setAttribute('aria-expanded', 'false');
  }
  if (menuButton && navigation) {
    menuButton.addEventListener('click', () => {
      const open = navigation.classList.toggle('is-open');
      menuButton.setAttribute('aria-expanded', String(open));
    });
    navigation.addEventListener('click', (event) => {
      if (event.target.closest('a')) closeMenu();
    });
  }

  /* WeChat contact popover on the homepage */
  const wechat = document.querySelector('.wechat-contact');
  document.addEventListener('click', (event) => {
    if (wechat && wechat.open && !wechat.contains(event.target)) wechat.open = false;
  });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (wechat && wechat.open) {
      wechat.open = false;
      wechat.querySelector('summary').focus();
      return;
    }
    closeMenu();
  });

  /* Search dialog */
  const overlay = document.getElementById('search-overlay');
  if (overlay) {
    const input = document.getElementById('search-input');
    const resultList = document.getElementById('search-results');
    const status = document.getElementById('search-status');
    const closeButton = document.getElementById('search-close');
    const toggleButton = document.getElementById('search-toggle');
    const typeLabels = {
      en: { page: 'Page', publication: 'Publication', post: 'Post' },
      zh: { page: '页面', publication: '论文', post: '博客' },
    };

    let entries = null;
    let loading = null;
    let activeIndex = -1;
    let query = '';

    const loadIndex = () => {
      if (!loading) {
        loading = fetch(overlay.dataset.searchUrl, { credentials: 'omit' })
          .then((response) => (response.ok ? response.json() : []))
          .then((data) => (Array.isArray(data) ? data : []))
          .catch(() => []);
      }
      return loading;
    };

    const scoreEntry = (entry, terms) => {
      const primary = ((state.lang === 'zh' && entry.title_zh) || entry.title || '').toLowerCase();
      const fallback = (entry.title || '').toLowerCase();
      const body = `${entry.text || ''} ${entry.journal || ''} ${entry.year || ''}`.toLowerCase();
      let score = 0;
      for (const term of terms) {
        if (primary.includes(term) || fallback.includes(term)) score += 3;
        else if (body.includes(term)) score += 1;
        else return -1;
      }
      return score;
    };

    const setActive = (index) => {
      const links = [...resultList.querySelectorAll('a')];
      links.forEach((link, position) => link.classList.toggle('is-active', position === index));
      activeIndex = index;
      if (index >= 0 && links[index]) links[index].scrollIntoView({ block: 'nearest' });
    };

    const render = (value) => {
      query = value;
      const zh = state.lang === 'zh';
      const hint = zh ? overlay.dataset.zhHint : overlay.dataset.enHint;
      const empty = zh ? overlay.dataset.zhEmpty : overlay.dataset.enEmpty;
      const terms = value.trim().toLowerCase().split(/\s+/).filter(Boolean);
      resultList.innerHTML = '';
      activeIndex = -1;

      if (!entries || !terms.length) {
        status.textContent = hint;
        return;
      }

      const hits = entries
        .map((entry) => ({ entry, score: scoreEntry(entry, terms) }))
        .filter((hit) => hit.score >= 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 8);

      if (!hits.length) {
        status.textContent = empty;
        return;
      }

      status.textContent = '';
      const labels = typeLabels[state.lang] || typeLabels.en;
      hits.forEach(({ entry }) => {
        const item = document.createElement('li');
        const link = document.createElement('a');
        link.href = entry.url;

        const type = document.createElement('span');
        type.className = 'search-result-type';
        type.textContent = labels[entry.type] || entry.type || '';

        const title = document.createElement('span');
        title.className = 'search-result-title';
        title.textContent = (zh && entry.title_zh) || entry.title || entry.url;

        link.append(type, title);
        item.append(link);
        resultList.append(item);
      });
      setActive(0);
    };

    const openSearch = async () => {
      overlay.hidden = false;
      document.body.classList.add('search-open');
      if (toggleButton) toggleButton.setAttribute('aria-expanded', 'true');
      input.value = '';
      render('');
      input.focus();
      entries = await loadIndex();
      render(input.value);
    };

    const closeSearch = () => {
      overlay.hidden = true;
      document.body.classList.remove('search-open');
      if (toggleButton) {
        toggleButton.setAttribute('aria-expanded', 'false');
        toggleButton.focus();
      }
    };

    searchRender = () => render(query);

    if (toggleButton) {
      toggleButton.addEventListener('click', () => {
        if (overlay.hidden) openSearch();
        else closeSearch();
      });
    }
    if (closeButton) closeButton.addEventListener('click', closeSearch);
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) closeSearch();
    });
    resultList.addEventListener('click', () => closeSearch());
    input.addEventListener('input', () => render(input.value));

    document.addEventListener('keydown', (event) => {
      if ((event.key === 'k' || event.key === 'K') && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        if (overlay.hidden) openSearch();
        else closeSearch();
        return;
      }
      if (overlay.hidden) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        closeSearch();
        return;
      }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        const count = resultList.children.length;
        if (!count) return;
        event.preventDefault();
        const next =
          event.key === 'ArrowDown' ? (activeIndex + 1) % count : (activeIndex - 1 + count) % count;
        setActive(next);
        return;
      }
      if (event.key === 'Enter') {
        const links = resultList.querySelectorAll('a');
        if (links[activeIndex]) {
          event.preventDefault();
          window.location.href = links[activeIndex].href;
        }
      }
    });
  }

  applyTheme(state.theme, false);
  applyLang(state.lang, false);
})();
