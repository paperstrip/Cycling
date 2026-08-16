import React, { useState } from 'react';
import { WorkoutPlan, CyclistProfile, CyclingRoute, TrainingProgram } from '../types';
import { PRESET_WORKOUTS } from '../data/presetWorkouts';
import { flattenWorkoutPlan, formatSecondsToMinutes } from '../utils/planFlatten';
import { WorkoutProfileBar } from './WorkoutProfileBar';
import {
  Sparkles,
  Play,
  Clock,
  Zap,
  Route as RouteIcon,
  MessageSquare,
  Award,
  ChevronRight,
  TrendingUp,
  Flame,
  Bike,
  Activity,
  Headphones,
  Sliders,
  Check,
  ChevronDown,
} from 'lucide-react';

interface WorkoutSelectorProps {
  onStartWorkout: (plan: WorkoutPlan) => void;
  onOpenCoachChat: () => void;
  onOpenRoutesTab: () => void;
  onOpenProgramTab: () => void;
  onOpenProfileTab: () => void;
  cyclistProfile: CyclistProfile;
  activeProgram: TrainingProgram | null;
  selectedPlan: WorkoutPlan;
  onSelectPlan: (plan: WorkoutPlan) => void;
}

export const WorkoutSelector: React.FC<WorkoutSelectorProps> = ({
  onStartWorkout,
  onOpenCoachChat,
  onOpenRoutesTab,
  onOpenProgramTab,
  onOpenProfileTab,
  cyclistProfile,
  activeProgram,
  selectedPlan,
  onSelectPlan,
}) => {
  const [filterCategory, setFilterCategory] = useState<'all' | 'vo2max' | 'seuil' | 'endurance' | 'recup'>('all');
  const [isBlockDetailOpen, setIsBlockDetailOpen] = useState<boolean>(false);

  const filteredPresets = PRESET_WORKOUTS.filter((p) => {
    if (filterCategory === 'all') return true;
    if (filterCategory === 'vo2max') return p.nom.toLowerCase().includes('vo2') || p.objectif.toLowerCase().includes('vo2');
    if (filterCategory === 'seuil') return p.nom.toLowerCase().includes('seuil') || p.nom.toLowerCase().includes('sweet');
    if (filterCategory === 'endurance') return p.nom.toLowerCase().includes('endurance') || p.nom.toLowerCase().includes('tempo');
    if (filterCategory === 'recup') return p.nom.toLowerCase().includes('recup') || p.nom.toLowerCase().includes('cadence');
    return true;
  });

  const flattenedSteps = flattenWorkoutPlan(selectedPlan);
  const totalDurationSec = flattenedSteps.reduce((acc, step) => acc + step.durationSec, 0);

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Active Workout Hero Card */}
      <div className="rounded-3xl bg-stone-900 border border-stone-800 p-5 sm:p-7 shadow-2xl space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 border-b border-stone-800 pb-5">
          <div className="space-y-1.5 max-w-2xl">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-black uppercase tracking-wider text-amber-400">
                Séance Sélectionnée
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-stone-950 text-stone-300 font-mono">
                {formatSecondsToMinutes(totalDurationSec)} ({flattenedSteps.length} blocs)
              </span>
              {selectedPlan.difficultyRating && (
                <span className="text-[10px] px-2 py-0.5 rounded bg-stone-800 text-amber-300 font-mono font-bold">
                  Difficulté : {selectedPlan.difficultyRating}/5
                </span>
              )}
              {selectedPlan.targetTSS && (
                <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 font-mono font-bold">
                  TSS ~{selectedPlan.targetTSS}
                </span>
              )}
            </div>

            <h2 className="text-2xl sm:text-3xl font-black text-white">{selectedPlan.nom}</h2>
            <p className="text-xs sm:text-sm text-stone-300 leading-relaxed">{selectedPlan.objectif}</p>
          </div>

          {/* Big Start Button */}
          <div className="flex items-center gap-3 shrink-0 w-full lg:w-auto">
            <button
              id="btn-start-workout-hub"
              onClick={() => onStartWorkout(selectedPlan)}
              className="w-full lg:w-auto py-4 px-8 rounded-2xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2.5 transition-all cursor-pointer shadow-xl shadow-amber-500/25 transform hover:-translate-y-0.5"
            >
              <Play className="w-5 h-5 fill-stone-950" />
              <span>Démarrer la séance</span>
            </button>
          </div>
        </div>

        {/* Coach Instructions Callout */}
        {selectedPlan.coachTips && selectedPlan.coachTips.length > 0 && (
          <div className="p-4 rounded-2xl bg-stone-950 border border-stone-800 space-y-2">
            <div className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              Consignes du Directeur Sportif Jean-Marc
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] text-stone-300">
              {selectedPlan.coachTips.map((tip, idx) => (
                <div key={idx} className="flex items-start gap-1.5">
                  <span className="text-amber-500 font-bold">•</span>
                  <span>{tip}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Profil d'intensité : la forme de la séance en un coup d'œil */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-xs text-stone-400">
            <span className="font-bold uppercase tracking-wider text-stone-300">
              Profil de la séance
            </span>
            <span className="text-amber-400 font-mono text-[11px]">Guidage vocal temps réel</span>
          </div>

          <WorkoutProfileBar steps={flattenedSteps} />

          {/* Détail bloc par bloc, replié par défaut pour garder l'écran lisible */}
          <button
            onClick={() => setIsBlockDetailOpen((v) => !v)}
            aria-expanded={isBlockDetailOpen}
            className="w-full mt-1 px-3.5 py-2.5 rounded-xl bg-stone-950 hover:bg-stone-800/60 border border-stone-800 text-stone-300 text-xs font-bold flex items-center justify-between cursor-pointer transition-colors"
          >
            <span>
              {isBlockDetailOpen ? 'Masquer' : 'Voir'} le détail des {flattenedSteps.length} blocs
            </span>
            <ChevronDown
              className={`w-4 h-4 transition-transform ${isBlockDetailOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {isBlockDetailOpen && (
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2 animate-fade-up">
              {flattenedSteps.map((step, idx) => {
                let color = 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300';
                if (step.targetIntensity === 'moyen') color = 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300';
                if (step.targetIntensity === 'seuil') color = 'border-amber-500/30 bg-amber-500/10 text-amber-300';
                if (step.targetIntensity === 'a_fond') color = 'border-rose-500/30 bg-rose-500/10 text-rose-300';

                return (
                  <div key={idx} className={`p-2.5 rounded-xl border ${color} text-left space-y-1`}>
                    <div className="flex items-center justify-between font-mono text-[10px] text-stone-400">
                      <span>Bloc {idx + 1}</span>
                      <span className="font-bold text-white">{formatSecondsToMinutes(step.durationSec)}</span>
                    </div>
                    <div className="font-bold text-white text-xs truncate">{step.title}</div>
                    <div className="text-[9px] uppercase font-bold tracking-wider opacity-85">
                      {step.targetIntensity.replace('_', ' ')}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Quick Link to Route Explorer */}
        {selectedPlan.routeSuggestion && (
          <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5 text-amber-200">
              <RouteIcon className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                <strong>Itinéraire adapté inclus : </strong>
                {selectedPlan.routeSuggestion.name} ({selectedPlan.routeSuggestion.estimatedDistanceKm.toFixed(0)} km • +{selectedPlan.routeSuggestion.totalAscentM}m D+)
              </span>
            </div>

            <button
              onClick={onOpenRoutesTab}
              className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs flex items-center gap-1 cursor-pointer transition-all self-start sm:self-auto"
            >
              <span>Voir sur la carte</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Preset Workouts Filter and Library */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-black text-white">Catalogue des Séances Calibrées</h3>
            <p className="text-xs text-stone-400">
              Séances structurées avec intensités et cadences adaptées à votre niveau
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {[
              { id: 'all', label: 'Toutes' },
              { id: 'vo2max', label: 'VO2 Max (Z5)' },
              { id: 'seuil', label: 'Seuil & FTP (Z4)' },
              { id: 'endurance', label: 'Endurance (Z2/Z3)' },
              { id: 'recup', label: 'Récupération (Z1)' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setFilterCategory(f.id as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  filterCategory === f.id
                    ? 'bg-amber-500 text-stone-950 shadow-md'
                    : 'bg-stone-900 border border-stone-800 text-stone-400 hover:text-white'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Preset Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredPresets.map((preset) => {
            const isSelected = selectedPlan.nom === preset.nom;
            const steps = flattenWorkoutPlan(preset);
            const durMin = Math.round(steps.reduce((a, s) => a + s.durationSec, 0) / 60);

            return (
              <div
                key={preset.id || preset.nom}
                onClick={() => onSelectPlan(preset)}
                className={`p-4 rounded-3xl border transition-all cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? 'bg-amber-500/10 border-amber-500 shadow-xl shadow-amber-500/10 ring-1 ring-amber-500'
                    : 'bg-stone-900 border-stone-800 hover:border-stone-700 hover:bg-stone-850'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-stone-950 text-stone-300 font-mono">
                      {durMin} min
                    </span>
                    <span className="text-[11px] font-semibold text-amber-400">
                      {preset.blocs.length} blocs
                    </span>
                  </div>

                  <h4 className="text-sm font-bold text-white mb-1 line-clamp-1">{preset.nom}</h4>
                  <p className="text-xs text-stone-400 line-clamp-2 leading-relaxed">{preset.objectif}</p>
                </div>

                <div className="mt-3 pt-2.5 border-t border-stone-800/80 flex items-center justify-between text-xs">
                  <span className="text-[10px] text-stone-500 font-mono">
                    TSS ~{preset.targetTSS || 45}
                  </span>
                  <span className={`font-bold text-xs ${isSelected ? 'text-amber-400' : 'text-stone-400'}`}>
                    {isSelected ? '✓ Sélectionnée' : 'Choisir'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* AI Coach Banner */}
      <div className="p-5 rounded-3xl bg-gradient-to-r from-stone-900 to-amber-950/20 border border-stone-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold shrink-0">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <div className="font-bold text-sm text-white">Besoin d'une séance spécifique pour aujourd'hui ?</div>
            <p className="text-xs text-stone-400">
              Demandez au Directeur Sportif Jean-Marc de créer une séance calibrée selon votre forme, météo ou temps disponible.
            </p>
          </div>
        </div>

        <button
          onClick={onOpenCoachChat}
          className="px-4 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-black text-xs uppercase tracking-wider flex items-center gap-2 cursor-pointer transition-all shadow-md shadow-amber-500/20 shrink-0 self-start sm:self-auto"
        >
          <Sparkles className="w-4 h-4" />
          <span>Briefing avec le Coach</span>
        </button>
      </div>
    </div>
  );
};
