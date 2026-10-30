'use strict';

(() => {
  const e = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const key = 'merzig-sheet-inputs-v1';
  const dialog = document.querySelector('#live-sheet');
  const content = document.querySelector('#sheet-content');
  const resume = document.querySelector('#active-resume');
  const abortDialog = document.querySelector('#abort-dialog');
  const abortContent = document.querySelector('#abort-content');
  const rules = window.BillardRules;
  let bridge, opened = null, aborting = null, busy = false, notice = null, pointerFocus = null, deferredRender = false, formNavigation = null;
  let inputs;
  try { inputs = JSON.parse(sessionStorage.getItem(key) || '{}') || {}; if(typeof inputs!=='object'||Array.isArray(inputs))inputs={}; } catch { inputs = {}; }
  const records = new Map();
  let running = [];
  const ownKey = id => `${bridge?.user()?.id || 'guest'}:${id}`;
  const input = id => inputs[ownKey(id)] ||= {};
  const persist = () => { try { sessionStorage.setItem(key, JSON.stringify(inputs)); } catch { /* In-memory drafts still work. */ } };
  const same = (a,b) => String(a) === String(b);
  const encoded = value => encodeURIComponent(value);
  const matchPath = id => `/matches/${encoded(id)}`;
  const actionPath = (m,s) => `${matchPath(m.id)}/sheets/${encoded(s.id)}/actions`;
  const players = m => m.teams.flat();
  const name = (m,id) => players(m).find(p => same(p.id,id))?.name || 'Person nicht verfügbar';
  const canAbort = m => !!m?.can_abort && !m.result && !m.proposal?.is_correction && ['playing','pending','disputed'].includes(m.status);
  const editable = m => m.status === 'playing' && !m.result && !m.proposal;
  const unsigned = value => /^\d+$/.test(String(value)) && Number.isSafeInteger(Number(value));
  const sheet = record => record?.sheets.find(s => same(s.id, opened?.sheetId)) || null;
  const record = () => opened ? records.get(String(opened.matchId)) : null;
  function draft(s) {
    const d = input(`sheet:${s.id}`);
    if (d.baseVersion === undefined) Object.assign(d,{baseVersion:s.version,playerId:s.current_player_id,balls:String(s.draft_balls),winnerId:s.winner_id == null ? '' : String(s.winner_id),reason:s.end_reason || '',include:true,warnSpoken:false});
    return d;
  }
  function tell(text, error = false) { notice = {text,error}; renderSheet(); }
  function updateMatch(m) {
    const r=records.get(m.id), previous=r?.match||running.find(old=>same(old.id,m.id));
    if(previous&&previous.version>m.version)return previous;
    if(r)r.match=m;
    running=running.filter(old=>!same(old.id,m.id));
    if(['playing','pending','disputed'].includes(m.status)&&!m.result)running.push(m);
    renderResume();return m;
  }
  function ackMatch(m) {
    if (!m?.id) throw new Error('Kein bestätigter Partiestand erhalten. Bitte identisch erneut versuchen.');
    const r=records.get(String(m.id)),current=r?.match||bridge.findMatch(m.id);
    if(current&&Number(current.version)>Number(m.version))return current;
    bridge.updateMatch(m);if(r)r.match=m;return m;
  }
  function adoptSheet(r,s,{keepBalls=false}={}) {
    if (!s?.id || !['live','finished','aborted'].includes(s.state)) throw new Error('Kein bestätigter Blattstand erhalten. Bitte identisch erneut versuchen.');
    const index=r.sheets.findIndex(old=>same(old.id,s.id));
    if(index>=0&&Number(r.sheets[index].version)>Number(s.version)){
      const d=draft(r.sheets[index]);d.pending=null;d.conflict=true;d.reviewed=false;persist();return;
    }
    if(index<0)r.sheets.push(s);else r.sheets[index]=s;
    r.active_sheet_id=s.state==='live'?s.id:(same(r.active_sheet_id,s.id)?null:r.active_sheet_id);
    const d=draft(s), balls=d.balls, playerId=d.playerId;
    const movedDraft=keepBalls&&!same(playerId,s.current_player_id)&&(!unsigned(balls)||Number(balls)!==0||balls!==String(s.draft_balls));
    Object.assign(d,{baseVersion:s.version,playerId:movedDraft?playerId:s.current_player_id,conflict:movedDraft,reviewed:false,pending:null,warnSpoken:false});
    d.balls=keepBalls?balls:String(s.draft_balls); d.winnerId=s.winner_id == null?'':String(s.winner_id); d.reason=s.end_reason||'';
    persist();
  }
  async function loadMatch(m) {
    m=updateMatch(m);
    if (m.pool !== '14-single') return;
    const id=String(m.id), previous=records.get(id);
    const r=previous || {match:m,sheets:[],loaded:false,error:'',active_sheet_id:null}; r.match=m; r.error='';records.set(id,r);
    try {
      const data=await bridge.read(`${matchPath(m.id)}/sheets`);
      if (!Array.isArray(data.sheets)) throw new Error('Die Spielblätter konnten nicht gelesen werden.');
      r.sheets=[...data.sheets].sort((a,b)=>a.round_index-b.round_index);r.active_sheet_id=data.active_sheet_id;r.loaded=true;
    } catch(err) { r.error=err.message; }
    renderResume();return r;
  }
  async function overview(matches) {
    if (!bridge.user()) return clear();
    running=matches.filter(m=>['playing','pending','disputed'].includes(m.status) && !m.result);
    await Promise.all(running.filter(m=>m.pool==='14-single').map(loadMatch));renderResume();
  }
  function clear() { running=[];records.clear(); if(opened)closeView(false);if(abortDialog.open)abortDialog.close();aborting=null;renderResume(); }
  function summary(m,sheets) {
    const ids=m.teams.map(t=>t[0].id), target=({1:1,5:3,7:4})[m.best_of];
    let a=0,b=0,error='';const rounds=[];
    const ordered=[...sheets].sort((x,y)=>x.round_index-y.round_index);
    for(const s of ordered){
      if(a===target||b===target){error='Es liegen Blätter nach dem Satzende vor. Bitte den Serverstand prüfen.';break;}
      if(s.state!=='finished'||s.winner_id==null)break;
      const side=ids.findIndex(id=>same(id,s.winner_id));
      const pa=s.totals?.[ids[0]]?.points,pb=s.totals?.[ids[1]]?.points;
      if(side<0||!Number.isSafeInteger(pa)||!Number.isSafeInteger(pb)){error='Ein gespeichertes Blatt enthält noch keinen vollständigen Sieger-/Punktestand.';break;}
      if(side===0)a++;else b++;
      rounds.push({a:pa,b:pb,winner_id:s.winner_id,reason:s.end_reason||null,sheet_id:s.id,sheet_version:s.version});
    }
    return {a,b,rounds,error,complete:!error&&(a===target||b===target)&&rounds.length===ordered.length};
  }
  function legacyAllowed(m){return m.pool!=='14-single'||!!records.get(String(m.id))?.loaded && records.get(String(m.id)).sheets.length===0;}
  function disputeRecoveryAllowed(m) {
    const r=records.get(m.id);
    return m.pool==='14-single'&&m.status==='disputed'&&!m.result&&!!m.proposal&&!m.proposal.is_correction&&!!r?.loaded&&!r.error&&!r.active_sheet_id&&r.sheets.length>0&&summary(m,r.sheets).complete;
  }
  function panel(m) {
    if(m.pool!=='14-single')return '';
    const r=records.get(String(m.id));const count=r?.loaded?r.sheets.length:null;
    return `<section class="panel sheet-match-panel"><p class="eyebrow">14/1 · Papier &amp; Stift digital</p><h2>${m.result?'Original-Spielblätter · unverändert':count&&!editable(m)?(m.status==='disputed'?'Bestrittene Original-Spielblätter · unverändert':'Gespeicherte Original-Spielblätter · unverändert'):'Spielblatt am Tisch'}</h2><p class="muted">${count===null?'Spielblätter werden vom Server geladen.':count?`${count} gespeicherte ${count===1?'Runde':'Runden'}. Aufnahmen, Punkte und manuelle Rundensieger bleiben nachvollziehbar.`:'Startperson bewusst wählen, Aufnahmen erfassen und nach Spielende den Sieger selbst festlegen.'}</p>${r?.error?`<p class="sk-error" role="alert">${e(r.error)}</p>`:''}<button class="btn primary" type="button" data-sk="open" data-mid="${e(m.id)}">${count?(m.result?'Original-Spielblätter öffnen':'Spielblätter öffnen'):'Live-Spielblatt öffnen'}</button>${count?`<p class="hint">${m.status==='disputed'&&!m.result?'Die bestrittenen Original-Blätter bleiben schreibgeschützt. Das vollständige tatsächlich gespielte Ergebnis kann in der Partienansicht begründet ersetzt werden.':'Die Original-Blätter bleiben lesbar. Maßgeblich ist das Ergebnis in der Partienansicht; erst die Gegenseite bestätigt die Wertung.'}</p>`:''}</section>`;
  }
  function renderResume() {
    if(rules.isOpen())return;
    const visible=running.filter(m=>!same(m.id,bridge?.currentMatchId?.()));
    resume.hidden=!bridge?.user()||!visible.length||!!opened;
    if(resume.hidden){resume.replaceChildren();return;}
    resume.innerHTML=`<div class="resume-heading">${visible.length===1?'Laufende Partie':`${visible.length} laufende Partien`}</div>${visible.map(m=>{
      const r=records.get(String(m.id));const active=r?.sheets.find(s=>same(s.id,r.active_sheet_id)&&s.state==='live');const d=active?input(`sheet:${active.id}`):{};
      const latest=r?.sheets.at(-1);const local=active&&(d.pending||d.editEntry||d.balls!==undefined&&String(d.balls)!==String(active.draft_balls));
      return `<div class="resume-row"><span><strong>${e(m.teams.map(t=>t.map(p=>p.name).join(' & ')).join(' · '))}</strong><small>${active?`14/1 · Runde ${e(active.round_index)} läuft${local?' · Entwurf nur lokal':''}`:m.pool==='14-single'?(r?.error?'14/1 · Blattstand nicht erreichbar':latest?.state==='finished'?`14/1 · Runde ${latest.round_index} gespeichert`:'14/1 · kein laufendes Blatt'):bridge.poolLabel(m.pool)}</small></span><button class="btn small" type="button" data-sk="${active||latest?.state==='finished'?'open':'go-match'}" data-mid="${e(m.id)}">${active?'Fortsetzen':latest?.state==='finished'?'Blatt ansehen':'Zur Partie'}</button>${canAbort(m)?`<button class="btn small danger" type="button" data-sk="abort-view" data-mid="${e(m.id)}">Abbrechen</button>`:''}</div>`;
    }).join('')}`;
  }
  async function open(m,trigger) {
    if(m.pool!=='14-single')return;
    if(opened)return;
    const focus=pointerFocus||document.activeElement;pointerFocus=null;
    opened={matchId:m.id,sheetId:null,mode:'sheet',focus,trigger,scroll:window.scrollY,hash:location.hash,token:`sheet-${Date.now()}`,pushed:false};
    notice=null;content.innerHTML='<div class="loading" role="status">Spielblätter werden geladen …</div>';dialog.showModal();document.body.classList.add('sheet-open');renderResume();
    dialog.querySelector('[data-sk="finish-view"]').disabled=true;
    dialog.querySelector('[data-sk="abort-view"]').disabled=!canAbort(m);
    try{history.pushState({...history.state,merzigSheet:opened.token},'',location.href);opened.pushed=true;}catch{}
    try{m=await freshMatch(m.id);}catch(err){notice={text:err.message,error:true};}
    if(!opened)return;
    await loadMatch(m);if(!opened||!same(opened.matchId,m.id))return;
    const r=record();opened.sheetId=r.active_sheet_id||r.sheets.at(-1)?.id||null;renderSheet();dialog.querySelector('[data-sk="minimize"]')?.focus({preventScroll:true});
  }
  function closeView(back=true) {
    if(!opened)return;const old=opened;opened=null;formNavigation=null;if(dialog.open)dialog.close();document.body.classList.remove('sheet-open');renderResume();
    if(old.hash===location.hash){(old.focus?.isConnected?old.focus:old.trigger)?.focus({preventScroll:true});window.scrollTo({top:old.scroll,behavior:'instant'});}
    if(back&&old.pushed&&history.state?.merzigSheet===old.token)history.back();
    bridge.render();
  }
  async function minimize(back=true) {
    const r=record(),s=sheet(r),d=s?draft(s):null;
    persist();closeView(back);
    if(!r||!s||s.state!=='live'||!editable(r.match)||busy)return;
    if(d.pending||stale(s,d)||!unsigned(d.balls)||!navigator.onLine){bridge.notify('Spielblatt minimiert. Nicht bestätigte oder ungültige Eingaben bleiben lokal; bitte später ausdrücklich prüfen und erneut speichern.',true);return;}
    if(String(d.balls)!==String(s.draft_balls))await action(r,s,{type:'draft',balls:Number(d.balls)},{minimized:true});
    else bridge.notify('Spielblatt minimiert. Der angezeigte Kugelentwurf ist auf dem Server gespeichert.');
  }
  function stale(s,d){return !!d.conflict||Number(d.baseVersion)!==Number(s.version)||!same(d.playerId,s.current_player_id);}
  async function action(r,s,raw,{minimized=false}={}) {
    const d=draft(s);
    if(busy)return;
    if(!editable(r.match)){tell('Der Parent-Partiestand erlaubt keine Blattänderung. Akzeptierte Ergebnisse und offene Vorschläge bleiben unverändert.',true);return;}
    if(stale(s,d)){tell('Der Blattstand hat sich geändert. Eingaben bleiben erhalten; erst laden und ausdrücklich prüfen.',true);return;}
    const pending={path:actionPath(r.match,s),body:{expected_version:d.baseVersion,action:raw},scope:`sheet:${r.match.id}:${s.id}:action`};
    d.pending=pending;persist();return sendPending(r,s,{minimized});
  }
  async function sendPending(r,s,{minimized=false}={}){
    const d=draft(s),pending=d.pending;if(!pending||busy)return;
    busy=true;notice={text:'Wird an den Server gesendet …',error:false};renderSheet();
    try{
      const data=await bridge.write(pending.path,pending.body,pending.scope);
      const type=pending.body.action.type;
      const keepBalls=['warning','rerack'].includes(type)||['undo','edit_visit'].includes(type)&&d.balls!==String(s.draft_balls);
      adoptSheet(r,data.sheet,{keepBalls});bridge.acknowledge(pending.scope);
      if(type==='edit_visit')d.editEntry=null;
      if(['finish','winner','reopen'].includes(type)){try{const fresh=await bridge.read(matchPath(r.match.id));ackMatch(fresh.match);}catch{bridge.notify('Blattaktion gespeichert. Der Partiestand muss vor dem nächsten Schritt erneut geladen werden.',true);}}
      if(type==='finish'&&opened){opened.mode='sheet';formNavigation='[data-sk-form="winner"]';}
      notice={text:type==='warning'?'Der Server hat die tatsächlich ausgesprochene Warnung für diese Aufnahme gespeichert.':type==='finish'?'Das Blatt ist gespeichert und eingefroren. Wähle den Rundensieger jetzt ausdrücklich selbst.':'Vom Server gespeichert.',error:false};
      if(minimized)bridge.notify('Kugelentwurf vom Server gespeichert. Die Partie läuft weiter.');
    }catch(err){
      if(err.status===409){d.conflict=true;d.pending=null;notice={text:`${err.message} Eingaben bleiben erhalten. Bei einer älteren Aufnahmekorrektur müssen gegebenenfalls spätere Aktionen mit „Rückgängig“ aufgehoben werden. Spieler werden nicht stillschweigend verschoben.`,error:true};}
      else if(err.status&&err.status<500){d.pending=null;notice={text:err.message,error:true};}
      else notice={text:`${err.message} Ausgang unklar: denselben Sendeversuch ausdrücklich wiederholen.`,error:true};
      if(minimized)bridge.notify('Entwurf nur lokal erhalten. Keine Serverbestätigung; bitte über Fortsetzen erneut speichern.',true);
    }finally{busy=false;persist();renderSheet();renderResume();}
  }
  function playerScore(m,s,p) {
    const t=s.totals?.[p.id];
    return `<section class="sheet-player ${same(p.id,s.current_player_id)&&s.state==='live'&&editable(m)?'at-table':''}"><span>${e(p.name)}${same(p.id,s.current_player_id)&&s.state==='live'&&editable(m)?' · am Tisch':''}</span><strong>${e(t?.points??'–')}</strong><small>Ziel ${e(m.points_target)} · gespeicherte Punkte</small><dl><div><dt>Aufnahmen</dt><dd>${e(t?.visits??'–')}</dd></div><div><dt>Höchstserie</dt><dd>${e(t?.highest_run??'–')}</dd></div><div><dt>Foulserie</dt><dd>${e(t?.foul_streak??'–')}</dd></div><div><dt>Strafpunkte</dt><dd>${e(t?.penalties??'–')}</dd></div></dl></section>`;
  }
  function conflictUI(m,s,d) {
    if(!stale(s,d)&&!d.pending)return '';
    return `<div class="callout warning"><p>${d.pending?'Für einen Sendeversuch fehlt eine eindeutige Bestätigung. Nicht automatisch erneut gesendet.':'Der Serverstand und dein Entwurf müssen verglichen werden.'}</p>${!same(d.playerId,s.current_player_id)?`<p>Die lokale Kugeleingabe ${e(d.balls)} gehört weiterhin zu ${e(name(m,d.playerId))}. Sie wurde keiner anderen Person gutgeschrieben.</p>`:''}${d.pending?'<button class="btn small" type="button" data-sk="retry-pending">Identischen Versuch wiederholen</button>':''}<button class="btn small" type="button" data-sk="refresh">Serverstand laden</button>${d.reviewed?`${s.state==='live'&&editable(m)?`<button class="btn small" type="button" data-sk="review">Stand geprüft · ${same(d.playerId,s.current_player_id)?'Entwurf beibehalten':'Entwurf ausdrücklich der aktuellen Person zuordnen'}</button>`:''}<button class="btn small" type="button" data-sk="discard-draft">Lokale Kugeleingabe verwerfen · Serverstand übernehmen</button>`:''}</div>`;
  }
  function ledger(m,s,allow) {
    const labels={visit:'Aufnahme',opening_foul:'Anstoßfoul',warning:'Gesprochene Warnung',rerack:'14 Kugeln neu aufgebaut',finish:'Spielende',winner:'Manuelle Siegerwahl',undo:'Rückgängig',edit_visit:'Aufnahmekorrektur'};
    const ends={miss:'Fehlstoß',safety:'Sicherheit',foul:'Foul',game_end:'Spielende'};
    return `<section class="sheet-ledger"><h3>Gespeicherter Verlauf</h3>${s.entries.length?`<div class="table-wrap" tabindex="0" role="region" aria-label="Gespeicherte Aufnahmen und Aktionen"><table><thead><tr><th>Person / Aktion</th><th>Kugeln</th><th>Strafe</th><th>Stand danach</th><th>Bearbeiten</th></tr></thead><tbody>${s.entries.map(entry=>`<tr><th scope="row">${e(name(m,entry.player_id))}<small>${e(labels[entry.type]||entry.type)}${entry.end_type?` · ${e(ends[entry.end_type]||entry.end_type)}`:''}</small></th><td>${e(entry.balls??'–')}</td><td>${e(entry.penalty??'–')}</td><td>${e(entry.points_after && typeof entry.points_after==='object'?players(m).map(p=>`${p.name}: ${entry.points_after[p.id]??'–'}`).join(' · '):entry.points_after??'–')}</td><td>${allow&&entry.type==='visit'?`<button class="btn small" type="button" data-sk="edit-entry" data-entry="${e(entry.id)}">Ändern</button>`:'–'}</td></tr>`).join('')}</tbody></table></div>`:'<p class="muted">Noch keine gespeicherte Aufnahme. Der Kugelentwurf ist davon getrennt.</p>'}</section>`;
  }
  function savedRounds(r) {
    const sum=summary(r.match,r.sheets);
    return `<section class="sheet-rounds"><h3>${!editable(r.match)?'Original-Blätter · ':''}Satzstand ${sum.a} : ${sum.b} · ${e(bridge.formatLabel(r.match))}</h3><div class="sheet-round-tabs">${r.sheets.map(s=>`<button class="btn small" type="button" data-sk="select-sheet" data-sid="${e(s.id)}" aria-pressed="${same(s.id,opened?.sheetId)}">R${e(s.round_index)} · ${s.state==='live'?'läuft':s.state==='aborted'?'abgebrochen':s.winner_id?e(name(r.match,s.winner_id)):'Sieger offen'}</button>`).join('')}</div>${sum.error?`<p class="sk-error">${e(sum.error)}</p>`:''}${input(`result:${r.match.id}`).pending?'<button class="btn" type="button" data-sk="propose">Unbestätigten Ergebnisversuch identisch wiederholen</button>':sum.complete&&editable(r.match)?'<button class="btn primary" type="button" data-sk="propose">Vollständiges Satzergebnis vorschlagen</button><p class="hint">Erst die Bestätigung der Gegenseite zählt für Rang und Platzierung.</p>':''}</section>`;
  }
  function startForm(r) {
    const d=input(`start:${r.match.id}`),sum=summary(r.match,r.sheets);
    if(d.pending)return '<form data-sk-form="start" class="sheet-start"><p>Ein Blattstart ist noch nicht eindeutig bestätigt. Die ursprüngliche Startperson und Version bleiben für einen identischen Retry erhalten.</p><button class="btn" type="submit">Denselben Blattstart erneut bestätigen lassen</button></form>';
    if(!editable(r.match)||r.active_sheet_id||sum.complete)return '';
    if(sum.error)return '';
    if(r.sheets.some(s=>s.state!=='finished'||s.winner_id==null))return '<p class="hint">Vor der nächsten Runde muss der Rundensieger des gespeicherten Blatts ausdrücklich gewählt und gespeichert werden.</p>';
    return `<form data-sk-form="start" class="sheet-start"><h3>${r.sheets.length?'Nächste Runde':'Erste Runde'} starten</h3><p class="muted">Die Startperson wird für jede Runde neu von euch gewählt.</p><label class="field"><span>Wer beginnt?</span><select id="sheet-start-player" data-sk-field="startId" required><option value="">Startperson ausdrücklich wählen</option>${players(r.match).map(p=>`<option value="${e(p.id)}" ${same(d.startId,p.id)?'selected':''}>${e(p.name)}</option>`).join('')}</select></label><button class="btn primary" type="submit">Spielblatt starten</button></form>`;
  }
  function winnerForm(r,s,d) {
    if(s.state!=='finished')return '';
    const ps=players(r.match),selected=ps.find(p=>same(p.id,d.winnerId));
    const points=selected?s.totals?.[selected.id]?.points:null, other=selected?ps.find(p=>!same(p.id,selected.id)):null;
    const reasonRequired=!!selected&&(Number(points)<Number(r.match.points_target)||Number(points)<=Number(s.totals?.[other?.id]?.points));
    return `<section class="sheet-finished"><h3>${r.match.result?'Original-Blatt · unverändert gespeichert':r.match.status==='disputed'?'Bestrittenes Original-Blatt · unverändert':'Blatt gespeichert · eingefroren'}</h3>${r.match.result?'<p>Dieses Original bleibt unverändert. Das aktuell akzeptierte Ergebnis wird in der Partienansicht angezeigt; eine Ersatzkorrektur ändert dieses Blatt nicht.</p>':''}<p>${s.frozen_at?e(bridge.date(s.frozen_at)):''}</p><p><strong>${s.winner_id?`Manuell gewählter Sieger: ${e(name(r.match,s.winner_id))}`:'Noch kein Rundensieger gewählt.'}</strong>${s.end_reason?`<br>Begründung: ${e(s.end_reason)}`:''}</p>${editable(r.match)?`<form data-sk-form="winner"><label class="field"><span>Rundensieger ausdrücklich wählen</span><select id="sheet-winner" data-sk-field="winnerId" required><option value="">Bitte selbst auswählen</option>${ps.map(p=>`<option value="${e(p.id)}" ${same(d.winnerId,p.id)?'selected':''}>${e(p.name)}</option>`).join('')}</select></label><label class="field"><span>Begründung${reasonRequired?' (Pflicht: Punktestand / Aufgabe)':' (bei Aufgabe oder abweichendem Punktestand erforderlich)'}</span><textarea id="sheet-winner-reason" data-sk-field="reason" maxlength="1000" ${reasonRequired?'required':''}>${e(d.reason||'')}</textarea></label><button class="btn primary" type="submit">Manuellen Rundensieger speichern</button></form>`:''}</section>`;
  }
  function renderSheet() {
    if(!opened)return;
    if(rules.isOpen()){deferredRender=true;return;}deferredRender=false;
    const r=record();if(!r)return;
    const active=document.activeElement, focusId=active?.id, selection=typeof active?.selectionStart==='number'?[active.selectionStart,active.selectionEnd]:null;
    const scroll=content.scrollTop;
    const s=sheet(r),m=r.match,d=s?draft(s):null,allow=!!s&&s.state==='live'&&editable(m);
    dialog.querySelector('[data-sk="finish-view"]').disabled=!allow;
    dialog.querySelector('[data-sk="abort-view"]').disabled=!canAbort(m);
    document.querySelector('#sheet-title').textContent=`14/1 · ${s?`Runde ${s.round_index}`:'Startperson wählen'} · ${bridge.formatLabel(m)}`;
    let body=notice?`<div class="callout sheet-feedback ${notice.error?'error':''}" role="${notice.error?'alert':'status'}">${e(notice.text)}</div>`:'';
    if(r.error)body+=`<div class="callout error" role="alert">${e(r.error)} <button class="btn small" type="button" data-sk="refresh">Erneut laden</button></div>`;
    if(!r.loaded){content.innerHTML=body||'<div class="loading">Blätter werden geladen …</div>';return;}
    if(s){
      body+=`<div class="sheet-scoreboard">${players(m).map(p=>playerScore(m,s,p)).join('')}</div><p class="sheet-server-state">${s.state==='live'&&editable(m)?`Aktuelle Person: ${e(name(m,s.current_player_id))} · ${s.opening_required?'Anstoß erforderlich':'normale Aufnahme'}`:s.state==='aborted'||m.status==='aborted'?'Abgebrochen · Verlauf erhalten · keine Wertung':'Gespeichertes, eingefrorenes Blatt'}</p>${conflictUI(m,s,d)}`;
      if(allow){
        body+=`<div class="sheet-work"><section class="sheet-controls"><div class="sheet-draft-controls"><label class="field"><span>Gültig gutgeschriebene Kugeln · aktuelle Aufnahme</span><input id="sheet-balls" type="number" inputmode="numeric" min="0" step="1" required value="${e(d.balls)}" data-sk-field="balls"></label><div class="sheet-increments">${[1,5,10].map(n=>`<button class="btn" type="button" data-sk="increment" data-by="${n}">+${n}</button>`).join('')}<button class="btn" type="button" data-sk="increment" data-by="-1">−1</button></div><p id="sheet-draft-state" class="hint">${String(d.balls)===String(s.draft_balls)?'Kugelentwurf auf dem Server gespeichert.':'Ungespeicherte Eingabe nur in diesem Tab.'} Kein abgeschlossener Punktestand.</p><button class="btn full" type="button" data-sk="save-draft">Kugelentwurf speichern</button><p class="hint">Mehr als 14 Kugeln sind möglich. Ein Neuaufbau beendet die Aufnahme nicht. Nur gültig gutgeschriebene Kugeln erfassen.</p></div><div class="sheet-end-controls">${[['miss','Fehlstoß'],['safety','Sicherheit'],['foul','Foul']].map(([type,label])=>`<button class="btn ${type==='foul'?'danger':''}" type="button" data-sk="visit" data-end="${type}">Aufnahme beenden · ${label}</button>`).join('')}</div><div class="sheet-extras">${Number(s.totals?.[s.current_player_id]?.foul_streak)===2?`<div class="callout warning"><p>Aktuelle Person hat laut Server zwei Standardfouls.</p>${same(s.warning_required_for,s.current_player_id)?`<label class="sheet-check"><input id="sheet-warning" type="checkbox" data-sk-field="warnSpoken" ${d.warnSpoken?'checked':''}> Ich habe die Warnung in dieser Aufnahme hörbar ausgesprochen.</label><button class="btn full" type="button" data-sk="warning">Gesprochene Warnung erfassen</button>`:'<p>Der Server fordert in dieser Aufnahme aktuell keine neue Warnungerfassung.</p>'}</div>`:''}${s.opening_required?`<div class="callout"><h3>Anstoßfoul</h3><p>Separate Anstoßfoul-Aktion. Der Server zieht 2 Punkte ab; kein zusätzliches Standardfoul und keine normale Aufnahme. Der aktuelle Kugelentwurf wird verworfen. Die Gegenseite entscheidet:</p><label class="field"><span>Entscheidung</span><select data-sk-field="rebreak"><option value="">Bewusst auswählen</option><option value="same" ${d.rebreak==='same'?'selected':''}>Gleiche Person stößt erneut an</option><option value="opponent" ${d.rebreak==='opponent'?'selected':''}>Gegenseite übernimmt den Tisch</option></select></label><button class="btn" type="button" data-sk="opening-foul">Anstoßfoul speichern</button></div>`:''}<div class="actions compact"><button class="btn" type="button" data-sk="rerack">14 Kugeln neu aufgebaut · notieren</button><button class="btn" type="button" data-sk="undo">Letzte Aktion rückgängig</button></div>${opened.mode==='finish'?`<form data-sk-form="finish" class="sheet-finish-form"><h3>Spielende · Blatt einfrieren</h3><label class="sheet-check"><input id="sheet-include" type="checkbox" data-sk-field="include" ${d.include?'checked':''}> Aktuelle Aufnahme mit den oben eingegebenen gültigen Kugeln mit speichern</label><p class="hint">Ohne Haken bleibt nur der bereits gespeicherte Verlauf. Danach wählst du den Sieger manuell; auch Aufgabe oder ein legal überschrittenes Punkteziel sind möglich.</p><button class="btn primary full" type="submit">Blatt speichern und einfrieren</button><button class="text-button" type="button" data-sk="finish-cancel">Weiter erfassen</button></form>`:''}${d.editEntry?`<form data-sk-form="edit" class="sheet-edit-form"><h3>Gespeicherte Aufnahme korrigieren</h3><label class="field"><span>Gültig gutgeschriebene Kugeln</span><input type="number" min="0" step="1" inputmode="numeric" id="sheet-edit-balls" data-sk-field="editBalls" required value="${e(d.editBalls)}"></label><label class="field"><span>Ende der Aufnahme</span><select id="sheet-edit-end" data-sk-field="editEnd" required><option value="">Ende ausdrücklich wählen</option>${[['miss','Fehlstoß'],['safety','Sicherheit'],['foul','Foul']].map(([v,t])=>`<option value="${v}" ${d.editEnd===v?'selected':''}>${t}</option>`).join('')}</select></label><button class="btn" type="submit">Aufnahme korrigieren</button><button class="text-button" type="button" data-sk="edit-cancel">Korrektur schließen</button></form>`:''}</div></section>${ledger(m,s,true)}</div>`;
      }else body+=winnerForm(r,s,d)+ledger(m,s,false);
      const latest=r.sheets.at(-1);
      if(s.state==='finished'&&same(latest?.id,s.id)&&!r.active_sheet_id&&editable(m))body+='<button class="btn" type="button" data-sk="reopen">Letztes Blatt wieder öffnen</button>';
    }
    body+=savedRounds(r)+startForm(r);
    body+='<div class="actions"><button class="btn small" type="button" data-sk="refresh">Serverstand laden</button><button class="btn small" type="button" data-sk="go-parent">Zur Partie / Bestätigung</button></div>';
    content.innerHTML=body;content.scrollTop=scroll;
    if(busy)content.querySelectorAll('button,input,select,textarea').forEach(el=>el.disabled=true);
    if(focusId){const replacement=document.getElementById(focusId);if(replacement&&!replacement.disabled){replacement.focus({preventScroll:true});if(selection)try{replacement.setSelectionRange(...selection);}catch{}}}
    // Explicit navigation wins over ordinary draft/focus/scroll restoration.
    if(formNavigation&&!busy){const form=content.querySelector(formNavigation);if(form){form.querySelector('input,select,textarea,button')?.focus({preventScroll:true});form.scrollIntoView({block:'start',behavior:'instant'});}formNavigation=null;}
  }
  async function freshMatch(id) {const data=await bridge.read(matchPath(id));ackMatch(data.match);return data.match;}
  async function refresh() {
    if(!opened||busy)return;
    const id=opened.matchId;
    try{const m=await freshMatch(id);await loadMatch(m);if(!opened||!same(id,opened.matchId))return;const r=record();
      if(!r.sheets.some(s=>same(s.id,opened.sheetId)))opened.sheetId=r.active_sheet_id||r.sheets.at(-1)?.id||null;
      if(r.error)throw new Error(r.error);
      const s=sheet(r);if(s){draft(s).reviewed=true;persist();}const start=input(`start:${id}`);if(start.conflict){start.conflict=false;start.pending=null;persist();}
      tell('Serverstand geladen. Vorhandene Eingaben bleiben erhalten. Bei Versionsunterschieden bitte den Vergleich ausdrücklich bestätigen.');
    }catch(err){tell(err.message,true);}
  }
  async function startSheet(r) {
    const d=input(`start:${r.match.id}`),p=players(r.match).find(p=>same(p.id,d.startId));
    if(!p){tell('Bitte die Startperson für diese Runde ausdrücklich auswählen.',true);return;}
    if(busy)return;busy=true;renderSheet();
    const scope=`sheet:${r.match.id}:start`;
    try{
      // An uncertain create retains the original match version and key until acknowledged.
      if(!d.pending){const m=await freshMatch(r.match.id);await loadMatch(m);const sum=summary(m,r.sheets);if(!editable(m)||r.error||r.active_sheet_id||sum.complete||sum.error||r.sheets.some(s=>s.state!=='finished'||s.winner_id==null))throw new Error(r.error||sum.error||'Erst das laufende Blatt beenden und den Rundensieger speichern. Ein vollständiger Satz erhält kein weiteres Blatt.');d.pending={starting_player_id:p.id,expected_version:m.version};persist();}
      const data=await bridge.write(`${matchPath(r.match.id)}/sheets`,d.pending,scope);
      if(!data.sheet?.id||!data.match)throw new Error('Blattstart nicht vollständig bestätigt. Bitte identisch erneut versuchen.');
      ackMatch(data.match);adoptSheet(r,data.sheet);bridge.acknowledge(scope);d.startId='';d.pending=null;
      if(opened){opened.sheetId=data.sheet.id;opened.mode='sheet';}notice={text:'Die Runde wurde vom Server mit der gewählten Startperson angelegt.',error:false};
    }catch(err){if(err.status===409){d.pending=null;notice={text:`${err.message} Startperson bleibt erhalten. Bitte den Serverstand ausdrücklich laden und vor einem neuen Start prüfen.`,error:true};d.conflict=true;}else{if(err.status&&err.status<500)d.pending=null;notice={text:err.message,error:true};}}
    finally{busy=false;persist();renderSheet();renderResume();}
  }
  async function propose(r) {
    if(busy)return;busy=true;renderSheet();const scope=`sheet:${r.match.id}:result`,d=input(`result:${r.match.id}`);
    try{
      if(!d.pending){const m=await freshMatch(r.match.id);await loadMatch(m);if(r.error)throw new Error(r.error);const sum=summary(m,r.sheets);
        if(!editable(m)||!m.can_propose||!sum.complete)throw new Error(sum.error||'Der Satz ist noch nicht vollständig oder wurde bereits vorgeschlagen.');
        d.pending={score_a:sum.a,score_b:sum.b,rounds:sum.rounds,expected_version:m.version};persist();
      }
      const data=await bridge.write(`${matchPath(r.match.id)}/result`,d.pending,scope);ackMatch(data.match);
      if(!data.match.proposal)throw new Error('Kein gespeicherter Ergebnisvorschlag bestätigt. Bitte identisch erneut versuchen.');
      bridge.acknowledge(scope);d.pending=null;notice={text:'Satzergebnis vom Server zur Bestätigung angenommen. Erst die Gegenseite bestätigt Rang und Platzierung.',error:false};
      await bridge.afterMatch(r.match);
    }catch(err){if(err.status===409||err.status&&err.status<500)d.pending=null;notice={text:err.message,error:true};}
    finally{busy=false;persist();renderSheet();}
  }
  function abortPanel(m){return canAbort(m)?`<div class="actions compact"><button type="button" class="btn small" data-sk="abort-view" data-mid="${e(m.id)}">Spiel abbrechen</button></div>`:'';}
  function renderAbort(){
    if(!aborting)return;const {match:m}=aborting,d=input(`abort:${m.id}`);
    abortContent.innerHTML=`<h2 id="abort-title">Partie abbrechen?</h2><p>${e(m.teams.map(t=>t.map(p=>p.name).join(' & ')).join(' gegen '))}</p><p>Erst nach der Serverbestätigung ist die Partie abgebrochen. Der Verlauf bleibt erhalten; keine Wertung und keine Platzierung.</p>${aborting.error?`<div class="callout error" role="alert">${e(aborting.error)}</div>`:''}<form data-sk-form="abort"><label class="field"><span>Begründung (optional)</span><textarea id="abort-reason" data-sk-abort-reason maxlength="1000">${e(d.reason||'')}</textarea></label>${aborting.conflict?'<button class="btn small" type="button" data-sk="abort-refresh">Serverstand laden</button>':''}${aborting.reviewed?'<button class="btn small" type="button" data-sk="abort-review">Aktuellen Stand geprüft</button>':''}<div class="actions"><button class="btn" type="button" data-sk="abort-cancel">Weiter spielen</button><button class="btn danger" type="submit" ${busy||aborting.conflict||!canAbort(m)?'disabled':''}>${busy?'Serverantwort läuft …':'Abbruch bestätigen'}</button></div></form>`;
  }
  function openAbort(m){
    if(!canAbort(m)){bridge.notify('Dieser Serverstand erlaubt keinen Abbruch. Bereits bestätigte Ergebnisse und offene Korrekturen bleiben geschützt.',true);return;}
    aborting={match:m,version:m.version,focus:document.activeElement,error:'',conflict:false,reviewed:false};renderAbort();abortDialog.showModal();abortDialog.querySelector('[data-sk="abort-cancel"]')?.focus();
  }
  function closeAbort(){const focus=aborting?.focus;aborting=null;if(abortDialog.open)abortDialog.close();focus?.focus({preventScroll:true});}
  async function abortMatch(){
    if(!aborting||busy||aborting.conflict)return;
    const a=aborting,m=a.match,d=input(`abort:${m.id}`);if(!canAbort(m))return;
    if((d.reason||'').trim().length>1000){aborting.error='Die Begründung darf höchstens 1000 Zeichen enthalten.';renderAbort();return;}
    const payload={expected_version:a.version,...(d.reason?.trim()?{reason:d.reason.trim()}:{})},scope=`${m.id}:abort`;
    busy=true;renderAbort();
    try{
      const data=await bridge.write(`${matchPath(m.id)}/abort`,payload,scope);
      if(data.match?.status!=='aborted')throw new Error('Der Abbruch wurde nicht eindeutig bestätigt. Bitte identisch erneut versuchen.');
      ackMatch(data.match);bridge.acknowledge(scope);running=running.filter(old=>!same(old.id,m.id));
      closeAbort();if(opened&&same(opened.matchId,m.id))closeView();await loadMatch(data.match);await bridge.afterMatch(data.match);
      bridge.notify('Die Partie wurde vom Server abgebrochen. Verlauf erhalten; keine Wertung.');
    }catch(err){if(aborting){aborting.error=err.message;if(err.status===409)aborting.conflict=true;}else bridge.notify(err.message,true);}
    finally{busy=false;persist();renderAbort();renderResume();}
  }
  async function handle(target){
    const act=target.dataset.sk;
    if(act==='abort-cancel'){closeAbort();return;}
    if(act==='abort-view'){
      const id=target.dataset.mid||opened?.matchId,m=records.get(String(id))?.match||bridge.findMatch(id);
      if(m)openAbort(m);return;
    }
    if(act==='abort-refresh'&&aborting){try{const m=await freshMatch(aborting.match.id);aborting.match=m;aborting.reviewed=true;aborting.error=canAbort(m)?'Serverstand geladen. Bitte ausdrücklich prüfen.':'Diese Partie kann laut Server nicht mehr abgebrochen werden.';}catch(err){aborting.error=err.message;}renderAbort();return;}
    if(act==='abort-review'&&aborting?.reviewed){aborting.version=aborting.match.version;aborting.conflict=false;aborting.reviewed=false;renderAbort();return;}
    if(act==='minimize'){await minimize();return;}
    if(act==='rules'&&opened){rules.openForMatch(record().match,target);return;}
    if(act==='go-match'){location.hash=`#partie/${encoded(target.dataset.mid)}`;return;}
    if(act==='open'){
      let m=records.get(String(target.dataset.mid))?.match||bridge.findMatch(target.dataset.mid);
      if(!m)try{m=await freshMatch(target.dataset.mid);}catch(err){bridge.notify(err.message,true);return;}
      if(m)await open(m,target);return;
    }
    const r=record();if(!r)return;const s=sheet(r),d=s?draft(s):null;
    if(act==='go-parent'){const id=r.match.id;await minimize();location.hash=`#partie/${encoded(id)}`;bridge.render();return;}
    if(act==='refresh'){await refresh();return;}
    if(act==='select-sheet'){opened.sheetId=target.dataset.sid;opened.mode='sheet';notice=null;renderSheet();return;}
    if(act==='finish-view'){if(s?.state==='live'){opened.mode='finish';formNavigation='.sheet-finish-form';renderSheet();}return;}
    if(act==='finish-cancel'){opened.mode='sheet';renderSheet();return;}
    if(act==='propose'){await propose(r);return;}
    if(!s||!d)return;
    if(act==='review'&&d.reviewed&&s.state==='live'&&editable(r.match)){Object.assign(d,{baseVersion:s.version,playerId:s.current_player_id,conflict:false,reviewed:false,pending:null,warnSpoken:false});persist();tell('Stand geprüft. Kugeln und Begründungen bleiben erhalten; eine erforderliche gesprochene Warnung muss für die aktuelle Aufnahme neu erfasst werden.');return;}
    if(act==='discard-draft'&&d.reviewed){Object.assign(d,{baseVersion:s.version,playerId:s.current_player_id,balls:String(s.draft_balls),conflict:false,reviewed:false,pending:null,warnSpoken:false});persist();tell('Lokale Kugeleingabe ausdrücklich verworfen. Der gespeicherte Serverentwurf wurde übernommen; keine Punkte nachgetragen.');return;}
    if(act==='retry-pending'){await sendPending(r,s);return;}
    if(busy)return;
    if(act==='increment'){if(!unsigned(d.balls)){tell('Bitte zuerst eine nichtnegative ganze Kugelzahl eingeben.',true);return;}d.balls=String(Math.max(0,Number(d.balls)+Number(target.dataset.by)));persist();renderSheet();document.querySelector('#sheet-balls')?.focus();return;}
    if(act==='edit-entry'){const entry=s.entries.find(entry=>same(entry.id,target.dataset.entry));if(entry){d.editEntry=entry.id;d.editBalls=String(entry.balls);d.editEnd=entry.end_type;formNavigation='.sheet-edit-form';}persist();renderSheet();return;}
    if(act==='edit-cancel'){d.editEntry=null;persist();renderSheet();return;}
    if(act==='warning'){if(!d.warnSpoken||!same(s.warning_required_for,s.current_player_id)){tell('Warnung nur nach tatsächlichem hörbarem Aussprechen für die aktuelle Person erfassen.',true);return;}await action(r,s,{type:'warning',player_id:s.current_player_id});return;}
    if(act==='opening-foul'){if(!['same','opponent'].includes(d.rebreak)){tell('Bitte die Entscheidung der Gegenseite ausdrücklich auswählen.',true);return;}await action(r,s,{type:'opening_foul',rebreak_choice:d.rebreak});return;}
    if(['rerack','undo','reopen'].includes(act)){await action(r,s,{type:act});return;}
    if(act==='save-draft'||act==='visit'){
      if(!unsigned(d.balls)){tell('Kugeln als nichtnegative ganze Zahl eingeben. Es gibt keine Begrenzung auf 14.',true);return;}
      await action(r,s,act==='save-draft'?{type:'draft',balls:Number(d.balls)}:{type:'visit',balls:Number(d.balls),end:target.dataset.end});
    }
  }
  document.addEventListener('click',event=>{const target=event.target.closest('[data-sk]');if(target)handle(target).catch(err=>tell(err.message,true));});
  document.addEventListener('submit',async event=>{
    const form=event.target.closest('[data-sk-form]');if(!form)return;event.preventDefault();if(!form.reportValidity())return;
    if(form.dataset.skForm==='abort'){await abortMatch();return;}
    const r=record();if(!r)return;if(form.dataset.skForm==='start'){const start=input(`start:${r.match.id}`);if(start.conflict){tell('Bitte den Serverstand laden und die Startauswahl erneut prüfen.',true);return;}await startSheet(r);return;}
    const s=sheet(r);if(!s||busy)return;const d=draft(s);
    if(form.dataset.skForm==='finish'){if(!unsigned(d.balls)){tell('Bitte eine nichtnegative ganze Kugelzahl eingeben.',true);return;}await action(r,s,{type:'finish',balls:Number(d.balls),include_current_visit:!!d.include});}
    if(form.dataset.skForm==='winner'){
      const ps=players(r.match),p=ps.find(p=>same(p.id,d.winnerId)),other=ps.find(p=>!same(p.id,d.winnerId));
      if(!p){tell('Bitte den Rundensieger ausdrücklich auswählen.',true);return;}
      const needsReason=Number(s.totals[p.id]?.points)<Number(r.match.points_target)||Number(s.totals[p.id]?.points)<=Number(s.totals[other.id]?.points);
      if(needsReason&&!d.reason?.trim()){tell('Für Aufgabe, Unterschreiten des Ziels oder eine abweichende Siegerwahl ist eine Begründung erforderlich.',true);return;}
      if((d.reason||'').trim().length>1000){tell('Die Begründung darf höchstens 1000 Zeichen enthalten.',true);return;}
      await action(r,s,{type:'winner',winner_id:p.id,...(d.reason?.trim()?{reason:d.reason.trim()}:{})});
    }
    if(form.dataset.skForm==='edit'){if(!unsigned(d.editBalls)||!['miss','safety','foul'].includes(d.editEnd)){tell('Bitte rohe Kugelzahl und Ende der Aufnahme prüfen.',true);return;}await action(r,s,{type:'edit_visit',entry_id:d.editEntry,balls:Number(d.editBalls),end:d.editEnd});}
  });
  function capture(event){
    if(event.target.hasAttribute('data-sk-abort-reason')&&aborting){input(`abort:${aborting.match.id}`).reason=event.target.value;persist();return;}
    const field=event.target.dataset.skField;if(!field||!opened)return;const r=record();if(!r)return;
    const s=sheet(r),d=field==='startId'?input(`start:${r.match.id}`):s?draft(s):null;if(!d)return;
    d[field]=event.target.type==='checkbox'?event.target.checked:event.target.value;
    if(field==='startId'){d.pending=null;d.conflict=false;}
    persist();
    if(field==='balls'){const hint=document.querySelector('#sheet-draft-state');if(hint)hint.textContent='Ungespeicherte Eingabe nur in diesem Tab. Noch keine abgeschlossene Aufnahme.';}
    if(event.type==='change'&&['winnerId','include'].includes(field))renderSheet();
  }
  document.addEventListener('input',capture);document.addEventListener('change',capture);
  document.addEventListener('pointerdown',event=>{if(event.target.closest('[data-sk="open"]'))pointerFocus=document.activeElement;});
  dialog.addEventListener('cancel',event=>{event.preventDefault();if(!rules.isOpen())minimize();});
  abortDialog.addEventListener('cancel',event=>{event.preventDefault();closeAbort();});
  document.addEventListener('focusin',event=>{
    // The original-PDF modal owns focus while it is above this sheet.
    if(opened&&!rules.isOpen()&&!abortDialog.open&&!dialog.contains(event.target))dialog.querySelector('[data-sk="minimize"]')?.focus({preventScroll:true});
  });
  document.addEventListener('merzig-rules-closed',()=>{if(opened&&deferredRender)renderSheet();});
  window.addEventListener('popstate',()=>{if(opened&&!rules.isOpen()&&history.state?.merzigSheet!==opened.token)minimize(false);});
  window.addEventListener('hashchange',()=>{if(opened&&location.hash!==opened.hash)minimize(false);});
  window.BillardScorekeeper=Object.freeze({
    init:callbacks=>{bridge=callbacks;},loadMatch,overview,panel,abortPanel,legacyAllowed,summary,canAbort,updateMatch,disputeRecoveryAllowed,
    originalRoundCount:m=>records.get(m.id)?.sheets.length||0,
    isOpen:()=>!!opened,clear,renderResume,open,openAbort,
    refreshMatch:async m=>{if(m.pool==='14-single')await loadMatch(m);},
    discardInputs:()=>{inputs={};persist();}
  });
})();
