// CSP forbids inline scripts, hence this file. Two jobs: open the "On this
// page" list in the wide layout where it sits in the margin, and put a copy
// button on every file card, as the reference site does on its examples.
for (const d of document.querySelectorAll('details.toc')) {
  if (matchMedia('(min-width: 1280px)').matches) d.open = true;
}
const COPY_ICON = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
const DONE_ICON = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';
// The install line gets the same button; its text is the command alone.
for (const inst of document.querySelectorAll('.install')) {
  const code = inst.querySelector('code');
  if (!code || !navigator.clipboard) continue;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'copy';
  btn.innerHTML = COPY_ICON;
  btn.title = 'Copy the command';
  btn.setAttribute('aria-label', 'Copy the command');
  btn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(code.textContent.trim());
      btn.innerHTML = DONE_ICON;
      btn.classList.add('done');
      setTimeout(() => { btn.innerHTML = COPY_ICON; btn.classList.remove('done'); }, 1500);
    } catch {}
  });
  inst.appendChild(btn);
}
for (const card of document.querySelectorAll('.file-card')) {
  const pre = card.querySelector('pre');
  const bar = card.querySelector('.bar');
  if (!pre || !bar || !navigator.clipboard) continue;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'copy';
  btn.innerHTML = COPY_ICON;
  btn.title = 'Copy this file';
  btn.setAttribute('aria-label', 'Copy this file');
  btn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(pre.textContent);
      btn.innerHTML = DONE_ICON;
      btn.classList.add('done');
      setTimeout(() => { btn.innerHTML = COPY_ICON; btn.classList.remove('done'); }, 1500);
    } catch {}
  });
  bar.appendChild(btn);
}
