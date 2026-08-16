/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Gestion de la clé API Gemini côté navigateur.
 *
 * L'application est déployée en statique (GitHub Pages), il n'y a donc aucun
 * serveur pour héberger un secret. La clé est saisie par l'utilisateur et
 * conservée uniquement dans le localStorage de son propre appareil : elle
 * n'est jamais commitée dans le dépôt ni envoyée ailleurs qu'à Google.
 */

const API_KEY_STORAGE = 'cyclocoach_gemini_api_key';

/** Clé éventuellement injectée au build (VITE_GEMINI_API_KEY), sinon vide. */
const BUILD_TIME_KEY = (import.meta.env.VITE_GEMINI_API_KEY as string | undefined) || '';

type Listener = (key: string) => void;
const listeners = new Set<Listener>();

export function getApiKey(): string {
  try {
    const stored = localStorage.getItem(API_KEY_STORAGE);
    if (stored && stored.trim()) return stored.trim();
  } catch {
    // localStorage indisponible (mode privé strict) : on retombe sur le build.
  }
  return BUILD_TIME_KEY;
}

export function hasApiKey(): boolean {
  return getApiKey().length > 0;
}

export function saveApiKey(key: string): void {
  const clean = key.trim();
  try {
    if (clean) {
      localStorage.setItem(API_KEY_STORAGE, clean);
    } else {
      localStorage.removeItem(API_KEY_STORAGE);
    }
  } catch {
    // Ignoré : la clé restera valable pour la session en cours uniquement.
  }
  listeners.forEach((fn) => fn(clean));
}

export function clearApiKey(): void {
  saveApiKey('');
}

/** S'abonne aux changements de clé (retourne la fonction de désabonnement). */
export function onApiKeyChange(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Erreur levée lorsqu'aucune clé n'est configurée. */
export class MissingApiKeyError extends Error {
  constructor() {
    super("Aucune clé API Gemini configurée. Ouvrez les réglages pour l'ajouter.");
    this.name = 'MissingApiKeyError';
  }
}
