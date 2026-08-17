/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Check } from 'lucide-react';

const DAY_LETTERS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

interface WeekStripProps {
  /** Dates ISO des sorties enregistrées. */
  rideDates: string[];
}

/** Lundi de la semaine en cours, à minuit. */
function startOfWeek(ref: Date): Date {
  const d = new Date(ref);
  d.setHours(0, 0, 0, 0);
  const offset = (d.getDay() + 6) % 7; // dimanche = 6
  d.setDate(d.getDate() - offset);
  return d;
}

/**
 * Bandeau de semaine.
 *
 * Répond en un coup d'œil à « où j'en suis cette semaine », sans ouvrir
 * l'historique : jour du mois, pastille pleine pour les jours roulés.
 */
export const WeekStrip: React.FC<WeekStripProps> = ({ rideDates }) => {
  const monday = startOfWeek(new Date());
  const todayKey = new Date().toDateString();

  const riddenKeys = new Set(
    rideDates.map((iso) => {
      const d = new Date(iso);
      return Number.isNaN(d.getTime()) ? '' : d.toDateString();
    }),
  );

  return (
    <div className="flex items-stretch justify-between gap-1.5">
      {DAY_LETTERS.map((letter, idx) => {
        const day = new Date(monday);
        day.setDate(monday.getDate() + idx);
        const key = day.toDateString();
        const isToday = key === todayKey;
        const hasRidden = riddenKeys.has(key);

        return (
          <div
            key={idx}
            className={`flex-1 rounded-2xl py-2.5 flex flex-col items-center gap-1.5 border transition-colors ${
              isToday ? 'bg-amber-500 border-amber-500' : 'bg-stone-900 border-stone-800'
            }`}
          >
            <span
              className={`text-[10px] font-bold uppercase ${
                isToday ? 'text-stone-900/70' : 'text-stone-500'
              }`}
            >
              {letter}
            </span>
            <span
              className={`font-mono text-[13px] font-bold leading-none ${
                isToday ? 'text-stone-950' : 'text-white'
              }`}
            >
              {day.getDate()}
            </span>
            {/* Une coche sur les jours roulés : la semaine se lit comme une
                suite d'objectifs tenus, pas comme un calendrier neutre. */}
            {hasRidden ? (
              <Check
                className={`w-3 h-3 ${isToday ? 'text-stone-950' : 'text-amber-500'}`}
                strokeWidth={3.5}
              />
            ) : (
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isToday ? 'bg-stone-900/25' : 'bg-stone-700'
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};
