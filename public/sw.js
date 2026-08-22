/**
 * Service Worker CycloCoach.
 *
 * Toutes les URLs sont relatives au script : le SW fonctionne donc aussi bien à
 * la racine du domaine qu'à un sous-chemin (GitHub Pages : /Cycling/).
 *
 * BUILD_ID et PRECACHE_ASSETS sont remplacés au build par le plugin Vite
 * `pwaServiceWorker` (voir vite.config.ts).
 */

const BUILD_ID = '__BUILD_ID__';
const PRECACHE_ASSETS = '__PRECACHE_ASSETS__';

const CACHE_NAME = `cyclocoach-${BUILD_ID}`;

// Coquille de l'app + assets hachés du build : l'app est utilisable hors ligne
// dès la première visite, sans attendre un second chargement.
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
].concat(Array.isArray(PRECACHE_ASSETS) ? PRECACHE_ASSETS : []);

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // addAll échoue en bloc si une seule ressource manque : on tolère les absences.
      Promise.all(ASSETS_TO_CACHE.map((url) => cache.add(url).catch(() => undefined)))
    )
  );
  // Pas de skipWaiting() ici : la nouvelle version attend que l'utilisateur
  // accepte la mise à jour (message SKIP_WAITING ci-dessous).
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.map((key) => (key !== CACHE_NAME ? caches.delete(key) : undefined)))
      )
      .then(() => self.clients.claim())
  );
});

// Déclenché par l'app quand l'utilisateur accepte la mise à jour.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const request = event.request;

  // On ne gère que les GET de même origine : les appels à l'API Gemini
  // (generativelanguage.googleapis.com), les tuiles de carte et les autres
  // services externes passent directement au réseau.
  if (request.method !== 'GET') return;
  if (new URL(request.url).origin !== self.location.origin) return;

  // Navigation (HTML) : cache d'abord, réseau en secours.
  //
  // Le réseau était servi en premier, et la réponse écrasait l'index.html du
  // cache. Or cet index tout juste déployé référence des fichiers JS aux noms
  // hachés NEUFS, qui ne sont mis en cache qu'à l'installation du nouveau
  // service worker — laquelle attend l'accord de l'utilisateur. Entre les deux,
  // le cache contenait donc un index pointant vers des fichiers absents : hors
  // connexion, l'app affichait une page blanche.
  //
  // Servir la coquille depuis le cache garantit que le HTML et les assets
  // proviennent toujours du même build. Les mises à jour restent assurées par
  // le cycle du service worker (nouveau BUILD_ID, nouveau cache, bandeau de
  // mise à jour puis SKIP_WAITING).
  if (request.mode === 'navigate') {
    event.respondWith(
      caches
        .match('./index.html')
        .then((cached) => cached || caches.match('./') || fetch(request))
        .catch(() => fetch(request))
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
        .catch(
          () =>
            // Surtout PAS index.html en secours : renvoyer du HTML pour une
            // requête de module JavaScript provoquait un refus de MIME type
            // et une page blanche, alors qu'un échec franc laisse au
            // navigateur la possibilité de réessayer.
            new Response('', { status: 504, statusText: 'Ressource indisponible hors connexion' })
        );
    })
  );
});
