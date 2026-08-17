/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Check, Clock } from 'lucide-react';
import type { WorkoutPlan } from '../types';
import { artworkForWorkout } from './WorkoutArtwork';
import { WorkoutPhoto } from './WorkoutPhoto';
import type { IllustrationPreference } from '../types';

interface WorkoutCarouselCardProps {
  plan: WorkoutPlan;
  durationMin: number;
  isSelected: boolean;
  illustrationPreference?: IllustrationPreference;
  onSelect: () => void;
}

/**
 * Carte de séance du carrousel.
 *
 * Format portrait, illustration sur toute la surface, durée en pastille en
 * haut et titre posé en bas : la carte se lit en entier sans avoir à la
 * dérouler, contrairement à une ligne de liste où le nom et l'objectif sont
 * tronqués.
 */
export const WorkoutCarouselCard: React.FC<WorkoutCarouselCardProps> = ({
  plan,
  durationMin,
  isSelected,
  illustrationPreference,
  onSelect,
}) => (
  <button
    onClick={onSelect}
    className="relative shrink-0 w-[62%] max-w-[240px] h-[188px] rounded-[26px] overflow-hidden text-left cursor-pointer snap-start"
  >
    <div className="absolute inset-0 bg-stone-900" />
    <WorkoutPhoto
      subject={artworkForWorkout(plan)}
      photoKey={plan.nom}
      preference={illustrationPreference}
      className="absolute inset-0 w-full h-full"
    />
    <div
      className="absolute inset-0"
      style={{
        background: 'linear-gradient(to top, #14161a 30%, rgba(20,22,26,0.75) 58%, rgba(20,22,26,0.15) 100%)',
      }}
    />

    {/* Liseré de sélection dessiné À L'INTÉRIEUR de la carte. En `ring`, il
        était tracé hors du cadre et le carrousel, qui masque ce qui dépasse,
        en rognait les bords haut et bas. */}
    {isSelected && (
      <div
        className="absolute inset-0 rounded-[26px] border-2 border-amber-500 pointer-events-none"
        aria-hidden="true"
      />
    )}

    <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-stone-950/70 backdrop-blur-sm">
      <Clock className="w-3 h-3 text-amber-400" />
      <span className="text-[11px] font-bold text-white">{durationMin} min</span>
    </div>

    {isSelected && (
      <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-amber-500 flex items-center justify-center">
        <Check className="w-3.5 h-3.5 text-stone-950" strokeWidth={3} />
      </div>
    )}

    <div className="absolute inset-x-0 bottom-0 p-3.5">
      <div className="text-[13.5px] font-black text-white leading-tight line-clamp-2">
        {plan.nom}
      </div>
      <div className="text-[11px] text-stone-400 mt-1 line-clamp-1">{plan.objectif}</div>
    </div>
  </button>
);
