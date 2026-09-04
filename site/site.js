// The "On this page" list is a <details> so phones get a toggle; in the wide
// layout it lives in the margin and should simply be open. CSP forbids
// inline scripts, hence this file.
for (const d of document.querySelectorAll('details.toc')) {
  if (matchMedia('(min-width: 1180px)').matches) d.open = true;
}
