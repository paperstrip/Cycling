/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Lecture de l'entraînement réellement effectué.
 *
 * L'app enregistrait les sorties sans jamais les relire : le coach ne voyait
 * que le profil déclaré, la FTP ne bougeait pas, et l'historique se contentait
 * d'aligner des distances. La boucle d'entraînement était ouverte — on
 * mesurait sans jamais en tirer de conséquence.
 *
 * Ce module la referme. Il ne stocke rien : tout se recalcule à partir des
 * `RideRecord`, qui contiennent déjà le prévu et le réalisé bloc par bloc.
 *
 * AVERTISSEMENT DE MÉTHODE — l'app n'a ni capteur de puissance ni ceinture
 * cardio : elle ne dispose que du GPS. Les charges calculées ici sont donc
 * dérivées de la DURÉE passée dans chaque zone d'intensité visée, pas d'une
 * puissance mesurée. C'est une approximation honnête, suffisante pour suivre
 * une tendance et repérer une surcharge, mais ce n'est pas un TSS.
 */

import type { CyclistProfile, IntensityZone, RideRecord } from '../types';
import { getAllRideRecords } from './storage';

const DAY_MS = 24 * 3600 * 1000;

/**
 * Coût relatif d'une minute passée dans chaque zone.
 *
 * Calé sur les facteurs d'intensité usuels : une minute au seuil pèse environ
 * quatre fois une minute en endurance, une minute à fond environ six.
 */
const ZONE_LOAD_PER_MINUTE: Record<IntensityZone, number> = {
  facile: 1,
  moyen: 2.2,
  seuil: 4,
  a_fond: 6,
};

/** En dessous, un bloc est une transition et non un effort. */
const MIN_BLOCK_DURATION_SEC = 60;

/** Fenêtres d'agrégation de la charge, en jours. */
const ACUTE_DAYS = 7;
const CHRONIC_DAYS = 28;

/**
 * Bornes du rapport charge aiguë / charge chronique.
 *
 * En dessous de 0,8 la charge récente s'effondre par rapport à l'habitude : la
 * forme se perd. Au-dessus de 1,5 elle grimpe trop vite, ce qui est le schéma
 * classique du surmenage et de la blessure.
 */
const RATIO_DETRAINING = 0.8;
const RATIO_OVERREACHING = 1.5;

export type LoadVerdict = 'reprise' | 'entretien' | 'progression' | 'surcharge';

export interface ZoneTrend {
  zone: IntensityZone;
  /** Allure médiane sur la période récente, en km/h. */
  recentSpeedKmh: number;
  /** Allure médiane sur la période précédente, pour comparaison. */
  previousSpeedKmh: number;
  /** Variation relative entre les deux périodes, en pourcentage. */
  changePercent: number;
  recentBlocks: number;
  previousBlocks: number;
  /** Vrai seulement si les deux périodes ont assez de blocs pour conclure. */
  isReliable: boolean;
}

export interface TrainingMetrics {
  rideCount: number;
  /** Sortie la plus récente, en millisecondes depuis l'époque. */
  lastRideAt: number | null;
  /** Jours écoulés depuis la dernière sortie. */
  daysSinceLastRide: number | null;

  /** Charge cumulée sur les sept derniers jours. */
  acuteLoad: number;
  /** Charge hebdomadaire moyenne sur les vingt-huit derniers jours. */
  chronicLoad: number;
  /** Rapport des deux. 1 = on tient le rythme habituel. */
  acuteChronicRatio: number;
  loadVerdict: LoadVerdict;

  /** Volume des quatre dernières semaines, de la plus ancienne à la plus récente. */
  weeklyVolume: { weekStart: number; minutes: number; km: number; load: number; rides: number }[];

  /** Part du temps prévu réellement effectuée, toutes sorties récentes confondues. */
  completionRate: number;
  /**
   * Part des blocs d'effort tenus dans la tolérance d'allure.
   * `null` quand aucun bloc n'est exploitable — mieux vaut ne rien dire.
   */
  paceAdherence: number | null;

  /** Répartition du temps par zone sur la période récente, en pourcentage. */
  zoneDistribution: Partial<Record<IntensityZone, number>>;

  /** Évolution d'allure par zone, période récente contre période précédente. */
  zoneTrends: ZoneTrend[];

  /** Nombre de semaines consécutives avec au moins une sortie. */
  consecutiveActiveWeeks: number;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/** Lundi 00 h 00 de la semaine contenant l'instant donné. */
export function startOfWeek(timestamp: number): number {
  const d = new Date(timestamp);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
}

/**
 * Charge d'une sortie, dérivée du temps réellement passé dans chaque zone.
 *
 * On se fonde sur `actualDurationSec` et non sur le prévu : une séance
 * abandonnée à mi-parcours ne doit pas compter comme une séance complète.
 */
export function rideLoad(ride: RideRecord): number {
  const steps = ride.steps || [];
  if (steps.length === 0) {
    // Sortie sans découpage exploitable : on la compte en endurance.
    return ((ride.totalDurationSec || 0) / 60) * ZONE_LOAD_PER_MINUTE.facile;
  }
  return steps.reduce((total, step) => {
    const minutes = (step.actualDurationSec || 0) / 60;
    return total + minutes * (ZONE_LOAD_PER_MINUTE[step.targetIntensity] ?? 1);
  }, 0);
}

/**
 * Part du temps prévu réellement effectuée sur une sortie, entre 0 et 1.
 *
 * Plafonnée à 1 par bloc : dépasser la durée d'un bloc ne compense pas d'en
 * avoir écourté un autre.
 */
export function rideCompletionRate(ride: RideRecord): number {
  const steps = ride.steps || [];
  if (steps.length === 0) return 1;
  const planned = steps.reduce((sum, s) => sum + (s.plannedDurationSec || 0), 0);
  if (planned <= 0) return 1;
  const done = steps.reduce(
    (sum, s) => sum + Math.min(s.actualDurationSec || 0, s.plannedDurationSec || 0),
    0,
  );
  return Math.min(1, done / planned);
}

function verdictFromRatio(ratio: number, chronic: number): LoadVerdict {
  // Sans charge chronique établie, parler de surcharge n'aurait aucun sens.
  if (chronic <= 0) return 'reprise';
  if (ratio < RATIO_DETRAINING) return 'reprise';
  if (ratio > RATIO_OVERREACHING) return 'surcharge';
  if (ratio > 1.1) return 'progression';
  return 'entretien';
}

/**
 * Compare l'allure par zone entre les six dernières semaines et les six
 * précédentes. Une progression se lit sur ce pas de temps ; sur deux sorties
 * on ne lirait que la météo et le vent.
 */
function computeZoneTrends(rides: RideRecord[], now: number): ZoneTrend[] {
  const recentFrom = now - 42 * DAY_MS;
  const previousFrom = now - 84 * DAY_MS;

  const recent: Partial<Record<IntensityZone, number[]>> = {};
  const previous: Partial<Record<IntensityZone, number[]>> = {};

  rides.forEach((ride) => {
    const at = new Date(ride.date).getTime();
    const bucket = at >= recentFrom ? recent : at >= previousFrom ? previous : null;
    if (!bucket) return;

    (ride.steps || []).forEach((step) => {
      if ((step.actualDurationSec || 0) < MIN_BLOCK_DURATION_SEC) return;
      if (!Number.isFinite(step.avgSpeedKmh) || step.avgSpeedKmh <= 1) return;
      const zone = step.targetIntensity;
      if (!bucket[zone]) bucket[zone] = [];
      bucket[zone]!.push(step.avgSpeedKmh);
    });
  });

  const zones: IntensityZone[] = ['facile', 'moyen', 'seuil', 'a_fond'];
  return zones
    .map((zone) => {
      const recentSamples = recent[zone] || [];
      const previousSamples = previous[zone] || [];
      const recentSpeed = median(recentSamples);
      const previousSpeed = median(previousSamples);
      return {
        zone,
        recentSpeedKmh: recentSpeed,
        previousSpeedKmh: previousSpeed,
        changePercent:
          previousSpeed > 0 ? ((recentSpeed - previousSpeed) / previousSpeed) * 100 : 0,
        recentBlocks: recentSamples.length,
        previousBlocks: previousSamples.length,
        isReliable: recentSamples.length >= 3 && previousSamples.length >= 3,
      };
    })
    .filter((t) => t.recentBlocks > 0 || t.previousBlocks > 0);
}

/**
 * Part des blocs d'effort tenus dans la tolérance d'allure.
 *
 * Ne portent que les blocs d'intensité : un échauffement ou un retour au calme
 * hors cible ne dit rien de la qualité de la séance.
 */
function computePaceAdherence(
  rides: RideRecord[],
  targetSpeedFor: (zone: IntensityZone) => number,
  tolerancePercent = 12,
): number | null {
  let total = 0;
  let inTarget = 0;

  rides.forEach((ride) => {
    (ride.steps || []).forEach((step) => {
      if (step.targetIntensity === 'facile') return;
      if ((step.actualDurationSec || 0) < MIN_BLOCK_DURATION_SEC) return;
      if (!Number.isFinite(step.avgSpeedKmh) || step.avgSpeedKmh <= 1) return;

      const target = targetSpeedFor(step.targetIntensity);
      if (!target || target <= 0) return;

      total += 1;
      const deviation = Math.abs((step.avgSpeedKmh - target) / target) * 100;
      if (deviation <= tolerancePercent) inTarget += 1;
    });
  });

  return total === 0 ? null : inTarget / total;
}

/**
 * Bilan d'entraînement complet.
 *
 * `targetSpeedFor` est injecté plutôt qu'importé : les allures de référence
 * viennent du calibrage sur l'historique, et l'importer ici créerait un cycle
 * entre les deux modules.
 */
export function computeTrainingMetrics(
  rides: RideRecord[],
  targetSpeedFor: (zone: IntensityZone) => number,
  now: number = Date.now(),
): TrainingMetrics {
  const sorted = [...rides].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );

  const lastRideAt = sorted.length > 0 ? new Date(sorted[0].date).getTime() : null;

  const acuteFrom = now - ACUTE_DAYS * DAY_MS;
  const chronicFrom = now - CHRONIC_DAYS * DAY_MS;

  const acuteRides = sorted.filter((r) => new Date(r.date).getTime() >= acuteFrom);
  const chronicRides = sorted.filter((r) => new Date(r.date).getTime() >= chronicFrom);

  const acuteLoad = acuteRides.reduce((sum, r) => sum + rideLoad(r), 0);
  // Ramenée à la semaine, pour être comparable à la charge aiguë.
  const chronicLoad = (chronicRides.reduce((sum, r) => sum + rideLoad(r), 0) / CHRONIC_DAYS) * 7;
  const acuteChronicRatio = chronicLoad > 0 ? acuteLoad / chronicLoad : 0;

  // Quatre semaines glissantes, de la plus ancienne à la plus récente.
  const currentWeekStart = startOfWeek(now);
  const weeklyVolume = [3, 2, 1, 0].map((weeksAgo) => {
    const weekStart = currentWeekStart - weeksAgo * 7 * DAY_MS;
    const weekEnd = weekStart + 7 * DAY_MS;
    const inWeek = sorted.filter((r) => {
      const at = new Date(r.date).getTime();
      return at >= weekStart && at < weekEnd;
    });
    return {
      weekStart,
      minutes: Math.round(inWeek.reduce((s, r) => s + (r.totalDurationSec || 0), 0) / 60),
      km: inWeek.reduce((s, r) => s + (r.totalDistanceKm || 0), 0),
      load: Math.round(inWeek.reduce((s, r) => s + rideLoad(r), 0)),
      rides: inWeek.length,
    };
  });

  let consecutiveActiveWeeks = 0;
  for (let i = weeklyVolume.length - 1; i >= 0; i -= 1) {
    if (weeklyVolume[i].rides > 0) consecutiveActiveWeeks += 1;
    else break;
  }

  // Répartition du temps par zone sur les vingt-huit derniers jours.
  const zoneSeconds: Partial<Record<IntensityZone, number>> = {};
  let totalZoneSeconds = 0;
  chronicRides.forEach((ride) => {
    (ride.steps || []).forEach((step) => {
      const sec = step.actualDurationSec || 0;
      zoneSeconds[step.targetIntensity] = (zoneSeconds[step.targetIntensity] || 0) + sec;
      totalZoneSeconds += sec;
    });
  });
  const zoneDistribution: Partial<Record<IntensityZone, number>> = {};
  if (totalZoneSeconds > 0) {
    (Object.keys(zoneSeconds) as IntensityZone[]).forEach((zone) => {
      zoneDistribution[zone] = (zoneSeconds[zone]! / totalZoneSeconds) * 100;
    });
  }

  const completionRates = chronicRides.map(rideCompletionRate);
  const completionRate =
    completionRates.length > 0
      ? completionRates.reduce((a, b) => a + b, 0) / completionRates.length
      : 1;

  return {
    rideCount: sorted.length,
    lastRideAt,
    daysSinceLastRide: lastRideAt === null ? null : Math.floor((now - lastRideAt) / DAY_MS),
    acuteLoad: Math.round(acuteLoad),
    chronicLoad: Math.round(chronicLoad),
    acuteChronicRatio: Number(acuteChronicRatio.toFixed(2)),
    loadVerdict: verdictFromRatio(acuteChronicRatio, chronicLoad),
    weeklyVolume,
    completionRate,
    paceAdherence: computePaceAdherence(chronicRides, targetSpeedFor),
    zoneDistribution,
    zoneTrends: computeZoneTrends(sorted, now),
    consecutiveActiveWeeks,
  };
}

const ZONE_LABEL: Record<IntensityZone, string> = {
  facile: 'endurance',
  moyen: 'tempo',
  seuil: 'seuil',
  a_fond: 'VO2 max',
};

const VERDICT_SENTENCE: Record<LoadVerdict, string> = {
  reprise: "charge en baisse par rapport à l'habitude, la forme se perd si ça dure",
  entretien: 'charge stable, entretien du niveau',
  progression: 'charge en hausse maîtrisée, la progression est en cours',
  surcharge: 'charge en hausse trop rapide, risque de surmenage',
};

/**
 * Met le bilan en français, pour être injecté dans les invites du coach.
 *
 * Un résumé rédigé plutôt qu'un JSON : le modèle raisonne mieux sur une prose
 * courte et chiffrée que sur une structure qu'il doit d'abord interpréter.
 * La phrase finale sur l'absence de capteur est essentielle — sans elle le
 * modèle commente des watts qu'il n'a jamais vus.
 */
export function summarizeForCoach(
  metrics: TrainingMetrics,
  profile?: CyclistProfile | null,
): string {
  if (metrics.rideCount === 0) {
    return "Historique d'entraînement : aucune sortie enregistrée pour l'instant. Ne fais donc référence à aucune séance passée et ne commente aucune progression.";
  }

  const lines: string[] = [];

  lines.push(
    `Sorties enregistrées : ${metrics.rideCount}. Dernière sortie il y a ${metrics.daysSinceLastRide} jour(s).`,
  );

  const weeks = metrics.weeklyVolume
    .map((w, i) => {
      const label = ['il y a 3 semaines', 'il y a 2 semaines', 'semaine dernière', 'cette semaine'][i];
      return `${label} : ${w.rides} sortie(s), ${w.minutes} min, ${w.km.toFixed(0)} km`;
    })
    .join(' ; ');
  lines.push(`Volume des 4 dernières semaines — ${weeks}.`);

  lines.push(
    `Charge sur 7 jours : ${metrics.acuteLoad} points, contre ${metrics.chronicLoad} en moyenne hebdomadaire sur 28 jours (rapport ${metrics.acuteChronicRatio}) — ${VERDICT_SENTENCE[metrics.loadVerdict]}.`,
  );

  const distribution = (Object.keys(metrics.zoneDistribution) as IntensityZone[])
    .map((z) => `${ZONE_LABEL[z]} ${metrics.zoneDistribution[z]!.toFixed(0)} %`)
    .join(', ');
  if (distribution) lines.push(`Répartition du temps sur 28 jours : ${distribution}.`);

  lines.push(
    `Séances menées à leur terme : ${(metrics.completionRate * 100).toFixed(0)} % du temps prévu réalisé.`,
  );

  if (metrics.paceAdherence !== null) {
    lines.push(
      `Blocs d'effort tenus dans l'allure demandée : ${(metrics.paceAdherence * 100).toFixed(0)} %.`,
    );
  }

  const reliable = metrics.zoneTrends.filter((t) => t.isReliable);
  if (reliable.length > 0) {
    const trends = reliable
      .map((t) => {
        const direction = t.changePercent >= 0 ? '+' : '';
        return `${ZONE_LABEL[t.zone]} ${t.recentSpeedKmh.toFixed(1)} km/h (${direction}${t.changePercent.toFixed(1)} % sur 6 semaines)`;
      })
      .join(' ; ');
    lines.push(`Évolution d'allure — ${trends}.`);
  } else {
    lines.push(
      "Pas encore assez de blocs comparables pour mesurer une évolution d'allure : ne conclus rien sur la progression.",
    );
  }

  if (profile?.ftpWatts) {
    lines.push(
      `FTP enregistrée au profil : ${profile.ftpWatts} W${profile.weightKg ? ` pour ${profile.weightKg} kg, soit ${(profile.ftpWatts / profile.weightKg).toFixed(2)} W/kg` : ''}. Valeur déclarée ou estimée, non mesurée.`,
    );
  }

  lines.push(
    "IMPORTANT — ces chiffres proviennent du GPS seul : ni capteur de puissance, ni cardiofréquencemètre. Les « points de charge » sont dérivés du temps passé par zone d'intensité visée, ce n'est pas un TSS. Ne cite jamais de watts mesurés ni de fréquence cardiaque : tu n'en as pas. Appuie-toi sur les allures, les durées et la régularité.",
  );

  return lines.join('\n');
}
