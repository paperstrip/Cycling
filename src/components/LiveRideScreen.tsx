import React, { useState, useEffect, useRef } from 'react';
import {
  WorkoutPlan,
  ExecutionStep,
  StepExecutionRecord,
  CoachVoiceEvent,
  RideRecord,
  IntensityZone,
  BlockType,
} from '../types';
import { flattenWorkoutPlan, formatTimeDisplay, formatTimeHoursDisplay } from '../utils/planFlatten';
import { GeoTracker, GeoState } from '../utils/geoTracker';
import { audioEngine } from '../utils/audioEngine';
import { generateLiveMotivation } from '../utils/geminiClient';
import { VoiceSettingsModal } from './VoiceSettingsModal';
import {
  Play,
  Pause,
  SkipForward,
  PlusCircle,
  Square,
  Volume2,
  VolumeX,
  Sun,
  Moon,
  Radio,
  Sparkles,
  Zap,
  Gauge,
  Navigation,
  Compass,
  CheckCircle2,
  AlertTriangle,
  Headphones,
} from 'lucide-react';

interface LiveRideScreenProps {
  plan: WorkoutPlan;
  onFinishRide: (ride: RideRecord) => void;
  onCancelRide: () => void;
}

export const LiveRideScreen: React.FC<LiveRideScreenProps> = ({
  plan,
  onFinishRide,
  onCancelRide,
}) => {
  // Flattened step list
  const steps = useRef<ExecutionStep[]>(flattenWorkoutPlan(plan)).current;

  // Runtime State
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [stepElapsedSec, setStepElapsedSec] = useState<number>(0);
  const [totalElapsedSec, setTotalElapsedSec] = useState<number>(0);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [sunlightMode, setSunlightMode] = useState<boolean>(false); // High contrast daylight vs OLED dark
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState<boolean>(false);
  const [recentCoachMessage, setRecentCoachMessage] = useState<string | null>(null);

  // GPS Telemetry State
  const [geoState, setGeoState] = useState<GeoState>({
    status: 'idle',
    errorMessage: null,
    currentSpeedKmh: 0,
    averageSpeedKmh: 0,
    maxSpeedKmh: 0,
    totalDistanceKm: 0,
    accuracy: null,
    lastPoint: null,
    trackPoints: [],
  });

  // Step Records (tracking planned vs actual timestamps and speeds)
  const stepRecords = useRef<StepExecutionRecord[]>([]);
  const currentStepStartTimestamp = useRef<number>(Date.now());
  const currentStepGpsPoints = useRef<{ speed: number; dist: number }[]>([]);
  const coachVoiceEvents = useRef<CoachVoiceEvent[]>([]);

  // Trackers and Timers
  const geoTrackerRef = useRef<GeoTracker | null>(null);
  const wakeLockRef = useRef<any>(null);
  const lastAiCommentTime = useRef<number>(0);
  const hasAnnouncedCurrentStep = useRef<boolean>(false);

  // Current Step Object
  const currentStep: ExecutionStep = steps[currentStepIndex] || steps[0];
  const stepRemainingSec = Math.max(0, currentStep.durationSec - stepElapsedSec);
  const stepProgressPercent = Math.min(100, (stepElapsedSec / Math.max(1, currentStep.durationSec)) * 100);
  const nextStep: ExecutionStep | undefined = steps[currentStepIndex + 1];

  // Keep screen awake via Screen Wake Lock API
  useEffect(() => {
    async function requestWakeLock() {
      try {
        if ('wakeLock' in navigator) {
          wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
        }
      } catch (err) {
        // WakeLock may be rejected if battery is low or not active window
      }
    }
    requestWakeLock();

    return () => {
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
      }
    };
  }, []);

  // Initialize GeoTracker and Audio on mount
  useEffect(() => {
    audioEngine.unlockAudio();

    const tracker = new GeoTracker((state) => {
      setGeoState(state);
      if (state.currentSpeedKmh > 0) {
        currentStepGpsPoints.current.push({
          speed: state.currentSpeedKmh,
          dist: state.totalDistanceKm,
        });
      }
    });

    geoTrackerRef.current = tracker;
    tracker.start(true); // with simulator fallback if GPS unavailable

    // Announce start of workout and first block
    const introMsg = `Départ de la sortie ${plan.nom}. ${currentStep.vocalPrompt}`;
    audioEngine.speak(introMsg, { priority: 'high', intensity: currentStep.targetIntensity });
    logCoachMessage(introMsg, 'plan');
    hasAnnouncedCurrentStep.current = true;

    return () => {
      tracker.stop();
    };
  }, []);

  // Sync simulator speed targets to current block intensity
  useEffect(() => {
    if (geoTrackerRef.current) {
      if (currentStep.targetIntensity === 'a_fond') {
        geoTrackerRef.current.setSimulatedTargetSpeed(38);
      } else if (currentStep.targetIntensity === 'seuil') {
        geoTrackerRef.current.setSimulatedTargetSpeed(33);
      } else if (currentStep.targetIntensity === 'moyen') {
        geoTrackerRef.current.setSimulatedTargetSpeed(29);
      } else {
        geoTrackerRef.current.setSimulatedTargetSpeed(23);
      }
    }
  }, [currentStepIndex, currentStep.targetIntensity]);

  // Main 1-Second Master Stopwatch Loop
  useEffect(() => {
    if (isPaused) return;

    const interval = setInterval(() => {
      setTotalElapsedSec((prev) => prev + 1);
      setStepElapsedSec((prev) => {
        const nextVal = prev + 1;

        // 3-2-1 Countdown audio cues before step end
        const secondsRemaining = currentStep.durationSec - nextVal;
        if (secondsRemaining === 3 || secondsRemaining === 2 || secondsRemaining === 1) {
          audioEngine.playCountdownTone(secondsRemaining);
        } else if (secondsRemaining === 0) {
          audioEngine.playCountdownTone(0);
        }

        // Automatic block transition
        if (nextVal >= currentStep.durationSec) {
          advanceToNextStep();
          return 0;
        }

        return nextVal;
      });

      // Periodic AI Coach Commentary (every 3 to 4 minutes: ~210 seconds)
      const now = totalElapsedSec;
      if (now - lastAiCommentTime.current >= 210 && now > 45) {
        lastAiCommentTime.current = now;
        triggerPeriodicAiCoach();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isPaused, currentStepIndex, totalElapsedSec, currentStep.durationSec]);

  // Log coach messages
  const logCoachMessage = (text: string, source: 'plan' | 'gemini_coach' | 'countdown') => {
    const event: CoachVoiceEvent = {
      id: `msg-${Date.now()}-${Math.random()}`,
      timeSec: totalElapsedSec,
      timestamp: Date.now(),
      text,
      source,
    };
    coachVoiceEvents.current.push(event);
    setRecentCoachMessage(text);
  };

  // Helper to complete current step record
  const finalizeCurrentStepRecord = () => {
    const endTimestamp = Date.now();
    const actualDurationSec = Math.max(1, Math.round((endTimestamp - currentStepStartTimestamp.current) / 1000));

    // Calculate speeds for this block
    const speeds = currentStepGpsPoints.current.map((p) => p.speed);
    const avgSpeed = speeds.length > 0 ? speeds.reduce((a, b) => a + b, 0) / speeds.length : geoState.currentSpeedKmh || 0;
    const maxSpeed = speeds.length > 0 ? Math.max(...speeds) : geoState.currentSpeedKmh || 0;

    let stepDistKm = 0;
    if (currentStepGpsPoints.current.length > 1) {
      const firstDist = currentStepGpsPoints.current[0].dist;
      const lastDist = currentStepGpsPoints.current[currentStepGpsPoints.current.length - 1].dist;
      stepDistKm = Math.max(0, lastDist - firstDist);
    } else {
      stepDistKm = (avgSpeed * actualDurationSec) / 3600;
    }

    const record: StepExecutionRecord = {
      stepIndex: currentStep.stepIndex,
      title: currentStep.title,
      type: currentStep.type,
      targetIntensity: currentStep.targetIntensity,
      plannedDurationSec: currentStep.durationSec,
      actualDurationSec,
      startTimestamp: currentStepStartTimestamp.current,
      endTimestamp,
      avgSpeedKmh: Number(avgSpeed.toFixed(1)),
      maxSpeedKmh: Number(maxSpeed.toFixed(1)),
      distanceKm: Number(stepDistKm.toFixed(2)),
    };

    stepRecords.current.push(record);
  };

  // Advance to next step or finish
  const advanceToNextStep = () => {
    finalizeCurrentStepRecord();

    const nextIndex = currentStepIndex + 1;
    if (nextIndex < steps.length) {
      setCurrentStepIndex(nextIndex);
      setStepElapsedSec(0);
      currentStepStartTimestamp.current = Date.now();
      currentStepGpsPoints.current = [];

      const upcomingStep = steps[nextIndex];
      const vocalText = upcomingStep.vocalPrompt;
      audioEngine.speak(vocalText, { priority: 'high', intensity: upcomingStep.targetIntensity });
      logCoachMessage(vocalText, 'plan');
    } else {
      // Workout Finished!
      handleCompleteWorkout();
    }
  };

  // Skip / Next Block Manual Click
  const handleManualSkip = () => {
    advanceToNextStep();
  };

  // Add 30 seconds to current block
  const handleAdd30s = () => {
    // We adjust by modifying remaining duration or step elapsed
    // Easiest is subtracting 30 from stepElapsedSec (min 0) or adjusting duration
    currentStep.durationSec += 30;
    audioEngine.speak('Bloc prolongé de 30 secondes', { priority: 'normal', intensity: currentStep.targetIntensity });
  };

  // Complete workout & prepare summary
  const handleCompleteWorkout = () => {
    if (stepRecords.current.length < steps.length && currentStepIndex < steps.length) {
      finalizeCurrentStepRecord();
    }

    audioEngine.speak("Bravo ! Sortie d'entraînement terminée avec succès !", { priority: 'high', intensity: 'facile' });

    const finalGeo = geoTrackerRef.current ? geoTrackerRef.current.getState() : geoState;

    const ride: RideRecord = {
      id: `ride-${Date.now()}`,
      date: new Date().toISOString(),
      planName: plan.nom,
      planGoal: plan.objectif,
      totalDurationSec: totalElapsedSec,
      totalDistanceKm: Number(finalGeo.totalDistanceKm.toFixed(2)),
      avgSpeedKmh: Number(finalGeo.averageSpeedKmh.toFixed(1)) || Number(geoState.currentSpeedKmh.toFixed(1)),
      maxSpeedKmh: Number(finalGeo.maxSpeedKmh.toFixed(1)),
      steps: [...stepRecords.current],
      gpsTrack: finalGeo.trackPoints.map((p) => ({
        lat: p.latitude,
        lng: p.longitude,
        speed: p.speedKmh,
      })),
      coachMessages: [...coachVoiceEvents.current],
    };

    onFinishRide(ride);
  };

  // Periodic AI Coach Commentary Call
  const triggerPeriodicAiCoach = async () => {
    try {
      const comment = await generateLiveMotivation({
        blockName: currentStep.title,
        blockType: currentStep.type,
        targetIntensity: currentStep.targetIntensity,
        timeRemainingInBlockSec: stepRemainingSec,
        totalTimeElapsedSec: totalElapsedSec,
        currentSpeedKmh: geoState.currentSpeedKmh,
        averageSpeedKmh: geoState.averageSpeedKmh || geoState.currentSpeedKmh,
        currentDistanceKm: geoState.totalDistanceKm,
        workoutGoal: plan.objectif,
        stepNumber: currentStepIndex + 1,
        totalSteps: steps.length,
      });

      if (comment) {
        audioEngine.speak(comment, { priority: 'normal', intensity: currentStep.targetIntensity });
        logCoachMessage(comment, 'gemini_coach');
      }
    } catch (e) {
      // Ignore silently without halting local timer
      console.warn('Periodic coach commentary skipped:', e);
    }
  };

  // Mute / Unmute
  const toggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    audioEngine.setMuted(nextMuted);
  };

  // Intensity Styling Helpers
  const getIntensityBadge = (target: IntensityZone) => {
    switch (target) {
      case 'a_fond':
        return {
          bg: sunlightMode ? 'bg-rose-600 text-white' : 'bg-rose-500/20 text-rose-400 border-rose-500/50',
          label: 'À FOND (PMA / Z5)',
          glow: 'shadow-rose-500/20',
          barColor: 'bg-rose-500',
        };
      case 'seuil':
        return {
          bg: sunlightMode ? 'bg-amber-600 text-white' : 'bg-amber-500/20 text-amber-400 border-amber-500/50',
          label: 'AU SEUIL (Z4)',
          glow: 'shadow-amber-500/20',
          barColor: 'bg-amber-500',
        };
      case 'moyen':
        return {
          bg: sunlightMode ? 'bg-cyan-600 text-white' : 'bg-cyan-500/20 text-cyan-400 border-cyan-500/50',
          label: 'TEMPO (Z3)',
          glow: 'shadow-cyan-500/20',
          barColor: 'bg-cyan-500',
        };
      default:
        return {
          bg: sunlightMode ? 'bg-emerald-600 text-white' : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50',
          label: 'FACILE / RÉCUP (Z1-Z2)',
          glow: 'shadow-emerald-500/20',
          barColor: 'bg-emerald-500',
        };
    }
  };

  const intensity = getIntensityBadge(currentStep.targetIntensity);

  // Sunlight high contrast theme classes
  const themeContainer = sunlightMode
    ? 'bg-white text-black'
    : 'bg-black text-white';

  const cardBg = sunlightMode
    ? 'bg-stone-100 border-stone-300 text-black'
    : 'bg-stone-900/90 border-stone-800 text-white';

  const subTextColor = sunlightMode ? 'text-stone-600' : 'text-stone-400';
  const digitColor = sunlightMode ? 'text-black' : 'text-amber-400';

  return (
    <div className={`min-h-screen ${themeContainer} flex flex-col justify-between p-3 sm:p-5 select-none transition-colors duration-200`}>
      {/* Top Header Bar */}
      <header className="flex items-center justify-between gap-2 border-b border-stone-800/40 pb-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-amber-500 text-stone-950 flex items-center justify-center font-black shrink-0">
            <Zap className="w-5 h-5 fill-stone-950" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-black uppercase tracking-wider truncate text-amber-500">
              {plan.nom}
            </div>
            <div className={`text-[11px] ${subTextColor} truncate`}>
              Étape {currentStepIndex + 1} / {steps.length}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* GPS Status Badge */}
          <div
            onClick={() => {
              if (geoTrackerRef.current) {
                const nextSim = !geoTrackerRef.current.getIsSimulating();
                geoTrackerRef.current.enableSimulator(nextSim);
              }
            }}
            title="Cliquez pour basculer Mode GPS / Simulateur"
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border cursor-pointer ${
              geoState.status === 'active'
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                : geoState.status === 'simulated'
                ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/40'
                : 'bg-amber-500/20 text-amber-400 border-amber-500/40'
            }`}
          >
            <Radio className={`w-3 h-3 ${geoState.status === 'active' || geoState.status === 'simulated' ? 'animate-pulse' : ''}`} />
            <span>{geoState.status === 'active' ? 'GPS Fix' : geoState.status === 'simulated' ? 'SIM GPS' : 'Recherche GPS'}</span>
          </div>

          {/* Voice Settings Button */}
          <button
            id="btn-voice-settings"
            onClick={() => setIsVoiceModalOpen(true)}
            className={`p-2 rounded-lg border ${
              sunlightMode
                ? 'bg-stone-200 text-stone-900 border-stone-300'
                : 'bg-stone-900 text-amber-400 border-stone-800 hover:border-amber-500/50'
            } cursor-pointer transition-colors`}
            title="Personnaliser et humaniser la voix du coach"
          >
            <Headphones className="w-4 h-4" />
          </button>

          {/* Voice Mute Toggle */}
          <button
            id="btn-toggle-mute"
            onClick={toggleMute}
            className={`p-2 rounded-lg border ${
              isMuted
                ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                : sunlightMode
                ? 'bg-stone-200 text-stone-900 border-stone-300'
                : 'bg-stone-900 text-stone-200 border-stone-800'
            } cursor-pointer`}
            title={isMuted ? 'Activer le coach vocal' : 'Couper le son'}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          {/* Sunlight Mode Toggle */}
          <button
            id="btn-toggle-sunlight"
            onClick={() => setSunlightMode(!sunlightMode)}
            className={`p-2 rounded-lg border ${
              sunlightMode
                ? 'bg-amber-400 text-stone-950 border-amber-500 font-bold'
                : 'bg-stone-900 text-stone-200 border-stone-800'
            } cursor-pointer`}
            title="Basculer contraste plein soleil"
          >
            {sunlightMode ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Center Big Display */}
      <main className="flex-1 flex flex-col justify-center my-3 gap-4">
        {/* Step Header & Intensity Pill */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <span className={`px-3 py-1 rounded-full text-xs font-black tracking-wider uppercase border ${intensity.bg} shadow-md`}>
              {intensity.label}
            </span>
          </div>

          <h2 className="text-2xl sm:text-4xl font-black uppercase tracking-tight">
            {currentStep.title}
          </h2>

          {/* Progress Bar of Current Step */}
          <div className="max-w-md mx-auto w-full bg-stone-800/80 h-2.5 rounded-full overflow-hidden p-0.5">
            <div
              className={`h-full rounded-full transition-all duration-1000 ${intensity.barColor}`}
              style={{ width: `${stepProgressPercent}%` }}
            />
          </div>
        </div>

        {/* Massive Timer & Speed Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl mx-auto w-full">
          {/* Card 1: Remaining Time in Block */}
          <div className={`p-5 rounded-2xl border ${cardBg} flex flex-col items-center justify-center text-center shadow-lg relative overflow-hidden`}>
            <span className={`text-xs font-bold uppercase tracking-widest ${subTextColor} mb-1 flex items-center gap-1.5`}>
              <Gauge className="w-3.5 h-3.5 text-amber-500" />
              Temps Restant dans le bloc
            </span>
            <div className="text-5xl sm:text-7xl font-black font-mono tracking-tighter my-1">
              {formatTimeDisplay(stepRemainingSec)}
            </div>
            <span className={`text-xs font-semibold ${subTextColor}`}>
              Écoulé : {formatTimeDisplay(stepElapsedSec)} / {formatTimeDisplay(currentStep.durationSec)}
            </span>
          </div>

          {/* Card 2: Instantaneous Speed */}
          <div className={`p-5 rounded-2xl border ${cardBg} flex flex-col items-center justify-center text-center shadow-lg relative overflow-hidden`}>
            <span className={`text-xs font-bold uppercase tracking-widest ${subTextColor} mb-1 flex items-center gap-1.5`}>
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              Vitesse Instantanée
            </span>
            <div className={`text-5xl sm:text-7xl font-black font-mono tracking-tighter my-1 ${digitColor}`}>
              {geoState.currentSpeedKmh.toFixed(1)}
            </div>
            <span className="text-sm font-bold uppercase tracking-widest text-amber-500">
              KM / H
            </span>
          </div>
        </div>

        {/* Global Workout Metrics (Distance, Elapsed Time, Average Speed) */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4 max-w-2xl mx-auto w-full">
          <div className={`p-3.5 rounded-xl border ${cardBg} text-center`}>
            <div className={`text-[10px] sm:text-xs font-bold uppercase ${subTextColor}`}>Distance</div>
            <div className="text-lg sm:text-2xl font-black font-mono mt-0.5">
              {geoState.totalDistanceKm.toFixed(2)} <span className="text-xs font-semibold">km</span>
            </div>
          </div>

          <div className={`p-3.5 rounded-xl border ${cardBg} text-center`}>
            <div className={`text-[10px] sm:text-xs font-bold uppercase ${subTextColor}`}>Chrono Total</div>
            <div className="text-lg sm:text-2xl font-black font-mono mt-0.5">
              {formatTimeHoursDisplay(totalElapsedSec)}
            </div>
          </div>

          <div className={`p-3.5 rounded-xl border ${cardBg} text-center`}>
            <div className={`text-[10px] sm:text-xs font-bold uppercase ${subTextColor}`}>Vitesse Moy.</div>
            <div className="text-lg sm:text-2xl font-black font-mono mt-0.5">
              {(geoState.averageSpeedKmh || geoState.currentSpeedKmh).toFixed(1)} <span className="text-xs font-semibold">km/h</span>
            </div>
          </div>
        </div>

        {/* Coach Vocal Feedback Bubble */}
        {recentCoachMessage && (
          <div className="max-w-2xl mx-auto w-full p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2.5 text-xs text-amber-300">
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5 animate-pulse" />
            <div className="flex-1">
              <span className="font-bold text-amber-400">Coach vocal : </span>
              <span className="italic">"{recentCoachMessage}"</span>
            </div>
          </div>
        )}

        {/* Next Step Preview */}
        {nextStep ? (
          <div className={`max-w-2xl mx-auto w-full p-3 rounded-xl border ${cardBg} flex items-center justify-between text-xs`}>
            <div className="flex items-center gap-2">
              <span className="font-bold uppercase text-amber-500">Suivant :</span>
              <span className="font-semibold">{nextStep.title}</span>
            </div>
            <span className="font-mono font-bold text-stone-400">
              {formatTimeDisplay(nextStep.durationSec)}
            </span>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto w-full p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-center text-xs font-bold text-emerald-400">
            🏁 Dernier bloc de la séance !
          </div>
        )}
      </main>

      {/* Bottom Cycling Glove-Friendly Control Bar */}
      <footer className="space-y-3 pt-2">
        <div className="grid grid-cols-4 gap-2 max-w-2xl mx-auto w-full">
          {/* Pause / Resume */}
          <button
            id="btn-pause-resume"
            onClick={() => setIsPaused(!isPaused)}
            className={`min-h-[54px] rounded-xl font-bold flex flex-col items-center justify-center gap-1 transition-transform active:scale-95 cursor-pointer ${
              isPaused
                ? 'bg-emerald-500 hover:bg-emerald-400 text-stone-950'
                : 'bg-stone-800 hover:bg-stone-700 text-white border border-stone-700'
            }`}
          >
            {isPaused ? <Play className="w-5 h-5 fill-current" /> : <Pause className="w-5 h-5" />}
            <span className="text-[10px] uppercase font-bold">{isPaused ? 'Reprendre' : 'Pause'}</span>
          </button>

          {/* +30 Sec */}
          <button
            id="btn-add-30s"
            onClick={handleAdd30s}
            className="min-h-[54px] rounded-xl bg-stone-800 hover:bg-stone-700 border border-stone-700 text-stone-200 font-bold flex flex-col items-center justify-center gap-1 transition-transform active:scale-95 cursor-pointer"
          >
            <PlusCircle className="w-5 h-5 text-amber-400" />
            <span className="text-[10px] uppercase font-bold">+ 30 sec</span>
          </button>

          {/* Skip to Next Block */}
          <button
            id="btn-skip-step"
            onClick={handleManualSkip}
            className="min-h-[54px] rounded-xl bg-stone-800 hover:bg-stone-700 border border-stone-700 text-stone-200 font-bold flex flex-col items-center justify-center gap-1 transition-transform active:scale-95 cursor-pointer"
          >
            <SkipForward className="w-5 h-5 text-cyan-400" />
            <span className="text-[10px] uppercase font-bold">Bloc suivant</span>
          </button>

          {/* Stop / Finish */}
          <button
            id="btn-finish-ride"
            onClick={handleCompleteWorkout}
            className="min-h-[54px] rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold flex flex-col items-center justify-center gap-1 transition-transform active:scale-95 cursor-pointer shadow-lg shadow-rose-600/30"
          >
            <Square className="w-5 h-5 fill-current" />
            <span className="text-[10px] uppercase font-bold">Terminer</span>
          </button>
        </div>

        {isPaused && (
          <div className="p-2 text-center text-xs font-bold text-amber-400 bg-amber-500/10 rounded-lg border border-amber-500/30 animate-pulse">
            ⏸️ Séance en pause — le chronomètre et l'enregistrement sont suspendus.
          </div>
        )}
      </footer>

      {/* Voice Settings & Humanization Modal */}
      <VoiceSettingsModal
        isOpen={isVoiceModalOpen}
        onClose={() => setIsVoiceModalOpen(false)}
      />
    </div>
  );
};
