const button = document.getElementById('menuButton');
const nav = document.getElementById('mobileNav');

button?.addEventListener('click', () => {
  const open = button.getAttribute('aria-expanded') === 'true';
  button.setAttribute('aria-expanded', String(!open));
  nav.hidden = open;
});

for (const roleSelect of document.querySelectorAll('[data-role-select]')) {
  const syncProjectField = () => {
    const form = roleSelect.closest('form');
    const field = form?.querySelector('.project-field');
    const projectSelect = field?.querySelector('select');
    if (!field || !projectSelect) return;

    const scoped = ['Operator', 'Staff'].includes(roleSelect.value);
    field.hidden = !scoped;
    projectSelect.required = scoped;
    if (!scoped) projectSelect.value = '';
  };

  roleSelect.addEventListener('change', syncProjectField);
  syncProjectField();
}

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/static/sw.js').catch(() => {});
  });
}
