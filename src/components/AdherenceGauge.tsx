/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { TrendingUp, TrendingDown, Minus, Target } from 'lucide-react';
import type { BlockAnalysis } from '../utils/rideAnalytics';
import { VERDICT_LABEL } from '../utils/rideAnalytics';

interface AdherenceGaugeProps {
  analysis: BlockAnalysis;
  sunlightMode?: boolean;
}

/**
 * Écart à l'intensité demandée, en direct.
 *
 * Le curseur se place sur une échelle de −30 % à +30 % autour de la cible, avec
 * une zone verte de tolérance : d'un coup d'œil, le cycliste sait s'il est dans
 * l'allure sans avoir à interpréter des chiffres pendant l'effort.
 */
export const AdherenceGauge: React.FC<AdherenceGaugeProps> = ({ analysis, sunlightMode }) => {
  const { deviationPercent, verdict, trend, targetSpeedKmh, avgSpeedKmh, sampleCount } = analysis;

  // Position du curseur, bornée aux extrémités de l'échelle.
  const clamped = Math.max(-30, Math.min(30, deviationPercent));
  const cursorPercent = ((clamped + 30) / 60) * 100;

  const verdictColor =
    verdict === 'dans_la_cible'
      ? 'text-emerald-400'
      : verdict === 'au_dessus'
        ? 'text-rose-400'
        : 'text-amber-400';

  const TrendIcon = trend === 'accelere' ? TrendingUp : trend === 'decroche' ? TrendingDown : Minus;

  const cardBg = sunlightMode
    ? 'bg-white border-stone-300'
    : 'bg-stone-900/70 border-stone-800';
  const labelColor = sunlightMode ? 'text-stone-600' : 'text-stone-400';

  // Sans assez de points GPS, afficher un écart serait trompeur.
  if (sampleCount < 4) {
    return (
      <div className={`w-full p-3 rounded-xl border ${cardBg}`}>
        <div className="flex items-center gap-2">
          <Target className={`w-3.5 h-3.5 ${labelColor}`} />
          <span className={`text-[10px] font-black uppercase tracking-wider ${labelColor}`}>
            Allure — mesure en cours…
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={`w-full p-3 rounded-xl border ${cardBg} space-y-2`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Target className={`w-3.5 h-3.5 ${labelColor}`} />
          <span className={`text-[10px] font-black uppercase tracking-wider ${labelColor}`}>
            Allure vs cible
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <TrendIcon className={`w-3.5 h-3.5 ${verdictColor}`} />
          <span className={`text-[11px] font-black ${verdictColor}`}>
            {deviationPercent > 0 ? '+' : ''}
            {deviationPercent.toFixed(0)} %
          </span>
        </div>
      </div>

      {/* Échelle −30 % … +30 % avec zone de tolérance centrale */}
      <div className="relative h-3 rounded-full bg-stone-950 border border-stone-800 overflow-hidden">
        <div className="absolute inset-y-0 left-[30%] right-[30%] bg-emerald-500/25" />
        <div className="absolute inset-y-0 left-1/2 w-px bg-emerald-400/60" />
        <div
          className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full border-2 border-stone-950 transition-all duration-500 ${
            verdict === 'dans_la_cible'
              ? 'bg-emerald-400'
              : verdict === 'au_dessus'
                ? 'bg-rose-400'
                : 'bg-amber-400'
          }`}
          style={{ left: `${cursorPercent}%` }}
        />
      </div>

      <div className="flex items-center justify-between font-mono text-[10px]">
        <span className={labelColor}>
          {avgSpeedKmh.toFixed(1)} / {targetSpeedKmh.toFixed(0)} km/h
        </span>
        <span className={`font-bold ${verdictColor}`}>{VERDICT_LABEL[verdict]}</span>
      </div>
    </div>
  );
};
