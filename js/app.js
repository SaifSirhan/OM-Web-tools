function activateTab(name) {
  const target = document.getElementById('tab-' + name);

  document.querySelectorAll('[data-tab]').forEach((btn) => {
    const on = btn.dataset.tab === name;
    btn.classList.toggle('active', on);
    btn.setAttribute('aria-selected', on ? 'true' : 'false');
  });

  document.querySelectorAll('.tab-panels > .panel').forEach((panel) => {
    panel.classList.remove('active');
    panel.hidden = panel !== target;
  });

  void target.offsetWidth; // reflow between remove and add, so the entrance animation replays
  target.classList.add('active');
}

document.querySelector('.tabbar').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-tab]');
  if (btn) activateTab(btn.dataset.tab);
});

const firstTab = document.querySelector('[data-tab]');
if (firstTab) activateTab(firstTab.dataset.tab);

/* ===== theme toggle =====
   index.html already resolved the stored / system preference before paint;
   this only labels the button and records later choices. */
const THEME_KEY = 'theme';
const themeToggle = document.getElementById('themeToggle');

function currentTheme() {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

function paintToggle(theme) {
  if (!themeToggle) return;
  const headingToDark = theme === 'light';
  themeToggle.textContent = headingToDark ? '🌙 Dark' : '☀️ Light';
  themeToggle.setAttribute('aria-label', headingToDark ? 'Switch to dark mode' : 'Switch to light mode');
}

if (themeToggle) {
  themeToggle.addEventListener('click', () => {
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    localStorage.setItem(THEME_KEY, next);
    document.documentElement.setAttribute('data-theme', next);
    paintToggle(next);
  });
}

paintToggle(currentTheme());
