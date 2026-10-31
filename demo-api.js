'use strict';
/*
 * DEMO-SERVER IM BROWSER
 * ----------------------
 * Ersetzt für die Prototyp-Vorschau den echten Server. Alle Anfragen an /api/…
 * werden hier beantwortet – mit erfundenen Spielern und Partien.
 * Es wird NICHTS an den echten Server gesendet, nichts dauerhaft gespeichert.
 * Neu laden = alles wieder wie am Anfang.
 *
 * Die Endpunkte unter "Neue Endpunkte" zeigen, was der echte Server für die
 * Erweiterungen zusätzlich liefern müsste (siehe UEBERGABE.md).
 */
(() => {
  // ---------- Hilfsfunktionen ----------
  let seed = 20261031;
  const rnd = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const pick = list => list[Math.floor(rnd() * list.length)];
  const DAY = 86400000;
  const berlinParts = d => Object.fromEntries(new Intl.DateTimeFormat('en', {timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short', hour: '2-digit', hourCycle: 'h23'}).formatToParts(d).map(p => [p.type, p.value]));
  const monthOf = d => { const p = berlinParts(new Date(d)); return `${p.year}-${p.month}`; };
  const dayOf = d => { const p = berlinParts(new Date(d)); return `${p.year}-${p.month}-${p.day}`; };
  const iso = t => new Date(t).toISOString();
  const now = () => Date.now();
  const startOfMonth = () => { const p = berlinParts(new Date()); return Date.now() - ((Number(p.day) - 1) * DAY) - Number(p.hour) * 3600000 - 1; };
  const startOfWeek = () => { const p = berlinParts(new Date()); const wd = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].indexOf(p.weekday); return Date.now() - wd * DAY - Number(p.hour) * 3600000 - 1; };
  const nextMonthStart = () => { const p = berlinParts(new Date()); let y = Number(p.year), m = Number(p.month) + 1; if (m > 12) { m = 1; y++; } return `${y}-${String(m).padStart(2, '0')}-01T00:00:00+01:00`; };

  // ---------- Spieler (erfunden) ----------
  const ME = 'p1';
  const names = ['Kreidefuchs','Bande-Bernd','Lena','Max','Jojo','Sascha','Tine','Kalle','Mira','Deniz','Ole','Ronja','Fritzi','Paul','Ahmet','Svenja','Timo','Nico','Hanna','Luca','Emre','Charly','Benni','Ilka'];
  const skill = [1085,1130,1215,1290,1010,940,1160,880,1250,1060,990,1110,905,1040,1335,975,1190,860,1020,1095,1265,930,1000,950];
  const players = names.map((name, i) => ({id: `p${i + 1}`, name, skill: skill[i]}));
  const byId = id => players.find(p => p.id === id);
  const POOLS = ['8-single','9-single','10-single','14-single','8-double'];
  const RANKS = [[1140,'1. Café-Liga'],[1050,'2. Café-Liga'],[960,'3. Café-Liga'],[-1e9,'4. Café-Liga']];
  const rankOf = r => RANKS.find(([min]) => r >= min)[1];
  const rankIndex = r => RANKS.findIndex(([min]) => r >= min); // 0 = beste Liga

  // Wertung je Disziplin: Elo pro einzelnem Spiel (wie vorgeschlagen)
  const ratings = {};      // ratings[pool][playerId] = {r, games(Begegnungen), wins, losses, history:[{t,r}]}
  POOLS.forEach(pool => { ratings[pool] = {}; players.forEach(p => { ratings[pool][p.id] = {r: 1000, games: 0, wins: 0, losses: 0, history: []}; }); });
  const K = rec => rec.games < 10 ? 40 : rec.r >= 1250 ? 12 : 20;
  const expected = (a, b) => 1 / (1 + Math.pow(10, (b - a) / 400));
  function applyMatch(m) {
    if (m.status !== 'confirmed' || !m.result) return;
    const R = ratings[m.pool];
    const side = i => m.teams[i].map(p => R[p.id]);
    const avg = recs => recs.reduce((s, x) => s + x.r, 0) / recs.length;
    const A = side(0), B = side(1);
    const games = m.pool === '14-single' ? [[m.result.score_a > m.result.score_b ? 1 : 0, 1]] : [[m.result.score_a, m.result.score_a + m.result.score_b]];
    for (const [wonA, total] of games) {
      const ea = expected(avg(A), avg(B));
      const delta = total ? (wonA - ea * total) : 0;
      A.forEach(x => { x.r += K(x) * delta; });
      B.forEach(x => { x.r -= K(x) * delta; });
    }
    const aWon = m.result.score_a > m.result.score_b;
    A.forEach(x => { x.games++; aWon ? x.wins++ : x.losses++; x.history.push({t: Date.parse(m.confirmed_at), r: x.r}); });
    B.forEach(x => { x.games++; aWon ? x.losses++ : x.wins++; x.history.push({t: Date.parse(m.confirmed_at), r: x.r}); });
  }

  // ---------- Partien erzeugen (letzte ~80 Tage, ein Drittel im aktuellen Monat) ----------
  const matches = [];
  let nextId = 1;
  const FORMATS = [[1,1],[5,3],[7,4]];
  function playRace(a, b, wins) { // a,b = Spielstärke; liefert Spielstand
    let sa = 0, sb = 0; const pa = expected(a, b);
    while (sa < wins && sb < wins) { rnd() < pa ? sa++ : sb++; }
    return [sa, sb];
  }
  function makeMatch({pool, teams, t, result, status = 'confirmed', bestOf, proposal = null}) {
    const id = `m${nextId++}`;
    return {id, version: 1, pool, best_of: bestOf, variant: pool === '8-double' ? 'aufnahme' : null, points_target: pool === '14-single' ? 50 : null,
      teams: teams.map(team => team.map(p => ({id: p.id, name: p.name}))), status, result, proposal,
      created_at: iso(t - 40 * 60000), played_at: iso(t - 5 * 60000), confirmed_at: status === 'confirmed' ? iso(t) : null,
      can_confirm: false, can_dispute: false, can_propose: false,
      audit_events: [{action: 'created', created_at: iso(t - 40 * 60000)}, {action: 'result_proposed', created_at: iso(t - 5 * 60000)}, ...(status === 'confirmed' ? [{action: 'confirmed', created_at: iso(t)}] : [])]};
  }
  const monthStart = startOfMonth();
  const times = [];
  for (let i = 0; i < 230; i++) {
    const inMonth = i % 3 === 0;
    const from = inMonth ? monthStart : now() - 80 * DAY, to = inMonth ? now() - 30 * 60000 : monthStart;
    let t = from + rnd() * Math.max(60000, to - from);
    const p = berlinParts(new Date(t)); t += (19 - Number(p.hour)) * 3600000 + rnd() * 3 * 3600000; // abends
    if (t > now() - 20 * 60000) t = now() - 20 * 60000 - rnd() * 3600000;
    times.push(t);
  }
  times.sort((a, b) => a - b);
  for (const t of times) {
    const roll = rnd();
    const pool = roll < .55 ? '8-single' : roll < .78 ? '9-single' : roll < .86 ? '10-single' : roll < .93 ? '14-single' : '8-double';
    const size = pool === '8-double' ? 2 : 1;
    const pool4 = [...players].sort(() => rnd() - .5);
    // Kreidefuchs spielt etwas öfter mit, damit das Demo-Profil gefüllt ist
    if (rnd() < .16 && !pool4.slice(0, size * 2).some(p => p.id === ME)) pool4.unshift(byId(ME));
    const unique = [...new Map(pool4.map(p => [p.id, p])).values()];
    const teams = [unique.slice(0, size), unique.slice(size, size * 2)];
    const strength = team => team.reduce((s, p) => s + p.skill, 0) / team.length;
    if (pool === '14-single') {
      const aWins = rnd() < expected(strength(teams[0]), strength(teams[1]));
      matches.push(makeMatch({pool, teams, t, bestOf: 1, result: {score_a: aWins ? 1 : 0, score_b: aWins ? 0 : 1}}));
    } else {
      const [best, wins] = pick(FORMATS.slice(1));
      const [sa, sb] = playRace(strength(teams[0]), strength(teams[1]), wins);
      matches.push(makeMatch({pool, teams, t, bestOf: best, result: {score_a: sa, score_b: sb}}));
    }
  }
  matches.forEach(applyMatch);
  // Offene Bestätigung für das Demo-Profil: Bande-Bernd hat ein Ergebnis eingetragen
  const pending = makeMatch({pool: '8-single', teams: [[byId('p2')], [byId(ME)]], t: now() - 25 * 60000, bestOf: 7, status: 'pending', result: null,
    proposal: {id: 'pr1', score_a: 4, score_b: 2, is_correction: false, reason: null, rounds: null}});
  pending.can_confirm = true; pending.can_dispute = true;
  matches.push(pending);

  // ---------- Gamification-Zustand des Demo-Profils ----------
  const game = {stamps: 9, vouchers: [], unseen: [], questsDone: new Set(), playDays: new Set(), registered: new Set(['e3'])};
  const myConfirmed = () => matches.filter(m => m.status === 'confirmed' && m.teams.flat().some(p => p.id === ME));
  myConfirmed().filter(m => Date.parse(m.confirmed_at) >= startOfWeek()).forEach(m => game.playDays.add(dayOf(m.confirmed_at)));

  // ---------- Antworten bauen ----------
  const session = {authenticated: true, user: {id: ME, name: 'Kreidefuchs'}, csrf_token: 'demo'};
  const sideOf = (m, id) => m.teams[0].some(p => p.id === id) ? 0 : m.teams[1].some(p => p.id === id) ? 1 : -1;
  function viewMatch(m) {
    const mine = sideOf(m, session.user?.id) >= 0;
    const copy = JSON.parse(JSON.stringify(m));
    if (!mine) { copy.can_confirm = copy.can_dispute = copy.can_propose = false; }
    return copy;
  }
  function ratingFor(pool, id) {
    const rec = ratings[pool][id];
    if (!rec.games) return null;
    const placed = rec.games >= 4;
    const idx = rankIndex(rec.r);
    const lower = RANKS[idx][0] < -1e8 ? 860 : RANKS[idx][0], upper = idx === 0 ? 1400 : RANKS[idx - 1][0];
    const progress = Math.max(0, Math.min(1, (rec.r - lower) / (upper - lower)));
    const recentRank = rec.history.filter(h => h.t < startOfMonth()).slice(-1)[0];
    const promoted = recentRank && rankIndex(recentRank.r) > idx;
    return {rank: placed ? rankOf(rec.r) : null, placement_games: Math.min(4, rec.games), protected_until: placed && promoted ? nextMonthStart() : null,
      games: rec.games, wins: rec.wins, losses: rec.losses,
      // NEU: Stufe innerhalb der Liga (I–III) und grober Fortschritt – die Spielstärke selbst bleibt verborgen
      tier: placed ? Math.min(3, 1 + Math.floor(progress * 3)) : null, progress: placed ? Math.round(progress * 100) / 100 : null,
      next_rank: placed && idx > 0 ? RANKS[idx - 1][1] : null};
  }
  function leaderboard(pool, month) {
    const inMonth = matches.filter(m => m.pool === pool && m.status === 'confirmed' && monthOf(m.confirmed_at) === month);
    const rows = new Map();
    for (const m of inMonth) {
      const aWon = m.result.score_a > m.result.score_b;
      m.teams.forEach((team, i) => team.forEach(p => {
        const row = rows.get(p.id) || {player: {id: p.id, name: p.name}, games: 0, wins: 0, losses: 0, league_points: 0, bonus: 0, opponents: {}};
        const won = i === 0 ? aWon : !aWon;
        row.games++; won ? row.wins++ : row.losses++;
        // NEU: Monatsliga-Punkte – Sieg 3, Niederlage 1, +1 gegen höhere Liga, max. 3 Wertungen gegen denselben Gegner
        const opp = m.teams[1 - i][0];
        row.opponents[opp.id] = (row.opponents[opp.id] || 0) + 1;
        if (row.opponents[opp.id] <= 3) {
          row.league_points += won ? 3 : 1;
          if (rankIndex(ratings[pool][opp.id].r) < rankIndex(ratings[pool][p.id].r)) { row.league_points++; row.bonus++; }
        }
        rows.set(p.id, row);
      }));
    }
    const list = [...rows.values()].map(row => {
      const rt = ratingFor(pool, row.player.id) || {};
      delete row.opponents;
      return {...row, rank: rt.rank, placement_games: rt.placement_games || 0, provisional: !rt.rank, protected_until: rt.protected_until, tier: rt.tier};
    }).sort((a, b) => (a.provisional - b.provisional) || (ratings[pool][b.player.id].r - ratings[pool][a.player.id].r));
    let place = 0; list.forEach(row => { row.place = row.provisional ? null : ++place; });
    // NEU: Titel des Monats
    const allMonth = matches.filter(m => m.status === 'confirmed' && monthOf(m.confirmed_at) === month);
    const days = {};
    allMonth.forEach(m => m.teams.flat().forEach(p => { (days[p.id] ||= new Set()).add(dayOf(m.confirmed_at)); }));
    const regular = Object.entries(days).sort((a, b) => b[1].size - a[1].size)[0];
    const climb = list.filter(r => r.games >= 5).map(r => {
      const h = ratings[pool][r.player.id].history; const before = h.filter(x => monthOf(x.t) < month).slice(-1)[0]?.r ?? 1000;
      const after = h.filter(x => monthOf(x.t) <= month).slice(-1)[0]?.r ?? before; return {player: r.player, delta: Math.round(after - before)};
    }).sort((a, b) => b.delta - a.delta)[0];
    const champion = list.find(r => !r.provisional && r.rank === '1. Café-Liga');
    const months = [...new Set(matches.filter(m => m.confirmed_at).map(m => monthOf(m.confirmed_at)))].sort().reverse();
    return {pool, month, months, rows: list, titles: {
      regular: regular ? {player: {id: regular[0], name: byId(regular[0]).name}, days: regular[1].size} : null,
      climber: climb && climb.delta > 0 ? {player: climb.player} : null,
      champion: champion ? {player: champion.player} : null}};
  }

  // ---------- Wochenaufgaben, Abzeichen, Bonusheft ----------
  function quests() {
    const week = myConfirmed().filter(m => Date.parse(m.confirmed_at) >= startOfWeek());
    const earlier = myConfirmed().filter(m => Date.parse(m.confirmed_at) < startOfWeek());
    const opp = m => m.teams[1 - sideOf(m, ME)];
    const knownBefore = new Set(earlier.flatMap(m => opp(m).map(p => p.id)));
    const newOpp = week.filter(m => opp(m).some(p => !knownBefore.has(p.id))).length;
    const nine = week.filter(m => m.pool === '9-single').length;
    const higher = week.filter(m => opp(m).some(p => rankIndex(ratings[m.pool][p.id].r) < rankIndex(ratings[m.pool][ME].r))).length;
    return [
      {id: 'q-neu', title: 'Neuer Gegner', text: 'Spiel gegen jemanden, gegen den du noch nie gespielt hast.', progress: Math.min(1, newOpp), goal: 1},
      {id: 'q-9', title: '9-Ball-Woche', text: 'Spiel zwei Partien 9-Ball.', progress: Math.min(2, nine), goal: 2},
      {id: 'q-hoch', title: 'Nach oben fordern', text: 'Spiel gegen jemanden aus einer höheren Café-Liga.', progress: Math.min(1, higher), goal: 1}
    ].map(q => ({...q, done: q.progress >= q.goal, reward: '1 Stempel'}));
  }
  function updateRewards() {
    for (const q of quests()) if (q.done && !game.questsDone.has(q.id)) { game.questsDone.add(q.id); game.stamps++; game.unseen.push(`Wochenaufgabe „${q.title}“ geschafft · +1 Stempel`); }
    for (const m of myConfirmed()) { const d = dayOf(m.confirmed_at); if (Date.parse(m.confirmed_at) >= startOfWeek() && !game.playDays.has(d)) { game.playDays.add(d); game.stamps++; game.unseen.push('Spieltag im Café · +1 Stempel'); } }
  }
  quests().filter(q => q.done).forEach(q => game.questsDone.add(q.id));

  function badges() {
    const mine = myConfirmed();
    const opps = new Set(mine.flatMap(m => m.teams[1 - sideOf(m, ME)].map(p => p.id)));
    const pools = new Set(mine.map(m => m.pool));
    const won = m => (sideOf(m, ME) === 0) === (m.result.score_a > m.result.score_b);
    let streak = 0, best = 0; mine.forEach(m => { streak = won(m) ? streak + 1 : 0; best = Math.max(best, streak); });
    const giant = Math.max(0, ...mine.filter(won).map(m => {
      const opp = m.teams[1 - sideOf(m, ME)][0];
      return rankIndex(ratings[m.pool][ME].r) - rankIndex(ratings[m.pool][opp.id].r);
    }));
    const days = new Set(mine.map(m => dayOf(m.confirmed_at))).size;
    const doubles = mine.filter(m => m.pool === '8-double').length;
    const mentor = mine.filter(m => m.teams[1 - sideOf(m, ME)].some(p => ratings[m.pool][p.id].games < 6)).length;
    const tiered = (id, title, text, value, steps, unit) => {
      const tier = steps.filter(s => value >= s).length;
      return {id, title, text, value, steps, tier, unit, next: steps[tier] ?? null};
    };
    return [
      tiered('erste-kugel', 'Erste Kugel', 'Deine erste bestätigte Partie.', mine.length, [1], 'Partie'),
      tiered('gesellig', 'Gesellig', 'Verschiedene Gegner am Tisch.', opps.size, [5, 15, 40], 'Gegner'),
      tiered('mentor', 'Mentor', 'Partien gegen Neue in der Platzierung.', mentor, [3, 10, 25], 'Partien'),
      tiered('allrounder', 'Allrounder', 'Verschiedene Disziplinen gespielt.', pools.size, [3, 4, 5], 'Disziplinen'),
      tiered('serie', 'Siegesserie', 'Siege in Folge.', best, [3, 5, 10], 'Siege'),
      tiered('riesentoeter', 'Riesentöter', 'Sieg gegen eine höhere Café-Liga.', giant, [1, 2, 3], 'Ligen höher'),
      tiered('treue', 'Treue Seele', 'Verschiedene Tage im Café gespielt.', days, [10, 25, 50], 'Tage'),
      tiered('serie141', 'Höchstserie 14/1', 'Kugeln am Stück im Live-Spielblatt.', 22, [15, 30, 50], 'Kugeln'),
      tiered('doppelpack', 'Doppelpack', 'Doppelpartien gespielt.', doubles, [5, 15, 30], 'Doppel'),
      tiered('fairplay', 'Fair Play', 'Partien ohne Widerspruch.', mine.length, [25, 50, 100], 'Partien'),
      tiered('turnier', 'Turnierspieler', 'Teilnahme, Finale, Turniersieg.', 1, [1, 2, 3], 'Stufe'),
      tiered('aufsteiger', 'Aufsteiger', 'Erster Aufstieg in eine höhere Café-Liga.', 1, [1], 'Aufstieg'),
      tiered('monatssieger', 'Monatssieger', 'Einmal eine Monatsliga gewonnen.', 0, [1], 'Titel'),
      tiered('champion', 'Champion des Hauses', 'Einmal Platz 1 der 1. Café-Liga.', 0, [1], 'Titel')
    ];
  }

  // ---------- Events, Tische, Neuigkeiten ----------
  const at = (daysAhead, weekdayTarget, hour, minute = 0) => {
    const base = new Date(); const p = berlinParts(base);
    const wd = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].indexOf(p.weekday);
    let add = (weekdayTarget - wd + 7) % 7; if (add === 0) add = 7; add += daysAhead;
    const d = new Date(base.getTime() + add * DAY); const q = berlinParts(d);
    return `${q.year}-${q.month}-${q.day}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00+01:00`;
  };
  const events = [
    {id: 'e1', type: 'Einsteigerabend', title: 'Einsteigerabend: Regeln & erste Stöße', starts_at: at(0, 1, 19), place: 'Tische 1–3', description: 'Stammspieler zeigen Grundlagen. Ideal für die ersten Partien in der Rangliste. Queues zum Leihen sind da.', price: 'Tischzeit frei', capacity: 12, participants: 5},
    {id: 'e2', type: 'Turnier', title: '9-Ball-Hausturnier', starts_at: at(0, 4, 19, 30), place: 'Alle Tische', description: 'Doppel-K.-o., Race to 5. Turnierbaum live auf dem Café-Bildschirm. Zählt für das Abzeichen „Turnierspieler“.', price: '10 € Startgeld', capacity: 16, participants: 11, sponsor: 'Musterbrauerei (Demo-Sponsor)'},
    {id: 'e3', type: 'Doppel', title: 'Doppel-Nacht 8-Ball', starts_at: at(7, 5, 20), place: 'Tische 1–6', description: 'Partner werden ausgelost – Starke spielen mit Neuen. Zählt für Doppelpack und Mentor.', price: 'Tischzeit halber Preis', capacity: 24, participants: 14},
    {id: 'e4', type: 'Siegerehrung', title: 'Siegerehrung der Monatsligen', starts_at: at(0, 5, 21), place: 'Theke', description: 'Die Monatssieger aller Café-Ligen, Stammgast und Aufsteiger des Monats bekommen ihre Preise.', price: 'frei', capacity: null, participants: null}
  ];
  const tables = Array.from({length: 8}, (_, i) => ({no: i + 1, busy: [1, 2, 4, 5, 7].includes(i + 1), since: now() - [47, 12, 0, 83, 25, 0, 6, 0][i] * 60000}));
  const feed = [
    'Lena ist in die 1. Café-Liga aufgestiegen',
    'Mira hat das Abzeichen „Riesentöter“ in Silber',
    'Deniz hat zum ersten Mal 14/1 gespielt',
    'Ahmet verteidigt Platz 1 der 1. Café-Liga',
    'Fritzi hat die Platzierung abgeschlossen: 4. Café-Liga',
    'Kalle führt die Monatsliga der 4. Café-Liga an'
  ];

  // ---------- Router ----------
  const json = (status, body) => new Response(JSON.stringify(body), {status, headers: {'Content-Type': 'application/json'}});
  const fail = (status, detail) => json(status, {detail});
  const needAuth = () => session.authenticated ? null : fail(401, 'Bitte zuerst anmelden.');

  function finishByOpponent(m) {
    // Demo: die Gegenseite bestätigt nach ein paar Sekunden "auf ihrem Handy"
    setTimeout(() => {
      if (m.status !== 'pending' || !m.proposal) return;
      m.result = {score_a: m.proposal.score_a, score_b: m.proposal.score_b};
      m.proposal = null; m.status = 'confirmed'; m.confirmed_at = iso(now()); m.version++;
      m.can_confirm = m.can_dispute = m.can_propose = false;
      m.audit_events.push({action: 'confirmed', created_at: m.confirmed_at});
      applyMatch(m); updateRewards();
      game.unseen.push('Die Gegenseite hat dein Ergebnis bestätigt');
      window.dispatchEvent(new Event('focus'));
    }, 6000);
  }

  async function handle(path, method, body) {
    const url = new URL(path, 'https://demo.local');
    const parts = url.pathname.split('/').filter(Boolean);
    const q = url.searchParams;
    if (url.pathname === '/session') return json(200, session.authenticated ? session : {authenticated: false});
    if (['/login', '/register'].includes(url.pathname) && method === 'POST') {
      const name = String(body?.name || '').trim();
      if (!name || !/^\d{6}$/.test(String(body?.pin || ''))) return fail(400, 'Bitte Nickname und eine PIN mit genau 6 Ziffern eingeben.');
      let p = players.find(x => x.name.toLowerCase() === name.toLowerCase());
      if (!p) { p = {id: `p${players.length + 1}`, name, skill: 1000}; players.push(p); POOLS.forEach(pool => { ratings[pool][p.id] = {r: 1000, games: 0, wins: 0, losses: 0, history: []}; }); }
      Object.assign(session, {authenticated: true, user: {id: p.id, name: p.name}, csrf_token: 'demo'});
      return json(200, session);
    }
    if (url.pathname === '/logout') { session.authenticated = false; session.user = null; return json(200, {ok: true}); }
    if (url.pathname === '/players') return needAuth() || json(200, {players: players.map(p => ({id: p.id, name: p.name}))});
    if (url.pathname === '/matches' && method === 'GET') return needAuth() || json(200, {matches: matches.filter(m => sideOf(m, session.user.id) >= 0 && ['playing','pending','disputed'].includes(m.status)).map(viewMatch)});
    if (url.pathname === '/matches' && method === 'POST') {
      if (needAuth()) return needAuth();
      if (body.pool === '14-single') return fail(400, 'Das Live-Spielblatt für 14/1 ist in dieser Demo nicht verfügbar. Bitte eine andere Disziplin wählen.');
      const teams = body.teams.map(t => t.map(id => byId(id)));
      const m = makeMatch({pool: body.pool, teams, t: now(), bestOf: body.best_of, status: 'playing', result: null});
      m.created_at = iso(now()); m.played_at = null; m.audit_events = [{action: 'created', created_at: m.created_at}]; m.can_propose = true;
      matches.push(m); tables[2].busy = true; tables[2].since = now();
      return json(200, {match: viewMatch(m)});
    }
    if (parts[0] === 'matches' && parts[1]) {
      const m = matches.find(x => x.id === parts[1]);
      if (!m) return fail(404, 'Partie nicht gefunden.');
      if (parts[2] === 'sheets') return json(200, {sheets: []});
      if (!parts[2]) return json(200, {match: viewMatch(m)});
      if (method !== 'POST') return fail(405, 'Nicht erlaubt.');
      if (parts[2] === 'result') {
        m.proposal = {id: `pr${nextId++}`, score_a: Number(body.score_a), score_b: Number(body.score_b), is_correction: false, reason: body.reason || null, rounds: null};
        m.status = 'pending'; m.played_at = iso(now()); m.version++; m.can_propose = false; m.can_confirm = false; m.can_dispute = false;
        m.audit_events.push({action: 'result_proposed', created_at: iso(now())});
        tables[2].busy = false;
        finishByOpponent(m);
        return json(200, {match: viewMatch(m)});
      }
      if (parts[2] === 'confirm') {
        m.result = {score_a: m.proposal.score_a, score_b: m.proposal.score_b}; m.proposal = null; m.status = 'confirmed'; m.confirmed_at = iso(now()); m.version++;
        m.can_confirm = m.can_dispute = false; m.audit_events.push({action: 'confirmed', created_at: m.confirmed_at});
        applyMatch(m); updateRewards();
        return json(200, {match: viewMatch(m)});
      }
      if (parts[2] === 'dispute') {
        m.status = 'disputed'; m.dispute_reason = body.reason; m.version++; m.can_confirm = false; m.can_dispute = false; m.can_propose = true;
        m.audit_events.push({action: 'disputed', created_at: iso(now()), reason: body.reason});
        return json(200, {match: viewMatch(m)});
      }
      return fail(400, 'Diese Aktion ist in der Demo nicht verfügbar.');
    }
    if (url.pathname === '/me') {
      if (needAuth()) return needAuth();
      const id = session.user.id;
      return json(200, {ratings: Object.fromEntries(POOLS.map(pool => [pool, ratingFor(pool, id)]).filter(([, v]) => v)),
        matches: matches.filter(m => sideOf(m, id) >= 0).map(viewMatch)});
    }
    if (url.pathname === '/leaderboard') return json(200, leaderboard(q.get('pool') || '8-single', q.get('month')));
    if (url.pathname === '/lobbies' && method === 'GET') return json(200, {lobbies: []});
    if (parts[0] === 'lobbies') return fail(400, 'Einladungen per QR-Code sind in dieser Demo nicht verfügbar. Bitte die Person direkt auswählen.');
    if (parts[0] === 'admin') return fail(403, 'Nur für das Café-Personal.');

    // ===== Neue Endpunkte für die Erweiterungen =====
    if (url.pathname === '/odds') {
      const pool = q.get('pool'), a = ratings[pool]?.[session.user?.id], b = ratings[pool]?.[q.get('opponent')];
      if (!a || !b) return fail(400, 'Keine Einschätzung möglich.');
      const pa = expected(a.r, b.r), wins = Number(q.get('wins')) || 3;
      // Vorschlag: Rennen so wählen, dass beide etwa gleiche Chancen haben
      let best = {a: wins, b: wins, diff: 1};
      for (let ra = Math.ceil(wins / 2); ra <= wins; ra++) for (let rb = Math.ceil(wins / 2); rb <= wins; rb++) {
        if (Math.max(ra, rb) !== wins) continue;
        let p = 0; const memo = {}; // Wahrscheinlichkeit, ra Spiele vor rb zu gewinnen
        const f = (x, y) => x === ra ? 1 : y === rb ? 0 : (memo[x + ',' + y] ??= pa * f(x + 1, y) + (1 - pa) * f(x, y + 1));
        p = f(0, 0); const diff = Math.abs(p - .5); if (diff < best.diff) best = {a: ra, b: rb, diff};
      }
      return json(200, {game_win_probability: Math.round(pa * 100) / 100, provisional: a.games < 4 || b.games < 4,
        suggestion: best.a === best.b ? null : {race_self: best.a, race_opponent: best.b}});
    }
    if (url.pathname === '/achievements') {
      if (needAuth()) return needAuth();
      const unseen = game.unseen.splice(0);
      return json(200, {week: quests(), badges: badges(), stamps: {count: game.stamps, goal: 10, reward: '1 Tischstunde gratis', vouchers: game.vouchers}, unseen});
    }
    if (url.pathname === '/vouchers' && method === 'POST') {
      if (game.stamps < 10) return fail(400, 'Für einen Gutschein brauchst du 10 Stempel.');
      game.stamps -= 10;
      const v = {code: 'BCM-' + Math.random().toString(36).slice(2, 6).toUpperCase() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase(), title: '1 Tischstunde gratis', valid_until: iso(now() + 90 * DAY), redeemed_at: null};
      game.vouchers.unshift(v); return json(200, {voucher: v});
    }
    if (parts[0] === 'vouchers' && parts[2] === 'redeem') {
      const v = game.vouchers.find(x => x.code === parts[1]);
      if (!v) return fail(404, 'Gutschein unbekannt.');
      if (v.redeemed_at) return fail(409, `Bereits eingelöst am ${new Date(v.redeemed_at).toLocaleString('de-DE')}.`);
      v.redeemed_at = iso(now()); return json(200, {voucher: v});
    }
    if (url.pathname === '/events') return json(200, {events: events.map(ev => ({...ev, registered: game.registered.has(ev.id), participants: ev.participants == null ? null : ev.participants + (game.registered.has(ev.id) ? 1 : 0)}))});
    if (parts[0] === 'events' && parts[2] === 'register') {
      if (needAuth()) return needAuth();
      body?.register ? game.registered.add(parts[1]) : game.registered.delete(parts[1]);
      return json(200, {ok: true});
    }
    if (url.pathname === '/tables') return json(200, {source: 'Gewichtssensor Kugelfach', tables: tables.map(t => ({no: t.no, status: t.busy ? 'busy' : 'free', since: t.busy ? iso(t.since) : null}))});
    if (url.pathname === '/feed') return json(200, {items: feed});
    return fail(404, 'Unbekannte Anfrage.');
  }

  const realFetch = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    const href = typeof input === 'string' ? input : input.url;
    const u = new URL(href, location.href);
    if (u.origin === location.origin && u.pathname.includes('/api/')) {
      const path = u.pathname.slice(u.pathname.indexOf('/api/') + 4) + u.search;
      let body = null; try { body = init.body ? JSON.parse(init.body) : null; } catch {}
      await new Promise(r => setTimeout(r, 120 + Math.random() * 180)); // kleine Netzwerkverzögerung
      return handle(path, (init.method || 'GET').toUpperCase(), body);
    }
    return realFetch(input, init);
  };
  window.BillardDemo = {active: true};
})();
