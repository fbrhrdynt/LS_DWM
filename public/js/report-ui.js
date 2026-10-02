(() => {
  const percentage = document.querySelector('[data-bypass-percentage]');
  const range = document.querySelector('[data-bypass-range]');
  if (percentage && range) {
    const sync = (source) => {
      let value = Number(source.value);
      if (!Number.isFinite(value)) value = 0;
      value = Math.max(0, Math.min(100, Math.round(value)));
      percentage.value = String(value);
      range.value = String(value);
      range.style.setProperty('--bypass-percent', `${value}%`);
    };

    percentage.addEventListener('input', () => sync(percentage));
    range.addEventListener('input', () => sync(range));
    sync(percentage);
  }
})();
