/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import type { ExecutionStep, IntensityZone } from '../types';
import { formatSecondsToMinutes } from '../utils/planFlatten';

/** Hauteur relative de chaque zone : la forme de la séance se lit d'un coup d'œil. */
const ZONE_HEIGHT: Record<IntensityZone, number> = {
  facile: 30,
  moyen: 52,
  seuil: 74,
  a_fond: 100,
};

const ZONE_COLOR: Record<IntensityZone, string> = {
  facile: 'bg-emerald-500',
  moyen: 'bg-cyan-500',
  seuil: 'bg-amber-500',
  a_fond: 'bg-rose-500',
};

export const ZONE_LABEL: Record<IntensityZone, string> = {
  facile: 'Facile (Z1/Z2)',
  moyen: 'Tempo (Z3)',
  seuil: 'Seuil (Z4)',
  a_fond: 'À fond (Z5+)',
};

interface WorkoutProfileBarProps {
  steps: ExecutionStep[];
  /** Index du bloc en cours, pour le suivi pendant la sortie. */
  currentStepIndex?: number;
  className?: string;
}

/**
 * Profil d'intensité de la séance sous forme d'histogramme proportionnel à la
 * durée — remplace avantageusement une longue liste de blocs.
 */
export const WorkoutProfileBar: React.FC<WorkoutProfileBarProps> = ({
  steps,
  currentStepIndex,
  className = '',
}) => {
  const totalSec = steps.reduce((acc, s) => acc + s.durationSec, 0) || 1;

  // Zones réellement présentes, pour une légende qui ne ment pas.
  const usedZones: IntensityZone[] = Array.from(
    new Set<IntensityZone>(steps.map((s) => s.targetIntensity)),
  );

  return (
    <div className={className}>
      <div
        className="flex items-end gap-[2px] h-24 sm:h-28 w-full"
        role="img"
        aria-label={`Profil de la séance : ${steps.length} blocs, ${formatSecondsToMinutes(totalSec)}`}
      >
        {steps.map((step, idx) => {
          const widthPercent = (step.durationSec / totalSec) * 100;
          const heightPercent = ZONE_HEIGHT[step.targetIntensity] ?? 40;
          const isCurrent = currentStepIndex === idx;
          const isPast = currentStepIndex !== undefined && idx < currentStepIndex;

          return (
            <div
              key={idx}
              className="relative group h-full flex items-end min-w-[3px]"
              style={{ width: `${widthPercent}%` }}
              title={`${step.title} • ${formatSecondsToMinutes(step.durationSec)} • ${ZONE_LABEL[step.targetIntensity]}`}
            >
              <div
                className={`w-full rounded-t transition-all ${ZONE_COLOR[step.targetIntensity]} ${
                  isCurrent ? 'ring-2 ring-white brightness-125' : ''
                } ${isPast ? 'opacity-40' : 'opacity-95'}`}
                style={{ height: `${heightPercent}%` }}
              />
            </div>
          );
        })}
      </div>

      {/* Repères de durée */}
      <div className="flex items-center justify-between mt-1.5 font-mono text-[10px] text-stone-500">
        <span>0:00</span>
        <span>{formatSecondsToMinutes(totalSec)}</span>
      </div>

      {/* Légende des zones utilisées */}
      <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-2">
        {usedZones.map((zone) => (
          <div key={zone} className="flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-sm ${ZONE_COLOR[zone]}`} />
            <span className="text-[10px] font-bold text-stone-400">{ZONE_LABEL[zone]}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
