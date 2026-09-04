// CSP forbids inline scripts, hence this file. Two jobs: open the "On this
// page" list in the wide layout where it sits in the margin, and put a copy
// button on every file card, as the reference site does on its examples.
for (const d of document.querySelectorAll('details.toc')) {
  if (matchMedia('(min-width: 1280px)').matches) d.open = true;
}
for (const card of document.querySelectorAll('.file-card')) {
  const pre = card.querySelector('pre');
  const bar = card.querySelector('.bar');
  if (!pre || !bar || !navigator.clipboard) continue;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'copy';
  btn.textContent = 'Copy';
  btn.setAttribute('aria-label', 'Copy this file');
  btn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(pre.textContent);
      btn.textContent = 'Copied';
      setTimeout(() => { btn.textContent = 'Copy'; }, 1500);
    } catch {}
  });
  bar.appendChild(btn);
}
