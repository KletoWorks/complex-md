// CSP forbids inline scripts, hence this file. It opens the "On this page"
// list in the wide layout, puts a copy button on every command and file
// card, and runs the home page's motion and map card. Every element it
// works on is complete in the markup, so a page without this script reads
// the same, only still.
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const canObserve = 'IntersectionObserver' in window;

for (const d of document.querySelectorAll('details.toc')) {
  if (matchMedia('(min-width: 1280px)').matches) d.open = true;
}

// ------------------------------------------------------------ copy buttons
const COPY_ICON = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
const DONE_ICON = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';

/** A button that copies what text() returns. Where the clipboard is not
 *  available, it selects the text so the visitor can copy it. */
function copyButton(label, text, selectable) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'copy';
  btn.innerHTML = COPY_ICON;
  btn.title = label;
  btn.setAttribute('aria-label', label);
  btn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(text());
      btn.innerHTML = DONE_ICON;
      btn.classList.add('done');
      btn.setAttribute('aria-label', 'Copied');
      setTimeout(() => { btn.innerHTML = COPY_ICON; btn.classList.remove('done'); btn.setAttribute('aria-label', label); }, 1500);
    } catch {
      const range = document.createRange();
      range.selectNodeContents(selectable);
      const sel = getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }
  });
  return btn;
}
// The install line's text is the command alone.
for (const inst of document.querySelectorAll('.install')) {
  const code = inst.querySelector('code');
  if (code) inst.appendChild(copyButton('Copy the command', () => code.textContent.trim(), code));
}
for (const card of document.querySelectorAll('.file-card')) {
  const pre = card.querySelector('pre');
  const bar = card.querySelector('.bar');
  if (pre && bar) bar.appendChild(copyButton('Copy this file', () => pre.textContent, pre));
}

// ------------------------------------------------------------------ reveal
// A block that starts below the fold waits, hidden, and shows as it scrolls
// in. A block already on screen is left alone, so nothing flickers.
if (!reduce && canObserve) {
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      e.target.classList.remove('wait');
      io.unobserve(e.target);
    }
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
  for (const el of document.querySelectorAll('main .rv, main .term, main .proof, main .tm')) {
    if (el.getBoundingClientRect().top < innerHeight) continue;
    el.classList.add('wait');
    // The proof dots fill one after another.
    el.querySelectorAll('.dots i').forEach((dot, k) => { dot.style.transitionDelay = `${k * 45}ms`; });
    io.observe(el);
  }
}

// ---------------------------------------------------------------- map card
// One hot file at a time: its directive and partners, while the card is on
// screen. Hover or focus pauses the cycle, and a selected tile stops it.
const demo = document.getElementById('demo');
if (demo) {
  const DUR = 5200;
  const tm = demo.querySelector('.tm');
  const reads = demo.querySelector('.reads');
  const prog = demo.querySelector('.prog');
  const bar = prog && prog.querySelector('i');
  const tiles = [...demo.querySelectorAll('.tile')];
  const panels = [...demo.querySelectorAll('.panel')];
  const cycle = (demo.dataset.cycle || '').split(' ').filter(Boolean);
  let pos = 0;
  let timer = null;
  let visible = !canObserve;
  let hold = false;
  let paused = false;

  for (const t of tiles) {
    t.setAttribute('role', 'button');
    t.setAttribute('tabindex', '0');
    t.setAttribute('aria-label', t.querySelector('title').textContent);
    t.setAttribute('aria-controls', `hot-${t.dataset.i}`);
    t.setAttribute('aria-pressed', 'false');
  }

  // The tiles assemble once. When the last one lands, the treemap is built
  // and its animation is removed, so a resize does not replay it.
  tm.addEventListener('animationend', (e) => {
    if (e.animationName !== 'assemble') return;
    const running = tm.getAnimations ? tm.getAnimations({ subtree: true }).some((a) => a.animationName === 'assemble') : false;
    if (!running) tm.classList.add('built');
  });

  const show = (i) => {
    for (const p of panels) {
      const on = p.dataset.i === i;
      if (on && p.hidden && !reduce) { p.classList.remove('swap'); void p.offsetWidth; p.classList.add('swap'); }
      p.hidden = !on;
    }
    for (const t of tiles) {
      const on = t.dataset.i === i;
      t.classList.toggle('on', on);
      t.setAttribute('aria-pressed', String(on));
    }
    tm.classList.add('has-active');
  };
  const restartBar = () => {
    if (!bar) return;
    bar.classList.remove('run');
    void bar.offsetWidth;
    bar.classList.add('run');
  };
  const stop = () => { clearInterval(timer); timer = null; };
  const start = () => {
    stop();
    if (reduce || hold || paused || !visible || document.hidden || cycle.length < 2) return;
    prog.classList.add('on');
    restartBar();
    timer = setInterval(() => {
      pos = (pos + 1) % cycle.length;
      show(cycle[pos]);
      restartBar();
    }, DUR);
  };
  const select = (t) => {
    hold = true;
    stop();
    if (prog) prog.classList.remove('on');
    // Announce a panel the visitor asked for; the cycle stays quiet.
    reads.setAttribute('aria-live', 'polite');
    show(t.dataset.i);
    const c = cycle.indexOf(t.dataset.i);
    if (c >= 0) pos = c;
  };
  for (const t of tiles) {
    t.addEventListener('click', () => select(t));
    t.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(t); }
    });
  }
  const pause = () => { paused = true; demo.classList.add('paused'); stop(); };
  const resume = () => { paused = false; demo.classList.remove('paused'); start(); };
  demo.addEventListener('mouseenter', pause);
  demo.addEventListener('mouseleave', () => { if (!demo.contains(document.activeElement)) resume(); });
  demo.addEventListener('focusin', pause);
  demo.addEventListener('focusout', (e) => { if (!demo.contains(e.relatedTarget) && !demo.matches(':hover')) resume(); });
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));

  if (cycle.length) show(cycle[0]);
  if (canObserve) {
    new IntersectionObserver((entries) => {
      for (const e of entries) {
        visible = e.isIntersecting;
        if (visible) start(); else stop();
      }
    }, { threshold: 0.35 }).observe(demo);
  } else start();
}
