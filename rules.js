'use strict';

(() => {
  // Verified source metadata supplied for this release. Only links: no PDF copy or proxy.
  const BOOK = Object.freeze({
    url: 'https://billard-union.net/anhang.php?p=8a17c9989ee8e20866752d0adea62caeb994d255d0bbaad18db3520848350176',
    listing: 'https://billard-union.net/downloads.php?p=10-20-37--',
    version: '1.2', stand: '01.08.2026', listed: '28.08.2026', pages: 47
  });
  const DISCIPLINES = Object.freeze({
    '8': Object.freeze({label: '8-Ball', page: 17}),
    '9': Object.freeze({label: '9-Ball', page: 20}),
    '10': Object.freeze({label: '10-Ball', page: 22}),
    '14': Object.freeze({label: '14/1', page: 24})
  });
  const SECTIONS = Object.freeze({...DISCIPLINES, general: {label: 'Allgemeine Regeln', page: 6}, fouls: {label: 'Fouls', page: 14}});
  const FORMATS = {1: {label: 'Einzelnes Spiel', wins: 1}, 3: {label: '3er Satz', wins: 2}, 5: {label: '3er Satz', wins: 3}, 7: {label: '5er Satz', wins: 4}};
  const VARIANTS = {
    aufnahme: {label: 'Aufnahmewechsel', definition: 'Ein Partner spielt die gesamte Aufnahme. Bei der nächsten Teamaufnahme wechselt der Partner.'},
    stoss: {label: 'Stoßwechsel', definition: 'Die Partner wechseln sich bei jedem Stoß innerhalb der Aufnahme ab.'}
  };
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const originalURL = section => `${BOOK.url}#page=${SECTIONS[section].page}`;
  const hasDiscipline = key => Object.hasOwn(DISCIPLINES, key);
  const sectionForPool = pool => ({'8-single': '8', '8-double': '8', '9-single': '9', '10-single': '10', '14-single': '14'}[pool]);
  const dialog = document.querySelector('#rules-dialog');
  const content = document.querySelector('#rules-dialog-content');
  const title = document.querySelector('#rules-dialog-title');
  const closeButton = document.querySelector('#rules-close');
  let modal = null;
  let pointerFocus = null;
  let sequence = 0;

  function sourceMetadata() {
    return `<p class="rules-source">Deutsche Billard-Union · deutsches Original<br>Stand ${BOOK.stand} · Version ${BOOK.version} · ${BOOK.pages} PDF-Seiten<br>Offizielle Listung des Anhangs: ${BOOK.listed}</p>`;
  }
  function renderPage(selected = '8') {
    const key = hasDiscipline(selected) ? selected : '8';
    const discipline = DISCIPLINES[key];
    return `<div class="narrow rules-page"><div class="page-heading"><p class="eyebrow">Am Tisch nachschlagen</p><h1>Regeln</h1><p class="muted">Das offizielle DBU-Regelwerk. Direkt beim passenden Abschnitt.</p></div><section aria-labelledby="rules-select-title"><h2 id="rules-select-title">Welche Disziplin?</h2><div class="choices rules-disciplines">${Object.entries(DISCIPLINES).map(([id, item]) => `<button class="choice" type="button" data-rules-discipline="${id}" aria-pressed="${id === key}"><strong>${item.label}</strong><small>PDF-Seite ${item.page}</small></button>`).join('')}</div><div class="panel rules-selected"><p class="eyebrow">Ausgewählter Abschnitt</p><h2>${discipline.label}</h2><p class="muted">Ab PDF-Seite ${discipline.page} im gemeinsamen DBU-Regelwerk.</p><button class="btn primary full" type="button" data-rules-section="${key}" aria-haspopup="dialog" aria-controls="rules-dialog">Original im Overlay öffnen <span aria-hidden="true">↗</span></button><p class="hint">Die App bleibt geöffnet. Zurück bringt dich an dieselbe Stelle.</p></div></section><section class="panel rules-origin" aria-labelledby="rules-source-title"><h2 id="rules-source-title">Ein Original. Vier Disziplinen.</h2><p>Alle vier Disziplinen stehen im selben unveränderten deutschen DBU-Originaldokument. Die Seitenangaben beziehen sich auf die PDF-Seitenzählung.</p>${sourceMetadata()}<a class="rules-source-link" href="${escape(BOOK.listing)}" target="_blank" rel="noopener noreferrer">Offizielle DBU-Downloadliste öffnen ↗</a><p class="hint">Das Dokument wird direkt von billard-union.net geladen. Zum Lesen ist eine Internetverbindung erforderlich.</p><div class="actions compact"><button class="btn small" type="button" data-rules-section="general" aria-haspopup="dialog">Allgemeine Regeln · Seite 6</button><button class="btn small" type="button" data-rules-section="fouls" aria-haspopup="dialog">Fouls · Seite 14</button></div></section><aside class="callout"><p><strong>Café-/App-Absprachen</strong><br>Die BO-Formate, die beiden Doppel-Wechselarten und unsere Ranglistenwertung sind eigene Absprachen im Billardcafé Merzig. Sie werden getrennt vom offiziellen DBU-Buch angezeigt.</p><a href="#profil/hilfe">Café-Wertung &amp; Formate nachlesen</a></aside></div>`;
  }
  function matchAgreements(match) {
    if (!match) return '';
    const format = FORMATS[match.best_of];
    const discipline = match.pool === '8-double' ? '8-Ball Doppel' : DISCIPLINES[sectionForPool(match.pool)]?.label;
    const variant = match.pool === '8-double' ? VARIANTS[match.variant] : null;
    return `<section class="rules-agreements" aria-labelledby="rules-agreements-title"><p class="eyebrow">Für diese Partie · Café-/App-Absprachen</p><h3 id="rules-agreements-title">${escape(discipline)}</h3><p><strong>${escape(format?.label || 'Format nicht verfügbar')}</strong>${format ? ` · BO${escape(match.best_of)} · zuerst ${format.wins} ${format.wins === 1 ? 'Sieg' : 'Siege'}` : ''}${match.pool === '14-single' ? `<br>Punkteziel je Runde: ${escape(match.points_target)}` : ''}</p>${variant ? `<p><strong>${variant.label}</strong><br>${variant.definition}</p>` : match.pool === '8-double' ? '<p>Die Wechselart ist im geladenen Partiestand nicht verfügbar.</p>' : ''}<p class="hint">Diese Partieabsprachen gehören zur Café-/App-Wertung. Sie sind kein Bestandteil des verlinkten offiziellen DBU-Originaldokuments.</p></section>`;
  }
  function focusSnapshot(element = document.activeElement) {
    return {element, selection: element && typeof element.selectionStart === 'number' ? [element.selectionStart, element.selectionEnd] : null};
  }
  function open(section, {match = null, trigger = null} = {}) {
    if (!Object.hasOwn(SECTIONS, section) || modal) return;
    const entry = SECTIONS[section];
    const focus = pointerFocus || focusSnapshot();
    pointerFocus = null;
    const token = `merzig-rules-${Date.now()}-${++sequence}`;
    modal = {token, focus, trigger, hash: location.hash, x: window.scrollX, y: window.scrollY, pushed: false};
    title.textContent = `${entry.label} · PDF-Seite ${entry.page}`;
    closeButton.setAttribute('aria-label', match ? 'Spielregeln schließen und zur Partie zurückkehren' : 'Spielregeln schließen und zur vorherigen Ansicht zurückkehren');
    content.innerHTML = `${matchAgreements(match)}<section class="rules-original" aria-labelledby="rules-original-title"><p class="eyebrow">Offizielles DBU-Original</p><h3 id="rules-original-title">${escape(entry.label)} · ab PDF-Seite ${entry.page}</h3><p id="rules-dialog-description">Unverändertes gemeinsames deutsches Regelwerk der DBU. Stand ${BOOK.stand}, Version ${BOOK.version}, ${BOOK.pages} PDF-Seiten. Anhang offiziell gelistet am ${BOOK.listed}.</p><a class="btn small rules-external" href="${escape(originalURL(section))}" target="_blank" rel="noopener noreferrer">Original in neuem Tab öffnen ↗</a><p class="hint">Falls dein Browser PDFs hier nicht anzeigen kann oder den Seitenanker ignoriert: Öffne das Original im neuen Tab und wähle PDF-Seite ${entry.page}. Die App bleibt dabei geöffnet.</p></section><div class="rules-pdf"><iframe class="rules-frame" title="DBU-Originalregelwerk · ${escape(entry.label)} · PDF-Seite ${entry.page}" src="${escape(originalURL(section))}" referrerpolicy="no-referrer"></iframe></div>`;
    document.body.classList.add('rules-modal-open');
    dialog.showModal();
    closeButton.focus({preventScroll: true});
    try {
      const previous = history.state && typeof history.state === 'object' ? history.state : {};
      history.pushState({...previous, merzigRulesOverlay: token}, '', location.href);
      modal.pushed = true;
    } catch { /* The fixed close control and Escape still work when history is unavailable. */ }
  }
  function finishClose(restore = true) {
    if (!modal) return;
    const previous = modal;
    modal = null;
    if (dialog.open) dialog.close();
    content.replaceChildren();
    document.body.classList.remove('rules-modal-open');
    if (!restore || location.hash !== previous.hash) return;
    const focus = previous.focus.element?.isConnected ? previous.focus.element : previous.trigger?.isConnected ? previous.trigger : document.querySelector('main');
    focus?.focus({preventScroll: true});
    if (previous.focus.selection && focus === previous.focus.element && typeof focus.setSelectionRange === 'function') {
      try { focus.setSelectionRange(...previous.focus.selection); } catch { /* Not all control types support a selection. */ }
    }
    window.scrollTo({left: previous.x, top: previous.y, behavior: 'instant'});
    document.dispatchEvent(new Event('merzig-rules-closed'));
  }
  function requestClose() {
    if (!modal) return;
    const token = modal.token;
    const pushed = modal.pushed;
    // Remove the embedded viewer first: closing never waits on a PDF viewer's own history.
    finishClose();
    if (pushed && history.state?.merzigRulesOverlay === token) history.back();
  }
  closeButton.addEventListener('click', requestClose);
  dialog.addEventListener('cancel', event => { event.preventDefault(); requestClose(); });
  dialog.addEventListener('close', () => { if (modal) requestClose(); });
  dialog.addEventListener('click', event => { if (event.target === dialog) requestClose(); });
  dialog.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); requestClose(); return; }
    if (event.key !== 'Tab') return;
    const controls = [...dialog.querySelectorAll('button:not([disabled]), a[href], iframe')];
    const first = controls[0], last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  });
  document.addEventListener('pointerdown', event => {
    pointerFocus = event.target.closest('[data-action="open-match-rules"], [data-rules-section], [data-sk="rules"]') ? focusSnapshot() : null;
  });
  document.addEventListener('keydown', () => { pointerFocus = null; });
  document.addEventListener('focusin', event => {
    if (modal && !dialog.contains(event.target)) closeButton.focus({preventScroll: true});
  });
  window.addEventListener('popstate', () => {
    if (modal && history.state?.merzigRulesOverlay !== modal.token) finishClose();
  });
  // A real app route change (such as an expired session) can leave the modal safely.
  window.addEventListener('hashchange', () => { if (modal && location.hash !== modal.hash) finishClose(false); });
  window.BillardRules = Object.freeze({
    renderPage, hasDiscipline, open, isOpen: () => !!modal,
    openForMatch: (match, trigger) => { const section = sectionForPool(match.pool); if (section) open(section, {match, trigger}); }
  });
})();
