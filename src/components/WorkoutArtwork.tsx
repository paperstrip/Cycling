/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import type { WorkoutPlan } from '../types';

export type ArtworkVariant = 'col' | 'chrono' | 'route' | 'recup';

/**
 * Choisit une illustration à partir du nom et de l'objectif de la séance.
 *
 * Déduit plutôt que stocké : les séances viennent aussi bien du catalogue que
 * de l'IA, et une séance générée n'aura jamais de champ « illustration ».
 */
export function artworkForWorkout(plan: Pick<WorkoutPlan, 'nom' | 'objectif'>): ArtworkVariant {
  const haystack = `${plan.nom} ${plan.objectif}`.toLowerCase();
  if (/vo2|pma|bosse|c[oô]te|grimp|mont|fartlek|sprint|relance/.test(haystack)) return 'col';
  if (/seuil|sweet|ftp|chrono|clm/.test(haystack)) return 'chrono';
  if (/r[ée]cup|cadence|souplesse|repos|d[ée]contract/.test(haystack)) return 'recup';
  return 'route';
}

interface WorkoutArtworkProps {
  variant: ArtworkVariant;
  className?: string;
}

/**
 * Illustration de fond d'une séance.
 *
 * Dessinée en SVG et non photographique : l'app doit fonctionner hors
 * connexion et tenir dans le cache du service worker, ce qu'une photo de
 * plusieurs centaines de kilo-octets par séance rendrait déraisonnable. Des
 * aplats, pas de dégradés.
 */
export const WorkoutArtwork: React.FC<WorkoutArtworkProps> = ({ variant, className = '' }) => (
  <svg
    // Le cadre est plus large que haut, au format réel de la zone illustrée :
    // avec `slice`, un cadre plus carré rognait le sujet en haut.
    viewBox="0 0 400 200"
    preserveAspectRatio="xMidYMid slice"
    className={className}
    aria-hidden="true"
  >
    {variant === 'col' && (
      <>
        {/* Chaîne de sommets et soleil rasant : la séance qui monte. */}
        <circle cx="308" cy="68" r="30" className="fill-amber-500/90" />
        <path d="M0 200 L86 78 L142 132 L206 62 L272 138 L332 100 L400 158 L400 200 Z" className="fill-stone-700" />
        <path d="M0 200 L64 128 L128 172 L200 116 L262 174 L326 140 L400 186 L400 200 Z" className="fill-stone-800" />
      </>
    )}

    {variant === 'chrono' && (
      <>
        {/* Lignes de vitesse au-dessus d'une route rectiligne : l'effort tenu. */}
        {[40, 66, 92].map((y, i) => (
          <rect
            key={y}
            x={54 - i * 22}
            y={y}
            width={132 + i * 50}
            height="8"
            rx="4"
            className="fill-stone-700"
          />
        ))}
        <rect x="30" y="118" width="216" height="8" rx="4" className="fill-amber-500/75" />
        <path d="M0 200 L136 138 L400 138 L400 200 Z" className="fill-stone-700" />
        <path d="M112 200 L196 146 L252 146 L152 200 Z" className="fill-stone-900/80" />
      </>
    )}

    {variant === 'route' && (
      <>
        {/* Route qui serpente vers l'horizon : la sortie longue. */}
        <circle cx="92" cy="56" r="26" className="fill-amber-500/85" />
        <path d="M0 148 L92 104 L172 140 L258 96 L336 132 L400 108 L400 200 L0 200 Z" className="fill-stone-800" />
        <path
          d="M176 200 C 176 158, 240 150, 240 118 C 240 92, 202 88, 214 68"
          className="stroke-stone-700"
          strokeWidth="42"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M176 200 C 176 158, 240 150, 240 118 C 240 92, 202 88, 214 68"
          className="stroke-amber-500/55"
          strokeWidth="3"
          strokeDasharray="11 15"
          fill="none"
          strokeLinecap="round"
        />
      </>
    )}

    {variant === 'recup' && (
      <>
        {/* Horizon calme et ondes basses : la séance qui repose. */}
        <circle cx="320" cy="58" r="28" className="fill-amber-500/70" />
        <path d="M0 122 L400 122 L400 200 L0 200 Z" className="fill-stone-800" />
        {[144, 166, 188].map((y, i) => (
          <path
            key={y}
            d={`M0 ${y} Q 66 ${y - 13}, 132 ${y} T 264 ${y} T 400 ${y}`}
            className={i === 1 ? 'stroke-amber-500/55' : 'stroke-stone-700'}
            strokeWidth="4"
            fill="none"
            strokeLinecap="round"
          />
        ))}
      </>
    )}
  </svg>
);
