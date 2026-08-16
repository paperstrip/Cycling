/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Sauvegarde et reprise d'une sortie interrompue.
 *
 * Une séance de deux heures ne doit pas disparaître parce que l'iPhone a
 * redémarré, que Safari a purgé l'onglet en arrière-plan ou que la batterie a
 * lâché. L'état est donc écrit en continu et proposé à la reprise au
 * redémarrage.
 *
 * localStorage plutôt qu'IndexedDB : l'écriture y est synchrone, donc elle a
 * une chance d'aboutir même dans les dernières millisecondes avant une
 * fermeture brutale, là où une transaction asynchrone serait perdue.
 */

import type { CoachVoiceEvent, StepExecutionRecord, WorkoutPlan } from '../types';

const STORAGE_KEY = 'cyclocoach_active_ride';

/** Au-delà, la reprise n'a plus de sens : on considère la sortie abandonnée. */
const MAX_RESUME_AGE_MS = 6 * 3600 * 1000;

export interface ActiveRideSession {
  plan: WorkoutPlan;
  currentStepIndex: number;
  stepElapsedSec: number;
  totalElapsedSec: number;
  stepRecords: StepExecutionRecord[];
  coachMessages: CoachVoiceEvent[];
  /** Cumuls GPS, pour ne pas repartir de zéro. */
  totalDistanceKm: number;
  maxSpeedKmh: number;
  startedAt: number;
  updatedAt: number;
}

export function saveActiveRide(session: ActiveRideSession): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...session, updatedAt: Date.now() }));
  } catch (err) {
    // Quota dépassé : la sortie continue normalement, seule la reprise est perdue.
    console.warn('Sauvegarde de la séance impossible:', err);
  }
}

export function clearActiveRide(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Sans effet notable.
  }
}

/**
 * Séance interrompue reprenable, s'il en existe une.
 * Une séance terminée normalement efface son état : ce qui reste ici est donc,
 * par construction, une interruption.
 */
export function getResumableRide(): ActiveRideSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const session = JSON.parse(raw) as ActiveRideSession;
    if (!session?.plan || typeof session.totalElapsedSec !== 'number') return null;

    // Trop ancienne : on nettoie plutôt que de proposer une reprise absurde.
    if (Date.now() - session.updatedAt > MAX_RESUME_AGE_MS) {
      clearActiveRide();
      return null;
    }

    // Quelques secondes ne valent pas une proposition de reprise.
    if (session.totalElapsedSec < 20) return null;

    return session;
  } catch {
    return null;
  }
}

/** Durée écoulée depuis l'interruption, pour l'afficher à l'utilisateur. */
export function formatInterruptionDelay(session: ActiveRideSession): string {
  const minutes = Math.round((Date.now() - session.updatedAt) / 60000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `il y a ${hours} h ${minutes % 60} min`;
}
