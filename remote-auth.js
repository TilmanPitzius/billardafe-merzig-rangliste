"use strict";

(() => {
  const config = window.BillardDeployment || {};
  const here = new URL(location.href);
  const base = new URL("./", here);
  let api = here.origin, enabled = false, configError = "";
  try {
    if (config.apiBase) {
      const candidate = new URL(config.apiBase);
      const frontend = new URL(config.frontendURL);
      if (candidate.protocol !== "https:" || candidate.username || candidate.password || candidate.pathname !== "/" || candidate.search || candidate.hash || frontend.href !== base.href || frontend.protocol !== "https:") throw Error();
      api = candidate.origin; enabled = api !== here.origin;
    } else if (/\.github\.io$/i.test(here.hostname)) throw Error();
  } catch { configError = "Die Verbindung dieser App ist nicht richtig eingerichtet. Bitte die offizielle App-Adresse verwenden."; enabled = true; }
  if (enabled && window.top !== window.self) configError = "Bitte die Rangliste direkt öffnen. Die Anmeldung ist in eingebetteten Ansichten gesperrt.";
  const key = "billard-pages-session-v1:" + base.href;
  const pendingKey = "billard-pages-pkce-v1:" + base.href;
  const shared = !!navigator.locks?.request;
  let tabRecord = null;
  if (!shared) {
    // A callback may hand its refresh token to the next document once. Consume
    // and delete immediately: without Web Locks no reusable browser storage remains.
    try {
      const handoff = JSON.parse(sessionStorage.getItem(key) || "null");
      sessionStorage.removeItem(key);
      if (handoff && Number.isFinite(handoff.savedAt) && Date.now() >= handoff.savedAt && Date.now() - handoff.savedAt < 60000) tabRecord = JSON.stringify(handoff.record);
    } catch { sessionStorage.removeItem(key); }
  }
  const storage = shared ? localStorage : {getItem:() => tabRecord, setItem:(_, value) => {tabRecord=value;}, removeItem:() => {tabRecord=null;}};
  const lockName = "billard-pages-refresh:" + base.href;
  let access = null, currentIdentity = null, currentUser = null, refreshing = null;
  let identityHandler = () => {};
  const authError = message => Object.assign(new Error(message), {status: 401});
  const read = () => { try { const value = JSON.parse(storage.getItem(key) || "null"); return value && typeof value.refresh_token === "string" && typeof value.identity === "string" && typeof value.user_id === "string" ? value : null; } catch { return null; } };
  const locked = fn => shared ? navigator.locks.request(lockName, {mode: "exclusive"}, fn) : fn();
  const clearMemory = () => { access = null; currentIdentity = null; currentUser = null; };
  function changed() { clearMemory(); identityHandler(); }
  const b64 = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
  const random = () => b64(crypto.getRandomValues(new Uint8Array(32)));
  const safeHash = hash => /^#(spielen(?:\/neu)?|partie\/[A-Za-z0-9_-]+|beitreten\/[A-Za-z0-9_-]+|installieren|rangliste|regeln|profil(?:\/hilfe)?)$/.test(hash || "") ? hash : "#spielen";
  async function json(path, body) {
    if (configError) throw new Error(configError);
    const response = await fetch(api + "/api/pages" + path, {method:"POST", credentials:"omit", cache:"no-store", redirect:"error", referrerPolicy:"no-referrer", headers:{"Content-Type":"application/json", Accept:"application/json"}, body:JSON.stringify(body)});
    let data; try { data = await response.json(); } catch { throw new Error("Die Anmeldung konnte nicht gelesen werden. Bitte erneut anmelden."); }
    if (!response.ok) throw Object.assign(new Error(typeof data.detail === "string" ? data.detail : "Die Anmeldung ist abgelaufen. Bitte erneut anmelden."), {status:response.status});
    return data;
  }
  function tokens(data, identity) {
    if (typeof data.access_token !== "string" || !data.access_token || typeof data.refresh_token !== "string" || !data.refresh_token || data.token_type !== "Bearer" || !Number.isFinite(data.expires_in) || data.expires_in <= 0 || typeof data.user?.id !== "string" || !data.user.id) throw authError("Die Anmeldung wurde nicht vollständig bestätigt. Bitte erneut anmelden.");
    const record = {refresh_token:data.refresh_token, refresh_expires_at:data.refresh_expires_at, user_id:data.user.id, identity};
    // Persist the replacement while still holding the same refresh lock.
    storage.setItem(key, JSON.stringify(record));
    currentIdentity = identity; currentUser = data.user.id;
    access = {token:data.access_token, expires:Date.now() + data.expires_in * 1000};
    return data;
  }
  async function refresh(force = false) {
    if (configError) throw new Error(configError);
    if (!force && access?.expires > Date.now() + 30000) {
      if (read()?.identity !== currentIdentity) { changed(); throw authError("Das Profil wurde geändert. Bitte neu prüfen."); }
      return access.token;
    }
    if (refreshing) return refreshing;
    refreshing = locked(async () => {
      const record = read();
      if (!record) { if (currentIdentity) changed(); return null; }
      if (currentIdentity && record.identity !== currentIdentity) { changed(); throw authError("Das Profil wurde in einem anderen Tab geändert. Bitte neu prüfen."); }
      if (!force && access?.expires > Date.now() + 30000) return access.token;
      try { tokens(await json("/refresh", {refresh_token:record.refresh_token}), record.identity); return access.token; }
      catch (error) {
        // Connection failures keep the last rotating token for an explicit retry.
        if ([400,401,403].includes(error.status)) { storage.removeItem(key); changed(); }
        throw error;
      }
    });
    try { return await refreshing; } finally { refreshing = null; }
  }
  async function fetchAPI(path, options = {}) {
    if (configError) throw new Error(configError);
    let token = await refresh();
    const send = value => fetch(api + "/api" + path, {...options, credentials:"omit", cache:"no-store", redirect:"error", referrerPolicy:"no-referrer", headers:{...options.headers, ...(value ? {Authorization:"Bearer " + value} : {})}});
    let response = await send(token);
    if (response.status === 401 && token && path !== "/logout") {
      // Authentication rejects precede mutation; retain the exact original write,
      // optimistic version and idempotency key for this single replay.
      token = await refresh(true);
      if (token) response = await send(token);
    }
    if (response.status === 401 && token) {
      await locked(async () => { if (read()?.identity === currentIdentity) storage.removeItem(key); });
      changed();
    }
    return response;
  }
  async function begin({purpose = "login", returnTo = location.hash} = {}) {
    if (!enabled || configError) throw new Error(configError || "Die externe Anmeldung ist hier nicht verfügbar.");
    if (!["login","account"].includes(purpose)) throw Error("Ungültige Profilwahl.");
    const verifier = random(), state = random();
    const challenge = b64(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))));
    const pending = {verifier,state,hash:safeHash(returnTo),created:Date.now()};
    sessionStorage.setItem(pendingKey, JSON.stringify(pending));
    try {
      const data = await json("/prepare", {code_challenge:challenge,state,purpose});
      const target = new URL(data.authorization_url);
      if (target.origin !== api || !/^\/connect\/[A-Za-z0-9_-]+$/.test(target.pathname) || target.search || target.hash || target.username || target.password) throw Error("Die Anmeldeseite wurde nicht bestätigt.");
      location.assign(target.href);
    } catch (error) { sessionStorage.removeItem(pendingKey); throw error; }
  }
  async function finishCallback(parameters) {
    if (!enabled || configError) throw Error(configError || "Diese Anmeldung gehört nicht zu dieser App.");
    let pending; try { pending = JSON.parse(sessionStorage.getItem(pendingKey) || "null"); } catch {}
    sessionStorage.removeItem(pendingKey);
    if (parameters.getAll("code").length !== 1 || parameters.getAll("state").length !== 1 || [...parameters.keys()].some(name => !["code","state"].includes(name)) || !pending || !/^[A-Za-z0-9_-]{43}$/.test(pending.verifier || "") || !/^[A-Za-z0-9_-]{43}$/.test(pending.state || "") || !Number.isFinite(pending.created) || pending.state !== parameters.get("state") || !/^[A-Za-z0-9_-]+$/.test(parameters.get("code") || "") || Date.now() - pending.created > 600000 || Date.now() < pending.created) throw Error("Diese Anmeldung ist abgelaufen oder gehört zu einem anderen Tab. Bitte erneut anmelden.");
    await locked(async () => {
      tokens(await json("/exchange", {code:parameters.get("code"), code_verifier:pending.verifier}), random());
      if (!shared) sessionStorage.setItem(key, JSON.stringify({savedAt:Date.now(),record:read()}));
    });
    return safeHash(pending.hash);
  }
  async function logout() {
    const previous = currentIdentity || read()?.identity;
    try { const response = await fetchAPI("/logout", {method:"POST", headers:{"Content-Type":"application/json",Accept:"application/json"}, body:"{}"}); if (!response.ok) throw Error("Der Server hat die Abmeldung nicht bestätigt."); }
    finally {
      await locked(async () => { if (!previous || read()?.identity === previous) storage.removeItem(key); });
      clearMemory(); sessionStorage.removeItem(pendingKey);
    }
  }
  window.addEventListener("storage", event => {
    if (!enabled || !shared || event.key !== key) return;
    const record = read();
    if (!record || record.identity !== currentIdentity) changed();
  });
  window.BillardRemoteAuth = Object.freeze({enabled, configError, apiBase:api, frontendURL:base.href, fetchAPI, begin, finishCallback, logout, safeHash,
    onIdentityChange:handler => { identityHandler = handler; },
    clearPending:() => sessionStorage.removeItem(pendingKey)
  });
})();
