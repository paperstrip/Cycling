/**
 * Service Worker CycloCoach.
 *
 * Toutes les URLs sont relatives au script : le SW fonctionne donc aussi bien à
 * la racine du domaine qu'à un sous-chemin (GitHub Pages : /Cycling/).
 */

const CACHE_NAME = 'cyclocoach-v2';
const ASSETS_TO_CACHE = ['./', './index.html', './manifest.webmanifest', './icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // addAll échoue en bloc si une seule ressource manque : on tolère les absences.
      return Promise.all(
        ASSETS_TO_CACHE.map((url) => cache.add(url).catch(() => undefined))
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;

  // On ne gère que les GET de même origine : les appels à l'API Gemini
  // (generativelanguage.googleapis.com), les tuiles de carte et les autres
  // services externes passent directement au réseau.
  if (request.method !== 'GET') return;
  if (new URL(request.url).origin !== self.location.origin) return;

  // Navigation (HTML) : réseau d'abord, pour toujours obtenir la dernière
  // version déployée ; le cache prend le relais hors connexion.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('./index.html', copy));
          return response;
        })
        .catch(() => caches.match('./index.html').then((r) => r || caches.match('./')))
    );
    return;
  }

  // Assets (JS/CSS/images, noms hachés par Vite) : cache d'abord.
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;
      return fetch(request)
        .then((response) => {
          if (response && response.status === 200 && response.type === 'basic') {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match('./index.html'));
    })
  );
});
