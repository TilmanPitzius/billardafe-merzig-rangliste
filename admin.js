'use strict';
/*
 * CAFÉ-VERWALTUNG (Prototyp)
 * --------------------------
 * Admin-Panel für den Inhaber („owner“) und das Personal an der Theke („staff“).
 * Route: #admin, #admin/<bereich>, #admin/spieler/<id>
 * Alle Daten über BillardApp.request/write an /admin/… (siehe UEBERGABE.md, Abschnitt „Admin“).
 * Rechte prüft der Server; die Oberfläche blendet nur aus, was die Rolle nicht darf.
 */
(() => {
  const app = () => window.BillardApp;
  const ui = () => window.BillardFeatures.ui;
  const e = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const ad = {issue: null, issuePreview: null, issueResult: null, voucherStatus: 'open', auditFilter: '', playerQuery: '', month: null, lookup: null, lookupError: '', reset: null};
  const date = (v, time = false) => v ? new Intl.DateTimeFormat('de-DE', {timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', year: 'numeric', ...(time ? {hour: '2-digit', minute: '2-digit'} : {})}).format(new Date(v)) + (time ? ' Uhr' : '') : '–';
  const SECTIONS = [
    ['uebersicht', 'Übersicht', ['owner', 'staff']],
    ['monat', 'Monatsabschluss', ['owner']],
    ['spieler', 'Spieler', ['owner']],
    ['gutscheine', 'Gutscheine', ['owner', 'staff']],
    ['streit', 'Streitfälle', ['owner', 'staff']],
    ['katalog', 'Belohnungen', ['owner']],
    ['events', 'Events', ['owner', 'staff']],
    ['aufgaben', 'Wochenaufgaben', ['owner']],
    ['protokoll', 'Protokoll', ['owner']]
  ];
  const ROLE = {owner: 'Inhaber', staff: 'Theke'};
  const KIND = {pokal: 'Pokal', medaille: 'Medaille', titel: 'Titel', gutschein: 'Gutschein'};
  const TIER = {1: 'Bronze', 2: 'Silber', 3: 'Gold'};
  const role = state => state.session?.authenticated ? state.session.user?.role || null : null;

  async function get(key, path) {
    try { ad[key] = await app().request(path); ad[key + 'Error'] = ''; }
    catch (err) { ad[key + 'Error'] = err.message; }
  }
  async function load(state, r) {
    const rl = role(state); if (!rl) return;
    const s = r.section || 'uebersicht';
    if (s === 'uebersicht') await get('overview', '/admin/overview');
    if (s === 'monat') await get('close', '/admin/month-close' + (ad.month ? '?month=' + encodeURIComponent(ad.month) : ''));
    if (s === 'spieler' && !r.id) await get('players', '/admin/players?q=' + encodeURIComponent(ad.playerQuery));
    if (s === 'spieler' && r.id) await Promise.all([get('player', '/admin/players/' + encodeURIComponent(r.id)), get('catalog', '/admin/catalog'), get('players', '/admin/players?q=')]);
    if (s === 'gutscheine' && r.id === 'neu' && rl === 'owner') { await Promise.all([get('catalog', '/admin/catalog'), get('players', '/admin/players?q='), get('events', '/events')]); await previewIssue(); }
    else if (s === 'gutscheine') await Promise.all([get('vouchers', '/admin/vouchers?status=' + ad.voucherStatus), rl === 'owner' ? get('batches', '/admin/vouchers/batches') : null]);
    if (s === 'streit') await get('disputed', '/admin/matches');
    if (s === 'katalog') await get('catalog', '/admin/catalog');
    if (s === 'events') await get('events', '/events');
    if (s === 'aufgaben') await get('quests', '/admin/quests');
    if (s === 'protokoll') await get('audit', '/admin/audit' + (ad.auditFilter ? '?action=' + ad.auditFilter : ''));
  }
  async function reload() { const st = app().state; await load(st, app().route()); app().render(); }

  // ---------- Bausteine ----------
  const err = key => ad[key + 'Error'] ? `<div class="callout error" role="alert"><p>${e(ad[key + 'Error'])}</p></div>` : '';
  const loadingBox = t => `<div class="loading" role="status">${e(t)}</div>`;
  const section = (title, body, extra = '') => `<section class="fx-card ad-card"><div class="section-heading"><h2>${e(title)}</h2>${extra}</div>${body}</section>`;
  const empty = t => `<p class="ad-empty">${e(t)}</p>`;
  function prizeIcon(award, size = 44) { return ui().trophyIcon({kind: award.kind === 'titel' ? 'medaille' : award.kind, tier: award.tier || 3, name: award.name}, size); }

  function shell(state, r, body) {
    const rl = role(state);
    const tabs = SECTIONS.filter(([, , roles]) => roles.includes(rl));
    const cur = r.section || 'uebersicht';
    return `<div class="ad">
      <div class="ad-head"><div><p class="eyebrow">Billardcafé Merzig</p><h1>Café-Verwaltung</h1></div><span class="ad-role ${rl}">${e(ROLE[rl])}</span></div>
      <nav class="ad-tabs" aria-label="Bereiche der Verwaltung">${tabs.map(([k, n]) => `<a href="#admin/${k}" ${k === cur ? 'aria-current="page"' : ''}>${e(n)}</a>`).join('')}</nav>
      ${body}
    </div>`;
  }

  // ---------- Übersicht ----------
  function viewOverview(state) {
    const o = ad.overview;
    if (!o) return err('overview') || loadingBox('Übersicht wird geladen …');
    const owner = role(state) === 'owner';
    const tile = (href, n, label, sub, tone = '') => `<a class="ad-tile ${tone}" href="${href}"><b>${e(n)}</b><span>${e(label)}</span>${sub ? `<small>${e(sub)}</small>` : ''}</a>`;
    return `<div class="ad-tiles">
        ${owner && o.close ? tile('#admin/monat', o.close.pending, 'Monatsabschluss', o.close.pending ? `${o.close.label} wartet auf dich` : `${o.close.label} erledigt`, o.close.pending ? 'hot' : '') : ''}
        ${tile('#admin/streit', o.disputed, 'Streitfälle', o.disputed ? 'bitte klären' : 'alles geklärt', o.disputed ? 'hot' : '')}
        ${tile('#admin/gutscheine', o.vouchers_open, 'Offene Gutscheine', `${o.redeemed_today.length} heute eingelöst`)}
        ${tile(owner ? '#admin/spieler' : '#admin/uebersicht', o.new_players.length, 'Neue Spieler', 'in der Platzierung')}
      </div>
      ${section('Gutschein an der Theke', voucherLookupForm())}
      ${o.suspicious.length ? section('Auffällige Paarungen', `<p class="hint">Viele Partien derselben zwei Spieler in diesem Monat mit wechselnden Siegen. Bitte im Blick behalten – die Monatsliga zählt höchstens drei davon.</p><ul class="ad-list">${o.suspicious.map(p => `<li class="ad-row">${ui().pAvatar(p.a, '', 34)}${ui().pAvatar(p.b, '', 34)}<span class="ad-row-main"><strong>${e(p.a.name)} & ${e(p.b.name)}</strong><small>${p.count} Partien · ${p.wins_a}:${p.wins_b} Siege</small></span>${owner ? `<a class="btn small" href="#admin/spieler/${e(p.a.id)}">Ansehen</a>` : ''}</li>`).join('')}</ul>`) : ''}
      ${o.new_players.length ? section('Neu in der Platzierung', `<div class="ad-avatars">${o.new_players.map(p => `<a href="${owner ? '#admin/spieler/' + e(p.id) : '#spieler/' + e(p.id)}">${ui().pAvatar(p, '', 44)}<span>${e(p.name)}</span></a>`).join('')}</div><p class="hint">Tipp: Beim nächsten Einsteigerabend persönlich begrüßen.</p>`) : ''}
      ${owner ? section('Zuletzt im Protokoll', o.recent.length ? auditList(o.recent) : empty('Noch keine Aktionen.'), '<a class="text-button" href="#admin/protokoll">Alles</a>') : ''}`;
  }

  // ---------- Gutscheine ----------
  function voucherLookupForm() {
    const v = ad.lookup;
    return `<form class="ad-lookup" data-adform="lookup"><label class="field"><span>Code vom Handy des Gastes</span><input id="ad-code" name="code" autocomplete="off" autocapitalize="characters" placeholder="BCM-XXXX-XXXX" value="${e(ad.lookupCode || '')}"></label><button class="btn primary" type="submit">Prüfen</button></form>
      ${ad.lookupError ? `<p class="ad-msg bad" role="alert">${e(ad.lookupError)}</p>` : ''}
      ${v ? `<div class="ad-voucher ${v.redeemed_at ? 'used' : Date.parse(v.valid_until) < Date.now() ? 'expired' : 'ok'}">
        <div><strong>${e(v.title)}</strong><small>${e(v.player)} · ${e(v.code)}</small><small>${v.redeemed_at ? `Eingelöst am ${date(v.redeemed_at, true)} von ${e(v.redeemed_by)}` : Date.parse(v.valid_until) < Date.now() ? `Abgelaufen am ${date(v.valid_until)}` : `Gültig bis ${date(v.valid_until)} · Quelle: ${e(v.source)}`}</small></div>
        ${!v.redeemed_at && Date.parse(v.valid_until) > Date.now() ? `<button type="button" class="btn primary" data-ad="redeem" data-code="${e(v.code)}">Jetzt einlösen</button>` : ''}
      </div><p class="hint">Nach dem Einlösen den Rabatt wie gewohnt in der Kasse buchen.</p>` : ''}`;
  }
  // ---------- Gutscheine erstellen & verteilen ----------
  const LIGEN = ['1. Café-Liga', '2. Café-Liga', '3. Café-Liga', '4. Café-Liga'];
  function issueState() {
    if (!ad.issue) {
      const first = (ad.catalog?.catalog || []).find(k => k.kind === 'gutschein' && !k.archived);
      ad.issue = {template: first?.id || 'custom', title: '', valid_days: 30, note: '', target: 'players', player_ids: [], liga: '4. Café-Liga', pool: '8-single', event_id: ad.events?.events?.find(x => x.capacity)?.id || '', count: 10, reason: '', q: ''};
    }
    return ad.issue;
  }
  const issueBody = () => { const i = ad.issue; return {template: i.template, title: i.title, valid_days: Number(i.valid_days), note: i.note, target: i.target, player_ids: i.player_ids, liga: i.liga, pool: i.pool, event_id: i.event_id, count: Number(i.count), reason: i.reason}; };
  let previewTimer = null;
  async function previewIssue() {
    if (!ad.issue) issueState();
    try { ad.issuePreview = await app().request('/admin/vouchers/preview', {method: 'POST', body: issueBody()}); ad.issuePreviewError = ''; }
    catch (er) { ad.issuePreview = null; ad.issuePreviewError = er.message; }
  }
  function schedulePreview() { clearTimeout(previewTimer); previewTimer = setTimeout(async () => { await previewIssue(); app().render(); }, 250); }
  function viewIssue() {
    if (ad.issueResult) return viewIssueResult();
    if (!ad.catalog || !ad.players || !ad.events) return err('catalog') || loadingBox('Wird vorbereitet …');
    const i = issueState();
    const tpl = (ad.catalog.catalog || []).filter(k => k.kind === 'gutschein' && !k.archived);
    const pv = ad.issuePreview;
    const radio = (name, value, label, sub = '') => `<button type="button" role="radio" aria-checked="${i[name] === value}" data-adi-pick="${name}" data-v="${e(value)}"><span class="nt-radio"></span><span><strong>${e(label)}</strong>${sub ? `<small>${e(sub)}</small>` : ''}</span></button>`;
    const q = i.q.trim().toLowerCase();
    const plist = ad.players.players.filter(p => !p.blocked && (!q || p.name.toLowerCase().includes(q)));
    return `<a class="back-link" href="#admin/gutscheine">← Gutscheine</a>
      <div class="page-heading"><p class="eyebrow">Inhaber</p><h2 class="ad-h">Gutscheine erstellen & verteilen</h2></div>
      ${section('1 · Was gibt es?', `<div class="nt-radio-list">${tpl.map(k => radio('template', k.id, k.name, `${k.valid_days} Tage gültig${k.sponsor ? ' · ' + k.sponsor : ''}`)).join('')}${radio('template', 'custom', 'Eigener Gutschein', 'Name und Gültigkeit selbst festlegen')}</div>
        ${i.template === 'custom' ? `<div class="ad-grid2"><label class="field"><span>Name</span><input id="adi-title" data-adi="title" maxlength="40" value="${e(i.title)}" placeholder="z. B. Happy Hour −50 %"></label><label class="field"><span>Gültig (Tage)</span><input id="adi-days" data-adi="valid_days" type="number" min="1" max="365" value="${e(i.valid_days)}"></label></div>` : ''}
        <label class="field"><span>Hinweis für Gäste (optional)</span><input id="adi-note" data-adi="note" maxlength="80" value="${e(i.note)}" placeholder="z. B. gilt Mo–Do bis 18 Uhr"></label>`)}
      ${section('2 · Wer bekommt ihn?', `<div class="nt-radio-list">
          ${radio('target', 'players', 'Ausgewählte Spieler', i.player_ids.length ? `${i.player_ids.length} ausgewählt` : 'einzeln anklicken')}
          ${radio('target', 'liga', 'Eine Café-Liga', 'z. B. alle aus der 4. Liga zum Ansporn')}
          ${radio('target', 'active', 'Alle, die diesen Monat gespielt haben')}
          ${radio('target', 'event', 'Teilnehmer eines Events')}
          ${radio('target', 'all', 'Alle Spieler')}
          ${radio('target', 'none', 'Ohne Empfänger', 'Codes zum Ausgeben – z. B. auf Flyern oder an Neue')}
        </div>
        ${i.target === 'players' ? `<label class="field ad-mt"><span>Spieler suchen</span><input id="adi-q" data-adi="q" value="${e(i.q)}" placeholder="Nickname" autocomplete="off"></label>
          <div class="ad-pick">${plist.map(p => `<button type="button" aria-pressed="${i.player_ids.includes(p.id)}" data-adi-toggle="${e(p.id)}">${ui().pAvatar(p, '', 30)}<span>${e(p.name)}</span></button>`).join('') || empty('Niemand gefunden.')}</div>` : ''}
        ${i.target === 'liga' ? `<div class="ad-grid2 ad-mt"><label class="field"><span>Café-Liga</span><select id="adi-liga" data-adi="liga">${LIGEN.map(l => `<option ${i.liga === l ? 'selected' : ''}>${l}</option>`).join('')}</select></label><label class="field"><span>Disziplin</span><select id="adi-pool" data-adi="pool">${Object.entries(ui().POOLNAME).map(([k, n]) => `<option value="${k}" ${i.pool === k ? 'selected' : ''}>${n}</option>`).join('')}</select></label></div>` : ''}
        ${i.target === 'event' ? `<label class="field ad-mt"><span>Event</span><select id="adi-event" data-adi="event_id">${ad.events.events.filter(x => x.capacity).map(x => `<option value="${e(x.id)}" ${i.event_id === x.id ? 'selected' : ''}>${e(x.title)} · ${date(x.starts_at)}</option>`).join('')}</select></label>` : ''}
        ${i.target === 'none' ? `<label class="field ad-mt"><span>Anzahl Codes</span><input id="adi-count" data-adi="count" type="number" min="1" max="50" value="${e(i.count)}"></label>` : ''}`)}
      ${section('3 · Vorschau', ad.issuePreviewError ? `<p class="ad-msg bad">${e(ad.issuePreviewError)}</p>` : pv ? `<div class="ad-ticket-big"><span class="ad-ticket-cut"></span><div><small>Gutschein · ${e(pv.valid_days)} Tage gültig</small><strong>${e(pv.title)}</strong>${i.note ? `<em>${e(i.note)}</em>` : ''}</div><b>×${pv.count}</b></div>
          <p class="ad-meta">${e(pv.label)}</p>${pv.recipients.length ? `<div class="ad-avatars small">${pv.recipients.map(p => `<span>${ui().pAvatar(p, '', 32)}<span>${e(p.name)}</span></span>`).join('')}${pv.count > pv.recipients.length ? `<span class="ad-more">+${pv.count - pv.recipients.length}</span>` : ''}</div>` : ''}` : loadingBox('Vorschau wird berechnet …'))}
      ${section('4 · Anlass', `<label class="field"><span>Begründung</span><textarea id="adi-reason" data-adi="reason" maxlength="200" rows="2" placeholder="z. B. Danke fürs Mitmachen beim Stadtfest">${e(i.reason)}</textarea><small class="hint">Steht im Protokoll und in der Nachricht an die Spieler.</small></label>
        <button type="button" class="btn primary ad-wide" data-ad="issue-go" ${pv && i.reason.trim().length >= 3 ? '' : 'disabled'}>${pv ? `${pv.count} ${pv.count === 1 ? 'Gutschein' : 'Gutscheine'} ${i.target === 'none' ? 'erstellen' : 'verteilen'}` : 'Gutscheine verteilen'}</button>`)}`;
  }
  function viewIssueResult() {
    const r = ad.issueResult;
    const none = r.vouchers.every(v => !v.player_id);
    return `<div class="page-heading"><p class="eyebrow">Erledigt</p><h2 class="ad-h">${r.vouchers.length} ${r.vouchers.length === 1 ? 'Gutschein' : 'Gutscheine'} ${none ? 'erstellt' : 'verteilt'}</h2></div>
      ${section(r.batch.title, `<p class="hint">${none ? 'Diese Codes gehören noch niemandem. Gib sie auf Papier, per Nachricht oder an der Theke aus – jeder Code gilt einmal.' : 'Die Spieler finden den Gutschein in ihrem Bonusheft und bekommen beim nächsten Öffnen der App eine Nachricht.'}</p>
        ${none ? `<button type="button" class="btn ad-wide" data-ad="copy-all">Alle Codes kopieren</button>` : ''}
        <ul class="ad-list ad-mt">${r.vouchers.map(v => `<li class="ad-row"><span class="ad-ticket">€</span><span class="ad-row-main"><strong class="ad-mono">${e(v.code)}</strong><small>${e(v.player)} · gültig bis ${date(v.valid_until)}</small></span>${none ? `<button type="button" class="btn small" data-ad="copy" data-code="${e(v.code)}">Kopieren</button>` : ''}</li>`).join('')}</ul>
        ${none ? `<textarea id="adi-codes" class="ad-codes" readonly rows="3">${e(r.vouchers.map(v => v.code).join('\n'))}</textarea>` : ''}`)}
      <div class="ad-actions"><button type="button" class="btn primary" data-ad="issue-again">Weitere Gutscheine</button><a class="btn" href="#admin/gutscheine" data-ad="issue-done">Fertig</a></div>`;
  }

  function viewVouchers() {
    const list = ad.vouchers?.vouchers;
    const tabs = [['open', 'Offen'], ['redeemed', 'Eingelöst'], ['expired', 'Abgelaufen'], ['all', 'Alle']];
    const owner = role(app().state) === 'owner';
    const b = ad.batches?.batches || [];
    return (owner ? section('Gutscheine verteilen', `<p class="hint">Eigene Gutscheine oder Vorlagen an einzelne Spieler, eine Liga, Event-Teilnehmer oder alle verteilen – oder Codes ohne Empfänger zum Ausgeben erstellen.</p><a class="btn primary ad-wide" href="#admin/gutscheine/neu">Gutscheine erstellen & verteilen</a>
        ${b.length ? `<h3 class="ad-h3">Letzte Aktionen</h3><ul class="ad-list">${b.slice(0, 5).map(x => `<li class="ad-row"><span class="ad-row-main"><strong>${e(x.title)}</strong><small>${e(x.target)} · ${date(x.created_at)} · ${e(x.by)}</small><span class="nt-wl small" style="--all:100%"><i style="width:${x.count ? (x.redeemed / x.count * 100).toFixed(1) : 0}%"></i></span></span><span class="ad-row-end"><b class="ad-frac">${x.redeemed}/${x.count}</b><small>eingelöst</small></span></li>`).join('')}</ul>` : ''}`) : '')
      + section('Gutschein einlösen', voucherLookupForm())
      + section('Alle Gutscheine', `<div class="ad-chips">${tabs.map(([k, n]) => `<button type="button" data-ad="vstatus" data-v="${k}" aria-pressed="${ad.voucherStatus === k}">${n}</button>`).join('')}</div>
        ${err('vouchers')}${!list ? loadingBox('Gutscheine werden geladen …') : list.length ? `<ul class="ad-list">${list.map(v => `<li class="ad-row"><span class="ad-ticket">€</span><span class="ad-row-main"><strong>${e(v.title)}</strong><small>${e(v.player)} · ${e(v.code)} · ${e(v.source)}</small>${v.note ? `<small>${e(v.note)}</small>` : ''}</span><span class="ad-row-end">${v.redeemed_at ? `<small>eingelöst ${date(v.redeemed_at)}</small>` : `<small>bis ${date(v.valid_until)}</small>`}</span></li>`).join('')}</ul>` : empty('Keine Gutscheine in dieser Auswahl.')}`);
  }

  // ---------- Monatsabschluss ----------
  function viewMonth() {
    const c = ad.close;
    if (!c) return err('close') || loadingBox('Monatsabschluss wird geladen …');
    const pending = c.items.filter(i => i.status === 'pending').length;
    const badge = st => ({pending: '<span class="ad-st pending">Offen</span>', approved: '<span class="ad-st ok">Bestätigt</span>', rejected: '<span class="ad-st no">Abgelehnt</span>', empty: '<span class="ad-st">Kein Kandidat</span>'})[st];
    return `<div class="ad-chips ad-months">${c.months.map(m => `<button type="button" data-ad="month" data-m="${m.month}" aria-pressed="${m.month === c.month}">${e(m.label)}${m.status === 'open' ? ' •' : ''}</button>`).join('')}</div>
      ${section(c.label, `<p class="hint">Das System schlägt die Sieger vor. Erst mit deiner Bestätigung bekommen die Spieler Pokal, Titel und Gutschein. Regel: höchstens eine Auszeichnung pro Person im Monat – wer schon eine hat, macht Platz für den Nächsten.</p>
        ${pending ? `<button type="button" class="btn primary ad-wide" data-ad="approve-all">Alle ${pending} Vorschläge bestätigen</button>` : `<p class="ad-msg good">Dieser Monat ist abgeschlossen.</p>`}`)}
      <ul class="ad-awards">${c.items.map(it => `<li class="ad-award ${it.status}">
        <div class="ad-award-top">${prizeIcon(it.award, 46)}<div class="ad-award-title"><strong>${e(it.label)}</strong><small>${e(it.basis)} · Preis: ${e(it.voucher)}</small></div>${badge(it.status)}</div>
        ${it.player ? `<div class="ad-award-who">${ui().pAvatar(it.player, '', 40)}<span><strong>${e(it.player.name)}</strong>${it.points?.[it.player.id] != null ? `<small>${e(it.points[it.player.id])} ${it.key === 'regular' ? 'Spieltage' : 'Punkte'}</small>` : ''}</span></div>` : ''}
        ${it.note ? `<p class="ad-note">${e(it.note)}</p>` : ''}
        ${it.reason ? `<p class="ad-note">Begründung: ${e(it.reason)}</p>` : ''}
        ${it.status === 'pending' ? `<div class="ad-actions"><button type="button" class="btn primary small" data-ad="approve" data-key="${e(it.key)}">Bestätigen</button><button type="button" class="btn small" data-ad="swap" data-key="${e(it.key)}">Anderer Spieler</button><button type="button" class="btn small danger" data-ad="reject" data-key="${e(it.key)}">Ablehnen</button></div>` : it.decided_by ? `<p class="ad-meta">${it.status === 'approved' ? 'Bestätigt' : 'Abgelehnt'} von ${e(it.decided_by)} · ${date(it.decided_at)}</p>` : ''}
      </li>`).join('')}</ul>`;
  }

  // ---------- Spieler ----------
  function viewPlayers() {
    const list = ad.players?.players;
    return section('Spieler suchen', `<form class="ad-lookup" data-adform="psearch"><label class="field"><span>Nickname</span><input id="ad-psearch" name="q" value="${e(ad.playerQuery)}" placeholder="z. B. Lena" autocomplete="off"></label><button class="btn" type="submit">Suchen</button></form>`)
      + (err('players') || (!list ? loadingBox('Spieler werden geladen …') : `<ul class="ad-list ad-plist">${list.map(p => `<li><a class="ad-row" href="#admin/spieler/${e(p.id)}">${ui().pAvatar(p, '', 40)}<span class="ad-row-main"><strong>${e(p.name)}${p.blocked ? ' <em class="ad-st no">Gesperrt</em>' : ''}</strong><small>${p.games} Partien · ${p.stamps}/10 Stempel${p.last_played ? ' · zuletzt ' + date(p.last_played) : ''}</small></span><span class="ad-row-end">${p.rank ? ui().emblem(p.rank, 24) : '<small>neu</small>'}</span></a></li>`).join('')}</ul>`));
  }
  function viewPlayer(r) {
    const d = ad.player;
    if (!d || d.player.id !== r.id) return err('player') || loadingBox('Spieler wird geladen …');
    const p = d.player;
    const openV = d.vouchers.filter(v => !v.redeemed_at && Date.parse(v.valid_until) > Date.now());
    return `<a class="back-link" href="#admin/spieler">← Alle Spieler</a>
      <section class="ad-player">
        ${ui().pAvatar(p, '', 72)}
        <div class="ad-player-id"><h2>${e(p.name)}</h2>${p.title ? `<span class="nt-ribbon">${e(p.title)}</span>` : ''}<small>${{public: 'Profil sichtbar für alle', members: 'Profil nur für angemeldete Spieler', hidden: 'Profil privat'}[d.visibility] || ''}</small></div>
      </section>
      ${d.blocked ? `<p class="ad-msg bad">Gesperrt seit ${date(d.blocked.at)}: ${e(d.blocked.reason)}</p>` : ''}
      ${ad.reset?.pid === p.id ? `<div class="ad-msg good" role="status"><strong>Einmal-Code für die neue PIN: <span class="ad-code">${e(ad.reset.code)}</span></strong><br>Nur persönlich an der Theke übergeben. Gültig bis ${date(ad.reset.valid_until, true)}. Wird nicht gespeichert.</div>` : ''}
      <div class="nt-kpis big"><div><b>${d.summary.games}</b><span>Partien</span></div><div><b>${d.summary.wins}</b><span>Siege</span></div><div><b>${d.stamps}</b><span>Stempel</span></div><div><b>${openV.length}</b><span>Gutscheine</span></div></div>
      <div class="ad-action-grid">
        <button type="button" class="btn primary" data-ad="award">Auszeichnung verleihen</button>
        <button type="button" class="btn" data-ad="voucher">Gutschein ausstellen</button>
        <button type="button" class="btn" data-ad="stamps">Stempel ändern</button>
        <button type="button" class="btn" data-ad="pin">PIN zurücksetzen</button>
        <button type="button" class="btn ${d.blocked ? '' : 'danger'}" data-ad="block" data-blocked="${d.blocked ? '0' : '1'}">${d.blocked ? 'Sperre aufheben' : 'Profil sperren'}</button>
        <button type="button" class="btn" data-ad="merge">Doppelprofil zusammenführen</button>
        ${d.has_photo ? '<button type="button" class="btn danger" data-ad="photo-remove">Profilbild entfernen</button>' : ''}
        <a class="btn" href="#spieler/${e(p.id)}">Öffentliches Profil</a>
      </div>
      ${section('Auszeichnungen', d.honors.length ? `<ul class="ad-list">${d.honors.map(h => `<li class="ad-row">${ui().trophyIcon({...h, kind: h.kind === 'abzeichen' || h.kind === 'titel' ? 'medaille' : h.kind}, 34)}<span class="ad-row-main"><strong>${e(h.name)}</strong><small>${e(h.kind === 'abzeichen' ? 'Abzeichen' : KIND[h.kind] || h.kind)} · ${e(h.sub)}</small></span>${h.kind !== 'abzeichen' ? `<button type="button" class="btn small" data-ad="revoke" data-id="${e(h.id)}" data-name="${e(h.name)}">Entziehen</button>` : ''}</li>`).join('')}</ul>` : empty('Noch keine Auszeichnungen.'))}
      ${section('Gutscheine', d.vouchers.length ? `<ul class="ad-list">${d.vouchers.map(v => `<li class="ad-row"><span class="ad-ticket">€</span><span class="ad-row-main"><strong>${e(v.title)}</strong><small>${e(v.code)} · ${e(v.source)}</small></span><span class="ad-row-end"><small>${v.redeemed_at ? 'eingelöst ' + date(v.redeemed_at) : 'bis ' + date(v.valid_until)}</small></span></li>`).join('')}</ul>` : empty('Keine Gutscheine.'))}
      ${section('Protokoll zu diesem Spieler', d.audit.length ? auditList(d.audit) : empty('Noch keine Aktionen des Cafés.'))}`;
  }

  // ---------- Streitfälle ----------
  function viewDisputes(state) {
    const list = ad.disputed?.matches;
    const owner = role(state) === 'owner';
    if (!list) return err('disputed') || loadingBox('Streitfälle werden geladen …');
    if (!list.length) return section('Streitfälle', '<p class="ad-msg good">Keine offenen Streitfälle. Alle Ergebnisse sind geklärt.</p>');
    const pools = ui().POOLNAME;
    return list.map(m => section(`${pools[m.pool]} · ${{1: 'Einzelnes Spiel', 3: '3er Satz', 5: '3er Satz', 7: '5er Satz'}[m.best_of]}`, `
      <div class="ad-vs"><div>${m.teams[0].map(p => `<strong>${e(p.name)}</strong>`).join(' & ')}</div><b>${m.proposal ? `${m.proposal.score_a} : ${m.proposal.score_b}` : '– : –'}</b><div>${m.teams[1].map(p => `<strong>${e(p.name)}</strong>`).join(' & ')}</div></div>
      <p class="ad-note">Vorschlag von ${e(m.teams[0][0].name)}. Widerspruch: „${e(m.dispute_reason)}“</p>
      <p class="ad-meta">Angelegt am ${date(m.created_at, true)}</p>
      ${owner ? `<div class="ad-actions"><button type="button" class="btn primary small" data-ad="resolve-accept" data-id="${e(m.id)}" data-a="${m.proposal?.score_a}" data-b="${m.proposal?.score_b}">Vorschlag ${m.proposal?.score_a}:${m.proposal?.score_b} bestätigen</button><button type="button" class="btn small" data-ad="resolve" data-id="${e(m.id)}">Anderes Ergebnis</button><button type="button" class="btn small danger" data-ad="void" data-id="${e(m.id)}">Annullieren</button></div>` : '<p class="hint">Entscheiden kann nur der Inhaber. Sprich die beiden am besten direkt an.</p>'}`)).join('');
  }

  // ---------- Katalog ----------
  function viewCatalog() {
    const list = ad.catalog?.catalog;
    if (!list) return err('catalog') || loadingBox('Katalog wird geladen …');
    const row = k => `<li class="ad-row ${k.archived ? 'archived' : ''}">${k.kind === 'gutschein' ? '<span class="ad-ticket">€</span>' : prizeIcon(k, 34)}<span class="ad-row-main"><strong>${e(k.name)}</strong><small>${e(KIND[k.kind])}${k.tier ? ' · ' + TIER[k.tier] : ''}${k.valid_days ? ` · ${k.valid_days} Tage gültig` : ''}${k.sponsor ? ' · ' + e(k.sponsor) : ''}</small>${k.description ? `<small>${e(k.description)}</small>` : ''}</span><button type="button" class="btn small" data-ad="archive" data-id="${e(k.id)}">${k.archived ? 'Reaktivieren' : 'Archivieren'}</button></li>`;
    return section('Belohnungen', `<p class="hint">Pokale, Medaillen und Titel kannst du Spielern verleihen. Sie erscheinen dann in deren Vitrine und Titelauswahl. Gutschein-Vorlagen stellst du beim Spieler aus.</p><button type="button" class="btn primary ad-wide" data-ad="cat-new">Neue Vorlage anlegen</button>`)
      + section('Auszeichnungen', `<ul class="ad-list">${list.filter(k => k.kind !== 'gutschein').map(row).join('') || empty('Noch keine.')}</ul>`)
      + section('Gutscheine', `<ul class="ad-list">${list.filter(k => k.kind === 'gutschein').map(row).join('') || empty('Noch keine.')}</ul>`);
  }

  // ---------- Events ----------
  function viewEvents() {
    const list = ad.events?.events;
    if (!list) return err('events') || loadingBox('Events werden geladen …');
    return section('Events', `<button type="button" class="btn primary ad-wide" data-ad="event-new">Neues Event</button>`)
      + `<ul class="ad-list">${list.map(ev => `<li class="ad-row ad-event"><span class="ad-date"><b>${e(new Intl.DateTimeFormat('de-DE', {timeZone: 'Europe/Berlin', day: '2-digit'}).format(new Date(ev.starts_at)))}</b><small>${e(new Intl.DateTimeFormat('de-DE', {timeZone: 'Europe/Berlin', month: 'short'}).format(new Date(ev.starts_at)))}</small></span><span class="ad-row-main"><strong>${e(ev.title)}</strong><small>${e(ev.type)} · ${date(ev.starts_at, true)}${ev.capacity ? ` · ${ev.participants}/${ev.capacity} angemeldet` : ''}</small></span><span class="ad-row-btns"><button type="button" class="btn small" data-ad="event-edit" data-id="${e(ev.id)}">Bearbeiten</button><button type="button" class="btn small danger" data-ad="event-del" data-id="${e(ev.id)}" data-name="${e(ev.title)}">Löschen</button></span></li>`).join('')}</ul>`;
  }

  // ---------- Wochenaufgaben ----------
  function viewQuests() {
    const d = ad.quests;
    if (!d) return err('quests') || loadingBox('Wochenaufgaben werden geladen …');
    const desc = q => q.type === 'pool' ? `${q.goal}× ${d.pools[q.pool]}` : q.type === 'weekday' ? `${q.goal}× am ${d.weekdays[q.weekday]}` : `${d.types[q.type]} · Ziel ${q.goal}`;
    return section('Wochenaufgaben', `<p class="hint">Gelten für alle Spieler, jede erledigte Aufgabe bringt einen Stempel. Höchstens fünf gleichzeitig. Tipp: Aufgaben für ruhige Wochentage füllen den Laden.</p>${d.quests.length < 5 ? '<button type="button" class="btn primary ad-wide" data-ad="quest-new">Neue Aufgabe</button>' : ''}`)
      + `<ul class="ad-list">${d.quests.map(q => `<li class="ad-row"><span class="fx-check" aria-hidden="true"></span><span class="ad-row-main"><strong>${e(q.title)}</strong><small>${e(q.text)}</small><small>${e(desc(q))}</small></span><span class="ad-row-btns"><button type="button" class="btn small" data-ad="quest-edit" data-id="${e(q.id)}">Bearbeiten</button><button type="button" class="btn small danger" data-ad="quest-del" data-id="${e(q.id)}" data-name="${e(q.title)}">Löschen</button></span></li>`).join('')}</ul>`;
  }

  // ---------- Protokoll ----------
  function auditList(list) {
    return `<ol class="ad-audit">${list.map(a => `<li><span class="ad-audit-dot"></span><div><strong>${e(a.label)}</strong>${a.player_name ? ` · <a href="#admin/spieler/${e(a.player_id)}">${e(a.player_name)}</a>` : ''}${a.detail ? `<small>${e(a.detail)}</small>` : ''}${a.reason ? `<small class="ad-reason">„${e(a.reason)}“</small>` : ''}<small class="ad-meta">${date(a.at, true)} · ${e(a.actor)} (${e(ROLE[a.role] || a.role)})</small></div></li>`).join('')}</ol>`;
  }
  function viewAudit() {
    const filters = [['', 'Alle'], ['award', 'Auszeichnungen'], ['month', 'Monatsabschluss'], ['voucher', 'Gutscheine'], ['match', 'Partien'], ['stamps', 'Stempel'], ['block', 'Sperren']];
    const list = ad.audit?.audit;
    return section('Protokoll', `<p class="hint">Jede Aktion des Cafés mit Zeit, Person und Begründung. Nicht löschbar.</p><div class="ad-chips">${filters.map(([k, n]) => `<button type="button" data-ad="afilter" data-f="${k}" aria-pressed="${ad.auditFilter === k}">${n}</button>`).join('')}</div>
      ${err('audit')}${!list ? loadingBox('Protokoll wird geladen …') : list.length ? auditList(list) : empty('Noch keine Einträge in dieser Auswahl.')}`);
  }

  // ---------- Ansicht ----------
  function view(state, r) {
    const rl = role(state);
    if (!rl) return `<div class="narrow"><div class="empty-state"><p class="eyebrow">Café-Verwaltung</p><h1>Kein Zugriff</h1><p>Dieser Bereich ist nur für Inhaber und Personal. Melde dich mit dem Café-Konto an.</p>${document.querySelector('[data-demo-as]') ? '<p class="hint">Demo: Oben im Prototyp-Balken auf „Inhaber“ oder „Theke“ wechseln.</p>' : ''}<a class="btn primary" href="#profil">Zur Anmeldung</a></div></div>`;
    const s = r.section || 'uebersicht';
    const allowed = SECTIONS.find(([k]) => k === s)?.[2].includes(rl);
    if (!allowed) return shell(state, r, '<div class="callout warning"><p>Dieser Bereich ist nur für den Inhaber.</p></div>');
    const body = s === 'uebersicht' ? viewOverview(state) : s === 'monat' ? viewMonth() : s === 'spieler' ? (r.id ? viewPlayer(r) : viewPlayers()) : s === 'gutscheine' ? (r.id === 'neu' ? (rl === 'owner' ? viewIssue() : '<div class="callout warning"><p>Gutscheine verteilen kann nur der Inhaber.</p></div>') : viewVouchers()) : s === 'streit' ? viewDisputes(state) : s === 'katalog' ? viewCatalog() : s === 'events' ? viewEvents() : s === 'aufgaben' ? viewQuests() : viewAudit();
    return shell(state, r, body) + '<dialog id="ad-dialog" class="fx-dialog ad-dialog" aria-labelledby="ad-dialog-title"></dialog>';
  }

  // ---------- Dialog mit Formular ----------
  let dlgSubmit = null, dlgFields = [];
  function field(f) {
    const id = 'adf-' + f.id;
    const common = `id="${id}" name="${f.id}" ${f.required ? 'required' : ''}`;
    let input;
    if (f.type === 'select') input = `<select ${common}>${f.options.map(([v, l]) => `<option value="${e(v)}" ${String(f.value ?? '') === String(v) ? 'selected' : ''}>${e(l)}</option>`).join('')}</select>`;
    else if (f.type === 'textarea') input = `<textarea ${common} maxlength="${f.max || 300}" rows="3" placeholder="${e(f.placeholder || '')}">${e(f.value || '')}</textarea>`;
    else input = `<input ${common} type="${f.type || 'text'}" value="${e(f.value ?? '')}" ${f.min != null ? `min="${f.min}"` : ''} ${f.maxv != null ? `max="${f.maxv}"` : ''} ${f.step ? `step="${f.step}"` : ''} placeholder="${e(f.placeholder || '')}" autocomplete="off">`;
    return `<label class="field" data-field="${f.id}"><span>${e(f.label)}</span>${input}${f.hint ? `<small class="hint">${e(f.hint)}</small>` : ''}</label>`;
  }
  function applyShowIf() {
    const dlg = document.querySelector('#ad-dialog'); if (!dlg) return;
    const vals = Object.fromEntries([...dlg.querySelectorAll('[name]')].map(el => [el.name, el.value]));
    dlgFields.forEach(f => { if (f.showIf) dlg.querySelector(`[data-field="${f.id}"]`).hidden = !f.showIf(vals); });
  }
  function openForm({title, intro = '', fields = [], submit = 'Speichern', danger = false, onSubmit}) {
    const dlg = document.querySelector('#ad-dialog'); if (!dlg) return;
    dlgFields = fields; dlgSubmit = onSubmit;
    dlg.innerHTML = `<form class="fx-dialog-body" data-adform="dialog" novalidate><h2 id="ad-dialog-title">${e(title)}</h2>${intro ? `<div class="ad-intro">${intro}</div>` : ''}${fields.map(field).join('')}<p class="ad-msg bad" id="ad-dialog-error" role="alert" hidden></p><div class="ad-actions"><button type="button" class="btn" data-ad="dialog-close">Abbrechen</button><button type="submit" class="btn ${danger ? 'danger' : 'primary'}">${e(submit)}</button></div></form>`;
    applyShowIf();
    dlg.showModal();
    dlg.querySelector('input,select,textarea')?.focus();
  }
  const reasonField = (label = 'Begründung', hint = 'Steht im Protokoll und wird dem Spieler angezeigt.') => ({id: 'reason', label, type: 'textarea', required: true, placeholder: 'kurz und sachlich', hint});

  // ---------- Klicks ----------
  async function act(fn, success) {
    try { await fn(); if (success) app().notify(success); await reload(); }
    catch (er) { app().notify(er.message, true); }
  }
  document.addEventListener('click', async event => {
    const el = event.target.closest('[data-ad]');
    if (!el) return;
    const a = el.dataset.ad, r = app().route(), w = app().write;
    if (a === 'dialog-close') { el.closest('dialog')?.close(); return; }
    if (a === 'issue-go') {
      el.disabled = true;
      try { ad.issueResult = await w('/admin/vouchers/issue', issueBody(), 'issue:' + JSON.stringify(issueBody())); app().notify(ad.issueResult.vouchers.every(v => !v.player_id) ? 'Codes erstellt.' : 'Gutscheine verteilt. Die Spieler werden benachrichtigt.'); app().render(); window.scrollTo(0, 0); }
      catch (er) { app().notify(er.message, true); el.disabled = false; }
      return;
    }
    if (a === 'issue-again') { ad.issueResult = null; ad.issue = null; await reload(); return; }
    if (a === 'issue-done') { ad.issueResult = null; ad.issue = null; return; }
    if (a === 'copy' || a === 'copy-all') {
      const text = a === 'copy' ? el.dataset.code : ad.issueResult.vouchers.map(v => v.code).join('\n');
      try { await navigator.clipboard.writeText(text); app().notify(a === 'copy' ? 'Code kopiert.' : 'Alle Codes kopiert.'); }
      catch { const ta = document.querySelector('#adi-codes'); if (ta) { ta.focus(); ta.select(); } app().notify('Kopieren ist hier gesperrt – die Codes sind unten markiert.', true); }
      return;
    }
    if (a === 'vstatus') { ad.voucherStatus = el.dataset.v; ad.vouchers = null; app().render(); await reload(); return; }
    if (a === 'afilter') { ad.auditFilter = el.dataset.f; ad.audit = null; app().render(); await reload(); return; }
    if (a === 'month') { ad.month = el.dataset.m; ad.close = null; app().render(); await reload(); return; }
    if (a === 'redeem') {
      el.disabled = true;
      try { const res = await w(`/admin/vouchers/${encodeURIComponent(el.dataset.code)}/redeem`, {}, 'redeem:' + el.dataset.code); ad.lookup = res.voucher; app().notify('Eingelöst. Jetzt den Rabatt in der Kasse buchen.'); }
      catch (er) { ad.lookupError = er.message; }
      await reload(); return;
    }
    const month = ad.close?.month, item = key => ad.close?.items.find(i => i.key === key);
    if (a === 'approve') return act(() => w('/admin/month-close/decide', {month, key: el.dataset.key, decision: 'approve'}, 'mc:' + month + el.dataset.key), `Bestätigt: ${item(el.dataset.key).award.name} für ${item(el.dataset.key).player.name}.`);
    if (a === 'approve-all') return openForm({title: 'Alle Vorschläge bestätigen', intro: `<p>Alle offenen Auszeichnungen für ${e(ad.close.label)} werden vergeben. Jeder Gewinner bekommt Pokal oder Medaille, den Titel und seinen Gutschein.</p>`, fields: [{id: 'reason', label: 'Notiz (optional)', type: 'textarea'}], submit: 'Alle bestätigen',
      onSubmit: v => w('/admin/month-close/approve-all', {month, reason: v.reason}, 'mc-all:' + month).then(() => app().notify('Monatsabschluss bestätigt. Die Spieler werden benachrichtigt.'))});
    if (a === 'reject') { const it = item(el.dataset.key); return openForm({title: 'Vorschlag ablehnen', intro: `<p>${e(it.label)} geht in diesem Monat an niemanden.</p>`, fields: [reasonField()], submit: 'Ablehnen', danger: true,
      onSubmit: v => w('/admin/month-close/decide', {month, key: it.key, decision: 'reject', reason: v.reason}, 'mc-rej:' + month + it.key)}); }
    if (a === 'swap') {
      const it = item(el.dataset.key);
      const busy = new Set(ad.close.items.filter(x => x !== it && x.player && x.status !== 'rejected').map(x => x.player.id));
      const free = it.candidates.filter(c => c.id !== it.player?.id && !busy.has(c.id));
      if (!free.length) { app().notify('Alle weiteren Kandidaten haben in diesem Monat schon eine Auszeichnung. Lehne zuerst deren Vorschlag ab oder diesen hier.', true); return; }
      return openForm({title: 'Anderen Spieler wählen', intro: `<p>${e(it.label)}. Zur Auswahl stehen nur Spieler ohne andere Auszeichnung in diesem Monat.</p>`, fields: [{id: 'player_id', label: 'Spieler', type: 'select', options: free.map(c => [c.id, `${c.name}${c.points != null ? ` (${c.points})` : ''}`])}, reasonField()], submit: 'Vergeben',
      onSubmit: v => w('/admin/month-close/decide', {month, key: it.key, decision: 'swap', player_id: v.player_id, reason: v.reason}, 'mc-swap:' + month + it.key + v.player_id)}); }
    // Spieler-Aktionen
    const pid = ad.player?.player.id, path = c => `/admin/players/${encodeURIComponent(pid)}/${c}`;
    const done = res => { if (res?.player) ad.player = res; };
    if (a === 'award') { const opts = (ad.catalog?.catalog || []).filter(k => !k.archived && k.kind !== 'gutschein'); return openForm({title: 'Auszeichnung verleihen', fields: [{id: 'catalog_id', label: 'Auszeichnung', type: 'select', options: opts.map(k => [k.id, `${k.name} · ${KIND[k.kind]}${k.tier ? ' ' + TIER[k.tier] : ''}`])}, reasonField('Wofür?')], submit: 'Verleihen',
      onSubmit: v => w(path('award'), v, 'award:' + pid + v.catalog_id + v.reason).then(done).then(() => app().notify('Verliehen. Der Spieler sieht es beim nächsten Öffnen der App.'))}); }
    if (a === 'voucher') { const opts = (ad.catalog?.catalog || []).filter(k => !k.archived && k.kind === 'gutschein'); return openForm({title: 'Gutschein ausstellen', fields: [{id: 'catalog_id', label: 'Gutschein', type: 'select', options: opts.map(k => [k.id, `${k.name} · ${k.valid_days} Tage`])}, reasonField('Anlass')], submit: 'Ausstellen',
      onSubmit: v => w(path('voucher'), v, 'voucher:' + pid + v.catalog_id + v.reason).then(done).then(() => app().notify('Gutschein ausgestellt.'))}); }
    if (a === 'stamps') return openForm({title: 'Stempel ändern', intro: `<p>Aktuell ${ad.player.stamps}/10 Stempel.</p>`, fields: [{id: 'delta', label: 'Änderung', type: 'number', value: 1, min: -10, maxv: 10, step: 1, hint: 'z. B. 2 oder -1'}, reasonField()], submit: 'Übernehmen',
      onSubmit: v => w(path('stamps'), {delta: Number(v.delta), reason: v.reason}, 'stamps:' + pid + v.delta + v.reason).then(done)});
    if (a === 'pin') return openForm({title: 'PIN zurücksetzen', intro: '<p>Es entsteht ein Einmal-Code, mit dem der Spieler eine neue PIN wählt. Gib ihn nur persönlich an der Theke weiter – nach Ausweis oder wenn du die Person kennst.</p>', fields: [reasonField('Begründung', 'Steht im Protokoll.')], submit: 'Code erzeugen',
      onSubmit: v => w(path('pin-reset'), v, 'pin:' + pid + Date.now()).then(res => { done(res); ad.reset = {pid, ...res.reset}; })});
    if (a === 'block') { const on = el.dataset.blocked === '1'; return openForm({title: on ? 'Profil sperren' : 'Sperre aufheben', intro: on ? '<p>Gesperrte Spieler können sich nicht anmelden und erscheinen nicht in Rangliste und Monatsabschluss. Partien bleiben erhalten.</p>' : '', fields: [reasonField()], submit: on ? 'Sperren' : 'Aufheben', danger: on,
      onSubmit: v => w(path('block'), {blocked: on, reason: v.reason}, 'block:' + pid + on + v.reason).then(done)}); }
    if (a === 'merge') { const others = (ad.players?.players || []).filter(p => p.id !== pid); return openForm({title: 'Doppelprofil zusammenführen', intro: `<p><strong>${e(ad.player.player.name)}</strong> wird in das gewählte Profil übernommen: Partien, Auszeichnungen, Gutscheine und Stempel. Das alte Profil verschwindet. Nur für Personen, die versehentlich zwei Profile angelegt haben.</p>`, fields: [{id: 'into_id', label: 'Behalten wird', type: 'select', options: others.map(p => [p.id, `${p.name} (${p.games} Partien)`])}, reasonField('Begründung', 'Steht im Protokoll.')], submit: 'Zusammenführen', danger: true,
      onSubmit: v => w(path('merge'), v, 'merge:' + pid + v.into_id).then(res => { location.hash = '#admin/spieler/' + encodeURIComponent(res.player.id); })}); }
    if (a === 'photo-remove') return openForm({title: 'Profilbild entfernen', intro: '<p>Das Foto wird gelöscht, der Spieler erscheint wieder mit seiner Kugel und bekommt die Begründung.</p>', fields: [reasonField()], submit: 'Entfernen', danger: true,
      onSubmit: v => w(path('remove-photo'), v, 'photo:' + pid + Date.now()).then(done)});
    if (a === 'revoke') return openForm({title: 'Auszeichnung entziehen', intro: `<p>„${e(el.dataset.name)}“ verschwindet aus Vitrine und Titelauswahl. Der Spieler wird mit Begründung informiert.</p>`, fields: [reasonField()], submit: 'Entziehen', danger: true,
      onSubmit: v => w(path('revoke'), {honor_id: el.dataset.id, reason: v.reason}, 'revoke:' + pid + el.dataset.id).then(done)});
    // Streitfälle
    if (a === 'resolve-accept') return openForm({title: 'Vorschlag bestätigen', intro: `<p>Das Ergebnis ${e(el.dataset.a)}:${e(el.dataset.b)} wird gewertet.</p>`, fields: [reasonField('Begründung', 'z. B. „Mit beiden gesprochen“. Beide Spieler sehen sie.')], submit: 'Bestätigen',
      onSubmit: v => w(`/admin/matches/${encodeURIComponent(el.dataset.id)}/resolve`, {score_a: Number(el.dataset.a), score_b: Number(el.dataset.b), reason: v.reason}, 'res:' + el.dataset.id)});
    if (a === 'resolve') { const m = ad.disputed.matches.find(x => x.id === el.dataset.id); return openForm({title: 'Ergebnis festlegen', fields: [{id: 'score_a', label: m.teams[0].map(p => p.name).join(' & '), type: 'number', min: 0, maxv: 7, value: ''}, {id: 'score_b', label: m.teams[1].map(p => p.name).join(' & '), type: 'number', min: 0, maxv: 7, value: ''}, reasonField()], submit: 'Ergebnis werten',
      onSubmit: v => w(`/admin/matches/${encodeURIComponent(m.id)}/resolve`, {score_a: Number(v.score_a), score_b: Number(v.score_b), reason: v.reason}, 'res:' + m.id + v.score_a + v.score_b)}); }
    if (a === 'void') return openForm({title: 'Partie annullieren', intro: '<p>Die Partie zählt nicht für Wertung, Liga und Erfolge. Sie bleibt im Verlauf sichtbar.</p>', fields: [reasonField()], submit: 'Annullieren', danger: true,
      onSubmit: v => w(`/admin/matches/${encodeURIComponent(el.dataset.id)}/void`, {reason: v.reason}, 'void:' + el.dataset.id)});
    // Katalog
    if (a === 'archive') return act(() => w(`/admin/catalog/${encodeURIComponent(el.dataset.id)}/archive`, {}, 'arch:' + el.dataset.id + Date.now()));
    if (a === 'cat-new') return openForm({title: 'Neue Vorlage', fields: [
      {id: 'name', label: 'Name', required: true, placeholder: 'z. B. Turniersieger 8-Ball'},
      {id: 'kind', label: 'Art', type: 'select', value: 'pokal', options: Object.entries(KIND)},
      {id: 'tier', label: 'Metall', type: 'select', value: '3', options: [['3', 'Gold'], ['2', 'Silber'], ['1', 'Bronze']], showIf: v => v.kind !== 'gutschein'},
      {id: 'valid_days', label: 'Gültig (Tage)', type: 'number', value: 90, min: 7, maxv: 365, showIf: v => v.kind === 'gutschein'},
      {id: 'sponsor', label: 'Sponsor (optional)', placeholder: 'z. B. Getränkelieferant'},
      {id: 'description', label: 'Beschreibung (optional)', type: 'textarea', max: 140}], submit: 'Anlegen',
      onSubmit: v => w('/admin/catalog', v, 'cat:' + v.name + v.kind)});
    // Events
    if (a === 'event-new' || a === 'event-edit') {
      const ev = a === 'event-edit' ? ad.events.events.find(x => x.id === el.dataset.id) : {};
      const local = ev.starts_at ? new Date(new Date(ev.starts_at).getTime() - new Date(ev.starts_at).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '';
      return openForm({title: ev.id ? 'Event bearbeiten' : 'Neues Event', fields: [
        {id: 'type', label: 'Art', type: 'select', value: ev.type || 'Turnier', options: ['Turnier', 'Einsteigerabend', 'Doppel', 'Siegerehrung', 'Aktion'].map(x => [x, x])},
        {id: 'title', label: 'Titel', value: ev.title, required: true},
        {id: 'starts_at', label: 'Beginn', type: 'datetime-local', value: local, required: true},
        {id: 'place', label: 'Ort', value: ev.place, placeholder: 'z. B. Tische 1–4'},
        {id: 'price', label: 'Preis', value: ev.price, placeholder: 'z. B. 10 € Startgeld'},
        {id: 'capacity', label: 'Plätze (leer = ohne Anmeldung)', type: 'number', value: ev.capacity ?? '', min: 2, maxv: 64},
        {id: 'sponsor', label: 'Sponsor (optional)', value: ev.sponsor},
        {id: 'description', label: 'Beschreibung', type: 'textarea', value: ev.description, max: 300}], submit: 'Speichern',
        onSubmit: v => w('/admin/events', {...v, id: ev.id, starts_at: v.starts_at ? new Date(v.starts_at).toISOString() : ''}, 'ev:' + (ev.id || 'new') + v.title + v.starts_at)});
    }
    if (a === 'event-del') return openForm({title: 'Event löschen', intro: `<p>„${e(el.dataset.name)}“ wird entfernt. Angemeldete Spieler sollten Bescheid bekommen.</p>`, submit: 'Löschen', danger: true,
      onSubmit: () => w(`/admin/events/${encodeURIComponent(el.dataset.id)}/delete`, {}, 'evdel:' + el.dataset.id)});
    // Wochenaufgaben
    if (a === 'quest-new' || a === 'quest-edit') {
      const d = ad.quests, q = a === 'quest-edit' ? d.quests.find(x => x.id === el.dataset.id) : {type: 'weekday', goal: 1, weekday: 1};
      return openForm({title: q.id ? 'Aufgabe bearbeiten' : 'Neue Wochenaufgabe', fields: [
        {id: 'title', label: 'Titel', value: q.title, required: true, placeholder: 'z. B. Dienstagsspieler'},
        {id: 'text', label: 'Beschreibung für Spieler', value: q.text, placeholder: 'z. B. Spiel eine Partie an einem Dienstag.'},
        {id: 'type', label: 'Art', type: 'select', value: q.type, options: Object.entries(d.types)},
        {id: 'pool', label: 'Disziplin', type: 'select', value: q.pool || '9-single', options: Object.entries(d.pools), showIf: v => v.type === 'pool'},
        {id: 'weekday', label: 'Wochentag', type: 'select', value: q.weekday ?? 1, options: d.weekdays.map((n, i) => [i, n]), showIf: v => v.type === 'weekday'},
        {id: 'goal', label: 'Ziel (Anzahl)', type: 'number', value: q.goal, min: 1, maxv: 10}], submit: 'Speichern',
        onSubmit: v => w('/admin/quests', {...v, id: q.id, goal: Number(v.goal)}, 'quest:' + (q.id || 'new') + JSON.stringify(v))});
    }
    if (a === 'quest-del') return openForm({title: 'Aufgabe löschen', intro: `<p>„${e(el.dataset.name)}“ verschwindet sofort aus den Wochenaufgaben.</p>`, submit: 'Löschen', danger: true,
      onSubmit: () => w(`/admin/quests/${encodeURIComponent(el.dataset.id)}/delete`, {}, 'qdel:' + el.dataset.id)});
  });
  document.addEventListener('submit', async event => {
    const form = event.target.closest('[data-adform]');
    if (!form) return;
    event.preventDefault();
    const kind = form.dataset.adform;
    if (kind === 'lookup') {
      const code = form.code.value.trim().toUpperCase();
      ad.lookupCode = code; ad.lookup = null; ad.lookupError = '';
      if (!code) { ad.lookupError = 'Bitte den Code eingeben.'; app().render(); return; }
      try { ad.lookup = (await app().request('/admin/vouchers/' + encodeURIComponent(code))).voucher; } catch (er) { ad.lookupError = er.message; }
      app().render(); return;
    }
    if (kind === 'psearch') { ad.playerQuery = form.q.value.trim(); ad.players = null; app().render(); await reload(); document.querySelector('#ad-psearch')?.focus(); return; }
    if (kind === 'dialog') {
      const vals = Object.fromEntries([...form.querySelectorAll('[name]')].filter(el => !el.closest('[hidden]')).map(el => [el.name, el.value.trim()]));
      const out = form.querySelector('#ad-dialog-error');
      const missing = dlgFields.find(f => f.required && !form.querySelector(`[data-field="${f.id}"]`)?.hidden && !vals[f.id]);
      if (missing) { out.hidden = false; out.textContent = `Bitte „${missing.label}“ ausfüllen.`; return; }
      const btn = form.querySelector('[type=submit]'); btn.disabled = true;
      try { await dlgSubmit(vals); form.closest('dialog').close(); await reload(); }
      catch (er) { out.hidden = false; out.textContent = er.message; btn.disabled = false; }
    }
  });
  document.addEventListener('change', event => { if (event.target.closest('#ad-dialog')) applyShowIf(); });
  document.addEventListener('input', event => {
    const el = event.target.closest('[data-adi]');
    if (!el || !ad.issue) return;
    ad.issue[el.dataset.adi] = el.value;
    if (el.dataset.adi === 'q') { app().render(); return; }
    if (el.dataset.adi === 'reason') { const b = document.querySelector('[data-ad="issue-go"]'); if (b) b.disabled = !(ad.issuePreview && el.value.trim().length >= 3); return; }
    if (el.dataset.adi !== 'note') schedulePreview(); else { const em = document.querySelector('.ad-ticket-big em'); if (em) em.textContent = el.value; }
  });
  document.addEventListener('click', event => {
    const pick = event.target.closest('[data-adi-pick]'), tog = event.target.closest('[data-adi-toggle]');
    if (!ad.issue || (!pick && !tog)) return;
    const y = window.scrollY;
    if (pick) ad.issue[pick.dataset.adiPick] = pick.dataset.v;
    if (tog) { const id = tog.dataset.adiToggle, l = ad.issue.player_ids; ad.issue.player_ids = l.includes(id) ? l.filter(x => x !== id) : [...l, id]; }
    ad.issuePreview = null; app().render(); window.scrollTo(0, y); schedulePreview();
  });

  // ---------- Navigation: „Verwaltung“ statt „Erfolge“ für das Café-Team ----------
  let navOriginal = null;
  function afterRender(state) {
    const rl = role(state);
    const link = document.querySelector('.bottom-nav a[data-tab="erfolge"], .bottom-nav a[data-tab="admin"]');
    if (!link) return;
    if (!navOriginal) navOriginal = {html: link.innerHTML};
    if (rl && link.dataset.tab !== 'admin') {
      link.dataset.tab = 'admin'; link.href = '#admin';
      link.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 21V9l8-6 8 6v12M9 21v-6h6v6"/></svg><span>Verwaltung</span>';
    } else if (!rl && link.dataset.tab === 'admin') {
      link.dataset.tab = 'erfolge'; link.href = '#erfolge'; link.innerHTML = navOriginal.html;
    }
    const r = app().route();
    if (link.dataset.tab === r.tab) link.setAttribute('aria-current', 'page'); else if (link.dataset.tab === 'admin') link.removeAttribute('aria-current');
  }

  window.BillardAdmin = {load, view, afterRender};
})();
