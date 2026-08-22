/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Calibrage des allures cibles sur l'historique réel du cycliste.
 *
 * Les vitesses de référence par zone étaient jusqu'ici des valeurs génériques
 * ajustées au niveau déclaré. Elles pouvaient donc être franchement à côté des
 * allures réelles — et la jauge d'adhérence signalait alors des écarts qui
 * n'existaient pas, ce qui décrédibilise les corrections du coach.
 *
 * On dérive désormais ces références des blocs réellement effectués.
 */

import type { IntensityZone, RideRecord } from '../types';
import { getAllRideRecords } from './storage';
import { targetSpeedForZone } from './rideAnalytics';

const STORAGE_KEY = 'cyclocoach_pace_calibration';

/**
 * Allures issues du test de terrain.
 *
 * Le calibrage ordinaire exige trois blocs par zone, ce qui demande plusieurs
 * semaines : un débutant roulerait donc longtemps sur des cibles génériques.
 * Le test de calibrage fournit un ancrage dès la première sortie.
 */
const BASELINE_KEY = 'cyclocoach_pace_baseline';

export function savePaceBaseline(zoneSpeeds: Partial<Record<IntensityZone, number>>): void {
  try {
    localStorage.setItem(BASELINE_KEY, JSON.stringify(zoneSpeeds));
  } catch {
    // Sans stockage, on retombe simplement sur les valeurs génériques.
  }
}

export function getPaceBaseline(): Partial<Record<IntensityZone, number>> | null {
  try {
    const raw = localStorage.getItem(BASELINE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** Nombre minimum de blocs par zone avant de faire confiance à la mesure. */
const MIN_BLOCKS_PER_ZONE = 3;

/** Blocs trop courts : la vitesse moyenne y est dominée par la transition. */
const MIN_BLOCK_DURATION_SEC = 60;

/** Seules les sorties récentes reflètent la forme actuelle. */
const MAX_AGE_DAYS = 120;

export interface ZoneCalibration {
  zone: IntensityZone;
  /** Vitesse médiane observée sur cette zone, en km/h. */
  medianSpeedKmh: number;
  blockCount: number;
}

export interface PaceCalibration {
  zones: Partial<Record<IntensityZone, ZoneCalibration>>;
  ridesAnalyzed: number;
  computedAt: number;
}

/**
 * Médiane plutôt que moyenne : un feu rouge, un arrêt ou une descente rapide
 * fausseraient une moyenne, alors que la médiane les ignore.
 */
function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/** Calcule le calibrage à partir de toutes les sorties enregistrées. */
export async function computePaceCalibration(): Promise<PaceCalibration> {
  let rides: RideRecord[] = [];
  try {
    rides = await getAllRideRecords();
  } catch {
    rides = [];
  }

  const cutoff = Date.now() - MAX_AGE_DAYS * 24 * 3600 * 1000;
  const recent = rides.filter((r) => new Date(r.date).getTime() >= cutoff);

  const samplesByZone: Partial<Record<IntensityZone, number[]>> = {};

  recent.forEach((ride) => {
    (ride.steps || []).forEach((step) => {
      if (step.actualDurationSec < MIN_BLOCK_DURATION_SEC) return;
      // Une vitesse nulle signifie GPS absent ou séance en intérieur.
      if (!Number.isFinite(step.avgSpeedKmh) || step.avgSpeedKmh <= 1) return;

      const zone = step.targetIntensity;
      if (!samplesByZone[zone]) samplesByZone[zone] = [];
      samplesByZone[zone]!.push(step.avgSpeedKmh);
    });
  });

  const zones: PaceCalibration['zones'] = {};
  (Object.keys(samplesByZone) as IntensityZone[]).forEach((zone) => {
    const samples = samplesByZone[zone]!;
    if (samples.length < MIN_BLOCKS_PER_ZONE) return;
    zones[zone] = {
      zone,
      medianSpeedKmh: median(samples),
      blockCount: samples.length,
    };
  });

  const calibration: PaceCalibration = {
    zones,
    ridesAnalyzed: recent.length,
    computedAt: Date.now(),
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(calibration));
  } catch {
    // Sans stockage, le calibrage sera simplement recalculé au besoin.
  }

  return calibration;
}

/** Dernier calibrage connu, sans recalcul. */
export function getStoredCalibration(): PaceCalibration | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PaceCalibration;
  } catch {
    return null;
  }
}

/**
 * Vitesse de référence d'une zone : mesurée si l'historique le permet, sinon
 * valeur générique liée au niveau déclaré.
 */
export function resolveTargetSpeed(
  zone: IntensityZone,
  level: string | undefined,
  calibration: PaceCalibration | null,
): { speedKmh: number; isCalibrated: boolean } {
  // Ordre de confiance : ce qui a été observé sur plusieurs séances, puis le
  // test de terrain, puis seulement la table générique liée au niveau déclaré.
  const measured = calibration?.zones?.[zone];
  if (measured && measured.blockCount >= MIN_BLOCKS_PER_ZONE) {
    return { speedKmh: measured.medianSpeedKmh, isCalibrated: true };
  }

  const baseline = getPaceBaseline()?.[zone];
  if (baseline && baseline > 0) {
    return { speedKmh: baseline, isCalibrated: true };
  }

  return { speedKmh: targetSpeedForZone(zone, level), isCalibrated: false };
}

/** Combien de blocs manquent encore pour calibrer une zone. */
export function blocksMissingForZone(
  zone: IntensityZone,
  calibration: PaceCalibration | null,
): number {
  const count = calibration?.zones?.[zone]?.blockCount ?? 0;
  return Math.max(0, MIN_BLOCKS_PER_ZONE - count);
}

export { MIN_BLOCKS_PER_ZONE };
