const THEME_KEY = 'dwm-theme';

function currentTheme() {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

function applyTheme(theme, persist = true) {
  const next = theme === 'dark' ? 'dark' : 'light';
  document.documentElement.dataset.theme = next;

  if (persist) {
    try { localStorage.setItem(THEME_KEY, next); } catch {}
  }

  const meta = document.getElementById('themeColorMeta');
  if (meta) meta.setAttribute('content', next === 'dark' ? '#101419' : '#f7f9fc');

  document.querySelectorAll('[data-theme-toggle]').forEach(button => {
    const label = button.querySelector('[data-theme-label]');
    if (label) label.textContent = next === 'dark' ? 'Light' : 'Dark';
    button.setAttribute('aria-pressed', String(next === 'dark'));
    button.title = next === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
  });
}

applyTheme(currentTheme(), false);

document.querySelectorAll('[data-theme-toggle]').forEach(button => {
  button.addEventListener('click', () => {
    applyTheme(currentTheme() === 'dark' ? 'light' : 'dark');
  });
});

const button = document.getElementById('menuButton');
const nav = document.getElementById('mobileNav');

button?.addEventListener('click', () => {
  const open = button.getAttribute('aria-expanded') === 'true';
  button.setAttribute('aria-expanded', String(!open));
  nav.hidden = open;
});

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/static/sw.js').catch(() => {});
  });
}
