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

import type { RideRecord, ScheduledWorkout, TrainingProgram, WorkoutPlan } from '../types';

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

/**
 * Insère une séance dans le programme, à une date donnée.
 *
 * Une séance générée par le coach ne pouvait pas être planifiée : elle restait
 * hors du calendrier, donc invisible du tableau de bord et jamais comptée dans
 * la progression.
 *
 * Si une séance est déjà prévue ce jour-là, elle est remplacée — un jour porte
 * une séance, pas une pile. Un jour de repos est écrasé sans état d'âme : c'est
 * un choix délibéré de la personne.
 */
export function scheduleWorkoutOnDate(
  program: TrainingProgram,
  plan: WorkoutPlan,
  date: Date,
): TrainingProgram {
  const start = new Date(program.createdAt);
  start.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);

  const dayNumber = Math.round((target.getTime() - start.getTime()) / DAY_MS) + 1;
  const durationMinutes = Math.round(
    (plan.blocs || []).reduce(
      (total, block) =>
        total + (block.duree_sec + (block.recup_sec || 0)) * (block.repetitions || 1),
      0,
    ) / 60,
  );

  const entry: ScheduledWorkout = {
    id: `sched-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    dayNumber,
    dayOfWeek: target.toLocaleDateString('fr-FR', { weekday: 'long' }),
    title: plan.nom,
    type: 'velo',
    targetDurationMinutes: durationMinutes,
    workoutPlan: plan,
    notes: plan.objectif || '',
    isCompleted: false,
  };

  const withoutThatDay = (program.workouts || []).filter((w) => w.dayNumber !== dayNumber);

  return {
    ...program,
    // Le programme doit couvrir la date choisie, sinon la séance serait
    // planifiée au-delà de son horizon et n'apparaîtrait sur aucune semaine.
    durationWeeks: Math.max(program.durationWeeks, Math.ceil(dayNumber / 7)),
    workouts: [...withoutThatDay, entry].sort((a, b) => a.dayNumber - b.dayNumber),
  };
}

/**
 * Programme minimal, créé à la volée pour accueillir une première séance
 * planifiée alors qu'aucun programme n'existe encore.
 */
export function createAdHocProgram(level: TrainingProgram['cyclistLevel']): TrainingProgram {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return {
    id: `prog-${Date.now()}`,
    title: 'Mon planning',
    overview: "Planning constitué au fil des séances que vous programmez vous-même.",
    durationWeeks: 4,
    targetGoal: 'Progression',
    cyclistLevel: level,
    weeklyVolumeHours: 6,
    pedagogicalAdvice: [],
    workouts: [],
    createdAt: start.toISOString(),
  };
}

/**
 * Séance prévue aujourd'hui, si elle existe et porte un plan exécutable.
 *
 * L'accueil affichait la dernière séance choisie à la main, sans jamais
 * consulter le programme : on pouvait avoir un plan complet généré par le
 * coach et se voir proposer une séance sans rapport. Le planificateur et
 * l'écran d'accueil vivaient côte à côte sans se parler.
 */
export function todaysScheduledSession(
  program: TrainingProgram | null,
  now: number = Date.now(),
): ScheduledWorkout | null {
  if (!program) return null;
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  const match = (program.workouts || []).find(
    (w) =>
      w.type !== 'repos' &&
      scheduledDateFor(program, w).getTime() === today.getTime(),
  );

  // Une séance sans blocs ne serait pas exécutable : autant ne rien proposer.
  return match && match.workoutPlan && (match.workoutPlan.blocs || []).length > 0 ? match : null;
}

/** Jour de repos explicitement prévu aujourd'hui. */
export function isRestDayToday(program: TrainingProgram | null, now: number = Date.now()): boolean {
  if (!program) return false;
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  return (program.workouts || []).some(
    (w) => w.type === 'repos' && scheduledDateFor(program, w).getTime() === today.getTime(),
  );
}
