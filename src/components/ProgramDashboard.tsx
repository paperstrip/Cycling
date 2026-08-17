import React, { useState } from 'react';
import { TrainingProgram, ScheduledWorkout, WorkoutPlan } from '../types';
import { computeProgramProgress } from '../utils/programProgress';
import {
  Calendar,
  Award,
  CheckCircle2,
  Play,
  ChevronRight,
  BookOpen,
  Zap,
  Clock,
  Flame,
  ArrowRight,
  RefreshCw,
  Sparkles,
  Info,
} from 'lucide-react';

interface ProgramDashboardProps {
  program: TrainingProgram;
  onSelectWorkout: (plan: WorkoutPlan) => void;
  onOpenCoachChat: () => void;
}

export const ProgramDashboard: React.FC<ProgramDashboardProps> = ({
  program,
  onSelectWorkout,
  onOpenCoachChat,
}) => {
  const [selectedWeek, setSelectedWeek] = useState<number>(1);
  const [selectedWorkout, setSelectedWorkout] = useState<ScheduledWorkout | null>(
    program.workouts[0] || null
  );

  const workoutsThisWeek = program.workouts.filter(
    (w) => Math.ceil(w.dayNumber / 7) === selectedWeek
  );

  // Les jours de repos gonflaient le dénominateur : un programme dont toutes
  // les séances étaient faites n'affichait jamais 100 %.
  const progress = computeProgramProgress(program);
  const completedCount = progress.completedSessions;
  const progressPercent =
    progress.totalSessions > 0
      ? Math.round((progress.completedSessions / progress.totalSessions) * 100)
      : 0;

  return (
    <div className="space-y-6">
      {/* Program Hero Header */}
      <div className="rounded-3xl bg-gradient-to-br from-stone-900 via-stone-900 to-amber-950/30 border border-stone-800 p-6 sm:p-8 relative overflow-hidden shadow-2xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-400 text-xs font-bold uppercase tracking-wider">
              <Award className="w-3.5 h-3.5" />
              Programme personnalisé • {program.durationWeeks} semaines
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-white">{program.title}</h1>
            <p className="text-xs sm:text-sm text-stone-300 leading-relaxed">
              {program.overview}
            </p>
          </div>

          {/* Key metrics box */}
          <div className="grid grid-cols-2 gap-3 shrink-0">
            <div className="p-4 rounded-2xl bg-stone-950/80 border border-stone-800 text-center">
              <div className="text-[10px] uppercase font-bold text-stone-500 flex items-center justify-center gap-1">
                <Clock className="w-3 h-3 text-amber-400" />
                Volume Cible
              </div>
              <div className="text-xl sm:text-2xl font-black font-mono text-white mt-0.5">
                {program.weeklyVolumeHours} <span className="text-xs text-amber-400 font-bold">h/sem</span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-stone-950/80 border border-stone-800 text-center">
              <div className="text-[10px] uppercase font-bold text-stone-500 flex items-center justify-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                Progression
              </div>
              <div className="text-xl sm:text-2xl font-black font-mono text-emerald-400 mt-0.5">
                {progressPercent}%
              </div>
            </div>
          </div>
        </div>

        {/* Pedagogical Advice Bar */}
        {program.pedagogicalAdvice && program.pedagogicalAdvice.length > 0 && (
          <div className="mt-5 pt-4 border-t border-stone-800/80">
            <div className="text-xs font-bold text-amber-400 flex items-center gap-1.5 mb-2">
              <Sparkles className="w-3.5 h-3.5" />
              Principes d'entraînement de Jean-Marc
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {program.pedagogicalAdvice.slice(0, 3).map((adv, idx) => (
                <div key={idx} className="p-2.5 rounded-xl bg-stone-950/60 border border-stone-800/60 text-[11px] text-stone-300 flex items-start gap-2">
                  <span className="text-amber-500 font-bold">•</span>
                  <span>{adv}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Week Selector Tabs */}
      <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1">
        <div className="flex items-center gap-2">
          {Array.from({ length: program.durationWeeks }).map((_, idx) => {
            const wNum = idx + 1;
            const isSelected = selectedWeek === wNum;
            return (
              <button
                key={wNum}
                onClick={() => setSelectedWeek(wNum)}
                className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-amber-500 text-stone-950 shadow-lg shadow-amber-500/20'
                    : 'bg-stone-900 border border-stone-800 text-stone-400 hover:text-white hover:border-stone-700'
                }`}
              >
                Semaine {wNum}
              </button>
            );
          })}
        </div>

        <button
          onClick={onOpenCoachChat}
          className="px-3 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 border border-stone-800 text-xs text-amber-400 font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Ajuster avec le coach</span>
        </button>
      </div>

      {/* Week Calendar Grid */}
      <div className="grid grid-cols-1 md:grid-cols-7 gap-2.5">
        {workoutsThisWeek.map((workout) => {
          const isSelected = selectedWorkout?.id === workout.id;
          const isBike = workout.type === 'velo';
          const isRest = workout.type === 'repos';

          return (
            <div
              key={workout.id}
              onClick={() => setSelectedWorkout(workout)}
              className={`p-3.5 rounded-2xl border text-xs cursor-pointer transition-all flex flex-col justify-between min-h-[140px] ${
                isSelected
                  ? 'bg-stone-850 border-amber-500 shadow-xl'
                  : 'bg-stone-900 border-stone-800 hover:border-stone-700'
              }`}
            >
              <div>
                <div className="flex items-center justify-between text-[11px] font-bold text-stone-400 mb-1">
                  <span className="uppercase">{workout.dayOfWeek.slice(0, 3)}</span>
                  <span className="font-mono text-[10px]">J{workout.dayNumber}</span>
                </div>

                <h4 className="font-bold text-white text-xs line-clamp-2 leading-tight">
                  {workout.title}
                </h4>

                <div className="mt-2 flex items-center gap-1 text-[10px]">
                  {isBike && (
                    <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-bold">
                      {workout.targetDurationMinutes} min
                    </span>
                  )}
                  {isRest && (
                    <span className="px-1.5 py-0.5 rounded bg-stone-800 text-stone-400">
                      Repos
                    </span>
                  )}
                  {workout.type === 'recup_active' && (
                    <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
                      Récup Z1
                    </span>
                  )}
                </div>
              </div>

              {workout.workoutPlan && (
                <div className="mt-2 pt-2 border-t border-stone-800/80 flex items-center justify-between text-[10px] text-amber-400 font-bold">
                  <span>Séance prête</span>
                  <Play className="w-3 h-3 fill-amber-400" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Selected Workout Detail Focus Box */}
      {selectedWorkout && (
        <div className="rounded-3xl bg-stone-900 border border-stone-800 p-6 space-y-4 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-800 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-stone-800 text-amber-400 text-xs font-mono font-bold">
                  Jour {selectedWorkout.dayNumber} • {selectedWorkout.dayOfWeek}
                </span>
                <span className="text-xs text-stone-400 capitalize">
                  {selectedWorkout.type === 'velo' ? 'Séance sur le vélo' : selectedWorkout.type}
                </span>
              </div>
              <h3 className="text-lg font-black text-white mt-1">{selectedWorkout.title}</h3>
              <p className="text-xs text-stone-400 mt-0.5">{selectedWorkout.notes}</p>
            </div>

            {selectedWorkout.workoutPlan && (
              <button
                id="btn-launch-program-workout"
                onClick={() => onSelectWorkout(selectedWorkout.workoutPlan!)}
                className="py-3 px-6 rounded-2xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-amber-500/20 shrink-0"
              >
                <Play className="w-4 h-4 fill-stone-950" />
                <span>Lancer cette séance avec le Coach Vocal</span>
              </button>
            )}
          </div>

          {/* Workout Blocks preview if available */}
          {selectedWorkout.workoutPlan && (
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-stone-400">
                Structure des blocs & consignes vocales
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {selectedWorkout.workoutPlan.blocs.map((b, idx) => (
                  <div key={idx} className="p-3 rounded-xl bg-stone-950 border border-stone-800 text-xs space-y-1">
                    <div className="flex items-center justify-between font-semibold">
                      <span className="text-stone-300 capitalize">{b.type.replace('_', ' ')}</span>
                      <span className="text-amber-400 font-mono">
                        {Math.round((b.duree_sec * (b.repetitions || 1)) / 60)} min
                      </span>
                    </div>
                    <div className="text-[11px] text-stone-400 italic">
                      "{b.consigne_vocale}"
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
