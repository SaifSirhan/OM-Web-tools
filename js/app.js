function activateTab(name) {
  document.querySelectorAll('[data-tab]').forEach((btn) => {
    const on = btn.dataset.tab === name;
    btn.classList.toggle('active', on);
    btn.setAttribute('aria-selected', on ? 'true' : 'false');
    const panel = document.getElementById('tab-' + btn.dataset.tab);
    if (panel) panel.hidden = !on;
  });
}

document.querySelector('.tabbar').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-tab]');
  if (btn) activateTab(btn.dataset.tab);
});

const firstTab = document.querySelector('[data-tab]');
if (firstTab) activateTab(firstTab.dataset.tab);
