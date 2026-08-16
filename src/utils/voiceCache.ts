/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Cache persistant des clips vocaux Gemini.
 *
 * Générer la voix au moment où le bloc démarre introduit la latence du réseau
 * (souvent 0,5 à 2 s) : la consigne arrive alors après le début de l'effort.
 * On génère donc tout l'audio d'une séance AVANT le départ et on le conserve
 * dans IndexedDB — la lecture devient instantanée, fonctionne hors connexion,
 * et une séance déjà préparée ne consomme plus aucun quota.
 *
 * IndexedDB et non localStorage : un clip PCM pèse plusieurs centaines de Ko en
 * base64, ce qui saturerait immédiatement les ~5 Mo de localStorage.
 */

import type { WorkoutPlan } from '../types';
import { flattenWorkoutPlan } from './planFlatten';
import { synthesizeSpeech, type TtsResult } from './geminiClient';
import { normalizeTextForSpeech } from './audioEngine';

const DB_NAME = 'cyclocoach_voice';
const DB_VERSION = 1;
const STORE_NAME = 'clips';

/** Au-delà, les clips les plus anciens sont purgés. */
const MAX_CLIPS = 400;

export interface CachedClip {
  key: string;
  audioBase64: string;
  sampleRate: number;
  voiceName: string;
  text: string;
  createdAt: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      return reject(new Error('IndexedDB non supporté'));
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event: any) => {
      const db = event.target.result as IDBDatabase;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'key' });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
  });
}

/** Clé stable : même texte + même voix = même clip. */
export function clipKey(voiceName: string, text: string): string {
  return `${voiceName}::${text.trim()}`;
}

export async function getCachedClip(key: string): Promise<CachedClip | null> {
  try {
    const db = await openDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(key);
      req.onsuccess = () => resolve((req.result as CachedClip) || null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function putCachedClip(clip: CachedClip): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const req = tx.objectStore(STORE_NAME).put(clip);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Écriture du cache vocal impossible:', err);
  }
}

/** Supprime les clips les plus anciens au-delà de MAX_CLIPS. */
export async function pruneCache(): Promise<void> {
  try {
    const db = await openDB();
    const all: CachedClip[] = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
    if (all.length <= MAX_CLIPS) return;

    const surplus = all.sort((a, b) => a.createdAt - b.createdAt).slice(0, all.length - MAX_CLIPS);
    const db2 = await openDB();
    await new Promise<void>((resolve) => {
      const tx = db2.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      surplus.forEach((c) => store.delete(c.key));
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // Purge best-effort : un échec n'empêche pas l'app de fonctionner.
  }
}

export async function clearVoiceCache(): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const req = tx.objectStore(STORE_NAME).clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Purge du cache vocal impossible:', err);
  }
}

/** Nombre de clips stockés et poids approximatif, pour l'affichage des réglages. */
export async function getCacheStats(): Promise<{ count: number; approxKo: number }> {
  try {
    const db = await openDB();
    const all: CachedClip[] = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
    const bytes = all.reduce((acc, c) => acc + c.audioBase64.length * 0.75, 0);
    return { count: all.length, approxKo: Math.round(bytes / 1024) };
  } catch {
    return { count: 0, approxKo: 0 };
  }
}

/* ------------------------------------------------------------------ */
/* Préchargement d'une séance                                          */
/* ------------------------------------------------------------------ */

export interface PrefetchProgress {
  done: number;
  total: number;
  /** Phrases servies depuis le cache, sans appel réseau. */
  fromCache: number;
  failed: number;
  currentText: string | null;
}

export interface PrefetchResult {
  total: number;
  ready: number;
  failed: number;
  /** Raison du premier échec, pour informer sans bloquer le départ. */
  firstError: string | null;
}

/**
 * Toutes les phrases prononcées automatiquement pendant la séance.
 * Les commentaires IA générés en direct ne peuvent pas être anticipés : ils
 * restent produits à la volée pendant la sortie.
 */
export function collectWorkoutPhrases(plan: WorkoutPlan): string[] {
  const steps = flattenWorkoutPlan(plan);
  const phrases: string[] = [];

  if (steps.length > 0) {
    phrases.push(`Départ de la sortie ${plan.nom}. ${steps[0].vocalPrompt}`);
  }
  steps.forEach((step) => {
    if (step.vocalPrompt) phrases.push(step.vocalPrompt);
    if (step.cadencePrompt) phrases.push(step.cadencePrompt);
  });
  phrases.push('Dernier bloc de la séance, on termine fort !');
  phrases.push('Séance terminée. Bravo, retour au calme et hydratation.');

  // Dédoublonnage : les blocs répétés partagent la même consigne.
  return Array.from(new Set(phrases.map((p) => p.trim()).filter(Boolean)));
}

/**
 * Génère et stocke l'audio de toutes les consignes d'une séance.
 * Séquentiel volontairement : les modèles TTS en préversion ont des quotas par
 * minute très bas, et un envoi en parallèle les déclencherait immédiatement.
 */
export async function prefetchWorkoutVoice(
  plan: WorkoutPlan,
  persona: string,
  options?: {
    naturalProsody?: boolean;
    onProgress?: (p: PrefetchProgress) => void;
    signal?: { cancelled: boolean };
  },
): Promise<PrefetchResult> {
  const rawPhrases = collectWorkoutPhrases(plan);
  // Le texte doit être normalisé exactement comme à la lecture, sinon la clé
  // de cache ne correspondra pas et l'audio sera régénéré pendant la sortie.
  const phrases =
    options?.naturalProsody === false
      ? rawPhrases
      : rawPhrases.map((p) => normalizeTextForSpeech(p));

  const total = phrases.length;
  let done = 0;
  let fromCache = 0;
  let failed = 0;
  let firstError: string | null = null;

  for (const text of phrases) {
    if (options?.signal?.cancelled) break;

    options?.onProgress?.({ done, total, fromCache, failed, currentText: text });

    try {
      // La voix dépend du persona : on interroge le cache avec la même clé que
      // celle utilisée à la lecture.
      const voiceName = voiceNameForPersona(persona);
      const key = clipKey(voiceName, text);
      const existing = await getCachedClip(key);

      if (existing) {
        fromCache++;
      } else {
        const result: TtsResult = await synthesizeSpeech({ text, persona });
        await putCachedClip({
          key: clipKey(result.voiceName, text),
          audioBase64: result.audioBase64,
          sampleRate: result.sampleRate,
          voiceName: result.voiceName,
          text,
          createdAt: Date.now(),
        });
      }
    } catch (err: any) {
      failed++;
      if (!firstError) firstError = err?.message || String(err);
    }

    done++;
    options?.onProgress?.({ done, total, fromCache, failed, currentText: null });
  }

  pruneCache();

  return { total, ready: total - failed, failed, firstError };
}

/** Même correspondance persona → voix que le client Gemini. */
export function voiceNameForPersona(persona?: string): string {
  if (persona === 'emilie_punchy') return 'Kore';
  if (persona === 'marc_pose') return 'Puck';
  if (persona === 'radio_tour') return 'Charon';
  return 'Fenrir';
}
