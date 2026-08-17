/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Point d'entrée unique du bilan d'entraînement destiné au coach.
 *
 * Assemble l'historique, le calibrage d'allure et les métriques. Centralisé
 * ici pour que les quatre appelants — chat, séance, programme, débriefing —
 * envoient exactement le même bilan : sans cela, le coach tiendrait un
 * discours différent selon l'écran d'où on lui parle.
 */

import type { CyclistProfile, IntensityZone } from '../types';
import { getAllRideRecords } from './storage';
import { computePaceCalibration, resolveTargetSpeed } from './paceCalibration';
import { computeTrainingMetrics, summarizeForCoach, type TrainingMetrics } from './trainingMetrics';

/** Bilan chiffré et sa version rédigée, calculés en une passe. */
export async function loadTrainingContext(
  profile?: CyclistProfile | null,
): Promise<{ metrics: TrainingMetrics; summary: string }> {
  const [rides, calibration] = await Promise.all([
    getAllRideRecords().catch(() => []),
    computePaceCalibration().catch(() => null),
  ]);

  const targetSpeedFor = (zone: IntensityZone) =>
    resolveTargetSpeed(zone, profile?.level, calibration).speedKmh;

  const metrics = computeTrainingMetrics(rides, targetSpeedFor);
  return { metrics, summary: summarizeForCoach(metrics, profile) };
}

/**
 * Bilan rédigé seul, pour les appelants qui n'ont besoin que de l'invite.
 *
 * Ne remonte jamais d'erreur : un coach sans bilan reste utile, alors qu'un
 * écran qui refuse de s'ouvrir parce que l'historique est illisible ne l'est
 * pas.
 */
export async function loadTrainingSummary(
  profile?: CyclistProfile | null,
): Promise<string | undefined> {
  try {
    const { summary } = await loadTrainingContext(profile);
    return summary;
  } catch {
    return undefined;
  }
}
