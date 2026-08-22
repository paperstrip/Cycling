import React, { useEffect, useRef, useState } from 'react';
import { WorkoutPlan, CyclistProfile, TrainingProgram, RideRecord } from '../types';
import { PRESET_WORKOUTS } from '../data/presetWorkouts';
import { flattenWorkoutPlan, formatSecondsToMinutes } from '../utils/planFlatten';
import { getAllRideRecords } from '../utils/storage';
import { WorkoutProfileBar } from './WorkoutProfileBar';
import { WorkoutHeroCard } from './WorkoutHeroCard';
import { artworkForWorkout } from './WorkoutArtwork';
import { WorkoutPhoto } from './WorkoutPhoto';
import { WorkoutCarouselCard } from './WorkoutCarouselCard';
import { ScreenTitle } from './ScreenTitle';
import { ProgressRing } from './ProgressRing';
import { WeekStrip } from './WeekStrip';
import { SectionHeader } from './SectionHeader';
import {
  Compass,
  SlidersHorizontal,
  ChevronRight,
  ChevronDown,
  Trash2,
  CalendarCheck,
} from 'lucide-react';
import { isRestDayToday, todaysScheduledSession } from '../utils/programProgress';
import {
  deleteWorkout,
  getSavedWorkouts,
  type StoredWorkout,
} from '../utils/workoutLibrary';

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

/** Objectif hebdomadaire par défaut, faute de programme actif. */
const DEFAULT_WEEKLY_TARGET = 3;

export const WorkoutSelector: React.FC<WorkoutSelectorProps> = ({
  onStartWorkout,
  onOpenRoutesTab,
  onOpenProfileTab,
  cyclistProfile,
  activeProgram,
  selectedPlan,
  onSelectPlan,
}) => {
  const [filterCategory, setFilterCategory] = useState<'all' | 'vo2max' | 'seuil' | 'endurance' | 'recup'>('all');
  const [isBlockDetailOpen, setIsBlockDetailOpen] = useState<boolean>(false);
  const [rides, setRides] = useState<RideRecord[]>([]);
  // Séances enregistrées : celles créées par le coach doivent se retrouver
  // ici, sinon elles n'existent que le temps d'un écran.
  const [saved, setSaved] = useState<StoredWorkout[]>(() => getSavedWorkouts());
  const catalogueRef = useRef<HTMLElement>(null);

  useEffect(() => {
    let cancelled = false;
    getAllRideRecords()
      .then((all) => {
        if (!cancelled) setRides(all);
      })
      .catch(() => {
        /* L'accueil reste utilisable sans historique. */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const scrollToCatalogue = () =>
    catalogueRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  // Semaine en cours : lundi 00 h 00.
  const monday = (() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return d;
  })();

  const ridesThisWeek = rides.filter((r) => new Date(r.date).getTime() >= monday.getTime());
  // Le programme ne stocke pas d'objectif hebdomadaire : on le déduit des
  // séances planifiées qui ne sont pas des jours de repos.
  const programSessionsPerWeek = activeProgram
    ? Math.round(
        activeProgram.workouts.filter((w) => w.type !== 'repos').length /
          Math.max(1, activeProgram.durationWeeks),
      )
    : 0;
  const weeklyTarget = programSessionsPerWeek || DEFAULT_WEEKLY_TARGET;
  const weeklyKm = ridesThisWeek.reduce((acc, r) => acc + (r.totalDistanceKm || 0), 0);
  const weeklyMinutes = Math.round(
    ridesThisWeek.reduce((acc, r) => acc + (r.totalDurationSec || 0), 0) / 60,
  );

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

  // Séance prévue au programme aujourd'hui : l'accueil doit la refléter, sinon
  // le planificateur et l'écran d'accueil racontent deux histoires différentes.
  const plannedToday = todaysScheduledSession(activeProgram);
  const isShowingPlanned =
    !!plannedToday?.workoutPlan && plannedToday.workoutPlan.nom === selectedPlan.nom;
  const restToday = isRestDayToday(activeProgram);

  const firstName = (cyclistProfile.name || 'Cycliste').split(' ')[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir';

  return (
    <div className="space-y-7 animate-fadeIn">
      <section className="space-y-4">
        <ScreenTitle
          eyebrow={`${greeting}, ${firstName}`}
          title="On roule"
          accent="aujourd'hui ?"
        />
        <WeekStrip rideDates={rides.map((r) => r.date)} />
      </section>

      {/* Séance du jour : une image, un titre, un bouton */}
      <section>
        <SectionHeader
          title={isShowingPlanned ? 'Au programme aujourd’hui' : 'Votre séance'}
          actionLabel="Changer"
          onAction={scrollToCatalogue}
        />

        {/* Rappel du plan quand la séance affichée n'est pas celle qui était
            prévue : sans lui, on s'écarte de son programme sans le savoir. */}
        {plannedToday?.workoutPlan && !isShowingPlanned && (
          <button
            onClick={() => onSelectPlan(plannedToday.workoutPlan!)}
            className="w-full mb-2.5 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-3 text-left cursor-pointer hover:bg-amber-500/15 transition-colors"
          >
            <CalendarCheck className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="flex-1 min-w-0">
              <span className="block text-[11px] text-amber-300/80">Prévu aujourd’hui</span>
              <span className="block text-[12.5px] font-bold text-white truncate">
                {plannedToday.title}
              </span>
            </span>
            <span className="text-[11px] font-black uppercase tracking-wider text-amber-400 shrink-0">
              Charger
            </span>
          </button>
        )}

        {restToday && !plannedToday && (
          <div className="mb-2.5 p-3 rounded-2xl bg-stone-900 border border-stone-800 text-[12.5px] text-stone-300">
            Journée de <span className="font-bold text-white">repos</span> au programme. Rouler
            reste possible, mais la récupération fait partie de l’entraînement.
          </div>
        )}

        <WorkoutHeroCard
          eyebrow={isShowingPlanned ? 'Au programme' : 'Séance du jour'}
          artwork={artworkForWorkout(selectedPlan)}
          illustrationPreference={cyclistProfile.illustrationPreference}
          title={selectedPlan.nom}
          goal={selectedPlan.objectif}
          chips={[
            `${Math.round(totalDurationSec / 60)} min`,
            `${flattenedSteps.length} blocs`,
            selectedPlan.difficultyRating ? `Intensité ${selectedPlan.difficultyRating}/5` : 'Libre',
          ]}
          onStart={() => onStartWorkout(selectedPlan)}
        />

        {/* Détails repliés : consignes, blocs et itinéraire ne s'imposent plus */}
        <div className="rounded-3xl bg-stone-900 border border-stone-800 mt-2.5 overflow-hidden">
          <button
            onClick={() => setIsBlockDetailOpen((v) => !v)}
            aria-expanded={isBlockDetailOpen}
            className="w-full px-5 py-3.5 text-stone-400 hover:text-white text-xs font-bold flex items-center justify-between cursor-pointer transition-colors"
          >
            <span>Détail de la séance</span>
            <ChevronDown
              className={`w-4 h-4 transition-transform ${isBlockDetailOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {isBlockDetailOpen && (
            <div className="px-5 pb-5 space-y-4 animate-fade-up border-t border-stone-800/60 pt-4">
              <WorkoutProfileBar steps={flattenedSteps} />

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

      {/* Semaine en cours : l'anneau répond à « où j'en suis » sans calcul */}
      <section>
        <SectionHeader title="Cette semaine" />
        <div className="rounded-3xl bg-stone-900 border border-stone-800 p-5 flex items-center gap-5">
          <ProgressRing
            value={weeklyTarget ? ridesThisWeek.length / weeklyTarget : 0}
            centerValue={`${ridesThisWeek.length}/${weeklyTarget}`}
            centerLabel="séances"
          />
          <div className="flex-1 min-w-0 space-y-3">
            {[
              { value: weeklyKm >= 100 ? Math.round(weeklyKm).toString() : weeklyKm.toFixed(1), unit: 'km parcourus' },
              { value: weeklyMinutes.toString(), unit: 'minutes de selle' },
            ].map((stat) => (
              <div key={stat.unit}>
                <div className="font-mono text-xl font-black text-white leading-none">
                  {stat.value}
                </div>
                <div className="text-[11px] text-stone-500 mt-1">{stat.unit}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Deux entrées sorties de la barre basse, où elles étaient illisibles */}
      <section className="grid grid-cols-2 gap-2.5">
        {[
          {
            label: 'Parcours',
            sub: 'Itinéraires & GPS',
            icon: Compass,
            photo: 'parcours' as const,
            onClick: onOpenRoutesTab,
          },
          {
            label: 'Profil',
            sub: 'Zones & calibrage',
            icon: SlidersHorizontal,
            photo: 'coach' as const,
            onClick: onOpenProfileTab,
          },
        ].map((tile) => {
          const Icon = tile.icon;
          return (
            <button
              key={tile.label}
              onClick={tile.onClick}
              className="relative overflow-hidden p-4 pt-14 rounded-3xl bg-stone-900 border border-stone-800 hover:border-stone-700 text-left cursor-pointer transition-colors"
            >
              <WorkoutPhoto
                subject={tile.photo}
                photoKey={tile.label}
                preference={cyclistProfile.illustrationPreference}
                className="absolute inset-x-0 top-0 w-full h-24 opacity-70"
              />
              <div
                className="absolute inset-0"
                style={{
                  background: 'linear-gradient(to top, #1b1d21 42%, rgba(27,29,33,0.55) 100%)',
                }}
              />
              <div className="relative">
                <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center">
                  <Icon className="w-4.5 h-4.5" />
                </div>
                <div className="text-[13.5px] font-bold text-white mt-2.5">{tile.label}</div>
                <div className="text-[11px] text-stone-500 mt-0.5">{tile.sub}</div>
              </div>
            </button>
          );
        })}
      </section>

      {/* Catalogue : filtres en pastilles défilantes, cartes en liste dense
          plutôt qu'en grille — sur téléphone la grille ne tenait qu'une carte
          par ligne tout en la rendant plus haute. */}
      <section ref={catalogueRef}>
        <SectionHeader title="Autres séances" />

        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar bleed-page pb-3">
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

        {saved.length > 0 && (
          <div className="mb-4">
            <div className="text-[11px] uppercase tracking-wider text-stone-500 font-bold mb-2">
              Mes séances ({saved.length})
            </div>
            <div className="space-y-2">
              {saved.map((workout) => {
                const durMin = Math.round(
                  flattenWorkoutPlan(workout).reduce((a, x) => a + x.durationSec, 0) / 60,
                );
                const isSelected = selectedPlan.nom === workout.nom;
                return (
                  <div
                    key={workout.id}
                    className={`w-full p-3 rounded-2xl border flex items-center gap-3 transition-colors ${
                      isSelected
                        ? 'bg-amber-500/10 border-amber-500'
                        : 'bg-stone-900 border-stone-800'
                    }`}
                  >
                    <button
                      onClick={() => onSelectPlan(workout)}
                      className="flex-1 min-w-0 text-left cursor-pointer"
                    >
                      <div className="text-[13px] font-bold text-white truncate">
                        {workout.nom}
                      </div>
                      <div className="text-[11px] text-stone-400 truncate mt-0.5">
                        {durMin} min · {workout.objectif}
                      </div>
                    </button>
                    <button
                      onClick={() => {
                        deleteWorkout(workout.id);
                        setSaved(getSavedWorkouts());
                      }}
                      aria-label={`Supprimer ${workout.nom}`}
                      className="p-2 rounded-lg text-stone-500 hover:text-rose-400 cursor-pointer transition-colors shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Carrousel : la carte suivante dépasse volontairement du bord, ce qui
            signale qu'il y en a d'autres sans ajouter de flèche ni de point. */}
        <div className="flex gap-3 overflow-x-auto no-scrollbar snap-x snap-mandatory bleed-page pb-1">
          {filteredPresets.map((preset) => {
            const steps = flattenWorkoutPlan(preset);
            return (
              <WorkoutCarouselCard
                key={preset.id || preset.nom}
                plan={preset}
                durationMin={Math.round(steps.reduce((a, s) => a + s.durationSec, 0) / 60)}
                isSelected={selectedPlan.nom === preset.nom}
                illustrationPreference={cyclistProfile.illustrationPreference}
                onSelect={() => onSelectPlan(preset)}
              />
            );
          })}
        </div>
      </section>
    </div>
  );
};
