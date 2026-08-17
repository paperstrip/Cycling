/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Avancement d'un programme d'entraînement.
 *
 * `isCompleted` était lu par le tableau de bord mais n'était écrit nulle part :
 * la barre de progression affichait donc 0 en permanence, quel que soit le
 * nombre de sorties réalisées, et rien ne savait quelle séance avait été
 * sautée. Ce module rattache les sorties au calendrier du programme.
 */

import type { RideRecord, ScheduledWorkout, TrainingProgram } from '../types';

const DAY_MS = 24 * 3600 * 1000;

/**
 * Date prévue d'une séance.
 *
 * `dayNumber` est un rang depuis le début du programme (1 = premier jour), et
 * `createdAt` en donne l'origine.
 */
export function scheduledDateFor(program: TrainingProgram, workout: ScheduledWorkout): Date {
  const start = new Date(program.createdAt);
  start.setHours(0, 0, 0, 0);
  return new Date(start.getTime() + (workout.dayNumber - 1) * DAY_MS);
}

export interface ProgramProgress {
  /** Séances de vélo prévues, hors jours de repos. */
  totalSessions: number;
  completedSessions: number;
  /** Séances dont la date est passée sans qu'elles soient réalisées. */
  missedSessions: number;
  /** Numéro de la semaine en cours, à partir de 1. */
  currentWeek: number;
  /** Part des séances déjà échues qui ont été réalisées, entre 0 et 1. */
  adherence: number;
  /** Prochaine séance à venir, jour de repos exclu. */
  nextSession: ScheduledWorkout | null;
  nextSessionDate: Date | null;
}

export function computeProgramProgress(
  program: TrainingProgram,
  now: number = Date.now(),
): ProgramProgress {
  const sessions = (program.workouts || []).filter((w) => w.type !== 'repos');
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  const completed = sessions.filter((w) => w.isCompleted);
  const due = sessions.filter((w) => scheduledDateFor(program, w).getTime() <= today.getTime());
  const missed = due.filter((w) => !w.isCompleted);

  const upcoming = sessions
    .filter((w) => !w.isCompleted && scheduledDateFor(program, w).getTime() >= today.getTime())
    .sort((a, b) => a.dayNumber - b.dayNumber);

  const start = new Date(program.createdAt);
  start.setHours(0, 0, 0, 0);
  const daysElapsed = Math.floor((today.getTime() - start.getTime()) / DAY_MS);

  return {
    totalSessions: sessions.length,
    completedSessions: completed.length,
    missedSessions: missed.length,
    currentWeek: Math.min(program.durationWeeks, Math.max(1, Math.floor(daysElapsed / 7) + 1)),
    adherence: due.length === 0 ? 1 : completed.length / due.length,
    nextSession: upcoming[0] || null,
    nextSessionDate: upcoming[0] ? scheduledDateFor(program, upcoming[0]) : null,
  };
}

/** Normalise un titre pour le comparer sans buter sur la casse ou les accents. */
function normalize(text: string): string {
  return (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Marque la séance du programme correspondant à une sortie terminée.
 *
 * Deux critères, dans cet ordre : la séance prévue le jour même, puis à défaut
 * une séance non réalisée portant le même titre. Le rapprochement par date
 * prime, parce qu'un titre peut se répéter d'une semaine à l'autre alors qu'une
 * date ne désigne qu'une séance.
 *
 * Retourne `null` quand rien ne correspond — c'est le cas d'une sortie libre,
 * hors programme, et il ne faut alors surtout rien cocher.
 */
export function markSessionCompleted(
  program: TrainingProgram,
  ride: RideRecord,
): TrainingProgram | null {
  const rideDay = new Date(ride.date);
  if (Number.isNaN(rideDay.getTime())) return null;
  rideDay.setHours(0, 0, 0, 0);

  const candidates = (program.workouts || []).filter((w) => w.type !== 'repos' && !w.isCompleted);
  if (candidates.length === 0) return null;

  let match = candidates.find(
    (w) => scheduledDateFor(program, w).getTime() === rideDay.getTime(),
  );

  if (!match) {
    const ridePlan = normalize(ride.planName);
    match = candidates.find((w) => {
      const title = normalize(w.title);
      return title.length > 0 && (title === ridePlan || ridePlan.includes(title) || title.includes(ridePlan));
    });
  }

  if (!match) return null;

  return {
    ...program,
    workouts: program.workouts.map((w) =>
      w.id === match!.id ? { ...w, isCompleted: true } : w,
    ),
  };
}
