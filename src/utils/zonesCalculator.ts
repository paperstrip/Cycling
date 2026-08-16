import { PowerZones, HeartRateZones, CyclistProfile } from '../types';

/**
 * Calculates Dr. Andrew Coggan's 7 Power Training Zones from FTP (Watts)
 */
export function calculatePowerZones(ftp: number): PowerZones {
  return {
    z1: [0, Math.round(ftp * 0.55)], // Récupération active (< 55%)
    z2: [Math.round(ftp * 0.56), Math.round(ftp * 0.75)], // Endurance fondamentale (56 - 75%)
    z3: [Math.round(ftp * 0.76), Math.round(ftp * 0.90)], // Tempo (76 - 90%)
    z4: [Math.round(ftp * 0.91), Math.round(ftp * 1.05)], // Seuil lactique (91 - 105%)
    z5: [Math.round(ftp * 1.06), Math.round(ftp * 1.20)], // VO2 Max (106 - 120%)
    z6: [Math.round(ftp * 1.21), Math.round(ftp * 1.50)], // Capacité anaérobie (121 - 150%)
    z7: [Math.round(ftp * 1.51), Math.round(ftp * 2.20)], // Puissance neuromusculaire / Sprint (> 150%)
  };
}

/**
 * Calculates Heart Rate Zones from Max HR (FCmax)
 */
export function calculateHeartRateZones(maxHr: number): HeartRateZones {
  return {
    z1: [Math.round(maxHr * 0.50), Math.round(maxHr * 0.60)], // Récupération (< 60%)
    z2: [Math.round(maxHr * 0.60), Math.round(maxHr * 0.70)], // Endurance fondamentale (60 - 70%)
    z3: [Math.round(maxHr * 0.70), Math.round(maxHr * 0.80)], // Tempo / Aérobie (70 - 80%)
    z4: [Math.round(maxHr * 0.80), Math.round(maxHr * 0.90)], // Seuil anaérobie (80 - 90%)
    z5: [Math.round(maxHr * 0.90), maxHr], // VO2 Max & Maxima (90 - 100%)
  };
}

/**
 * Estimates FTP based on experience, weight and average training pace
 */
export function estimateInitialFtp(
  level: string,
  weightKg: number = 70,
  experienceYears: number = 2
): number {
  let wPerKg = 2.5; // default moderate
  if (level === 'debutant') wPerKg = 2.1;
  else if (level === 'intermediaire') wPerKg = 2.8 + Math.min(experienceYears * 0.1, 0.4);
  else if (level === 'avance') wPerKg = 3.6 + Math.min(experienceYears * 0.1, 0.5);
  else if (level === 'competiteur_pro') wPerKg = 4.4;

  return Math.round(weightKg * wPerKg);
}

/**
 * Calculates Power-to-weight ratio (W/kg)
 */
export function calculateWattsPerKg(ftpWatts: number, weightKg: number): number {
  if (!weightKg || weightKg <= 0) return 0;
  return parseFloat((ftpWatts / weightKg).toFixed(2));
}

/**
 * Provides zone descriptions and physiological targets
 */
export const ZONE_DETAILS = [
  {
    zone: 'Z1',
    name: 'Récupération Active',
    pctFtp: '< 55% FTP',
    color: 'text-stone-400 bg-stone-800/60 border-stone-700',
    barColor: 'bg-stone-500',
    benefit: 'Élimination des toxines, régénération musculaire et détente articulaire.',
    breathing: 'Aisance respiratoire totale, discussion fluide continue sans essoufflement.',
  },
  {
    zone: 'Z2',
    name: 'Endurance Fondamentale',
    pctFtp: '56 - 75% FTP',
    color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
    barColor: 'bg-emerald-500',
    benefit: 'Développement mitochondrial, combustion des lipides et capacité à rouler des heures.',
    breathing: 'Respiration rythmée par le nez ou la bouche, conversations par phrases complètes.',
  },
  {
    zone: 'Z3',
    name: 'Tempo / Allure Cyclo',
    pctFtp: '76 - 90% FTP',
    color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
    barColor: 'bg-cyan-500',
    benefit: 'Rythme soutenu en peloton, amélioration de la réserve de glycogène.',
    breathing: 'Respiration plus profonde, phrases courtes possibles.',
  },
  {
    zone: 'Z4',
    name: 'Seuil Anaérobie (FTP)',
    pctFtp: '91 - 105% FTP',
    color: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
    barColor: 'bg-amber-500',
    benefit: 'Repousse l\'accumulation d\'acide lactique, allure contre-la-montre et cols.',
    breathing: 'Concentration élevée, souffle saccadé, parole limitée à quelques mots.',
  },
  {
    zone: 'Z5',
    name: 'Puissance Maximale Aérobie (VO2 Max)',
    pctFtp: '106 - 120% FTP',
    color: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
    barColor: 'bg-rose-500',
    benefit: 'Développement de la cylindrée cardiaque et du débit maximal d\'oxygène.',
    breathing: 'Hyperventilation contrôlée, effort soutenable 3 à 6 minutes max.',
  },
  {
    zone: 'Z6',
    name: 'Capacité Anaérobie Lactique',
    pctFtp: '121 - 150% FTP',
    color: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
    barColor: 'bg-purple-500',
    benefit: 'Attaques tranchantes, raidillons raides et relances de virage.',
    breathing: 'Effort violent de 30s à 2min, acidose musculaire intense.',
  },
  {
    zone: 'Z7',
    name: 'Puissance Neuromusculaire / Sprint',
    pctFtp: '> 150% FTP',
    color: 'text-red-400 bg-red-500/10 border-red-500/30',
    barColor: 'bg-red-500',
    benefit: 'Recrutement maximal des fibres rapides, explosivité et sprint final.',
    breathing: 'Effort maximal en apnée relative de 5 à 15 secondes.',
  },
];
