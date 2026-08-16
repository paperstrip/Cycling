/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { Loader2, CheckCircle2, Play, AlertTriangle, Download, X } from 'lucide-react';
import type { WorkoutPlan } from '../types';
import { audioEngine } from '../utils/audioEngine';
import { hasApiKey } from '../utils/apiKey';
import { prefetchWorkoutVoice, type PrefetchProgress } from '../utils/voiceCache';

interface RidePreparationModalProps {
  isOpen: boolean;
  plan: WorkoutPlan;
  onReady: () => void;
  onCancel: () => void;
}

/**
 * Préchargement de la voix avant le départ.
 *
 * Générer chaque consigne au moment où son bloc démarre imposait la latence du
 * réseau : la voix arrivait après le début de l'effort. On génère donc tout en
 * amont, une fois, et la lecture devient instantanée pendant la sortie.
 * L'étape n'est jamais bloquante : on peut toujours partir immédiatement.
 */
export const RidePreparationModal: React.FC<RidePreparationModalProps> = ({
  isOpen,
  plan,
  onReady,
  onCancel,
}) => {
  const [progress, setProgress] = useState<PrefetchProgress | null>(null);
  const [isDone, setIsDone] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const cancelSignal = useRef({ cancelled: false });

  useEffect(() => {
    if (!isOpen) return;

    // Sans clé Gemini, aucune voix à précharger : la voix du navigateur est
    // synthétisée localement et n'a aucune latence.
    if (!hasApiKey() || audioEngine.getSettings().engineMode !== 'gemini_neural') {
      onReady();
      return;
    }

    cancelSignal.current = { cancelled: false };
    const settings = audioEngine.getSettings();

    prefetchWorkoutVoice(plan, settings.persona, {
      naturalProsody: settings.naturalProsody,
      onProgress: setProgress,
      signal: cancelSignal.current,
    })
      .then((result) => {
        if (cancelSignal.current.cancelled) return;
        setIsDone(true);
        if (result.failed > 0) {
          const isQuota =
            result.firstError?.includes('429') ||
            result.firstError?.includes('RESOURCE_EXHAUSTED') ||
            result.firstError?.includes('quota');
          setWarning(
            isQuota
              ? `${result.failed} consigne(s) non préchargée(s) : quota Gemini atteint. Elles seront dites par la voix du navigateur.`
              : `${result.failed} consigne(s) non préchargée(s). La voix du navigateur prendra le relais pour celles-ci.`,
          );
        }
      })
      .catch(() => {
        if (!cancelSignal.current.cancelled) setIsDone(true);
      });

    return () => {
      cancelSignal.current.cancelled = true;
    };
  }, [isOpen, plan]);

  if (!isOpen) return null;

  const percent = progress && progress.total > 0 ? (progress.done / progress.total) * 100 : 0;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-stone-950/95 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl bg-stone-900 border border-stone-800 shadow-2xl p-6 space-y-5">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 shrink-0 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
            {isDone ? <CheckCircle2 className="w-5 h-5" /> : <Download className="w-5 h-5" />}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-black text-white">
              {isDone ? 'Séance prête' : 'Préparation de la séance'}
            </h2>
            <p className="text-xs text-stone-400 mt-0.5">
              {isDone
                ? 'Les consignes sont enregistrées sur l\'appareil : aucune latence pendant la sortie.'
                : 'Enregistrement des consignes vocales pour supprimer le décalage audio.'}
            </p>
          </div>
          <button
            onClick={() => {
              cancelSignal.current.cancelled = true;
              onCancel();
            }}
            aria-label="Annuler"
            className="p-1.5 text-stone-500 hover:text-stone-300 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Progression */}
        <div className="space-y-2">
          <div className="h-2 rounded-full bg-stone-950 border border-stone-800 overflow-hidden">
            <div
              className="h-full bg-amber-500 transition-all duration-300"
              style={{ width: `${isDone ? 100 : percent}%` }}
            />
          </div>
          <div className="flex items-center justify-between font-mono text-[11px] text-stone-400">
            <span>
              {progress ? `${progress.done} / ${progress.total} consignes` : 'Analyse du plan…'}
            </span>
            {progress && progress.fromCache > 0 && (
              <span className="text-emerald-400">{progress.fromCache} déjà en cache</span>
            )}
          </div>
        </div>

        {warning && (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex gap-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
            <p className="text-[11px] text-amber-200 leading-relaxed">{warning}</p>
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={() => {
              cancelSignal.current.cancelled = true;
              onReady();
            }}
            className="flex-1 px-5 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-black text-xs uppercase tracking-wider cursor-pointer transition-all flex items-center justify-center gap-2"
          >
            {isDone ? (
              <>
                <Play className="w-4 h-4 fill-stone-950" />
                <span>Démarrer</span>
              </>
            ) : (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Partir maintenant</span>
              </>
            )}
          </button>
        </div>

        {!isDone && (
          <p className="text-[10.5px] text-stone-500 text-center leading-relaxed">
            Vous pouvez partir sans attendre : les consignes non préchargées seront simplement
            générées en cours de route.
          </p>
        )}
      </div>
    </div>
  );
};
