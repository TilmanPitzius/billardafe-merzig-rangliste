'use strict';

// A real welcome view: no timer, navigation rewrite, account data or storage.
(() => {
  const opening = document.querySelector('#app-opening');
  const shell = document.querySelector('#app-shell');
  const next = document.querySelector('#opening-continue');
  if (!opening || !shell || !next) return;

  let dismissed = false;
  const home = () => ['', '#', '#spielen'].includes(location.hash);
  const dismiss = (focus = false) => {
    if (dismissed) return;
    dismissed = true;
    opening.hidden = true;
    shell.inert = false;
    shell.removeAttribute('inert');
    shell.removeAttribute('aria-hidden');
    document.body.classList.remove('opening-visible');
    if (focus) document.querySelector('main')?.focus({preventScroll: true});
  };
  window.BillardOpening = {
    ready({hasActiveMatch = false, failed = false} = {}) {
      if (hasActiveMatch || failed || !home()) dismiss();
    }
  };
  next.addEventListener('click', () => dismiss(true));
  window.addEventListener('hashchange', () => dismiss());
  window.addEventListener('popstate', () => dismiss());
  window.addEventListener('pageshow', event => { if (event.persisted) dismiss(); });
  document.addEventListener('keydown', event => {
    if (!opening.hidden && event.key === 'Escape') { event.preventDefault(); dismiss(true); }
  });
  if (!home() || window.performance?.getEntriesByType('navigation')[0]?.type === 'back_forward') {
    dismiss();
    return;
  }
  opening.hidden = false;
  shell.inert = true;
  shell.setAttribute('inert', '');
  shell.setAttribute('aria-hidden', 'true');
  document.body.classList.add('opening-visible');
  next.focus({preventScroll: true});
})();
