'use strict';
/*
 * ERWEITERUNGEN (Prototyp)
 * ------------------------
 * Liga-Wertung pro Café-Liga, Titel des Monats, Stufen & Fortschritt, Gewinnchance,
 * Wochenaufgaben, Bonusheft mit Gutschein, Abzeichen, Events und Café-Bildschirm.
 *
 * Alle Daten kommen über BillardApp.request(...) vom Server (bzw. in der Demo von demo-api.js).
 * Benötigte neue Endpunkte: siehe UEBERGABE.md.
 */
(() => {
  const e = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const app = () => window.BillardApp;
  const fx = {achievements: null, events: null, tables: null, feed: null, odds: {}, boardMode: 'liga', tvTimer: null, tvSlide: 0, clock: null};
  const ROMAN = ['', 'I', 'II', 'III'];
  const LIGEN = ['1. Café-Liga', '2. Café-Liga', '3. Café-Liga', '4. Café-Liga'];
  const PRIZES = {'1. Café-Liga': '1 Tischstunde + Gravur', '2. Café-Liga': '1 Tischstunde', '3. Café-Liga': '1 Tischstunde', '4. Café-Liga': '1 Tischstunde'};
  const BALL = ['#f2c230','#2463b8','#d2392f','#6b3fa0','#e8742a','#2d8a4e','#8a2b2b','#1b1b1b','#f2c230','#2463b8'];
  const time = v => new Intl.DateTimeFormat('de-DE', {timeZone: 'Europe/Berlin', weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'}).format(new Date(v)) + ' Uhr';
  const minutes = since => Math.max(0, Math.floor((Date.now() - Date.parse(since)) / 60000));
  const duration = since => { const m = minutes(since); return m < 60 ? `${m} Min` : `${Math.floor(m / 60)} Std ${String(m % 60).padStart(2, '0')}`; };

  async function get(key, path) {
    try { fx[key] = await app().request(path); fx[key + 'Error'] = ''; }
    catch (err) { fx[key + 'Error'] = err.message; }
  }
  async function load(view, state) {
    const signed = !!state.session?.authenticated;
    const jobs = [];
    if (['home', 'tv'].includes(view)) jobs.push(get('tables', '/tables'));
    if (['home', 'events', 'tv'].includes(view)) jobs.push(get('events', '/events'));
    if (view === 'tv') jobs.push(get('feed', '/feed'), get('tvBoard', '/leaderboard?' + new URLSearchParams({pool: '8-single', month: state.boardMonth})));
    if (signed && ['home', 'erfolge', 'profile', 'tv'].includes(view)) jobs.push(get('achievements', '/achievements'));
    await Promise.all(jobs);
    const unseen = fx.achievements?.unseen;
    if (unseen?.length) { app().notify('🎱 ' + unseen.join(' · ')); fx.achievements.unseen = []; }
  }

  // ---------- Start-Bildschirm ----------
  function home(signed) {
    const free = fx.tables?.tables?.filter(t => t.status === 'free').length;
    const total = fx.tables?.tables?.length;
    const next = fx.events?.events?.[0];
    const week = fx.achievements?.week || [];
    const done = week.filter(q => q.done).length;
    return `<section class="fx-home" aria-label="Im Café">
      <a class="fx-tile" href="#tv"><span class="fx-tile-label">Tische jetzt</span><strong>${free == null ? '…' : `${free} von ${total} frei`}</strong><span class="fx-tables-mini" aria-hidden="true">${(fx.tables?.tables || []).map(t => `<i class="${t.status}"></i>`).join('')}</span></a>
      ${signed ? `<a class="fx-tile" href="#erfolge"><span class="fx-tile-label">Wochenaufgaben</span><strong>${week.length ? `${done} von ${week.length} geschafft` : '…'}</strong><span class="fx-tile-sub">${fx.achievements ? `${fx.achievements.stamps.count}/10 Stempel im Bonusheft` : ''}</span></a>` : ''}
      ${next ? `<a class="fx-tile fx-tile-wide" href="#events"><span class="fx-tile-label">Nächstes Event · ${e(next.type)}</span><strong>${e(next.title)}</strong><span class="fx-tile-sub">${e(time(next.starts_at))}${next.registered ? ' · du bist dabei' : ''}</span></a>` : ''}
    </section>`;
  }

  // ---------- Bausteine: Avatar & Lorbeer ----------
  const hue = name => [...String(name)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 17);
  const initials = name => String(name).replace(/[^A-Za-zÄÖÜäöüß0-9 -]/g, '').split(/[\s-]+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('') || '?';
  function avatar(name, ring = '', size = 44) {
    return `<span class="fx-av ${ring}" style="--h:${hue(name)};--s:${size}px" aria-hidden="true"><span>${e(initials(name))}</span></span>`;
  }
  function laurel(cls = '') {
    // zwei Lorbeerzweige als Bogen aus Blättern
    const leaves = side => Array.from({length: 8}, (_, i) => {
      const t = -70 + i * 18, a = t * Math.PI / 180, r = 46;
      const x = 60 + side * Math.cos(a) * r, y = 56 - Math.sin(a) * r;
      const rot = side * (-t + 28);
      return `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="4" ry="9.5" transform="rotate(${rot.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)})"/>`;
    }).join('');
    return `<svg class="fx-laurel ${cls}" viewBox="0 0 120 110" aria-hidden="true"><defs><linearGradient id="fxg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff0c2"/><stop offset=".5" stop-color="#e8b85f"/><stop offset="1" stop-color="#a8702a"/></linearGradient></defs><g fill="url(#fxg)" stroke="none">${leaves(1)}${leaves(-1)}</g></svg>`;
  }
  const crown = '<svg class="fx-crown" viewBox="0 0 40 26" aria-hidden="true"><path d="M3 22 1 6l10 8 9-12 9 12 10-8-2 16Z" fill="url(#fxg)" stroke="#5a3a12" stroke-width="1"/><circle cx="20" cy="15" r="2.6" fill="#5fe3d3"/></svg>';

  // ---------- Rangliste: Monatsliga mit Podium ----------
  function board(data, tableHTML, state) {
    const tabs = `<div class="fx-switch" role="tablist" aria-label="Ansicht der Rangliste"><button type="button" role="tab" data-fx="board-mode" data-mode="liga" aria-selected="${fx.boardMode === 'liga'}">Monatsliga</button><button type="button" role="tab" data-fx="board-mode" data-mode="table" aria-selected="${fx.boardMode === 'table'}">Gesamttabelle</button></div>`;
    if (fx.boardMode === 'table' || !data || !data.rows?.length) return tabs + tableHTML;
    const me = String(state.session?.user?.id || '');
    const groups = [...LIGEN.map(liga => ({key: liga, label: liga.replace(' Café-Liga', ''), rows: data.rows.filter(r => r.rank === liga)})),
      {key: 'neu', label: 'Neu', rows: data.rows.filter(r => r.provisional)}].filter(g => g.rows.length);
    groups.forEach(g => g.rows.sort((a, b) => b.league_points - a.league_points || b.wins - a.wins));
    const mine = groups.find(g => g.rows.some(r => String(r.player.id) === me));
    if (!groups.some(g => g.key === fx.liga)) fx.liga = mine?.key || groups[0]?.key;
    const g = groups.find(x => x.key === fx.liga);
    const top = g.rows.slice(0, 3), rest = g.rows.slice(3);
    const order = [top[1], top[0], top[2]];
    const ringOf = i => ['gold', 'silver', 'bronze'][i];
    const podium = top.length ? `<section class="fx-podium" aria-label="Top 3 der ${e(g.label === 'Neu' ? 'Platzierung' : g.key)}">
      ${laurel('fx-podium-laurel')}
      ${order.map(r => { if (!r) return '<div class="fx-pod empty"></div>'; const i = top.indexOf(r);
        return `<div class="fx-pod p${i + 1} ${String(r.player.id) === me ? 'own' : ''}">${i === 0 ? crown : ''}<div class="fx-pod-frame">${avatar(r.player.name, ringOf(i), i === 0 ? 86 : 64)}<span class="fx-pod-no">${i + 1}</span></div><strong>${e(r.player.name)}</strong><span class="fx-pts-pill"><b>${r.league_points}</b> P.</span><small>${r.wins}–${r.losses}${r.tier ? ` · Stufe ${ROMAN[r.tier]}` : ''}</small></div>`; }).join('')}
    </section>` : '';
    const row = (r, i) => `<li class="fx-row ${String(r.player.id) === me ? 'own' : ''}">${avatar(r.player.name, '', 42)}<span class="fx-row-main"><strong>${e(r.player.name)}${String(r.player.id) === me ? ' <em>du</em>' : ''}</strong><span class="fx-row-tags">${r.tier ? `<span class="fx-tag">Stufe ${ROMAN[r.tier]}</span>` : `<span class="fx-tag">${Math.min(4, r.placement_games)}/4 Platzierung</span>`}${r.bonus ? `<span class="fx-tag gold">+${r.bonus} Bonus</span>` : ''}<span class="fx-row-rec">${r.wins}–${r.losses}</span></span></span><span class="fx-row-end"><b>${String(i + 1).padStart(2, '0')}</b><small>${r.league_points} P.</small></span></li>`;
    const ownIndex = g.rows.findIndex(r => String(r.player.id) === me);
    const ownRow = mine && mine.key !== g.key ? mine.rows.find(r => String(r.player.id) === me) : null;
    const sticky = ownIndex >= 3 ? g.rows[ownIndex] : ownIndex < 0 ? ownRow : null;
    const stickyPos = ownIndex >= 0 ? ownIndex + 1 : mine ? mine.rows.indexOf(ownRow) + 1 : 0;
    const titles = data.titles || {};
    const fame = [
      ['Stammgast', titles.regular?.player?.name, titles.regular ? `${titles.regular.days} Spieltage` : '', '1 Tischstunde', 'silver'],
      ['Champion des Hauses', titles.champion?.player?.name, '1. Café-Liga · Platz 1', 'Wanderpokal', 'gold'],
      ['Aufsteiger', titles.climber?.player?.name, 'größter Sprung', 'Sponsorpreis', 'bronze']
    ];
    return tabs + `
      <nav class="fx-ligen" aria-label="Café-Liga wählen">${groups.map(x => `<button type="button" data-fx="liga" data-liga="${e(x.key)}" aria-pressed="${x.key === g.key}">${e(x.label)}${x.key !== 'neu' ? '<small>Liga</small>' : '<small>Platzierung</small>'}</button>`).join('')}</nav>
      <p class="fx-prize-line">${g.key === 'neu' ? 'Nach vier bestätigten Begegnungen geht es in die erste Café-Liga.' : `Monatssieg der ${e(g.key)}: <b>${e(PRIZES[g.key])}</b>`}</p>
      ${podium}
      ${rest.length ? `<ol class="fx-rows" start="4">${rest.map((r, i) => row(r, i + 3)).join('')}</ol>` : ''}
      ${sticky ? `<div class="fx-own-sticky" aria-label="Deine Platzierung">${avatar(sticky.player.name, 'gold', 40)}<span class="fx-row-main"><strong>${e(sticky.player.name)}</strong><small>${e(mine.key === 'neu' ? 'In der Platzierung' : mine.key)}${ownIndex < 0 ? ' · andere Liga' : ''}</small></span><span class="fx-row-end"><b>${String(stickyPos).padStart(2, '0')}</b><small>${sticky.league_points} P.</small></span></div>` : ''}
      <section class="fx-fame" aria-labelledby="fx-fame-title">
        <div class="fx-banner"><span>Hall of Fame</span></div>
        <h2 id="fx-fame-title" class="fx-month">${e(new Intl.DateTimeFormat('de-DE', {month: 'long', year: 'numeric'}).format(new Date(data.month + '-15T12:00:00Z')))}</h2>
        <div class="fx-fame-grid">${fame.map(([t, name, sub, prize, ring]) => `<article class="fx-fame-card ${ring}">${ring === 'gold' ? crown : ''}${avatar(name || '–', ring, ring === 'gold' ? 72 : 56)}<span class="fx-fame-title">${e(t)}</span><strong>${e(name || 'noch offen')}</strong><small>${e(sub)}</small><span class="fx-prize">${e(prize)}</span></article>`).join('')}</div>
      </section>
      <p class="table-caption">Monatsliga: Sieg 3 Punkte, Niederlage 1 Punkt fürs Mitspielen, +1 gegen eine höhere Café-Liga. Derselbe Gegner zählt höchstens dreimal im Monat. Höchstens ein Monatspreis pro Person.</p>`;
  }

  // ---------- Profil: Stufe & Fortschritt ----------
  function ratingExtras(pool, rating) {
    if (!rating?.rank || !rating.tier) return '';
    const order = ['4. Café-Liga', '3. Café-Liga', '2. Café-Liga', '1. Café-Liga'];
    const cur = order.indexOf(rating.rank);
    const pct = Math.round((rating.progress || 0) * 100);
    return `<div class="fx-path" aria-label="Liga-Pfad: ${e(rating.rank)}, Stufe ${rating.tier} von 3">
      <ol>${order.map((l, i) => `<li class="${i < cur ? 'done' : i === cur ? 'now' : ''}"><span>${e(l.slice(0, 2))}</span></li>`).join('')}</ol>
      <div class="fx-bar"><i style="width:${(cur * 100 + pct) / 4}%"></i></div>
      <p><b>Stufe ${ROMAN[rating.tier]}</b> ${rating.next_rank ? `· nächstes Ziel: ${e(rating.next_rank)}` : '· höchste Liga erreicht'}</p>
    </div>`;
  }
  function profileExtras() {
    const a = fx.achievements;
    if (!a) return '';
    const earned = a.badges.filter(b => b.tier > 0).length;
    return `<a class="fx-tile fx-tile-wide fx-profile-link" href="#erfolge"><span class="fx-tile-label">Erfolge</span><strong>${earned} von ${a.badges.length} Abzeichen · ${a.stamps.count}/10 Stempel</strong><span class="fx-tile-sub">Wochenaufgaben, Bonusheft und Abzeichen ansehen →</span></a>`;
  }

  // ---------- Neue Partie: Gewinnchance ----------
  function matchup(w, state) {
    if (w.pool === '8-double' || w.pool === '14-single') return '';
    const opp = w.teams?.[1]?.[0];
    if (!opp) return '';
    const wins = ({1: 1, 3: 2, 7: 4})[Number(w.best_of)] || 3;
    const key = `${w.pool}:${opp}:${wins}`;
    const data = fx.odds[key];
    if (!data) {
      fx.odds[key] = 'loading';
      app().request('/odds?' + new URLSearchParams({pool: w.pool, opponent: opp, wins})).then(d => { fx.odds[key] = d; app().render(); }).catch(() => { fx.odds[key] = 'error'; app().render(); });
      return `<div class="fx-odds">Gewinnchance wird berechnet …</div>`;
    }
    if (data === 'loading') return `<div class="fx-odds">Gewinnchance wird berechnet …</div>`;
    if (data === 'error') return '';
    const oppName = state.players?.find(p => String(p.id) === String(opp))?.name || 'Gegenseite';
    const p = data.game_win_probability, pct = Math.round(p * 100);
    const ratio = `etwa ${Math.min(9, Math.max(1, Math.round(p * 10)))} von 10 Spielen`;
    return `<section class="fx-odds" aria-label="Gewinnchance">
      <span class="fx-tile-label">Vor dem Anstoß</span>
      <p>Laut Spielstärke gewinnst du ${ratio} gegen ${e(oppName)}.${data.provisional ? ' <small>(noch ungenau – Platzierung läuft)</small>' : ''}</p>
      <div class="fx-odds-bar" role="img" aria-label="Du ${pct} Prozent, ${e(oppName)} ${100 - pct} Prozent je Spiel"><i style="width:${pct}%"><span>Du ${pct} %</span></i><span>${e(oppName)} ${100 - pct} %</span></div>
      ${data.suggestion ? `<p class="hint">Fairer Vorschlag (freiwillig): du spielst auf <b>${data.suggestion.race_self}</b>, ${e(oppName)} auf <b>${data.suggestion.race_opponent}</b>. Die Wertung berücksichtigt das automatisch, weil jedes Spiel einzeln zählt.</p>` : '<p class="hint">Ausgeglichene Partie – keine Vorgabe nötig.</p>'}
    </section>`;
  }

  // ---------- Erfolge ----------
  function erfolge(state) {
    if (!state.session?.authenticated) return `<div class="narrow"><div class="empty-state"><p class="eyebrow">Erfolge</p><h1>Bitte anmelden</h1><p>Wochenaufgaben, Bonusheft und Abzeichen gehören zu deinem Profil.</p><a class="btn primary" href="#profil">Zur Anmeldung</a></div></div>`;
    const a = fx.achievements;
    if (!a) return fx.achievementsError ? `<div class="narrow"><div class="callout error"><p>${e(fx.achievementsError)}</p></div></div>` : '<div class="loading" role="status">Erfolge werden geladen …</div>';
    const s = a.stamps;
    const open = s.vouchers.filter(v => !v.redeemed_at);
    const stampBalls = Array.from({length: s.goal}, (_, i) => `<span class="fx-ball ${i < s.count ? 'on' : ''} ${i === 7 ? 'eight' : ''} ${i >= 8 ? 'stripe' : ''}" style="--ball:${BALL[i]}" aria-hidden="true"><b>${i + 1}</b></span>`).join('');
    return `<div class="page-heading"><p class="eyebrow">Dein Fortschritt</p><h1>Erfolge</h1><p class="muted">Mitspielen lohnt sich – nicht nur gewinnen.</p></div>
      <section class="fx-card fx-stamps" aria-labelledby="fx-stamps-title">
        <div class="section-heading"><h2 id="fx-stamps-title">Bonusheft</h2><span class="fx-count">${s.count}/${s.goal}</span></div>
        <div class="fx-rack" role="img" aria-label="${s.count} von ${s.goal} Stempeln">${stampBalls}</div>
        <p class="hint">Einen Stempel gibt es pro Spieltag mit belegtem Tisch und für jede Wochenaufgabe. Bei ${s.goal} Stempeln: <b>${e(s.reward)}</b>.</p>
        <button type="button" class="btn primary" data-fx="voucher-new" ${s.count < s.goal ? 'disabled' : ''}>${s.count < s.goal ? `Noch ${s.goal - s.count} Stempel bis zum Gutschein` : 'Gutschein erstellen'}</button>
        ${s.vouchers.length ? `<ul class="fx-vouchers">${s.vouchers.map(v => `<li><span><strong>${e(v.title)}</strong><small>${v.redeemed_at ? `eingelöst am ${e(new Date(v.redeemed_at).toLocaleDateString('de-DE'))}` : `gültig bis ${e(new Date(v.valid_until).toLocaleDateString('de-DE'))}`}</small></span>${v.redeemed_at ? '<span class="badge confirmed">Eingelöst</span>' : `<button type="button" class="btn small" data-fx="voucher-show" data-code="${e(v.code)}">An der Theke zeigen</button>`}</li>`).join('')}</ul>` : ''}
        ${open.length ? '' : '<p class="hint fx-demo-hint">Demo-Tipp: Bestätige auf „Spielen“ das offene Ergebnis gegen Bande-Bernd – das bringt Stempel.</p>'}
      </section>
      <section class="fx-card" aria-labelledby="fx-week-title">
        <div class="section-heading"><h2 id="fx-week-title">Wochenaufgaben</h2><span class="fx-count">${a.week.filter(q => q.done).length}/${a.week.length}</span></div>
        <ul class="fx-quests">${a.week.map(q => `<li class="${q.done ? 'done' : ''}"><span class="fx-check" aria-hidden="true">${q.done ? '✓' : ''}</span><span><strong>${e(q.title)}</strong><small>${e(q.text)}</small></span><span class="fx-quest-meta">${q.progress}/${q.goal}<small>${e(q.reward)}</small></span></li>`).join('')}</ul>
        <p class="hint">Neue Aufgaben jeden Montag. Das Café kann eigene Aufgaben einstellen, zum Beispiel für ruhige Wochentage.</p>
      </section>
      <section class="fx-card" aria-labelledby="fx-badges-title">
        <div class="section-heading"><h2 id="fx-badges-title">Abzeichen</h2><span class="fx-count">${a.badges.filter(b => b.tier).length}/${a.badges.length}</span></div>
        <ul class="fx-badges">${a.badges.map(b => {
          const levels = b.steps.length > 1 ? ['Bronze', 'Silber', 'Gold'] : ['Erreicht'];
          const level = b.tier ? levels[b.tier - 1] : 'Noch offen';
          return `<li class="tier-${b.steps.length > 1 ? b.tier : (b.tier ? 3 : 0)}"><span class="fx-medal" aria-hidden="true">${e(b.title.slice(0, 1))}</span><span><strong>${e(b.title)}</strong><small>${e(b.text)}</small><small class="fx-level">${e(level)}${b.next != null ? ` · ${Math.min(b.value, b.next)}/${b.next} ${e(b.unit)}` : ''}</small></span></li>`;
        }).join('')}</ul>
      </section>
      <dialog id="fx-voucher" class="fx-dialog" aria-labelledby="fx-voucher-title"></dialog>`;
  }
  function voucherDialog(code) {
    const v = fx.achievements?.stamps.vouchers.find(x => x.code === code);
    const dlg = document.querySelector('#fx-voucher');
    if (!v || !dlg) return;
    let qr = '';
    try { const q = window.qrcode(0, 'M'); q.addData(`BCM-GUTSCHEIN:${v.code}`); q.make(); qr = q.createSvgTag({cellSize: 6, margin: 2, scalable: true}); } catch { qr = ''; }
    dlg.innerHTML = `<div class="fx-dialog-body"><p class="eyebrow">Gutschein · einmalig</p><h2 id="fx-voucher-title">${e(v.title)}</h2>
      <div class="fx-qr">${qr || '<p class="hint">QR-Code nicht verfügbar – der Code unten genügt.</p>'}</div>
      <p class="fx-code">${e(v.code)}</p>
      <p class="hint">Zeig diesen Code an der Theke. Das Personal scannt ihn, die App markiert ihn sofort als eingelöst, und der Rabatt wird ganz normal in der Kasse gebucht.</p>
      <div class="fx-staff"><span class="fx-tile-label">Ansicht für das Personal (Demo)</span><button type="button" class="btn small cream" data-fx="voucher-redeem" data-code="${e(v.code)}">Scannen & einlösen</button><p id="fx-redeem-result" class="hint" role="status"></p></div>
      <button type="button" class="btn" data-fx="dialog-close">Schließen</button></div>`;
    dlg.showModal();
  }

  // ---------- Events ----------
  function events(state) {
    const list = fx.events?.events;
    const signed = !!state.session?.authenticated;
    if (!list) return fx.eventsError ? `<div class="callout error"><p>${e(fx.eventsError)}</p></div>` : '<div class="loading" role="status">Events werden geladen …</div>';
    return `<div class="page-heading"><p class="eyebrow">Im Billardcafé Merzig</p><h1>Events</h1><p class="muted">Turniere, Einsteigerabende und Siegerehrungen.</p></div>
      <div class="row-list">${list.map(ev => `<article class="fx-event">
        <div class="fx-event-date"><span>${e(new Intl.DateTimeFormat('de-DE', {timeZone: 'Europe/Berlin', weekday: 'short'}).format(new Date(ev.starts_at)))}</span><strong>${e(new Intl.DateTimeFormat('de-DE', {timeZone: 'Europe/Berlin', day: '2-digit'}).format(new Date(ev.starts_at)))}</strong><span>${e(new Intl.DateTimeFormat('de-DE', {timeZone: 'Europe/Berlin', month: 'short'}).format(new Date(ev.starts_at)))}</span></div>
        <div class="fx-event-body"><span class="fx-tile-label">${e(ev.type)} · ${e(new Intl.DateTimeFormat('de-DE', {timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit'}).format(new Date(ev.starts_at)))} Uhr · ${e(ev.place)}</span><h3>${e(ev.title)}</h3><p>${e(ev.description)}</p>
          <p class="fx-event-meta"><span>${e(ev.price)}</span>${ev.capacity ? `<span>${ev.participants}/${ev.capacity} angemeldet</span>` : ''}${ev.sponsor ? `<span>präsentiert von ${e(ev.sponsor)}</span>` : ''}</p>
          ${ev.capacity ? (signed ? `<button type="button" class="btn small ${ev.registered ? '' : 'primary'}" data-fx="event-register" data-id="${e(ev.id)}" data-register="${ev.registered ? '0' : '1'}">${ev.registered ? 'Abmelden' : 'Ich bin dabei'}</button>${ev.registered ? '<span class="fx-in">✓ Du bist angemeldet</span>' : ''}` : '<a class="btn small" href="#profil">Zum Anmelden einloggen</a>') : ''}
        </div></article>`).join('')}</div>
      <div class="callout"><p>Erinnerungen an Events kommen nur, wenn du sie im Profil einschaltest – getrennt nach Turnieren, Einsteigerabenden und Aktionen.</p><a href="#tv">Café-Bildschirm-Ansicht öffnen</a></div>`;
  }

  // ---------- Café-Bildschirm ----------
  function tv() {
    const tables = fx.tables?.tables || [];
    const rows = fx.tvBoard?.rows || [];
    const leaders = LIGEN.map(liga => [liga, rows.filter(r => r.rank === liga).sort((a, b) => b.league_points - a.league_points)[0]]).filter(([, r]) => r);
    const next = fx.events?.events?.[0];
    const slides = [
      `<h2>Monatsliga 8-Ball · Führende</h2><ul class="fx-tv-list">${leaders.map(([liga, r]) => `<li><span>${e(liga)}</span><strong>${e(r.player.name)}</strong><b>${r.league_points} P.</b></li>`).join('')}</ul>`,
      `<h2>Neu im Café</h2><ul class="fx-tv-list fx-tv-feed">${(fx.feed?.items || []).map(t => `<li>${e(t)}</li>`).join('')}</ul>`,
      next ? `<h2>Nächstes Event</h2><p class="fx-tv-big">${e(next.title)}</p><p class="fx-tv-sub">${e(time(next.starts_at))} · ${e(next.price)}</p>${next.capacity ? `<p class="fx-tv-sub">${next.participants}/${next.capacity} angemeldet – Anmeldung in der App</p>` : ''}` : '',
      `<h2>Wochenaufgaben</h2><ul class="fx-tv-list">${(fx.achievements?.week || []).map(q => `<li><strong>${e(q.title)}</strong><span>${e(q.text)}</span></li>`).join('')}</ul><p class="fx-tv-sub">Jede erledigte Aufgabe = 1 Stempel im Bonusheft</p>`
    ].filter(Boolean);
    const i = fx.tvSlide % slides.length;
    return `<div class="fx-tv">
      <header class="fx-tv-head"><img src="./icons/icon.svg" width="56" height="56" alt=""><div><strong>Billardcafé Merzig</strong><span>Rangliste · live</span></div><time id="fx-tv-clock"></time><a class="btn small" href="#events">Schließen</a></header>
      <section class="fx-tv-tables" aria-label="Tische"><h2>Tische</h2><ul>${tables.map(t => `<li class="${t.status}"><span class="fx-tv-no">${t.no}</span>${t.status === 'busy' ? `<span class="fx-tv-time" data-since="${e(t.since)}">${duration(t.since)}</span><small>läuft</small>` : '<span class="fx-tv-time">frei</span><small>QR am Tisch scannen</small>'}</li>`).join('')}</ul><p class="fx-tv-note">Belegung über den Gewichtssensor im Kugelfach · ohne Namen</p></section>
      <section class="fx-tv-slide" aria-live="off">${slides[i] || ''}<div class="fx-tv-dots">${slides.map((_, n) => `<i class="${n === i ? 'on' : ''}"></i>`).join('')}</div></section>
      <footer class="fx-tv-foot">Monatswertung präsentiert von Musterbrauerei (Demo-Sponsor) · Mitmachen: QR-Code am Tisch scannen</footer>
    </div>`;
  }
  function startTv() {
    stopTv();
    const tick = () => {
      const c = document.querySelector('#fx-tv-clock');
      if (c) c.textContent = new Intl.DateTimeFormat('de-DE', {timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit'}).format(new Date());
      document.querySelectorAll('.fx-tv-time[data-since]').forEach(el => { el.textContent = duration(el.dataset.since); });
    };
    tick(); fx.clock = setInterval(tick, 15000);
    fx.tvTimer = setInterval(() => { fx.tvSlide++; const host = document.querySelector('.fx-tv'); if (host && location.hash === '#tv') app().render(); }, 12000);
  }
  function stopTv() { clearInterval(fx.tvTimer); clearInterval(fx.clock); fx.tvTimer = fx.clock = null; }

  // ---------- Ansichten & Klicks ----------
  function view(name, state) {
    document.body.classList.toggle('fx-tv-mode', name === 'tv');
    if (name !== 'tv') stopTv();
    if (name === 'erfolge') return erfolge(state);
    if (name === 'events') return events(state);
    if (name === 'tv') { if (!fx.tvTimer) setTimeout(startTv); return tv(); }
    return '';
  }
  document.addEventListener('click', async event => {
    const el = event.target.closest('[data-fx]');
    if (!el) return;
    const action = el.dataset.fx;
    if (action === 'board-mode') { fx.boardMode = el.dataset.mode; app().render(); return; }
    if (action === 'liga') { fx.liga = el.dataset.liga; app().render(); return; }
    if (action === 'dialog-close') { el.closest('dialog')?.close(); return; }
    if (action === 'voucher-show') { voucherDialog(el.dataset.code); return; }
    try {
      if (action === 'voucher-new') {
        el.disabled = true;
        const {voucher} = await app().write('/vouchers', {}, 'voucher-new');
        await get('achievements', '/achievements'); app().render(); voucherDialog(voucher.code);
      }
      if (action === 'voucher-redeem') {
        const out = document.querySelector('#fx-redeem-result');
        try { await app().write(`/vouchers/${encodeURIComponent(el.dataset.code)}/redeem`, {}, 'redeem:' + el.dataset.code); out.textContent = '✓ Gültig – jetzt eingelöst. Rabatt in der Kasse buchen.'; el.disabled = true; await get('achievements', '/achievements'); }
        catch (err) { out.textContent = err.message; }
      }
      if (action === 'event-register') {
        el.disabled = true;
        await app().write(`/events/${encodeURIComponent(el.dataset.id)}/register`, {register: el.dataset.register === '1'}, 'event:' + el.dataset.id + ':' + el.dataset.register);
        await get('events', '/events'); app().render();
        app().notify(el.dataset.register === '1' ? 'Du bist angemeldet. Bis dann am Tisch!' : 'Du bist abgemeldet.');
      }
    } catch (err) { app().notify(err.message, true); el.disabled = false; }
  });
  document.addEventListener('close', event => { if (event.target.id === 'fx-voucher') app().render(); }, true);

  window.BillardFeatures = {load, home, board, ratingExtras, profileExtras, matchup, view};
})();
