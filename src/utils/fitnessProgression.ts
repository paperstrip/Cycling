/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Révision de la FTP à partir des allures réellement tenues.
 *
 * La FTP était fixée à l'inscription et ne bougeait plus jamais. Comme elle
 * détermine toutes les zones de puissance, l'app raisonnait indéfiniment sur
 * l'estimation du premier jour : quelqu'un qui progresse gardait des cibles
 * devenues trop faciles, et son écran « Profil » lui affichait un chiffre faux.
 *
 * CE QUE CE MODULE NE FAIT PAS — il ne mesure pas la FTP. L'app n'a pas de
 * capteur de puissance. Il repère une progression d'allure au seuil,
 * suffisamment nette et durable pour être autre chose que du bruit, et en
 * déduit une révision prudente qu'il PROPOSE. La décision reste à la personne :
 * modifier sa FTP dans son dos fausserait ses zones sans qu'elle comprenne
 * pourquoi.
 */

import type { CyclistProfile } from '../types';
import type { TrainingMetrics } from './trainingMetrics';

/** Progression d'allure en deçà de laquelle on ne propose rien. */
const MIN_CHANGE_PERCENT = 2.5;

/** Révision maximale proposée en une fois, en pourcentage. */
const MAX_REVISION_PERCENT = 8;

/**
 * Exposant reliant la vitesse à la puissance.
 *
 * Sur le plat et au-dessus de 25 km/h la traînée aérodynamique domine, et la
 * puissance varie sensiblement comme le cube de la vitesse. On retient
 * volontairement 2 et non 3 : le terrain n'est pas contrôlé — pente, vent,
 * arrêts — et un exposant de 3 transformerait le moindre bruit de mesure en
 * révision spectaculaire. Sous-estimer est ici la seule erreur acceptable.
 */
const SPEED_TO_POWER_EXPONENT = 2;

/** Délai minimal entre deux révisions, en jours. */
const MIN_DAYS_BETWEEN_REVISIONS = 21;

const STORAGE_KEY = 'cyclocoach_last_ftp_revision';

export interface FtpSuggestion {
  currentFtp: number;
  suggestedFtp: number;
  changePercent: number;
  /** Progression d'allure observée au seuil, en pourcentage. */
  paceChangePercent: number;
  /** Nombre de blocs de seuil sur lesquels repose la mesure. */
  sampleBlocks: number;
  /** Phrase explicative destinée à être affichée telle quelle. */
  rationale: string;
}

function lastRevisionAt(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? Number(raw) || 0 : 0;
  } catch {
    return 0;
  }
}

/** Mémorise la date de révision, pour ne pas la reproposer chaque semaine. */
export function recordFtpRevision(at: number = Date.now()): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(at));
  } catch {
    // Sans stockage, la proposition réapparaîtra : gênant, pas grave.
  }
}

/**
 * Propose une révision de FTP, ou `null` si rien ne la justifie.
 *
 * Retourner `null` est le cas normal et attendu : une progression réelle se
 * constate sur des semaines, pas à chaque ouverture de l'app.
 */
export function suggestFtpRevision(
  metrics: TrainingMetrics,
  profile: CyclistProfile,
  now: number = Date.now(),
): FtpSuggestion | null {
  const currentFtp = profile.ftpWatts;
  if (!currentFtp || currentFtp <= 0) return null;

  // Une révision récente n'a pas eu le temps d'être vérifiée sur le terrain.
  if (now - lastRevisionAt() < MIN_DAYS_BETWEEN_REVISIONS * 24 * 3600 * 1000) return null;

  const threshold = metrics.zoneTrends.find((t) => t.zone === 'seuil');
  if (!threshold || !threshold.isReliable) return null;
  if (Math.abs(threshold.changePercent) < MIN_CHANGE_PERCENT) return null;

  // Une charge en chute libre explique une baisse d'allure sans qu'il y ait
  // perte de forme réelle : on ne revoit pas la FTP à la baisse là-dessus.
  if (threshold.changePercent < 0 && metrics.loadVerdict === 'reprise') return null;

  const speedRatio = threshold.recentSpeedKmh / threshold.previousSpeedKmh;
  const rawChangePercent = (Math.pow(speedRatio, SPEED_TO_POWER_EXPONENT) - 1) * 100;
  const changePercent = Math.max(
    -MAX_REVISION_PERCENT,
    Math.min(MAX_REVISION_PERCENT, rawChangePercent),
  );

  const suggestedFtp = Math.round(currentFtp * (1 + changePercent / 100));
  if (suggestedFtp === currentFtp) return null;

  const direction = changePercent > 0 ? 'progressé' : 'reculé';
  const rationale =
    `Votre allure au seuil a ${direction} de ${Math.abs(threshold.changePercent).toFixed(1)} % ` +
    `sur les six dernières semaines (${threshold.previousSpeedKmh.toFixed(1)} → ` +
    `${threshold.recentSpeedKmh.toFixed(1)} km/h, mesuré sur ${threshold.recentBlocks} blocs). ` +
    `L'app n'a pas de capteur de puissance : cette révision est une estimation prudente ` +
    `déduite de la vitesse, pas une mesure. À vous de la valider ou de l'ignorer.`;

  return {
    currentFtp,
    suggestedFtp,
    changePercent: Number(changePercent.toFixed(1)),
    paceChangePercent: Number(threshold.changePercent.toFixed(1)),
    sampleBlocks: threshold.recentBlocks,
    rationale,
  };
}
