const tabButtons = () => Array.from(document.querySelectorAll('.tab'));

function activateTab(name) {
  const target = document.getElementById('tab-' + name);
  const order = tabButtons();
  const index = order.findIndex((t) => t.dataset.tab === name);

  order.forEach((btn) => {
    const on = btn.dataset.tab === name;
    btn.classList.toggle('active', on);
    btn.setAttribute('aria-selected', on ? 'true' : 'false');
  });

  document.querySelectorAll('.sidebar-link').forEach((link) => {
    const on = link.dataset.target === name;
    link.classList.toggle('active', on);
    if (on) link.setAttribute('aria-current', 'true');
    else link.removeAttribute('aria-current');
    // Chapter 03 keeps a lit parent while its nested tool is the open sheet.
    link.classList.toggle('active-parent', !on && name === 'ch03-tool' && link.dataset.target === 'ch03');
  });

  document.querySelectorAll('.tab-panels > .panel').forEach((panel) => {
    panel.classList.remove('active');
    panel.hidden = panel !== target;
  });

  // The steps either side of this sheet in tab order; the ends have one fewer.
  target.querySelectorAll('.btn-nav').forEach((btn) => {
    const back = btn.dataset.direction === 'prev';
    const step = back ? order[index - 1] : order[index + 1];
    btn.classList.toggle('hidden', !step);
    if (step) {
      btn.dataset.target = step.dataset.tab;
      btn.setAttribute('aria-label', (back ? 'Previous: ' : 'Next: ') + step.textContent.trim());
    } else {
      delete btn.dataset.target;
      btn.removeAttribute('aria-label');
    }
  });

  void target.offsetWidth; // reflow between remove and add, so the entrance animation replays
  target.classList.add('active');

  // Panels are read top-down, and the Next button lives at the bottom of one,
  // so every switch starts the new sheet at its head.
  window.scrollTo(0, 0);
}

/* The sidebar is hand-written in index.html because it nests the scorecard
   under chapter 03; only the shared [data-target] contract is wired here. */
document.querySelector('.tabbar').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-tab]');
  if (btn) activateTab(btn.dataset.tab);
});

document.addEventListener('click', (e) => {
  const link = e.target.closest('[data-target]');
  if (!link) return;
  if (link.tagName === 'A') e.preventDefault(); // the href is the keyboard / middle-click affordance
  activateTab(link.dataset.target);
});

/* The hero stays inside chapter 01: it walks the reader down to the notes. */
const heroCta = document.querySelector('.btn-hero');
if (heroCta) {
  heroCta.addEventListener('click', (e) => {
    const sheet = document.getElementById('notes-start');
    if (!sheet) return;
    e.preventDefault();
    sheet.scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth', block: 'start' });
  });
}

const firstTab = document.querySelector('.tab');
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

function applyTheme(theme) {
  localStorage.setItem(THEME_KEY, theme);
  document.documentElement.setAttribute('data-theme', theme);
  paintToggle(theme);
}

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let wipes = 0;

if (themeToggle) {
  themeToggle.addEventListener('click', () => {
    const next = currentTheme() === 'dark' ? 'light' : 'dark';

    // The wipe animates a snapshot, so it needs the API and motion permission;
    // without either, the theme simply swaps.
    if (reduceMotion.matches || typeof document.startViewTransition !== 'function') {
      applyTheme(next);
      return;
    }

    wipes += 1;
    document.documentElement.classList.add('theme-wipe');
    const transition = document.startViewTransition(() => applyTheme(next));
    // Starting a new wipe skips the running one, which rejects with AbortError.
    // The callback already swapped the theme, so only the cleanup matters.
    transition.ready.catch(() => {});
    transition.finished
      .catch(() => {})
      .finally(() => {
        wipes -= 1;
        if (wipes === 0) document.documentElement.classList.remove('theme-wipe');
      });
  });
}

paintToggle(currentTheme());
