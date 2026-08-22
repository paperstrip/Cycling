/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Bibliothèque des séances de l'utilisateur.
 *
 * Une séance créée par le coach n'existait que dans l'état React : elle
 * disparaissait au rechargement de la page, n'apparaissait dans aucune liste et
 * ne pouvait pas être replanifiée. Autrement dit, on payait une génération
 * pour un objet jetable.
 *
 * Tout est ici conservé en localStorage, volontairement synchrone : une séance
 * doit survivre à une fermeture brutale de l'app en pleine sortie, ce qu'une
 * écriture asynchrone ne garantit pas.
 */

import type { WorkoutPlan } from '../types';

const LIBRARY_KEY = 'cyclocoach_workout_library_v1';
const SELECTED_KEY = 'cyclocoach_selected_workout_v1';

/** Au-delà, les plus anciennes sont écartées : le stockage n'est pas illimité. */
const MAX_WORKOUTS = 60;

export interface StoredWorkout extends WorkoutPlan {
  id: string;
  createdAt: string;
  /** D'où vient la séance : proposée par le coach, ou dupliquée à la main. */
  source: 'coach' | 'manuel';
}

function readAll(): StoredWorkout[] {
  try {
    const raw = localStorage.getItem(LIBRARY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(workouts: StoredWorkout[]): void {
  try {
    localStorage.setItem(LIBRARY_KEY, JSON.stringify(workouts.slice(0, MAX_WORKOUTS)));
  } catch {
    // Quota dépassé : la séance en cours reste utilisable, elle ne sera
    // simplement pas retrouvée plus tard.
  }
}

/** Séances enregistrées, de la plus récente à la plus ancienne. */
export function getSavedWorkouts(): StoredWorkout[] {
  return readAll().sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

/**
 * Enregistre une séance et renvoie sa version stockée.
 *
 * Une séance portant déjà le même nom est remplacée plutôt que dupliquée :
 * régénérer deux fois « Seuil 3x8 » ne doit pas encombrer la liste.
 */
export function saveWorkout(plan: WorkoutPlan, source: StoredWorkout['source'] = 'coach'): StoredWorkout {
  const existing = readAll();
  const duplicate = existing.find((w) => w.nom.trim() === plan.nom.trim());

  const stored: StoredWorkout = {
    ...plan,
    id: duplicate?.id || `wk-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    createdAt: new Date().toISOString(),
    source,
  };

  writeAll([stored, ...existing.filter((w) => w.id !== stored.id)]);
  return stored;
}

export function deleteWorkout(id: string): void {
  writeAll(readAll().filter((w) => w.id !== id));
}

/**
 * Séance sélectionnée, conservée d'une session à l'autre.
 *
 * Sans cela, fermer l'app ramenait toujours la première séance du catalogue,
 * y compris juste après en avoir fait générer une sur mesure.
 */
export function saveSelectedWorkout(plan: WorkoutPlan): void {
  try {
    // Horodatée : un choix vaut pour la journée. Le lendemain, c'est la séance
    // prévue au programme qui reprend la main, sinon un choix ponctuel
    // masquerait le plan pour toujours.
    localStorage.setItem(SELECTED_KEY, JSON.stringify({ plan, at: new Date().toISOString() }));
  } catch {
    // Sans stockage, la sélection ne survivra pas au rechargement.
  }
}

export function getSelectedWorkout(): WorkoutPlan | null {
  const entry = readSelection();
  return entry ? entry.plan : null;
}

/** Vrai si la séance affichée a été choisie à la main aujourd'hui. */
export function hasSelectionForToday(): boolean {
  const entry = readSelection();
  if (!entry) return false;
  const chosen = new Date(entry.at);
  const today = new Date();
  return chosen.toDateString() === today.toDateString();
}

function readSelection(): { plan: WorkoutPlan; at: string } | null {
  try {
    const raw = localStorage.getItem(SELECTED_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Ancien format : la séance était stockée seule, sans date.
    const plan = parsed?.plan ?? parsed;
    const at = parsed?.at ?? new Date(0).toISOString();
    // Une séance sans blocs ne serait pas exécutable : mieux vaut l'ignorer.
    return plan && Array.isArray(plan.blocs) && plan.blocs.length > 0 ? { plan, at } : null;
  } catch {
    return null;
  }
}
