/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

interface ProgressRingProps {
  /** Progression entre 0 et 1. */
  value: number;
  /** Grand chiffre au centre. */
  centerValue: string;
  /** Légende sous le chiffre. */
  centerLabel: string;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

/**
 * Anneau de progression.
 *
 * Dessiné en SVG plutôt qu'en image : il reste net à toutes les densités
 * d'écran, ne pèse rien et fonctionne hors connexion. Deux arcs seulement,
 * aucun dégradé — la couleur d'accent porte à elle seule la lecture.
 */
export const ProgressRing: React.FC<ProgressRingProps> = ({
  value,
  centerValue,
  centerLabel,
  size = 132,
  strokeWidth = 12,
  className = '',
}) => {
  const clamped = Math.max(0, Math.min(1, value));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className={`relative shrink-0 ${className}`} style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        // Démarre l'arc à midi plutôt qu'à trois heures.
        className="-rotate-90"
        role="img"
        aria-label={`${centerValue} ${centerLabel}`}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className="stroke-stone-800"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          className="stroke-amber-500 transition-[stroke-dashoffset] duration-700 ease-out"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped)}
        />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-2xl font-black text-white leading-none">{centerValue}</span>
        <span className="text-[9.5px] uppercase tracking-wider text-stone-500 mt-1 text-center px-2 leading-tight">
          {centerLabel}
        </span>
      </div>
    </div>
  );
};
