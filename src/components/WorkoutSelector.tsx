import React, { useRef, useState } from 'react';
import { WorkoutPlan, CyclistProfile, CyclingRoute, TrainingProgram } from '../types';
import { PRESET_WORKOUTS } from '../data/presetWorkouts';
import { flattenWorkoutPlan, formatSecondsToMinutes } from '../utils/planFlatten';
import { WorkoutProfileBar } from './WorkoutProfileBar';
import { SectionHeader } from './SectionHeader';
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
  const catalogueRef = useRef<HTMLElement>(null);

  const scrollToCatalogue = () =>
    catalogueRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

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
      {/* Séance du jour : une carte, une action. Les métadonnées passent en
          seconde lecture, sous le titre, au lieu d'une rangée de badges. */}
      <section>
        <SectionHeader title="Votre séance" actionLabel="Changer" onAction={scrollToCatalogue} />

        <div className="rounded-3xl bg-stone-900 border border-stone-800 overflow-hidden">
          <div className="p-5 space-y-4">
            <div>
              <h3 className="text-[22px] leading-tight font-black text-white">{selectedPlan.nom}</h3>
              <p className="text-[13px] text-stone-400 mt-1.5 leading-relaxed">
                {selectedPlan.objectif}
              </p>
            </div>

            {/* Trois chiffres, alignés, en une ligne lisible d'un coup d'œil */}
            <div className="flex items-stretch rounded-2xl bg-stone-950 border border-stone-800 divide-x divide-stone-800">
              {[
                { value: `${Math.round(totalDurationSec / 60)} min`, label: 'Durée' },
                { value: String(flattenedSteps.length), label: 'Blocs' },
                {
                  value: selectedPlan.difficultyRating ? `${selectedPlan.difficultyRating}/5` : '—',
                  label: 'Intensité',
                },
              ].map((stat) => (
                <div key={stat.label} className="flex-1 px-3 py-2.5 text-center">
                  <div className="font-mono text-base font-bold text-white">{stat.value}</div>
                  <div className="text-[10px] uppercase tracking-wider text-stone-500 mt-0.5">
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>

            <WorkoutProfileBar steps={flattenedSteps} />

            <button
              id="btn-start-workout-hub"
              onClick={() => onStartWorkout(selectedPlan)}
              className="w-full py-4 rounded-2xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2.5 cursor-pointer transition-colors"
            >
              <Play className="w-5 h-5 fill-stone-950" />
              <span>Démarrer</span>
            </button>
          </div>

          {/* Détails repliés : consignes, blocs et itinéraire ne s'imposent plus */}
          <button
            onClick={() => setIsBlockDetailOpen((v) => !v)}
            aria-expanded={isBlockDetailOpen}
            className="w-full px-5 py-3 border-t border-stone-800 text-stone-400 hover:text-white text-xs font-bold flex items-center justify-between cursor-pointer transition-colors"
          >
            <span>Détail de la séance</span>
            <ChevronDown
              className={`w-4 h-4 transition-transform ${isBlockDetailOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {isBlockDetailOpen && (
            <div className="px-5 pb-5 pt-1 space-y-4 animate-fade-up border-t border-stone-800/60">
              {selectedPlan.coachTips && selectedPlan.coachTips.length > 0 && (
                <ul className="space-y-1.5">
                  {selectedPlan.coachTips.map((tip, idx) => (
                    <li key={idx} className="flex gap-2 text-[12px] text-stone-300 leading-relaxed">
                      <span className="text-amber-500 shrink-0">•</span>
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {flattenedSteps.map((step, idx) => {
                  let color = 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300';
                  if (step.targetIntensity === 'moyen') color = 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300';
                  if (step.targetIntensity === 'seuil') color = 'border-amber-500/30 bg-amber-500/10 text-amber-300';
                  if (step.targetIntensity === 'a_fond') color = 'border-rose-500/30 bg-rose-500/10 text-rose-300';

                  return (
                    <div key={idx} className={`p-2.5 rounded-xl border ${color}`}>
                      <div className="flex items-center justify-between font-mono text-[10px] text-stone-400">
                        <span>{idx + 1}</span>
                        <span className="font-bold text-white">
                          {formatSecondsToMinutes(step.durationSec)}
                        </span>
                      </div>
                      <div className="font-bold text-white text-[11px] truncate mt-0.5">
                        {step.title}
                      </div>
                    </div>
                  );
                })}
              </div>

              {selectedPlan.routeSuggestion && (
                <button
                  onClick={onOpenRoutesTab}
                  className="w-full p-3 rounded-2xl bg-stone-950 border border-stone-800 hover:border-stone-700 flex items-center justify-between gap-3 text-left cursor-pointer transition-colors"
                >
                  <div className="min-w-0">
                    <div className="text-[10px] uppercase tracking-wider text-stone-500">
                      Itinéraire suggéré
                    </div>
                    <div className="text-[12px] text-stone-200 truncate">
                      {selectedPlan.routeSuggestion.name}
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-stone-500 shrink-0" />
                </button>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Catalogue : filtres en pastilles défilantes, cartes en liste dense
          plutôt qu'en grille — sur téléphone la grille ne tenait qu'une carte
          par ligne tout en la rendant plus haute. */}
      <section ref={catalogueRef}>
        <SectionHeader title="Autres séances" />

        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-3">
          {[
            { id: 'all', label: 'Toutes' },
            { id: 'vo2max', label: 'VO2 Max' },
            { id: 'seuil', label: 'Seuil' },
            { id: 'endurance', label: 'Endurance' },
            { id: 'recup', label: 'Récupération' },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setFilterCategory(f.id as any)}
              className={`px-3.5 py-2 rounded-full text-[12px] font-bold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                filterCategory === f.id
                  ? 'bg-amber-500 text-stone-950'
                  : 'bg-stone-900 border border-stone-800 text-stone-400'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="space-y-2">
          {filteredPresets.map((preset) => {
            const isSelected = selectedPlan.nom === preset.nom;
            const steps = flattenWorkoutPlan(preset);
            const durMin = Math.round(steps.reduce((a, s) => a + s.durationSec, 0) / 60);

            return (
              <button
                key={preset.id || preset.nom}
                onClick={() => onSelectPlan(preset)}
                className={`w-full p-3.5 rounded-2xl border text-left flex items-center gap-3.5 cursor-pointer transition-colors ${
                  isSelected
                    ? 'bg-amber-500/10 border-amber-500'
                    : 'bg-stone-900 border-stone-800 hover:border-stone-700'
                }`}
              >
                {/* Durée en pastille : le critère de choix numéro un */}
                <div
                  className={`w-14 shrink-0 text-center rounded-xl py-2 ${
                    isSelected ? 'bg-amber-500 text-stone-950' : 'bg-stone-950 text-white'
                  }`}
                >
                  <div className="font-mono text-base font-bold leading-none">{durMin}</div>
                  <div className="text-[9px] uppercase tracking-wider opacity-70 mt-0.5">min</div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-bold text-white truncate">{preset.nom}</div>
                  <div className="text-[11.5px] text-stone-400 truncate mt-0.5">
                    {preset.objectif}
                  </div>
                </div>

                {isSelected ? (
                  <Check className="w-5 h-5 text-amber-400 shrink-0" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-stone-600 shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* Accès au coach : une ligne, pas une bannière */}
      <button
        onClick={onOpenCoachChat}
        className="w-full p-4 rounded-2xl bg-stone-900 border border-stone-800 hover:border-stone-700 flex items-center gap-3 text-left cursor-pointer transition-colors"
      >
        <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center shrink-0">
          <MessageSquare className="w-4.5 h-4.5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-bold text-white">Demander une séance sur mesure</div>
          <div className="text-[11.5px] text-stone-400">
            Selon votre forme, le temps dont vous disposez ou la météo
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-stone-600 shrink-0" />
      </button>
    </div>
  );
};
