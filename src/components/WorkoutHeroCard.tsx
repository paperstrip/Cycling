/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Play } from 'lucide-react';
import type { ExecutionStep, IntensityZone } from '../types';
import { WorkoutArtwork, type ArtworkVariant } from './WorkoutArtwork';

interface WorkoutHeroCardProps {
  title: string;
  goal: string;
  /** Pastilles de contexte : durée, nombre de blocs, difficulté. */
  chips: string[];
  eyebrow: string;
  artwork: ArtworkVariant;
  onStart: () => void;
}

/**
 * Carte de tête de l'accueil : une illustration pleine largeur, le titre posé
 * dessus, un seul bouton. Le détail chiffré de la séance vit ailleurs — ici on
 * répond à « qu'est-ce que je fais aujourd'hui, et est-ce que j'y vais ».
 */
export const WorkoutHeroCard: React.FC<WorkoutHeroCardProps> = ({
  title,
  goal,
  chips,
  eyebrow,
  artwork,
  onStart,
}) => {
  return (
    <div className="relative rounded-[28px] overflow-hidden bg-stone-900 min-h-[268px] flex flex-col justify-end">
      {/* Illustration de fond, à la place qu'occuperait une photo. Elle est
          cantonnée à la moitié haute : son sujet est posé sur sa ligne
          d'horizon, et le voile de lecture assombrit le bas de la carte. */}
      <WorkoutArtwork variant={artwork} className="absolute inset-x-0 top-0 w-full h-[62%]" />

      {/* Voile de lecture : le titre doit tenir par-dessus l'illustration. */}
      <div
        className="absolute inset-0"
        aria-hidden="true"
        style={{
          background:
            'linear-gradient(to top, #1b1d21 42%, rgba(27,29,33,0.42) 78%, rgba(27,29,33,0) 100%)',
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
