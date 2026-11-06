const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

/* Chapter 01 opens as a landing page with the course map folded away. The first
   deliberate step — a tab, a sidebar link, or Start Learning — reveals it for
   the rest of the session. */
let hasRevealedSidebar = false;

const tabButtons = () => Array.from(document.querySelectorAll('.tab'));

function activateTab(name) {
  const target = document.getElementById('tab-' + name);
  const order = tabButtons();
  const index = order.findIndex((t) => t.dataset.tab === name);
  if (name !== 'ch01') hasRevealedSidebar = true;

  order.forEach((btn) => {
    const on = btn.dataset.tab === name;
    btn.classList.toggle('active', on);
    btn.setAttribute('aria-selected', on ? 'true' : 'false');
    // Thirteen chapters no longer fit the strip at 1280px; the bar scrolls, so
    // bring the active tab into view when the chapter is opened from the rail.
    if (on) btn.scrollIntoView({ inline: 'nearest', block: 'nearest' });
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
  // so every switch starts the new sheet at its head. `instant` because the page
  // itself glides (html { scroll-behavior: smooth }) and a switch should not.
  window.scrollTo({ top: 0, behavior: 'instant' });

  const layout = document.querySelector('.app-layout');
  if (name === 'ch01' && !hasRevealedSidebar) layout.classList.add('is-landing');
  else layout.classList.remove('is-landing');

  paintView();
  buildTrack();
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

/* ===== scroll reveal =====
   Cards sit in the fog until their top edge reaches the middle band of the
   viewport. 0.7 is that band's lower edge: the same line the observer watches,
   so every state change is caught by a crossing. Above the line a card stays
   clear — text you have already read never fogs again. */
const REVEAL_EDGE = 0.7;
let atDocumentEnd = false;
let revealCards = [];

function revealState(card) {
  if (!card.offsetParent) return; // unrendered: its box is all zeros, so geometry would lie
  card.classList.toggle('is-visible',
    atDocumentEnd || card.getBoundingClientRect().top <= window.innerHeight * REVEAL_EDGE);
}

function paintView() {
  const sheet = document.querySelector('.tab-panels > .panel:not([hidden])');
  const notes = !!sheet && !!sheet.querySelector('article.notes');
  document.body.classList.toggle('fog-on', notes && !atDocumentEnd);
  if (notes) revealCards.forEach(revealState);
}

function initScrollReveal() {
  revealCards = Array.from(document.querySelectorAll('.note-block'));
  if (!revealCards.length) return;
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => revealState(entry.target));
  }, {
    root: null,
    rootMargin: '-30% 0px -30% 0px', // the middle 40% of the viewport
    threshold: 0
  });
  revealCards.forEach((card) => observer.observe(card));
  /* A crossing is reported with the next painted frame, which can land after
     the card has already moved past the line, so re-read wherever the reader
     stops and once a freshly opened sheet finishes sliding in. */
  window.addEventListener('scrollend', paintView, { passive: true });
  document.querySelector('.tab-panels').addEventListener('animationend', paintView);
  window.addEventListener('resize', paintView);
  /* The last row can sit below the band on a tall viewport, so reaching the
     end of the document clears everything and lifts the fog off the footer. */
  window.addEventListener('scroll', () => {
    const end = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
    if (end === atDocumentEnd) return;
    atDocumentEnd = end;
    paintView();
  }, { passive: true });
  window.addEventListener('resize', paintView);
  paintView();
}

/* ===== scroll track =====
   One dot per card in the open sheet. The track is aria-hidden and its dots
   are out of the tab order on purpose: the sidebar already offers every one of
   these jumps to the keyboard, and a second copy would only add stops. */
const track = document.getElementById('scrollTrack');
let trackCards = [];
let trackIndex = -1;
let dotObserver;

function buildTrack() {
  const sheet = document.querySelector('.tab-panels > .panel:not([hidden])');
  trackCards = sheet ? Array.from(sheet.querySelectorAll('.note-block')) : [];
  trackIndex = -1;
  track.innerHTML = '';
  if (!trackCards.length) {
    track.classList.remove('has-dots');
    if (dotObserver) dotObserver.disconnect();
    return;
  }
  track.classList.add('has-dots');
  trackCards.forEach((card, i) => {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'scroll-dot';
    dot.dataset.index = String(i);
    dot.tabIndex = -1;
    track.appendChild(dot);
  });
  // The old dots are gone, so the observer watching the old cards goes with them.
  if (dotObserver) dotObserver.disconnect();
  dotObserver = new IntersectionObserver(markDots, {
    root: null,
    rootMargin: '-45% 0px -45% 0px',
    threshold: 0
  });
  trackCards.forEach((card) => dotObserver.observe(card));
  markDots();
}

function markDots() {
  if (!trackCards.length) return;
  const line = window.innerHeight * 0.5;
  let current = 0;
  trackCards.forEach((card, i) => {
    // One pixel of slack: a card parked exactly on the line has reached it.
    if (card.offsetParent && card.getBoundingClientRect().top <= line + 1) current = i;
  });
  const index = atDocumentEnd ? trackCards.length - 1 : current;
  if (index === trackIndex) return; // only a real change replays the bop
  trackIndex = index;
  Array.from(track.children).forEach((dot, i) => dot.classList.toggle('active', i === index));
}

track.addEventListener('click', (e) => {
  const dot = e.target.closest('.scroll-dot');
  if (!dot) return;
  const card = trackCards[Number(dot.dataset.index)];
  if (!card) return;
  card.scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth', block: 'center' });
});
/* The observer only reports a card as it crosses the midline, so a long jump
   can leave the lit dot one row behind. Reading the position on each scroll
   event is a handful of rect reads and keeps the dot honest wherever the
   reader lands. */
window.addEventListener('scroll', markDots, { passive: true });
window.addEventListener('resize', markDots);

/* The hero stays inside chapter 01: it reveals the course map and lets the
   anchor glide down to the notes on the page's own smooth scroll. */
const heroCta = document.querySelector('.btn-hero');
if (heroCta) {
  heroCta.addEventListener('click', () => {
    hasRevealedSidebar = true;
    document.querySelector('.app-layout').classList.remove('is-landing');
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

/* ---- chapter 01: critical path vs slack ----
   The critical tasks are a chain: a task's shift carries into everything after
   it, so the finish line is always the test task's right edge. Slack never
   touches the finish line. Initial geometry is CSS; this only writes inline
   values while a block moves. */
function initTimeline() {
  const widget = document.getElementById('timelineWidget');
  if (!widget) return;

  const finishLine = document.getElementById('finishLine');
  const statusText = document.getElementById('timelineStatus');
  const nodes = {
    design: widget.querySelector('[data-id="design"]'),
    build: widget.querySelector('[data-id="build"]'),
    test: widget.querySelector('[data-id="test"]'),
    docs: widget.querySelector('[data-id="docs"]')
  };
  if (!finishLine || !statusText || Object.values(nodes).some((n) => !n)) return;

  const plan = {
    design: { left: 0, width: 15 },
    build: { left: 15, width: 35 },
    test: { left: 50, width: 20 },
    docs: { left: 0, width: 30 }
  };
  const chain = ['design', 'build', 'test'];
  const shifts = { design: 0, build: 0, test: 0 };
  const finishAtRest = 70; // test's right edge on the base plan
  const finishRoom = 100 - finishAtRest; // nothing may be pushed off the track
  const slackLimit = 40;

  function placeChain() {
    let carried = 0;
    chain.forEach((id) => {
      carried += shifts[id];
      nodes[id].style.left = plan[id].left + carried + '%';
    });
  }

  function setFinish(delay) {
    const pos = finishAtRest + delay;
    // The percentage must resolve against the block area, not the whole
    // container: 100% here would include the label column a second time.
    const raw = parseFloat(getComputedStyle(widget).getPropertyValue('--track-label'));
    const label = Number.isFinite(raw) ? raw : 100;
    finishLine.style.left = 'calc(' + label + 'px + (100% - ' + label + 'px) * ' + (pos / 100).toFixed(4) + ')';

    if (delay > 0) {
      const weeks = Math.round((delay / 10) * 10) / 10;
      statusText.textContent = 'Project Delayed by ' + weeks + (weeks === 1 ? ' Week!' : ' Weeks!');
      statusText.classList.add('delayed');
    } else {
      statusText.textContent = 'On Schedule';
      statusText.classList.remove('delayed');
    }
  }

  let drag = null;

  function startDrag(e) {
    const block = e.target.closest('.task-block');
    if (!block || !widget.contains(block)) return;
    const point = e.type.indexOf('touch') === 0 ? e.touches[0] : e;

    drag = {
      id: block.dataset.id,
      block,
      critical: block.closest('.track-blocks').dataset.track === 'critical',
      startX: point.clientX,
      startLeft: parseFloat(getComputedStyle(block).left),
      track: block.parentElement.clientWidth
    };
    block.style.zIndex = '10';
    block.style.boxShadow = '0 8px 16px rgba(0, 0, 0, 0.2)';
  }

  function doDrag(e) {
    if (!drag) return;
    if (e.cancelable) e.preventDefault();
    const point = e.type.indexOf('touch') === 0 ? e.touches[0] : e;
    if (!point) return;

    const newLeft = Math.max(0, drag.startLeft + ((point.clientX - drag.startX) / drag.track) * 100);

    if (!drag.critical) {
      drag.block.style.left = Math.min(newLeft, slackLimit) + '%';
      return;
    }

    const id = drag.id;
    const at = chain.indexOf(id);
    const before = chain.slice(0, at).reduce((sum, c) => sum + shifts[c], 0);
    const after = chain.slice(at + 1).reduce((sum, c) => sum + shifts[c], 0);
    shifts[id] = Math.max(0, Math.min(newLeft - plan[id].left - before, finishRoom - before - after));
    placeChain();
    setFinish(shifts.design + shifts.build + shifts.test);
  }

  function endDrag() {
    if (!drag) return;
    drag.block.style.zIndex = '';
    drag.block.style.boxShadow = '';
    drag = null;
  }

  widget.addEventListener('mousedown', startDrag);
  window.addEventListener('mousemove', doDrag);
  window.addEventListener('mouseup', endDrag);
  widget.addEventListener('touchstart', startDrag, { passive: false });
  window.addEventListener('touchmove', doDrag, { passive: false });
  window.addEventListener('touchend', endDrag);
}

paintToggle(currentTheme());
initScrollReveal();
buildTrack();
initTimeline();
