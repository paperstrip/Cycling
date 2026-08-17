import React, { useState, useEffect } from 'react';
import { RideRecord, StepExecutionRecord, CyclistProfile } from '../types';
import { saveRideRecord, exportRideToGPX } from '../utils/storage';
import { generateRideDebrief } from '../utils/geminiClient';
import { loadTrainingSummary } from '../utils/trainingContext';
import { formatTimeDisplay, formatTimeHoursDisplay, formatSecondsToMinutes } from '../utils/planFlatten';
import { RouteViewer } from './RouteViewer';
import {
  Trophy,
  Zap,
  Gauge,
  Clock,
  Navigation,
  Download,
  CheckCircle2,
  ArrowRight,
  History,
  Sparkles,
  Calendar,
  Share2,
  Route as RouteIcon,
  BookOpen,
  MessageSquare,
  Award,
} from 'lucide-react';

interface SummaryScreenProps {
  ride: RideRecord;
  cyclistProfile: CyclistProfile;
  onNewWorkout: () => void;
  onOpenHistory: () => void;
  onOpenCoachChat: () => void;
}

export const SummaryScreen: React.FC<SummaryScreenProps> = ({
  ride,
  cyclistProfile,
  onNewWorkout,
  onOpenHistory,
  onOpenCoachChat,
}) => {
  const [isSaved, setIsSaved] = useState<boolean>(false);
  const [downloadNotice, setDownloadNotice] = useState<string | null>(null);
  const [coachDebrief, setCoachDebrief] = useState<string | null>(ride.coachDebrief || null);
  const [isLoadingDebrief, setIsLoadingDebrief] = useState<boolean>(false);

  // Automatically save to local persistent database
  useEffect(() => {
    async function persist() {
      await saveRideRecord(ride);
      setIsSaved(true);
    }
    persist();
  }, [ride]);

  // Request coach debrief on load if not already computed
  useEffect(() => {
    async function fetchDebrief() {
      if (coachDebrief) return;
      setIsLoadingDebrief(true);
      try {
        // Le débriefing commentait la séance isolément. Avec le bilan, il peut
        // la situer dans les semaines précédentes et adapter la consigne de
        // suite à la charge en cours.
        const trainingSummary = await loadTrainingSummary(cyclistProfile);
        const debrief = await generateRideDebrief({
          rideRecord: ride,
          cyclistProfile,
          trainingSummary,
        });
        setCoachDebrief(debrief);
      } catch (err) {
        console.warn('Debrief error:', err);
      } finally {
        setIsLoadingDebrief(false);
      }
    }
    fetchDebrief();
  }, [ride, cyclistProfile]);

  const handleDownloadGPX = () => {
    const gpxData = exportRideToGPX(ride);
    const blob = new Blob([gpxData], { type: 'application/gpx+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cyclocoach-${new Date(ride.date).toISOString().slice(0, 10)}.gpx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setDownloadNotice('Fichier GPX téléchargé avec succès pour Strava / Garmin !');
    setTimeout(() => setDownloadNotice(null), 3000);
  };

  const handleDownloadJSON = () => {
    const jsonStr = JSON.stringify(ride, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cyclocoach-sortie-${ride.id}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setDownloadNotice('Données JSON exportées !');
    setTimeout(() => setDownloadNotice(null), 3000);
  };

  const formattedDate = new Date(ride.date).toLocaleDateString('fr-FR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 sm:py-8 space-y-6">
      {/* Header Banner */}
      <div className="rounded-3xl bg-gradient-to-b from-stone-900 via-stone-900 to-amber-950/20 border border-stone-800 p-6 sm:p-8 text-center relative overflow-hidden shadow-2xl">
        <div className="w-16 h-16 rounded-2xl bg-amber-500 text-stone-950 flex items-center justify-center mx-auto mb-3 shadow-lg shadow-amber-500/20">
          <Trophy className="w-9 h-9 fill-stone-950" />
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-2">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Séance terminée avec succès
        </div>

        <h1 className="text-2xl sm:text-3xl font-black text-white">{ride.planName}</h1>
        <p className="text-xs text-stone-400 mt-1">{formattedDate}</p>

        {isSaved && (
          <div className="mt-3 inline-flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
            <CheckCircle2 className="w-3 h-3" />
            Enregistrée dans l'historique de performance
          </div>
        )}
      </div>

      {/* Global Metrics 4-Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Distance */}
        <div className="p-4 rounded-2xl bg-stone-900 border border-stone-800 text-center">
          <div className="text-xs font-bold uppercase text-stone-400 flex items-center justify-center gap-1">
            <Navigation className="w-3.5 h-3.5 text-amber-500" />
            Distance
          </div>
          <div className="text-2xl sm:text-3xl font-black font-mono text-white mt-1">
            {ride.totalDistanceKm.toFixed(2)} <span className="text-xs font-bold text-amber-400">km</span>
          </div>
        </div>

        {/* Duration */}
        <div className="p-4 rounded-2xl bg-stone-900 border border-stone-800 text-center">
          <div className="text-xs font-bold uppercase text-stone-400 flex items-center justify-center gap-1">
            <Clock className="w-3.5 h-3.5 text-amber-500" />
            Durée Totale
          </div>
          <div className="text-2xl sm:text-3xl font-black font-mono text-white mt-1">
            {formatTimeHoursDisplay(ride.totalDurationSec)}
          </div>
        </div>

        {/* Avg Speed */}
        <div className="p-4 rounded-2xl bg-stone-900 border border-stone-800 text-center">
          <div className="text-xs font-bold uppercase text-stone-400 flex items-center justify-center gap-1">
            <Gauge className="w-3.5 h-3.5 text-amber-500" />
            Vitesse Moy.
          </div>
          <div className="text-2xl sm:text-3xl font-black font-mono text-amber-400 mt-1">
            {ride.avgSpeedKmh.toFixed(1)} <span className="text-xs font-bold text-white">km/h</span>
          </div>
        </div>

        {/* Max Speed */}
        <div className="p-4 rounded-2xl bg-stone-900 border border-stone-800 text-center">
          <div className="text-xs font-bold uppercase text-stone-400 flex items-center justify-center gap-1">
            <Zap className="w-3.5 h-3.5 text-rose-500" />
            Vitesse Max
          </div>
          <div className="text-2xl sm:text-3xl font-black font-mono text-white mt-1">
            {ride.maxSpeedKmh.toFixed(1)} <span className="text-xs font-bold text-stone-400">km/h</span>
          </div>
        </div>
      </div>

      {/* Professional AI Debriefing by Coach Jean-Marc */}
      <div className="rounded-3xl bg-stone-900 border border-stone-800 p-6 space-y-4 shadow-xl">
        <div className="flex items-center justify-between border-b border-stone-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Débriefing Professionnel du Coach</h2>
              <p className="text-xs text-stone-400">Analyse physiologique de l'effort & conseils de récupération</p>
            </div>
          </div>
          <button
            onClick={onOpenCoachChat}
            className="px-3 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-amber-400 text-xs font-bold border border-stone-700 transition-colors cursor-pointer flex items-center gap-1"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Discuter du ressenti</span>
          </button>
        </div>

        {isLoadingDebrief ? (
          <div className="p-6 text-center text-xs text-amber-400 flex items-center justify-center gap-2">
            <Sparkles className="w-4 h-4 animate-spin" />
            <span>Jean-Marc analyse vos temps de passage et vos vitesses...</span>
          </div>
        ) : (
          <div className="text-xs text-stone-300 leading-relaxed whitespace-pre-line p-4 rounded-2xl bg-stone-950 border border-stone-800/80">
            {coachDebrief ||
              "Excellente séance exécutée avec régularité ! Vous avez maintenu une intensité cible stable sur les blocs clés. Pensez à réhydrater avec des électrolytes."}
          </div>
        )}
      </div>

      {/* Block by Block: Planned vs Actual Comparison */}
      <div className="rounded-3xl bg-stone-900 border border-stone-800 p-5 sm:p-6 space-y-4 shadow-xl">
        <div className="flex items-center justify-between border-b border-stone-800 pb-3">
          <div>
            <h2 className="text-base font-bold text-white">Comparatif Bloc par Bloc (Prévu vs Réel)</h2>
            <p className="text-xs text-stone-400">Basé sur les timestamps réels des transitions et données GPS</p>
          </div>
          <span className="text-xs font-semibold text-amber-400">
            {ride.steps.length} blocs exécutés
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-stone-800 text-stone-400 uppercase text-[10px] tracking-wider">
                <th className="py-2.5 px-3"># Bloc</th>
                <th className="py-2.5 px-3">Cible</th>
                <th className="py-2.5 px-3">Durée Prévue</th>
                <th className="py-2.5 px-3">Durée Réelle</th>
                <th className="py-2.5 px-3">Écart</th>
                <th className="py-2.5 px-3 text-right">Vitesse Moy.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-800/60">
              {ride.steps.map((step, idx) => {
                const deltaSec = step.actualDurationSec - step.plannedDurationSec;
                const deltaLabel =
                  Math.abs(deltaSec) <= 2
                    ? '0s (Parfait)'
                    : deltaSec > 0
                    ? `+${deltaSec}s`
                    : `${deltaSec}s`;

                let badgeColor = 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
                if (step.targetIntensity === 'moyen') badgeColor = 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30';
                if (step.targetIntensity === 'seuil') badgeColor = 'bg-amber-500/20 text-amber-400 border-amber-500/30';
                if (step.targetIntensity === 'a_fond') badgeColor = 'bg-rose-500/20 text-rose-400 border-rose-500/30';

                return (
                  <tr key={idx} className="hover:bg-stone-850 transition-colors">
                    <td className="py-3 px-3 font-semibold text-stone-200">
                      <div className="flex items-center gap-2">
                        <span className="w-4 h-4 rounded-full bg-stone-800 text-stone-400 text-[10px] flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <span>{step.title}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${badgeColor}`}>
                        {step.targetIntensity}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono text-stone-400">
                      {formatTimeDisplay(step.plannedDurationSec)}
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-white">
                      {formatTimeDisplay(step.actualDurationSec)}
                    </td>
                    <td className="py-3 px-3 font-mono font-medium">
                      <span className={Math.abs(deltaSec) <= 5 ? 'text-emerald-400' : 'text-amber-400'}>
                        {deltaLabel}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-black text-amber-400">
                      {step.avgSpeedKmh.toFixed(1)} km/h
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Voice Coach Interventions Log */}
      {ride.coachMessages && ride.coachMessages.length > 0 && (
        <div className="rounded-3xl bg-stone-900 border border-stone-800 p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold text-white">Consignes et encouragements vocaux ({ride.coachMessages.length})</h3>
          </div>

          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {ride.coachMessages.map((msg, idx) => (
              <div key={idx} className="p-2.5 rounded-xl bg-stone-950 border border-stone-800 text-xs flex items-start gap-2.5">
                <span className="font-mono text-[11px] text-amber-500 font-bold shrink-0 pt-0.5">
                  {formatTimeDisplay(msg.timeSec)}
                </span>
                <p className="text-stone-300 italic">"{msg.text}"</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Export & Action Buttons */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <button
          id="btn-download-gpx"
          onClick={handleDownloadGPX}
          className="w-full sm:w-auto flex-1 py-3.5 px-4 rounded-2xl bg-stone-800 hover:bg-stone-700 text-white text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 border border-stone-700 transition-colors cursor-pointer"
        >
          <Download className="w-4 h-4 text-amber-400" />
          <span>Exporter trace GPX (Strava / Garmin)</span>
        </button>

        <button
          id="btn-download-json"
          onClick={handleDownloadJSON}
          className="w-full sm:w-auto py-3.5 px-4 rounded-2xl bg-stone-800 hover:bg-stone-700 text-white text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 border border-stone-700 transition-colors cursor-pointer"
        >
          <Share2 className="w-4 h-4 text-cyan-400" />
          <span>JSON</span>
        </button>

        <button
          id="btn-view-history"
          onClick={onOpenHistory}
          className="w-full sm:w-auto py-3.5 px-5 rounded-2xl bg-stone-800 hover:bg-stone-700 text-white text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 border border-stone-700 transition-colors cursor-pointer"
        >
          <History className="w-4 h-4 text-amber-400" />
          <span>Historique</span>
        </button>

        <button
          id="btn-new-workout"
          onClick={onNewWorkout}
          className="w-full sm:w-auto flex-1 py-3.5 px-6 rounded-2xl bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-amber-500/20"
        >
          <span>Nouvelle Sortie</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {downloadNotice && (
        <div className="p-3 text-center text-xs font-bold text-emerald-400 bg-emerald-500/10 rounded-xl border border-emerald-500/30">
          {downloadNotice}
        </div>
      )}
    </div>
  );
};
