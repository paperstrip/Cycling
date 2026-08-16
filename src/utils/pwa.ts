/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Cycle de vie PWA : enregistrement du service worker, détection des mises à
 * jour, état d'installation et suivi de la connexion réseau.
 */

export type InstallPlatform = 'ios-safari' | 'prompt' | 'installed' | 'unsupported';

let waitingWorker: ServiceWorker | null = null;
let deferredInstallPrompt: any = null;

/** L'app tourne-t-elle en mode application (écran d'accueil) plutôt qu'en onglet ? */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari expose son propre indicateur, non standard.
    (window.navigator as any).standalone === true
  );
}

export function isIos(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    // iPadOS 13+ se déclare comme un Mac : on le distingue au tactile.
    (navigator.platform === 'MacIntel' && (navigator as any).maxTouchPoints > 1)
  );
}

/** Détermine comment l'utilisateur peut installer l'app sur son appareil. */
export function getInstallPlatform(): InstallPlatform {
  if (isStandalone()) return 'installed';
  if (deferredInstallPrompt) return 'prompt';
  if (isIos()) return 'ios-safari';
  return 'unsupported';
}

/** Déclenche l'invite d'installation native (Android/desktop). */
export async function promptInstall(): Promise<boolean> {
  if (!deferredInstallPrompt) return false;
  deferredInstallPrompt.prompt();
  const choice = await deferredInstallPrompt.userChoice.catch(() => null);
  deferredInstallPrompt = null;
  return choice?.outcome === 'accepted';
}

/**
 * Enregistre le service worker.
 * @param onUpdateReady appelé lorsqu'une nouvelle version est prête à être activée.
 */
export function registerServiceWorker(onUpdateReady: () => void): void {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

  // Le service worker exige HTTPS (localhost excepté, pour le développement).
  const isSecure =
    window.location.protocol === 'https:' ||
    ['localhost', '127.0.0.1'].includes(window.location.hostname);
  if (!isSecure) return;

  // BASE_URL vaut "/" en local et "/Cycling/" sur GitHub Pages.
  const swUrl = `${import.meta.env.BASE_URL}sw.js`;

  const start = () => {
    navigator.serviceWorker
      .register(swUrl)
      .then((registration) => {
        // Une version en attente existe déjà (onglet rouvert après un déploiement).
        if (registration.waiting && navigator.serviceWorker.controller) {
          waitingWorker = registration.waiting;
          onUpdateReady();
        }

        registration.addEventListener('updatefound', () => {
          const installing = registration.installing;
          if (!installing) return;
          installing.addEventListener('statechange', () => {
            // "installed" + un contrôleur actif = mise à jour (et non 1re visite).
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
              waitingWorker = installing;
              onUpdateReady();
            }
          });
        });

        // Vérifie périodiquement les nouvelles versions (app longtemps ouverte).
        setInterval(() => registration.update().catch(() => {}), 60 * 60 * 1000);
      })
      .catch((err) => {
        console.log('Enregistrement du service worker ignoré :', err);
      });

    // Rechargement unique lorsque le nouveau worker prend la main.
    let hasReloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (hasReloaded) return;
      hasReloaded = true;
      window.location.reload();
    });
  };

  // React peut monter après l'événement "load" : dans ce cas l'écouteur ne se
  // déclencherait jamais et le service worker ne serait pas enregistré.
  if (document.readyState === 'complete') {
    start();
  } else {
    window.addEventListener('load', start, { once: true });
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
  });
}

/** Active la version en attente : le worker prend la main puis la page se recharge. */
export function applyUpdate(): void {
  if (waitingWorker) {
    waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    waitingWorker = null;
  } else {
    window.location.reload();
  }
}

/** S'abonne aux changements de connectivité. Retourne la fonction de désabonnement. */
export function onConnectivityChange(fn: (online: boolean) => void): () => void {
  const handleOnline = () => fn(true);
  const handleOffline = () => fn(false);
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}
