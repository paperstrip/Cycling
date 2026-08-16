/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Analyse locale de l'effort en cours.
 *
 * Ces métriques sont calculées dans le navigateur, sans appel réseau : elles
 * s'affichent en continu et servent aussi à décider QUAND solliciter l'IA.
 * Interroger le modèle à intervalle fixe produisait des commentaires hors sujet
 * et gaspillait le quota ; ici l'IA n'est appelée que lorsqu'il se passe
 * réellement quelque chose.
 */

import type { IntensityZone } from '../types';

/** Vitesse de référence par zone, ajustée au niveau du cycliste. */
const BASE_TARGET_KMH: Record<IntensityZone, number> = {
  facile: 23,
  moyen: 29,
  seuil: 33,
  a_fond: 38,
};

const LEVEL_FACTOR: Record<string, number> = {
  debutant: 0.82,
  intermediaire: 1.0,
  confirme: 1.1,
  expert: 1.18,
};

export function targetSpeedForZone(zone: IntensityZone, level?: string): number {
  const base = BASE_TARGET_KMH[zone] ?? 28;
  const factor = LEVEL_FACTOR[level || 'intermediaire'] ?? 1;
  return base * factor;
}

export type AdherenceVerdict = 'sous_la_cible' | 'dans_la_cible' | 'au_dessus';

export interface BlockAnalysis {
  /** Vitesse moyenne depuis le début du bloc courant. */
  avgSpeedKmh: number;
  targetSpeedKmh: number;
  /** Écart relatif à la cible, en pourcentage (négatif = en dessous). */
  deviationPercent: number;
  verdict: AdherenceVerdict;
  /** Régularité : écart-type des vitesses. Plus bas = plus régulier. */
  variability: number;
  /** Tendance sur les 20 derniers échantillons : accélère, stable, décroche. */
  trend: 'accelere' | 'stable' | 'decroche';
  sampleCount: number;
}

/** Tolérance autour de la cible avant de signaler un écart. */
const TOLERANCE_PERCENT = 12;

/**
 * Accumule les vitesses du bloc en cours et en tire des indicateurs.
 * Remis à zéro à chaque changement de bloc.
 */
export class BlockTelemetry {
  private samples: number[] = [];
  private zone: IntensityZone;
  private level: string | undefined;

  constructor(zone: IntensityZone, level?: string) {
    this.zone = zone;
    this.level = level;
  }

  reset(zone: IntensityZone) {
    this.samples = [];
    this.zone = zone;
  }

  addSample(speedKmh: number) {
    if (!Number.isFinite(speedKmh) || speedKmh < 0) return;
    this.samples.push(speedKmh);
    // Borné : une sortie longue accumulerait sinon des milliers de points.
    if (this.samples.length > 600) this.samples.shift();
  }

  analyze(): BlockAnalysis {
    const target = targetSpeedForZone(this.zone, this.level);
    const n = this.samples.length;

    if (n === 0) {
      return {
        avgSpeedKmh: 0,
        targetSpeedKmh: target,
        deviationPercent: 0,
        verdict: 'dans_la_cible',
        variability: 0,
        trend: 'stable',
        sampleCount: 0,
      };
    }

    const avg = this.samples.reduce((a, b) => a + b, 0) / n;
    const deviation = ((avg - target) / target) * 100;

    const variance = this.samples.reduce((acc, s) => acc + (s - avg) ** 2, 0) / n;
    const variability = Math.sqrt(variance);

    // Tendance : on compare la dernière fenêtre à la précédente.
    let trend: BlockAnalysis['trend'] = 'stable';
    if (n >= 10) {
      const window = Math.min(20, Math.floor(n / 2));
      const recent = this.samples.slice(-window);
      const previous = this.samples.slice(-window * 2, -window);
      if (previous.length > 0) {
        const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
        const prevAvg = previous.reduce((a, b) => a + b, 0) / previous.length;
        const delta = ((recentAvg - prevAvg) / Math.max(1, prevAvg)) * 100;
        if (delta > 6) trend = 'accelere';
        else if (delta < -6) trend = 'decroche';
      }
    }

    let verdict: AdherenceVerdict = 'dans_la_cible';
    if (deviation < -TOLERANCE_PERCENT) verdict = 'sous_la_cible';
    else if (deviation > TOLERANCE_PERCENT) verdict = 'au_dessus';

    return {
      avgSpeedKmh: avg,
      targetSpeedKmh: target,
      deviationPercent: deviation,
      verdict,
      variability,
      trend,
      sampleCount: n,
    };
  }
}

/* ------------------------------------------------------------------ */
/* Décision de solliciter l'IA                                         */
/* ------------------------------------------------------------------ */

export interface CoachTriggerContext {
  secondsSinceLastCoach: number;
  stepElapsedSec: number;
  stepRemainingSec: number;
  isEffortBlock: boolean;
  analysis: BlockAnalysis;
  totalElapsedSec: number;
}

export interface CoachTriggerDecision {
  shouldTrigger: boolean;
  /** Motif transmis à l'IA pour cadrer sa réponse. */
  reason:
    | 'derive_effort'
    | 'debut_bloc_dur'
    | 'fin_de_bloc'
    | 'point_regulier'
    | null;
}

/** Délai minimum entre deux sollicitations, pour ménager le quota. */
const MIN_INTERVAL_SEC = 70;
/** Rythme de repli quand rien de particulier ne se produit. */
const ROUTINE_INTERVAL_SEC = 210;

/**
 * Décide s'il faut demander un commentaire à l'IA.
 * L'ordre des tests traduit une priorité : un décrochage prime sur le point
 * d'étape régulier.
 */
export function shouldRequestCoachInput(ctx: CoachTriggerContext): CoachTriggerDecision {
  const {
    secondsSinceLastCoach,
    stepElapsedSec,
    stepRemainingSec,
    isEffortBlock,
    analysis,
    totalElapsedSec,
  } = ctx;

  // Jamais dans les premières secondes : la consigne du bloc vient d'être dite.
  if (totalElapsedSec < 45) return { shouldTrigger: false, reason: null };
  if (secondsSinceLastCoach < MIN_INTERVAL_SEC) return { shouldTrigger: false, reason: null };

  // 1. Dérive installée sur un bloc d'effort : le motif le plus utile.
  const hasEnoughData = analysis.sampleCount >= 8;
  if (
    isEffortBlock &&
    hasEnoughData &&
    stepElapsedSec > 25 &&
    analysis.verdict !== 'dans_la_cible'
  ) {
    return { shouldTrigger: true, reason: 'derive_effort' };
  }

  // 2. Début d'un bloc dur : recadrage technique après la consigne.
  if (isEffortBlock && stepElapsedSec >= 20 && stepElapsedSec <= 35) {
    return { shouldTrigger: true, reason: 'debut_bloc_dur' };
  }

  // 3. Dernières secondes d'un effort long : relance finale.
  if (isEffortBlock && stepRemainingSec > 8 && stepRemainingSec <= 25) {
    return { shouldTrigger: true, reason: 'fin_de_bloc' };
  }

  // 4. Point d'étape régulier, à cadence lente.
  if (secondsSinceLastCoach >= ROUTINE_INTERVAL_SEC) {
    return { shouldTrigger: true, reason: 'point_regulier' };
  }

  return { shouldTrigger: false, reason: null };
}

/** Libellés lisibles, utilisés dans l'interface et dans le prompt. */
export const VERDICT_LABEL: Record<AdherenceVerdict, string> = {
  sous_la_cible: 'Sous la cible',
  dans_la_cible: 'Dans la cible',
  au_dessus: 'Au-dessus de la cible',
};

export const TREND_LABEL: Record<BlockAnalysis['trend'], string> = {
  accelere: 'en accélération',
  stable: 'stable',
  decroche: 'en décrochage',
};
