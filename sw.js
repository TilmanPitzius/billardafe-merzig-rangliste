'use strict';
const CACHE = 'merzig-shell-v12';
const SHELL = ['./', './index.html', './app.css', './opening.css', './opening.js', './deployment-config.js', './remote-auth.js', './branding/cafe-logo.svg', './scorekeeper.css', './rules.js', './scorekeeper.js', './app.js', './manifest.webmanifest', './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png'];
const shellURLs = new Set(SHELL.map(path => new URL(path, self.registration.scope).href));
const canCache = response => response.ok && response.type === 'basic' && !response.headers.has('set-cookie') && !/private|no-store/i.test(response.headers.get('cache-control') || '');
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => Promise.all([...shellURLs].map(async url => {
    const response = await fetch(url, {credentials: 'omit', cache: 'reload'});
    if (!response.ok) throw new Error('Shell unavailable');
    if (canCache(response)) await cache.put(url, response);
  }))));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('merzig-shell-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  // Exact allowlist: never intercept APIs, writes, private pages, or arbitrary URLs.
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.search || !shellURLs.has(url.href)) return;
  event.respondWith(fetch(request).then(response => {
    if (canCache(response)) {
      const copy = response.clone();
      event.waitUntil(caches.open(CACHE).then(cache => cache.put(request, copy)));
    }
    return response;
  }).catch(async () => (await caches.match(request)) || Response.error()));
});
