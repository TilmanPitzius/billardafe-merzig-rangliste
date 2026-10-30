"use strict";
(() => {
  const parameters = new URL(location.href).searchParams;
  history.replaceState(null, "", new URL("auth-callback.html", location.href).pathname);
  window.BillardRemoteAuth.finishCallback(parameters).then(hash => {
    location.replace(new URL("./", location.href).href + hash);
  }).catch(error => {
    document.querySelector("#callback-title").textContent = "Anmeldung nicht abgeschlossen";
    document.querySelector("#callback-status").textContent = error.message;
    document.querySelector("#callback-return").hidden = false;
  });
})();
