/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Test de terrain servant de point de départ à tout l'entraînement.
 *
 * Jusqu'ici l'app DEVINAIT le niveau : la FTP venait d'une table
 * niveau × poids, et les allures cibles de valeurs génériques. Quelqu'un qui
 * débute n'avait aucun moyen de savoir si ces chiffres lui correspondaient, et
 * le coach construisait ses programmes sur cette supposition.
 *
 * Un effort maximal soutenu, mesuré au GPS, remplace la supposition par une
 * mesure. Le résultat sert à deux choses : ancrer les allures cibles de toutes
 * les zones, et proposer une estimation de FTP nettement mieux fondée que la
 * table de départ.
 *
 * CE QUE CE MODULE MESURE VRAIMENT — une vitesse, pas une puissance. La
 * conversion passe par un modèle physique dont les paramètres (traînée
 * aérodynamique, résistance au roulement) sont des hypothèses, pas des
 * mesures. Le résultat est donc annoncé comme une estimation, avec sa marge.
 */

import type { CyclistLevel, IntensityZone, RideRecord, WorkoutPlan } from '../types';

/** Identifiant du test, pour le reconnaître dans l'historique. */
export const CALIBRATION_TEST_ID = 'test-calibrage-terrain';

/** Durée de l'effort mesuré, en secondes. */
const EFFORT_SEC = 12 * 60;

/**
 * Rapport entre la puissance tenue 12 minutes et la FTP.
 *
 * La FTP se définit sur une heure. Un effort de 12 minutes se tient nettement
 * au-dessus ; le coefficient usuel est de 0,90 (contre 0,95 pour un test de
 * 20 minutes). Douze minutes plutôt que vingt parce que le test doit rester
 * abordable à quelqu'un qui débute.
 */
const TWELVE_MIN_TO_FTP = 0.9;

/**
 * Surface frontale équivalente (CdA), en m².
 *
 * Dépend surtout de la position sur le vélo, d'où l'indexation sur le niveau :
 * un débutant roule redressé, un compétiteur bas sur les cocottes.
 */
const CDA_BY_LEVEL: Record<CyclistLevel, number> = {
  debutant: 0.42,
  intermediaire: 0.38,
  avance: 0.33,
  competiteur_pro: 0.29,
};

const AIR_DENSITY = 1.225;      // kg/m³, air au niveau de la mer à 15 °C
// 0,006 : pneus route sur asphalte ordinaire. Une valeur plus basse ne vaut
// que sur piste ou revêtement neuf, et sous-estimerait la puissance.
const ROLLING_RESISTANCE = 0.006;
const GRAVITY = 9.81;
const BIKE_MASS_KG = 9;
const DRIVETRAIN_EFFICIENCY = 0.97;

/**
 * Rapports d'allure entre zones, appliqués à l'allure de seuil mesurée.
 *
 * Volontairement resserrés : la vitesse varie beaucoup moins que la puissance,
 * puisque la traînée croît avec le cube de la vitesse. Doubler la puissance ne
 * fait gagner qu'environ 25 % de vitesse.
 */
const ZONE_RATIO: Record<IntensityZone, number> = {
  facile: 0.78,
  moyen: 0.90,
  seuil: 1.0,
  a_fond: 1.08,
};

export interface CalibrationResult {
  /** Vitesse moyenne tenue sur l'effort mesuré, en km/h. */
  thresholdSpeedKmh: number;
  /** FTP estimée, en watts. */
  estimatedFtp: number;
  /** Marge d'incertitude, en watts (± cette valeur). */
  uncertaintyW: number;
  /** Allures de référence déduites, par zone. */
  zoneSpeeds: Record<IntensityZone, number>;
  /** Régularité de l'effort : écart entre la première et la seconde moitié. */
  fadePercent: number;
  /** Phrase explicative, destinée à être affichée telle quelle. */
  summary: string;
}

/**
 * Puissance nécessaire pour tenir une vitesse donnée sur le plat, sans vent.
 *
 * Somme de la traînée aérodynamique, qui domine dès 25 km/h, et de la
 * résistance au roulement.
 */
function powerForSpeed(speedKmh: number, totalMassKg: number, cda: number): number {
  const v = speedKmh / 3.6;
  const aero = 0.5 * AIR_DENSITY * cda * v ** 3;
  const rolling = ROLLING_RESISTANCE * totalMassKg * GRAVITY * v;
  return (aero + rolling) / DRIVETRAIN_EFFICIENCY;
}

/** Séance de test, générée à la demande pour rester alignée sur les constantes. */
export function buildCalibrationWorkout(): WorkoutPlan {
  return {
    id: CALIBRATION_TEST_ID,
    nom: 'Test de calibrage terrain',
    description:
      "Un effort maximal régulier de 12 minutes, encadré d'un échauffement et d'un retour au calme. C'est lui qui remplace les valeurs devinées de votre profil par une mesure, et qui sert de base à tous vos programmes.",
    objectif: 'Mesurer votre allure de seuil pour calibrer profil et séances',
    difficultyRating: 4,
    targetTSS: 45,
    coachTips: [
      'Cherchez un parcours PLAT, sans feux ni stops, sur lequel vous pouvez rouler 12 minutes sans vous arrêter.',
      "Idéalement, faites l'aller-retour sur la même route : le vent s'annule ainsi en grande partie.",
      "Partez un peu en dessous de ce que vous pensez pouvoir tenir. Le but est de finir à la même allure qu'au départ, pas de partir vite et de couler.",
      "Évitez ce test par grand vent ou sur route mouillée : le résultat serait faussé et servirait de base à tout le reste.",
    ],
    blocs: [
      {
        type: 'echauffement',
        duree_sec: 600,
        cible: 'facile',
        consigne_vocale:
          "Échauffement de dix minutes, tranquille. On prépare le test, il n'y a rien à prouver maintenant.",
        cadence_recommandee: '90-95 rpm',
      },
      {
        type: 'effort',
        duree_sec: 120,
        cible: 'moyen',
        consigne_vocale:
          'Deux minutes de montée en régime. On approche de l’allure du test sans forcer.',
      },
      {
        type: 'effort',
        duree_sec: EFFORT_SEC,
        cible: 'seuil',
        consigne_vocale:
          "C'est parti pour douze minutes. Allure maximale que vous pouvez TENIR jusqu'au bout, régulière. Ne partez pas trop fort.",
        cadence_recommandee: '85-95 rpm',
        focus_technique: 'Régularité avant tout : la même allure à la douzième minute qu’à la première.',
      },
      {
        type: 'retour_calme',
        duree_sec: 480,
        cible: 'facile',
        consigne_vocale:
          'Test terminé, bravo. Huit minutes de retour au calme, moulinez souple.',
      },
    ],
  };
}

/** Reconnaît une sortie issue du test de calibrage. */
export function isCalibrationRide(ride: RideRecord): boolean {
  return (
    ride.planName === 'Test de calibrage terrain' ||
    (ride.steps || []).some(
      (s) => s.targetIntensity === 'seuil' && s.plannedDurationSec === EFFORT_SEC,
    )
  );
}

/**
 * Analyse une sortie de test et en tire le calibrage.
 *
 * Retourne `null` si l'effort mesuré n'a pas été tenu assez longtemps : un
 * test écourté donnerait une allure surévaluée, qui rendrait toutes les
 * séances suivantes trop dures.
 */
export function analyzeCalibrationRide(
  ride: RideRecord,
  weightKg: number = 70,
  level: CyclistLevel = 'intermediaire',
): CalibrationResult | null {
  const effort = (ride.steps || []).find(
    (s) => s.targetIntensity === 'seuil' && s.plannedDurationSec === EFFORT_SEC,
  );
  if (!effort) return null;

  // Au moins 80 % de l'effort réalisé, et une vitesse plausible.
  if (effort.actualDurationSec < EFFORT_SEC * 0.8) return null;
  if (!Number.isFinite(effort.avgSpeedKmh) || effort.avgSpeedKmh < 8) return null;

  const thresholdSpeedKmh = effort.avgSpeedKmh;
  const cda = CDA_BY_LEVEL[level] ?? CDA_BY_LEVEL.intermediaire;
  const totalMass = weightKg + BIKE_MASS_KG;

  const twelveMinPower = powerForSpeed(thresholdSpeedKmh, totalMass, cda);
  const estimatedFtp = Math.round(twelveMinPower * TWELVE_MIN_TO_FTP);

  // ±15 % : c'est l'ordre de grandeur de l'erreur induite par le vent, la
  // pente résiduelle et l'incertitude sur la position aérodynamique.
  const uncertaintyW = Math.round(estimatedFtp * 0.15);

  const zoneSpeeds = Object.fromEntries(
    (Object.keys(ZONE_RATIO) as IntensityZone[]).map((zone) => [
      zone,
      Number((thresholdSpeedKmh * ZONE_RATIO[zone]).toFixed(1)),
    ]),
  ) as Record<IntensityZone, number>;

  // La vitesse max sert d'indice de départ trop rapide : faute de découpage
  // plus fin, on compare la pointe à la moyenne.
  const fadePercent =
    effort.maxSpeedKmh > 0
      ? Number((((effort.maxSpeedKmh - thresholdSpeedKmh) / thresholdSpeedKmh) * 100).toFixed(0))
      : 0;

  const summary =
    `Vous avez tenu ${thresholdSpeedKmh.toFixed(1)} km/h pendant ` +
    `${Math.round(effort.actualDurationSec / 60)} minutes. ` +
    `Cela correspond à une FTP estimée de ${estimatedFtp} W (± ${uncertaintyW} W). ` +
    `Cette valeur vient d'un modèle physique appliqué à votre vitesse : elle suppose ` +
    `un parcours plat et sans vent, et n'a pas la précision d'un capteur de puissance. ` +
    `Ce qui est solide, en revanche, c'est votre allure de seuil — et c'est elle qui ` +
    `pilotera vos séances.`;

  return { thresholdSpeedKmh, estimatedFtp, uncertaintyW, zoneSpeeds, fadePercent, summary };
}
