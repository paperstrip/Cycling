/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { CloudOff, RefreshCw, Share, Plus, X } from 'lucide-react';
import {
  applyUpdate,
  getInstallPlatform,
  onConnectivityChange,
  promptInstall,
  registerServiceWorker,
} from '../utils/pwa';

const INSTALL_HINT_DISMISSED = 'cyclocoach_install_hint_dismissed';

/**
 * Bandeaux d'état de l'application installable :
 * - nouvelle version disponible,
 * - mode hors connexion,
 * - invitation à installer l'app sur l'écran d'accueil.
 */
export const PwaStatusBar: React.FC = () => {
  const [hasUpdate, setHasUpdate] = useState(false);
  const [isOffline, setIsOffline] = useState(
    typeof navigator !== 'undefined' ? !navigator.onLine : false,
  );
  const [showInstallHint, setShowInstallHint] = useState(false);

  useEffect(() => {
    registerServiceWorker(() => setHasUpdate(true));
    return onConnectivityChange((online) => setIsOffline(!online));
  }, []);

  useEffect(() => {
    // L'invite d'installation n'apparaît qu'après une prise en main de l'app,
    // jamais dès la première seconde.
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(INSTALL_HINT_DISMISSED) === 'true';
    } catch {
      dismissed = false;
    }
    if (dismissed) return;

    const timer = setTimeout(() => {
      const platform = getInstallPlatform();
      if (platform === 'ios-safari' || platform === 'prompt') {
        setShowInstallHint(true);
      }
    }, 20000);
    return () => clearTimeout(timer);
  }, []);

  const dismissInstallHint = () => {
    setShowInstallHint(false);
    try {
      localStorage.setItem(INSTALL_HINT_DISMISSED, 'true');
    } catch {
      // Sans stockage, l'invite réapparaîtra à la prochaine session.
    }
  };

  const handleInstall = async () => {
    const installed = await promptInstall();
    if (installed) dismissInstallHint();
  };

  const platform = getInstallPlatform();

  return (
    <>
      {/* Bandeau haut : mise à jour disponible / hors connexion */}
      {(hasUpdate || isOffline) && (
        <div className="sticky top-0 z-50 px-safe">
          {hasUpdate && (
            <div className="flex items-center gap-2.5 px-4 py-2 bg-amber-500 text-stone-950">
              <RefreshCw className="w-4 h-4 shrink-0" />
              <span className="text-xs font-bold flex-1">Nouvelle version disponible</span>
              <button
                onClick={applyUpdate}
                className="px-3 py-1 rounded-lg bg-stone-950 text-amber-400 text-[11px] font-black uppercase tracking-wider cursor-pointer"
              >
                Actualiser
              </button>
            </div>
          )}
          {isOffline && (
            <div className="flex items-center gap-2.5 px-4 py-2 bg-stone-800 text-stone-300 border-b border-stone-700">
              <CloudOff className="w-4 h-4 shrink-0 text-stone-400" />
              <span className="text-[11px] font-bold">
                Hors connexion — séances, chrono et GPS restent disponibles.
              </span>
            </div>
          )}
        </div>
      )}

      {/* Invite d'installation sur l'écran d'accueil */}
      {showInstallHint && (
        <div className="fixed left-0 right-0 bottom-0 z-[60] p-3 px-safe pb-safe animate-fade-up md:p-4">
          <div className="mx-auto max-w-md rounded-2xl bg-stone-900 border border-amber-500/40 shadow-2xl p-4 flex gap-3">
            <img
              src={`${import.meta.env.BASE_URL}icon-192.png`}
              alt=""
              className="w-11 h-11 rounded-xl shrink-0"
            />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-black text-white">Installer CycloCoach</div>
              {platform === 'ios-safari' ? (
                <p className="text-[11px] text-stone-400 mt-1 leading-relaxed">
                  Pour rouler en plein écran avec le GPS : appuyez sur{' '}
                  <Share className="inline w-3.5 h-3.5 text-amber-400 -mt-0.5" /> puis{' '}
                  <strong className="text-stone-200">« Sur l'écran d'accueil »</strong>{' '}
                  <Plus className="inline w-3.5 h-3.5 text-amber-400 -mt-0.5" />.
                </p>
              ) : (
                <p className="text-[11px] text-stone-400 mt-1 leading-relaxed">
                  Accès plein écran, démarrage instantané et fonctionnement hors connexion.
                </p>
              )}

              {platform === 'prompt' && (
                <button
                  onClick={handleInstall}
                  className="mt-2.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-black text-[11px] uppercase tracking-wider cursor-pointer"
                >
                  Installer
                </button>
              )}
            </div>
            <button
              onClick={dismissInstallHint}
              aria-label="Masquer"
              className="p-1.5 h-fit text-stone-500 hover:text-stone-300 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
};
