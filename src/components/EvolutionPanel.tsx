/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { TrendingUp, TrendingDown, Minus, AlertTriangle, Activity } from 'lucide-react';
import type { IntensityZone } from '../types';
import type { LoadVerdict, TrainingMetrics } from '../utils/trainingMetrics';

const ZONE_LABEL: Record<IntensityZone, string> = {
  facile: 'Endurance',
  moyen: 'Tempo',
  seuil: 'Seuil',
  a_fond: 'VO2 max',
};

const ZONE_COLOR: Record<IntensityZone, string> = {
  facile: 'bg-emerald-500',
  moyen: 'bg-cyan-500',
  seuil: 'bg-amber-500',
  a_fond: 'bg-rose-500',
};

const VERDICT: Record<LoadVerdict, { label: string; detail: string; tone: string }> = {
  reprise: {
    label: 'Charge en baisse',
    detail: "Vous roulez moins que d'habitude. Si ça dure, le niveau se perd.",
    tone: 'text-cyan-300 border-cyan-500/30 bg-cyan-500/10',
  },
  entretien: {
    label: 'Charge stable',
    detail: 'Vous tenez votre rythme habituel : le niveau se maintient.',
    tone: 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10',
  },
  progression: {
    label: 'Charge en hausse',
    detail: 'Progression maîtrisée : la charge monte sans excès.',
    tone: 'text-amber-300 border-amber-500/30 bg-amber-500/10',
  },
  surcharge: {
    label: 'Charge trop rapide',
    detail: 'La charge grimpe trop vite. Prévoyez une semaine allégée.',
    tone: 'text-rose-300 border-rose-500/30 bg-rose-500/10',
  },
};

interface EvolutionPanelProps {
  metrics: TrainingMetrics;
}

/**
 * Synthèse de l'évolution.
 *
 * L'historique alignait des sorties sans jamais rien en déduire : on pouvait
 * lire trente lignes sans savoir si l'on progressait. Cet écran ne montre que
 * ce qui répond à cette question, et se tait quand la mesure n'est pas encore
 * fiable — annoncer une progression sur deux blocs serait pire que ne rien
 * dire.
 */
export const EvolutionPanel: React.FC<EvolutionPanelProps> = ({ metrics }) => {
  if (metrics.rideCount === 0) return null;

  const verdict = VERDICT[metrics.loadVerdict];
  const maxLoad = Math.max(...metrics.weeklyVolume.map((w) => w.load), 1);
  const reliableTrends = metrics.zoneTrends.filter((t) => t.isReliable);
  const zones = (Object.keys(metrics.zoneDistribution) as IntensityZone[]).sort(
    (a, b) => (metrics.zoneDistribution[b] || 0) - (metrics.zoneDistribution[a] || 0),
  );

  return (
    <div className="space-y-3">
      {/* Verdict de charge : la seule information vraiment actionnable */}
      <div className={`p-4 rounded-2xl border ${verdict.tone}`}>
        <div className="flex items-center gap-2">
          {metrics.loadVerdict === 'surcharge' ? (
            <AlertTriangle className="w-4 h-4 shrink-0" />
          ) : (
            <Activity className="w-4 h-4 shrink-0" />
          )}
          <span className="text-[13px] font-black">{verdict.label}</span>
          <span className="ml-auto font-mono text-[11px] opacity-80">
            {metrics.acuteLoad} / {metrics.chronicLoad}
          </span>
        </div>
        <p className="text-[12px] mt-1.5 leading-relaxed opacity-90">{verdict.detail}</p>
      </div>

      {/* Volume des quatre dernières semaines */}
      <div className="p-4 rounded-2xl bg-stone-900 border border-stone-800">
        <h4 className="text-[11px] uppercase tracking-wider text-stone-500 font-bold">
          Charge des 4 dernières semaines
        </h4>
        <div className="flex items-end gap-2 h-24 mt-3">
          {metrics.weeklyVolume.map((week, idx) => {
            const isCurrent = idx === metrics.weeklyVolume.length - 1;
            return (
              // `h-full` est indispensable : sans hauteur propre, la colonne
              // se réduit à celle de ses libellés et la barre disparaît.
              <div key={week.weekStart} className="flex-1 h-full flex flex-col items-center gap-1.5">
                <div className="w-full flex-1 flex items-end">
                  <div
                    className={`w-full rounded-t transition-all ${
                      isCurrent ? 'bg-amber-500' : 'bg-stone-700'
                    }`}
                    style={{ height: `${Math.max(3, (week.load / maxLoad) * 100)}%` }}
                    title={`${week.rides} sortie(s), ${week.minutes} min`}
                  />
                </div>
                <span className="font-mono text-[10px] text-stone-400">{week.minutes}′</span>
                <span className="text-[9px] text-stone-600">
                  {idx === 3 ? 'cette sem.' : `S-${3 - idx}`}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Évolution d'allure : le cœur de « est-ce que je progresse » */}
      <div className="p-4 rounded-2xl bg-stone-900 border border-stone-800">
        <h4 className="text-[11px] uppercase tracking-wider text-stone-500 font-bold">
          Allure par zone, 6 semaines contre les 6 précédentes
        </h4>

        {reliableTrends.length === 0 ? (
          <p className="text-[12px] text-stone-400 mt-2.5 leading-relaxed">
            Pas encore assez de blocs comparables pour mesurer une progression. Il faut au moins
            trois blocs par zone sur chacune des deux périodes — continuez à rouler, la mesure
            apparaîtra d'elle-même.
          </p>
        ) : (
          <div className="space-y-2.5 mt-3">
            {reliableTrends.map((trend) => {
              const improving = trend.changePercent > 0.5;
              const declining = trend.changePercent < -0.5;
              const Icon = improving ? TrendingUp : declining ? TrendingDown : Minus;
              const tone = improving
                ? 'text-emerald-400'
                : declining
                  ? 'text-rose-400'
                  : 'text-stone-400';

              return (
                <div key={trend.zone} className="flex items-center gap-3">
                  <span className="text-[12px] font-bold text-white w-20 shrink-0">
                    {ZONE_LABEL[trend.zone]}
                  </span>
                  <span className="font-mono text-[12px] text-stone-400">
                    {trend.previousSpeedKmh.toFixed(1)} → {trend.recentSpeedKmh.toFixed(1)} km/h
                  </span>
                  <span className={`ml-auto flex items-center gap-1 font-mono text-[12px] font-bold ${tone}`}>
                    <Icon className="w-3.5 h-3.5" />
                    {trend.changePercent > 0 ? '+' : ''}
                    {trend.changePercent.toFixed(1)} %
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Régularité et répartition */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-4 rounded-2xl bg-stone-900 border border-stone-800">
          <div className="font-mono text-2xl font-black text-white">
            {(metrics.completionRate * 100).toFixed(0)} %
          </div>
          <div className="text-[11px] text-stone-500 mt-1 leading-tight">
            du temps prévu réalisé
          </div>
        </div>
        <div className="p-4 rounded-2xl bg-stone-900 border border-stone-800">
          <div className="font-mono text-2xl font-black text-white">
            {metrics.paceAdherence === null
              ? '—'
              : `${(metrics.paceAdherence * 100).toFixed(0)} %`}
          </div>
          <div className="text-[11px] text-stone-500 mt-1 leading-tight">
            des blocs dans l'allure
          </div>
        </div>
      </div>

      {zones.length > 0 && (
        <div className="p-4 rounded-2xl bg-stone-900 border border-stone-800">
          <h4 className="text-[11px] uppercase tracking-wider text-stone-500 font-bold">
            Répartition du temps sur 28 jours
          </h4>
          <div className="flex h-2.5 rounded-full overflow-hidden mt-3">
            {zones.map((zone) => (
              <div
                key={zone}
                className={ZONE_COLOR[zone]}
                style={{ width: `${metrics.zoneDistribution[zone]}%` }}
                title={`${ZONE_LABEL[zone]} ${metrics.zoneDistribution[zone]!.toFixed(0)} %`}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2.5">
            {zones.map((zone) => (
              <div key={zone} className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-sm ${ZONE_COLOR[zone]}`} />
                <span className="text-[10.5px] text-stone-400">
                  {ZONE_LABEL[zone]} {metrics.zoneDistribution[zone]!.toFixed(0)} %
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-[10.5px] text-stone-600 leading-relaxed px-1">
        Ces chiffres viennent du GPS seul : ni capteur de puissance, ni cardio. Les points de
        charge mesurent le temps passé par zone d'intensité visée — utile pour suivre une
        tendance, ce n'est pas un TSS.
      </p>
    </div>
  );
};
