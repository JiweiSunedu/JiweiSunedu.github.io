(() => {
  const root = document.documentElement;
  root.classList.add('js');
  const themeButton = document.querySelector('.theme-toggle');
  const menuButton = document.querySelector('.menu-toggle');
  const navigation = document.querySelector('.main-navigation');
  const preference = window.matchMedia('(prefers-color-scheme: dark)');
  let savedTheme = null;
  try { savedTheme = localStorage.getItem('jiwei-home-theme'); } catch (_) {}
  const applyTheme = (theme) => {
    root.dataset.theme = theme;
    const dark = theme === 'dark';
    themeButton.setAttribute('aria-pressed', String(dark));
    themeButton.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
    document.querySelector('meta[name="theme-color"]').content = dark ? '#211a15' : '#fff5eb';
  };
  applyTheme(savedTheme === 'dark' || savedTheme === 'light' ? savedTheme : preference.matches ? 'dark' : 'light');
  themeButton.addEventListener('click', () => {
    savedTheme = root.dataset.theme === 'dark' ? 'light' : 'dark';
    applyTheme(savedTheme);
    try { localStorage.setItem('jiwei-home-theme', savedTheme); } catch (_) {}
  });
  preference.addEventListener('change', (event) => { if (!savedTheme) applyTheme(event.matches ? 'dark' : 'light'); });
  const closeMenu = () => {
    navigation.classList.remove('is-open');
    menuButton.setAttribute('aria-expanded', 'false');
  };
  menuButton.addEventListener('click', () => {
    const open = navigation.classList.toggle('is-open');
    menuButton.setAttribute('aria-expanded', String(open));
  });
  navigation.addEventListener('click', (event) => { if (event.target.closest('a')) closeMenu(); });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && navigation.classList.contains('is-open')) { closeMenu(); menuButton.focus(); }
  });
  const wechat = document.querySelector('.wechat-contact');
  document.addEventListener('click', (event) => {
    if (wechat && wechat.open && !wechat.contains(event.target)) wechat.open = false;
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && wechat && wechat.open) {
      wechat.open = false;
      wechat.querySelector('summary').focus();
    }
  });
  const links = [...navigation.querySelectorAll('a')];
  const sections = [...document.querySelectorAll('main section[id]')];
  const updateCurrentSection = () => {
    let current = 'intro';
    sections.forEach((section) => {
      if (section.getBoundingClientRect().top <= 150) current = section.id;
    });
    if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 6) current = 'contact';
    links.forEach((link) => {
      if (link.hash === '#' + current) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  };
  let pending = false;
  window.addEventListener('scroll', () => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => { updateCurrentSection(); pending = false; });
  }, { passive: true });
  window.addEventListener('resize', updateCurrentSection);
  updateCurrentSection();
})();
