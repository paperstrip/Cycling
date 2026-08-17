/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Play } from 'lucide-react';
import type { ExecutionStep, IntensityZone } from '../types';

const ZONE_HEIGHT: Record<IntensityZone, number> = {
  facile: 34,
  moyen: 56,
  seuil: 78,
  a_fond: 100,
};

const ZONE_FILL: Record<IntensityZone, string> = {
  facile: 'bg-stone-700',
  moyen: 'bg-stone-600',
  seuil: 'bg-amber-700',
  a_fond: 'bg-amber-500',
};

interface WorkoutHeroCardProps {
  title: string;
  goal: string;
  steps: ExecutionStep[];
  /** Pastilles de contexte : durée, nombre de blocs, difficulté. */
  chips: string[];
  eyebrow: string;
  onStart: () => void;
}

/**
 * Carte de tête de l'accueil.
 *
 * Les applications de sport mettent une photo pleine largeur derrière le titre.
 * Ici la place de la photo est tenue par le profil d'intensité de la séance,
 * dessiné en grand sur toute la carte : c'est la même composition — une image
 * qui occupe le cadre, le texte posé dessus — mais l'image dit quelque chose
 * de vrai sur la séance au lieu d'être un décor interchangeable.
 */
export const WorkoutHeroCard: React.FC<WorkoutHeroCardProps> = ({
  title,
  goal,
  steps,
  chips,
  eyebrow,
  onStart,
}) => {
  const totalSec = steps.reduce((acc, s) => acc + s.durationSec, 0) || 1;

  return (
    <div className="relative rounded-[28px] overflow-hidden bg-stone-900 min-h-[268px] flex flex-col justify-end">
      {/* Fond : le profil de la séance, suspendu au bord haut de la carte.
          Suspendu plutôt que posé au sol, parce que les barres sont les plus
          hautes là où le texte se pose — les faire descendre du haut laisse le
          bas de la carte libre pour le titre. */}
      <div className="absolute inset-0 flex items-start gap-[3px] px-1" aria-hidden="true">
        {steps.map((step, idx) => (
          <div
            key={idx}
            className="h-full flex items-start min-w-[2px]"
            style={{ width: `${(step.durationSec / totalSec) * 100}%` }}
          >
            <div
              className={`w-full rounded-b-sm ${ZONE_FILL[step.targetIntensity]}`}
              style={{ height: `${ZONE_HEIGHT[step.targetIntensity]}%` }}
            />
          </div>
        ))}
      </div>

      {/* Voile de lecture : le titre doit tenir par-dessus les barres. */}
      <div
        className="absolute inset-0"
        aria-hidden="true"
        style={{
          background:
            'linear-gradient(to top, #1c1917 32%, rgba(28,25,23,0.82) 58%, rgba(28,25,23,0.34) 100%)',
        }}
      />

      <div className="relative p-5 pt-6">
        <div className="text-[10px] font-black uppercase tracking-[0.14em] text-amber-400">
          {eyebrow}
        </div>

        <h3 className="text-[26px] leading-[1.12] font-black text-white mt-2 tracking-tight">
          {title}
        </h3>
        <p className="text-[12.5px] text-stone-300 mt-1.5 line-clamp-2">{goal}</p>

        <div className="flex items-end justify-between gap-3 mt-4">
          <div className="flex flex-wrap items-center gap-1.5">
            {chips.map((chip) => (
              <span
                key={chip}
                className="px-2.5 py-1 rounded-full bg-white/10 backdrop-blur-sm text-[11px] font-bold text-white"
              >
                {chip}
              </span>
            ))}
          </div>

          <button
            onClick={onStart}
            id="btn-start-workout-hub"
            aria-label="Démarrer la séance"
            className="w-14 h-14 shrink-0 rounded-full bg-amber-500 hover:bg-amber-400 text-stone-950 flex items-center justify-center cursor-pointer transition-colors shadow-lg shadow-amber-500/25"
          >
            <Play className="w-6 h-6 fill-stone-950 translate-x-[1px]" />
          </button>
        </div>
      </div>
    </div>
  );
};
