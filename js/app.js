const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

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
      // The circle shows a number, so the step names itself with the full title.
      btn.setAttribute('aria-label', (back ? 'Previous: ' : 'Next: ') + step.getAttribute('aria-label'));
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
  const widget = document.querySelector('.cinematic-timeline');
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

  function setFinish(delay, viaSheet) {
    const pos = finishAtRest + delay;
    // The percentage must resolve against the block area, not the whole
    // container: 100% here would include the label column a second time.
    const value = 'calc(var(--track-label) + (100% - var(--track-label)) * ' + (pos / 100).toFixed(4) + ')';
    if (viaSheet) scrollSheet.replaceSync('#finishLine { left: ' + value + ' }');
    else finishLine.style.left = value;
    widget.classList.toggle('delayed', delay > 0);
    finishLine.querySelector('.finish-label').textContent = delay > 0 ? 'DELAYED' : 'PROJECT FINISH';

    if (delay > 0) {
      const weeks = Math.round((delay / 10) * 10) / 10;
      statusText.textContent = 'Project Delayed by ' + weeks + (weeks === 1 ? ' Week!' : ' Weeks!');
      statusText.classList.add('delayed');
    } else {
      statusText.textContent = 'ON SCHEDULE';
      statusText.classList.remove('delayed');
    }
  }

  let drag = null;
  let dragged = false;

  /* Page scroll sweeps the finish line across the remaining float until the
     visitor takes over by dragging a block. Its position goes through an
     adopted sheet, so scrolling never adds a style attribute to the page. */
  const scrollSheet = new CSSStyleSheet();
  document.adoptedStyleSheets = [...document.adoptedStyleSheets, scrollSheet];

  function scrollFraction() {
    const room = document.documentElement.scrollHeight - window.innerHeight;
    return room > 0 ? Math.min(1, Math.max(0, window.scrollY / room)) : 0;
  }

  function onScroll() {
    const pct = scrollFraction();
    const broken = pct >= 0.99;
    widget.classList.toggle('fourth-wall', broken);
    /* The crack is a screen, not a scene: it lives on <body> so it stays put
       when another chapter owns the viewport. */
    document.body.classList.toggle('fourth-wall', broken);
    if (dragged) return;
    setFinish(pct * finishRoom, true);
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  onScroll();

  function startDrag(e) {
    if (!widget.classList.contains('is-settled')) return;
    const block = e.target.closest('.task-block');
    if (!block || !widget.contains(block)) return;
    dragged = true;
    const point = e.type.indexOf('touch') === 0 ? e.touches[0] : e;

    drag = {
      id: block.dataset.id,
      block,
      critical: block.closest('.track-blocks').dataset.track === 'critical',
      startX: point.clientX,
      startLeft: (parseFloat(getComputedStyle(block).left) / block.parentElement.clientWidth) * 100,
      track: block.parentElement.clientWidth
    };
    block.classList.add('is-dragging');
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
    drag.block.classList.remove('is-dragging');
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

/* ---- cinematic bands: domain expansion ----
   Each band opens its sphere when a third of it is on screen, the title and
   instruments follow on their own transition delays, and the sequence settles
   after five seconds so the dimmed band accepts drags. Leaving re-arms it. */
function initDomainBands() {
  const bands = [...document.querySelectorAll('.cinematic-band')];
  if (!bands.length) return;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const SETTLE_MS = 4000;

  bands.forEach((widget) => {
    let settleTimer = null;

    const settle = () => {
      window.clearTimeout(settleTimer);
      settleTimer = null;
      widget.classList.add('is-settled');
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          widget.classList.add('is-active');
          if (reduced.matches) settle();
          else settleTimer = window.setTimeout(settle, SETTLE_MS);
        } else {
          window.clearTimeout(settleTimer);
          settleTimer = null;
          widget.classList.remove('is-active', 'is-settled');
          // Collapse the reveal without a transition, so re-entry restarts at 0.
          widget.classList.add('is-reset');
          void widget.offsetWidth;
          widget.classList.remove('is-reset');
        }
      });
    }, {
      threshold: 0.3
    });

    reduced.addEventListener('change', () => {
      if (reduced.matches && widget.classList.contains('is-active')) settle();
    });

    observer.observe(widget);
  });
}

initDomainBands();

/* ---- cinematic bands: particle field ----
   Fifty drifting motes over the sphere. Dark keeps the neon dust; light swaps
   to gold four-point flares that twinkle on a sine. The loop only runs while
   the band is on screen and uncovered, and a reduced-motion visitor gets one
   still frame. */
const flareSprites = new Map();

function flareSprite(colour) {
  if (flareSprites.has(colour)) return flareSprites.get(colour);

  const SIZE = 64;
  const sprite = document.createElement('canvas');
  sprite.width = sprite.height = SIZE;
  const g = sprite.getContext('2d');
  const h = SIZE / 2;

  // The halo is broad and soft; the spikes below carry the shape.
  const glow = g.createRadialGradient(h, h, 0, h, h, h);
  glow.addColorStop(0, 'rgba(255, 252, 240, 0.85)');
  glow.addColorStop(0.18, 'rgba(' + colour + ', 0.55)');
  glow.addColorStop(0.5, 'rgba(' + colour + ', 0.12)');
  glow.addColorStop(1, 'rgba(' + colour + ', 0)');
  g.fillStyle = glow;
  g.fillRect(0, 0, SIZE, SIZE);

  // Concave sides are what read as a flare rather than a diamond.
  const reach = h * 0.96;
  const waist = h * 0.1;
  g.beginPath();
  g.moveTo(h, h - reach);
  g.quadraticCurveTo(h + waist, h - waist, h + reach, h);
  g.quadraticCurveTo(h + waist, h + waist, h, h + reach);
  g.quadraticCurveTo(h - waist, h + waist, h - reach, h);
  g.quadraticCurveTo(h - waist, h - waist, h, h - reach);
  g.closePath();
  g.fillStyle = 'rgba(' + colour + ', 0.92)';
  g.fill();

  g.beginPath();
  g.arc(h, h, waist, 0, Math.PI * 2);
  g.fillStyle = 'rgba(255, 252, 240, 0.95)';
  g.fill();

  flareSprites.set(colour, sprite);
  return sprite;
}

function initField(canvas, widget, looks, occluder) {
  if (!canvas || !widget || !canvas.getContext) return;

  const ctx = canvas.getContext('2d');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const COUNT = 50; // per field; three fields stay far under the 500 budget
  const particles = [];
  let width = 0, height = 0, raf = null, stamp = 0.8;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = canvas.offsetWidth;
    height = canvas.offsetHeight;
    // A hidden sheet measures nothing; the field sizes itself on entry instead.
    if (!width || !height) return false;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return true;
  }

  for (let i = 0; i < COUNT; i++) {
    particles.push({
      x: Math.random(), y: Math.random(),
      radius: Math.random() * 2 + 1,
      speedX: (Math.random() - 0.5) * 0.5,
      speedY: (Math.random() - 0.5) * 0.5,
      opacity: Math.random() * 0.5 + 0.1,
      // Per-star phase and rate keep the twinkle from pulsing in lockstep.
      phase: Math.random() * Math.PI * 2,
      rate: 0.8 + Math.random() * 1.6
    });
  }

  function covered() {
    return !!occluder && occluder.getBoundingClientRect().top <= 0;
  }

  function paint(time) {
    if (!width || !height || covered()) return;
    stamp = time;
    const light = currentTheme() === 'light';
    const look = light ? looks.light : looks.dark;
    const sprite = light ? flareSprite(look.colour) : null;

    ctx.clearRect(0, 0, width, height);
    particles.forEach((p) => {
      const x = p.x * width, y = p.y * height;
      if (sprite) {
        // 0.3 → 1.0, the range the light field was specified at.
        const alpha = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(time * p.rate + p.phase));
        const size = 6 + p.radius * 5;
        ctx.globalAlpha = alpha;
        ctx.drawImage(sprite, x - size / 2, y - size / 2, size, size);
      } else {
        ctx.beginPath();
        ctx.arc(x, y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(' + look.colour + ', ' + p.opacity + ')';
        ctx.shadowColor = 'rgba(' + look.colour + ', 0.9)';
        ctx.shadowBlur = 12;
        ctx.fill();
      }
    });
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  }

  function step(now) {
    if (!width && !resize()) { raf = requestAnimationFrame(step); return; }
    if (!covered()) {
      particles.forEach((p) => {
        p.x += p.speedX / width;
        p.y += p.speedY / height;
        if (p.x < 0) p.x = 1;
        if (p.x > 1) p.x = 0;
        if (p.y < 0) p.y = 1;
        if (p.y > 1) p.y = 0;
      });
      paint(now / 1000);
    }
    raf = requestAnimationFrame(step);
  }

  function start() {
    if (raf !== null) return;
    resize();
    if (reduced.matches) { paint(stamp); return; }
    raf = requestAnimationFrame(step);
  }

  function stop() {
    if (raf === null) return;
    cancelAnimationFrame(raf);
    raf = null;
  }

  resize();
  paint(stamp);

  new IntersectionObserver((entries) => {
    entries.forEach((entry) => (entry.isIntersecting ? start() : stop()));
  }, { threshold: 0.05 }).observe(widget);

  window.addEventListener('resize', () => { resize(); if (raf === null) paint(stamp); });
  reduced.addEventListener('change', () => { stop(); start(); });
  // The toggle swaps the attribute inside a view transition; repaint at once so
  // the captured frame already carries the new palette.
  new MutationObserver(() => { if (raf === null) paint(stamp); })
    .observe(document.documentElement, { attributeFilter: ['data-theme'] });
}

/* ---- chapter 03: the core ----
   A wireframe icosahedron on a 2D canvas: it turns on its own, and the scroll
   through the hold adds half a revolution and a push toward the camera. The
   notes sheet rides over it, so the scene stops painting once covered. */
function initCh03Scene() {
  const widget = document.getElementById('ch03Scene');
  const canvas = document.getElementById('ch03Core');
  if (!widget || !canvas || !canvas.getContext) return;

  const ctx = canvas.getContext('2d');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const hold = widget.closest('.band-hold') || widget;
  const sheet = document.querySelector('.ch03-sheet');

  const PHI = (1 + Math.sqrt(5)) / 2;
  const scale = Math.sqrt(1 + PHI * PHI);
  const verts = [
    [-1, PHI, 0], [1, PHI, 0], [-1, -PHI, 0], [1, -PHI, 0],
    [0, -1, PHI], [0, 1, PHI], [0, -1, -PHI], [0, 1, -PHI],
    [PHI, 0, -1], [PHI, 0, 1], [-PHI, 0, -1], [-PHI, 0, 1]
  ].map(([x, y, z]) => [x / scale, y / scale, z / scale]);

  const edges = [];
  let nearest = Infinity;
  const gap = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  for (let i = 0; i < verts.length; i++) {
    for (let j = i + 1; j < verts.length; j++) {
      nearest = Math.min(nearest, gap(verts[i], verts[j]));
    }
  }
  for (let i = 0; i < verts.length; i++) {
    for (let j = i + 1; j < verts.length; j++) {
      if (Math.abs(gap(verts[i], verts[j]) - nearest) < 1e-6) edges.push([i, j]);
    }
  }

  let cw = 0, ch = 0, raf = null, onScreen = false;

  function fit() {
    const w = canvas.offsetWidth;
    const h = canvas.offsetHeight;
    if (!w || !h) return false;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (w !== cw || h !== ch) {
      cw = w;
      ch = h;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    return true;
  }

  function progress() {
    const rect = hold.getBoundingClientRect();
    const span = rect.height - window.innerHeight;
    return span > 0 ? Math.min(1, Math.max(0, -rect.top / span)) : 0;
  }

  function covered() {
    return !!sheet && sheet.getBoundingClientRect().top <= 0;
  }

  function draw(time) {
    if (!fit() || covered()) return;

    const t = reduced.matches ? 0 : time;
    const p = reduced.matches ? 0.28 : progress();
    const rx = 0.42 + t * 0.12 + p * Math.PI * 0.85;
    const ry = -0.3 + t * 0.17 + p * Math.PI * 2;
    const radius = Math.min(cw, ch) * 0.24 * (1 + p * 1.55);
    const cx = cw / 2;
    const cy = ch * 0.42;
    const fov = 4.6;
    const cosX = Math.cos(rx), sinX = Math.sin(rx);
    const cosY = Math.cos(ry), sinY = Math.sin(ry);

    const pts = verts.map(([x, y, z]) => {
      const X = x * cosY - z * sinY;
      const Z1 = x * sinY + z * cosY;
      const Y = y * cosX - Z1 * sinX;
      const Z = y * sinX + Z1 * cosX;
      const k = fov / (fov - Z);
      return { x: cx + X * radius * k, y: cy + Y * radius * k, z: Z, k };
    });

    const light = currentTheme() === 'light';
    const ink = light ? '154, 92, 10' : '167, 139, 250';
    const accent = light ? '217, 119, 6' : '34, 211, 238';

    ctx.clearRect(0, 0, cw, ch);
    edges.forEach(([i, j], index) => {
      const a = pts[i], b = pts[j];
      const depth = (a.z + b.z) / 2; // -1 back … 1 front
      const alpha = 0.16 + 0.55 * ((depth + 1) / 2);
      ctx.strokeStyle = 'rgba(' + (index % 5 === 0 ? accent : ink) + ', ' + alpha.toFixed(3) + ')';
      ctx.lineWidth = depth > 0 ? 1.4 : 0.8;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    });

    pts.forEach((pt) => {
      const alpha = 0.22 + 0.55 * ((pt.z + 1) / 2);
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 1.5 * pt.k, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(' + accent + ', ' + alpha.toFixed(3) + ')';
      ctx.fill();
    });
  }

  function frame(now) {
    draw(now / 1000);
    raf = requestAnimationFrame(frame);
  }

  function still() {
    draw(performance.now() / 1000);
  }

  function start() {
    if (raf !== null || reduced.matches) return;
    raf = requestAnimationFrame(frame);
  }

  function stop() {
    if (raf === null) return;
    cancelAnimationFrame(raf);
    raf = null;
  }

  new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      onScreen = entry.isIntersecting;
      if (!onScreen) { stop(); return; }
      if (reduced.matches) still();
      else start();
    });
  }, { threshold: 0.05 }).observe(widget);

  window.addEventListener('resize', () => { if (raf === null) still(); });
  reduced.addEventListener('change', () => {
    stop();
    if (!onScreen) return;
    if (reduced.matches) still();
    else start();
  });
  new MutationObserver(() => { if (raf === null && onScreen) still(); })
    .observe(document.documentElement, { attributeFilter: ['data-theme'] });

  /* Hand the frame to the notes sheet before it starts clipping the title. */
  function veil() {
    if (!sheet) return;
    const height = ch || canvas.offsetHeight;
    widget.classList.toggle('is-veiled', height > 0 && sheet.getBoundingClientRect().top < height * 0.55);
  }
  window.addEventListener('scroll', veil, { passive: true });
  window.addEventListener('resize', veil);

  still();
  veil();
}

/* ---- chapter 01: parallax tilt ----
   The tracks ride a plane that leans toward the pointer and eases with scroll.
   The transform lives in an adopted sheet, so no element gains a style attribute. */
function init3DTilt() {
  const wrapper = document.getElementById('tiltWrapper');
  const section = document.getElementById('timelineWidget');
  if (!wrapper || !section) return;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const sheet = new CSSStyleSheet();
  document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
  const clamp = (n) => Math.max(-1, Math.min(1, n));
  const pointer = { x: 0, y: 0 };
  let scrollLean = 0;
  let queued = false;

  function apply() {
    queued = false;
    const rx = Math.max(-6, Math.min(6, -(pointer.y * 5 + scrollLean * 2)));
    const ry = Math.max(-6, Math.min(6, pointer.x * 5));
    sheet.replaceSync('#tiltWrapper{transform:rotateX(' + rx.toFixed(2) + 'deg) rotateY(' + ry.toFixed(2) + 'deg)}');
  }

  function queue() {
    if (queued || reduced.matches) return;
    queued = true;
    requestAnimationFrame(apply);
  }

  function measureScroll() {
    const r = section.getBoundingClientRect();
    scrollLean = clamp(((r.top + r.height / 2) - window.innerHeight / 2) / window.innerHeight);
  }

  section.addEventListener('mousemove', (e) => {
    if (reduced.matches) return;
    const r = section.getBoundingClientRect();
    pointer.x = clamp(((e.clientX - r.left) / r.width - 0.5) * 2);
    pointer.y = clamp(((e.clientY - r.top) / r.height - 0.5) * 2);
    queue();
  });

  section.addEventListener('mouseleave', () => {
    pointer.x = 0;
    pointer.y = 0;
    queue();
  });

  window.addEventListener('scroll', () => {
    if (reduced.matches) return;
    measureScroll();
    queue();
  }, { passive: true });

  window.addEventListener('resize', queue);
  reduced.addEventListener('change', () => {
    pointer.x = 0; pointer.y = 0; scrollLean = 0;
    sheet.replaceSync('');
  });

  measureScroll();
}

initField(document.getElementById('particleCanvas'), document.getElementById('timelineWidget'), {
  dark: { colour: '167, 139, 250' },
  light: { colour: '217, 119, 6' }
});
initField(document.getElementById('scaleCanvas'), document.getElementById('scaleWidget'), {
  dark: { colour: '52, 211, 153' },
  light: { colour: '217, 119, 6' }
});
initField(document.getElementById('ch03Canvas'), document.getElementById('ch03Scene'), {
  dark: { colour: '167, 139, 250' },
  light: { colour: '217, 119, 6' }
}, document.querySelector('.ch03-sheet'));
initCh03Scene();
init3DTilt();

/* ---- chapter 02: the selection matrix ----
   Bar heights are dynamic, so they cannot live in layout.css. They go through a
   constructable stylesheet instead of inline styles: the zero-inline-style
   contract holds, and reusing the bar elements keeps the grow transition alive
   between slider moves. */
function initScale() {
  const widget = document.getElementById('scaleWidget');
  if (!widget) return;

  const weights = {
    cost: document.getElementById('weight-cost'),
    time: document.getElementById('weight-time'),
    risk: document.getElementById('weight-risk')
  };
  const displays = {
    cost: document.getElementById('val-cost'),
    time: document.getElementById('val-time'),
    risk: document.getElementById('val-risk')
  };
  const bars = document.getElementById('equalizerBars');
  if (!weights.cost || !weights.time || !weights.risk || !bars) return;

  // Fixed project scores (1-10)
  const projects = [
    { name: 'A', scores: { cost: 6, time: 3, risk: 4 } },
    { name: 'B', scores: { cost: 4, time: 8, risk: 2 } },
    { name: 'C', scores: { cost: 8, time: 5, risk: 6 } }
  ];

  const sheet = new CSSStyleSheet();
  document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];

  const columns = projects.map((project) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'eq-bar-wrapper';
    wrapper.dataset.project = project.name;

    const bar = document.createElement('div');
    bar.className = 'eq-bar';

    const points = document.createElement('span');
    points.className = 'eq-points';

    const label = document.createElement('div');
    label.className = 'eq-label';
    label.textContent = project.name;

    bar.appendChild(points);
    wrapper.append(bar, label);
    bars.appendChild(wrapper);
    return { wrapper, bar, points };
  });

  function calculate() {
    const w = {
      cost: parseInt(weights.cost.value, 10),
      time: parseInt(weights.time.value, 10),
      risk: parseInt(weights.risk.value, 10)
    };

    // Max possible points to normalise the bars (10 * 10 * 3 = 300)
    const maxPoints = (w.cost + w.time + w.risk) * 10;

    const scores = projects.map((p) => {
      const points = p.scores.cost * w.cost + p.scores.time * w.time + p.scores.risk * w.risk;
      return { name: p.name, points, percentage: (points / maxPoints) * 100 };
    });

    const winner = scores.reduce((prev, current) => (prev.points > current.points ? prev : current));

    sheet.replaceSync(
      scores
        .map((s) => '.eq-bar-wrapper[data-project="' + s.name + '"] .eq-bar{height:' + s.percentage.toFixed(2) + '%}')
        .join('\n')
    );

    columns.forEach((column, i) => {
      const isWinner = scores[i].name === winner.name;
      column.wrapper.classList.toggle('winner', isWinner);
      column.bar.classList.toggle('winner', isWinner);
      column.points.textContent = Math.round(scores[i].points) + ' pts';
    });

    Object.keys(displays).forEach((key) => {
      if (displays[key]) displays[key].textContent = String(w[key]);
    });
  }

  Object.values(weights).forEach((input) => input.addEventListener('input', calculate));

  calculate();
}

initScale();

/* ---- chapter 04: work breakdown structure ----
   One delegated click handler toggles any node's target; the CSS owns the
   horizontal collapse and the shatter stagger, this only flips state.
   data-wbs-target, not data-target: the tab rail already owns that attribute. */
function initWBS() {
  const widget = document.getElementById('wbsWidget');
  if (!widget) return;

  widget.querySelectorAll('.wbs-node[data-wbs-target]').forEach((btn) => {
    btn.setAttribute('aria-expanded', 'false');
    if (document.getElementById(btn.dataset.wbsTarget)) btn.setAttribute('aria-controls', btn.dataset.wbsTarget);
  });

  widget.addEventListener('click', (e) => {
    const btn = e.target.closest('.wbs-node');
    if (!btn || !btn.dataset.wbsTarget) return;

    const targetContainer = document.getElementById(btn.dataset.wbsTarget);
    if (!targetContainer) return;

    const isOpen = targetContainer.classList.toggle('is-open');
    btn.setAttribute('aria-expanded', String(isOpen));
  });

  // Open the first level on load, after the page has settled, so it animates in.
  const level1 = document.getElementById('level1');
  if (level1) {
    setTimeout(() => {
      level1.classList.add('is-open');
      const root = widget.querySelector('.wbs-node[data-wbs-target="level1"]');
      if (root) root.setAttribute('aria-expanded', 'true');
    }, 500);
  }
}

initWBS();

/* ---- course map: out of the way while an introduction is on screen ----
   The rail is a chapter index, so it waits for the notes. The hero and every
   cinematic band hold it back; on a plain sheet neither element is rendered,
   so the observer reports them off-screen and the map appears. */
function initSidebarRetract() {
  const sidebar = document.querySelector('.sidebar');
  if (!sidebar) return;
  const zones = [...document.querySelectorAll('.hero-section, .cinematic-band')];
  if (!zones.length) return;

  const onScreen = new Set();
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) onScreen.add(entry.target);
      else onScreen.delete(entry.target);
    });
    sidebar.classList.toggle('is-retracted', onScreen.size > 0);
  }, {
    // The last 100px of the viewport does not count as "looking at" the intro.
    rootMargin: '0px 0px -100px 0px',
    threshold: 0.1
  });

  zones.forEach((zone) => observer.observe(zone));
}

initSidebarRetract();
