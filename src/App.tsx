/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { WorkoutPlan, RideRecord, CyclistProfile, TrainingProgram, CyclingRoute } from './types';
import { PRESET_WORKOUTS } from './data/presetWorkouts';
import { WorkoutSelector } from './components/WorkoutSelector';
import { RoutesExplorerScreen } from './components/RoutesExplorerScreen';
import { ProfileAndZonesScreen } from './components/ProfileAndZonesScreen';
import { LiveRideScreen } from './components/LiveRideScreen';
import { SummaryScreen } from './components/SummaryScreen';
import { HistoryScreen } from './components/HistoryScreen';
import { VirtualCoachChat } from './components/VirtualCoachChat';
import { ProgramDashboard } from './components/ProgramDashboard';
import { VoiceSettingsModal } from './components/VoiceSettingsModal';
import { OnboardingModal } from './components/OnboardingModal';
import { ApiKeyModal } from './components/ApiKeyModal';
import { BottomNav, NAV_ITEMS } from './components/BottomNav';
import { RidePreparationModal } from './components/RidePreparationModal';
import {
  clearActiveRide,
  formatInterruptionDelay,
  getResumableRide,
  type ActiveRideSession,
} from './utils/rideSession';
import { PwaStatusBar, PwaInstallPrompt } from './components/PwaStatusBar';
import { audioEngine } from './utils/audioEngine';
import { hasApiKey } from './utils/apiKey';
import {
  getStoredProfile,
  saveStoredProfile,
  getStoredActiveProgram,
  saveStoredActiveProgram,
  hasCompletedOnboarding,
  setCompletedOnboarding,
} from './utils/profileStorage';
import {
  Zap,
  Calendar,
  MessageSquare,
  Headphones,
  ShieldAlert,
  KeyRound,
  RotateCcw,
} from 'lucide-react';

export type MainNavTab = 'workouts' | 'routes' | 'program' | 'coach' | 'profile' | 'history';

export default function App() {
  // Navigation tab state
  const [activeTab, setActiveTab] = useState<MainNavTab>('workouts');
  const [isLiveRideActive, setIsLiveRideActive] = useState<boolean>(false);
  const [lastCompletedRide, setLastCompletedRide] = useState<RideRecord | null>(null);

  // Active workout & route selection
  const [activePlan, setActivePlan] = useState<WorkoutPlan>(PRESET_WORKOUTS[0]);

  // Profile and Program State
  const [cyclistProfile, setCyclistProfile] = useState<CyclistProfile>(getStoredProfile());
  const greetingHour = new Date().getHours();
  const greetingLabel =
    greetingHour < 12 ? 'Bonjour' : greetingHour < 18 ? 'Bon après-midi' : 'Bonsoir';
  const [activeProgram, setActiveProgram] = useState<TrainingProgram | null>(getStoredActiveProgram());

  // Modals
  const [isOnboardingOpen, setIsOnboardingOpen] = useState<boolean>(!hasCompletedOnboarding());
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState<boolean>(false);
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState<boolean>(false);
  const [isApiKeyConfigured, setIsApiKeyConfigured] = useState<boolean>(hasApiKey());
  // Séance en attente de préchargement vocal avant le départ.
  const [planPendingStart, setPlanPendingStart] = useState<WorkoutPlan | null>(null);
  // Séance interrompue détectée au démarrage (app fermée en pleine sortie).
  const [resumableRide, setResumableRide] = useState<ActiveRideSession | null>(getResumableRide());
  // Séance effectivement reprise, transmise à l'écran de course.
  const [resumingRide, setResumingRide] = useState<ActiveRideSession | null>(null);

  // GPS Availability Status
  const [isGpsAvailable, setIsGpsAvailable] = useState<boolean>(true);
  const [gpsStatusText, setGpsStatusText] = useState<string | null>(null);

  // Raccourcis du manifeste PWA (?tab=coach) : appui long sur l'icône de l'app.
  useEffect(() => {
    const requestedTab = new URLSearchParams(window.location.search).get('tab');
    const isKnownTab = NAV_ITEMS.some((item) => item.id === requestedTab);
    if (isKnownTab) {
      setActiveTab(requestedTab as MainNavTab);
      // Nettoie l'URL pour que l'onglet ne soit pas réimposé aux rechargements.
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  // Check Geolocation permission on startup
  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'permissions' in navigator && (navigator as any).permissions?.query) {
      (navigator as any).permissions
        .query({ name: 'geolocation' })
        .then((permissionStatus: any) => {
          if (permissionStatus.state === 'denied') {
            setIsGpsAvailable(false);
            setGpsStatusText('La géolocalisation est désactivée dans votre navigateur.');
          } else {
            setIsGpsAvailable(true);
            setGpsStatusText(null);
          }
          permissionStatus.onchange = () => {
            if (permissionStatus.state === 'denied') {
              setIsGpsAvailable(false);
              setGpsStatusText('La géolocalisation est refusée.');
            } else {
              setIsGpsAvailable(true);
              setGpsStatusText(null);
            }
          };
        })
        .catch(() => {});
    }
  }, []);

  const handleSaveProfile = (newProfile: CyclistProfile) => {
    setCyclistProfile(newProfile);
    saveStoredProfile(newProfile);
  };

  const handleCompleteOnboarding = (calibratedProfile: CyclistProfile) => {
    setCyclistProfile(calibratedProfile);
    saveStoredProfile(calibratedProfile);
    setCompletedOnboarding(true);
    setIsOnboardingOpen(false);
  };

  const handleProgramGenerated = (program: TrainingProgram) => {
    setActiveProgram(program);
    saveStoredActiveProgram(program);
  };

  const handleStartWorkout = (plan: WorkoutPlan) => {
    // Doit rester dans le geste utilisateur : iOS n'autorise le déverrouillage
    // audio que là.
    audioEngine.unlockAudio();
    setActivePlan(plan);
    // Préchargement des consignes avant le départ, pour supprimer la latence.
    setPlanPendingStart(plan);
  };

  const handlePreparationReady = () => {
    setPlanPendingStart(null);
    setIsLiveRideActive(true);
  };

  const handleResumeRide = () => {
    if (!resumableRide) return;
    audioEngine.unlockAudio();
    setActivePlan(resumableRide.plan);
    setResumingRide(resumableRide);
    setResumableRide(null);
    // Reprise immédiate : l'audio de cette séance est déjà en cache.
    setIsLiveRideActive(true);
  };

  const handleDiscardResumable = () => {
    clearActiveRide();
    setResumableRide(null);
  };

  const handleSelectRouteForRide = (route: CyclingRoute, workoutPlan?: WorkoutPlan) => {
    const planToUse = workoutPlan || activePlan;
    const enrichedPlan: WorkoutPlan = {
      ...planToUse,
      routeSuggestion: route,
    };
    handleStartWorkout(enrichedPlan);
  };

  const handleFinishRide = (ride: RideRecord) => {
    setLastCompletedRide(ride);
    setIsLiveRideActive(false);
    setResumingRide(null);
  };

  const handleCancelRide = () => {
    setIsLiveRideActive(false);
    setResumingRide(null);
    // Abandon volontaire : on n'en proposera pas la reprise.
    clearActiveRide();
  };

  // If in live ride, show full screen rider interface
  if (isLiveRideActive) {
    return (
      <LiveRideScreen
        plan={activePlan}
        onFinishRide={handleFinishRide}
        onCancelRide={handleCancelRide}
        resumeFrom={resumingRide}
      />
    );
  }

  // If viewing post-ride summary
  if (lastCompletedRide) {
    return (
      <div className="min-h-screen bg-stone-950 text-white font-sans">
        <SummaryScreen
          ride={lastCompletedRide}
          cyclistProfile={cyclistProfile}
          onNewWorkout={() => {
            setLastCompletedRide(null);
            setActiveTab('workouts');
          }}
          onOpenHistory={() => {
            setLastCompletedRide(null);
            setActiveTab('history');
          }}
          onOpenCoachChat={() => {
            setLastCompletedRide(null);
            setActiveTab('coach');
          }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-950 text-white flex flex-col selection:bg-amber-500 selection:text-stone-950 font-sans">
      {/* Texture de fond : la vue aérienne de la route, la seule image sans
          variante puisque personne n'y est reconnaissable. Très effacée et
          fixe, elle donne de la matière au fond sans concurrencer le contenu.
          `pointer-events-none` la laisse traversable par les touchers, et le
          voile par-dessus garantit le contraste du texte quelle que soit la
          zone de l'image qui tombe derrière. */}
      <div className="fixed inset-0 z-0 pointer-events-none" aria-hidden="true">
        <img
          src={`${import.meta.env.BASE_URL}image/image-6.webp`}
          alt=""
          className="w-full h-full object-cover opacity-[0.09]"
        />
        <div className="absolute inset-0 bg-stone-950/45" />
      </div>

      {/* Zone haute collante : bandeaux PWA puis en-tête.
          Un seul conteneur collant porte la marge de sécurité de l'encoche —
          deux éléments en sticky top-0 se superposeraient, et un bandeau sans
          marge haute passerait sous la barre d'état iOS. */}
      <div className="sticky top-0 z-40 bg-stone-950 pt-safe px-safe">
        <PwaStatusBar />

        {/* Top Main Navigation Header */}
        <header className="bg-stone-950/90 backdrop-blur-md border-b border-stone-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14 sm:h-18 gap-3">
            {/* Identité : à qui on parle, pas comment l'app s'appelle. Le nom
                du produit n'apprend rien à quelqu'un qui l'a déjà installée. */}
            <button
              onClick={() => setActiveTab('profile')}
              className="flex items-center gap-2.5 cursor-pointer select-none shrink-0 min-w-0 text-left"
            >
              <div className="w-10 h-10 rounded-2xl bg-amber-500 text-stone-950 flex items-center justify-center font-black text-base shrink-0">
                {(cyclistProfile.name || 'C').charAt(0).toUpperCase()}
              </div>
              {/* Le prénom n'apparaît qu'ici sur les écrans qui n'ont pas de
                  titre d'accueil ; sur « Séances » c'est le grand titre qui
                  porte la salutation, et le répéter ferait doublon. */}
              {activeTab !== 'workouts' && (
                <div className="min-w-0">
                  <div className="text-[11px] text-stone-400 leading-tight">{greetingLabel}</div>
                  <div className="text-[15px] font-black tracking-tight text-white truncate leading-tight">
                    {(cyclistProfile.name || 'Cycliste').split(' ')[0]}
                  </div>
                </div>
              )}
            </button>

            {/* Desktop Navigation Tabs */}
            <nav className="hidden md:flex items-center gap-1 bg-stone-900/80 p-1.5 rounded-2xl border border-stone-800">
              {NAV_ITEMS.map((tab) => {
                const isSelected = activeTab === tab.id;
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    id={`nav-tab-${tab.id}`}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-amber-500 text-stone-950 shadow-md shadow-amber-500/20'
                        : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/60'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${isSelected ? 'fill-stone-950' : ''}`} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </nav>

            {/* Quick Profile & Voice Settings Shortcut */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                id="btn-header-api-key"
                onClick={() => setIsApiKeyModalOpen(true)}
                className={`w-10 h-10 rounded-2xl flex items-center justify-center cursor-pointer transition-colors ${
                  isApiKeyConfigured
                    ? 'bg-stone-900 hover:bg-stone-800 text-stone-400'
                    : 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-400'
                }`}
                title="Clé API Gemini (fonctions IA)"
                aria-label="Clé API Gemini"
              >
                <KeyRound className="w-[1.15rem] h-[1.15rem]" />
              </button>

              <button
                id="btn-header-voice-modal"
                onClick={() => setIsVoiceModalOpen(true)}
                className="w-10 h-10 rounded-2xl bg-stone-900 hover:bg-stone-800 text-stone-400 flex items-center justify-center cursor-pointer transition-colors"
                title="Ambiance oreillette & voix du coach"
                aria-label="Voix du coach"
              >
                <Headphones className="w-[1.15rem] h-[1.15rem]" />
              </button>
            </div>
          </div>

        </div>
        </header>
      </div>

      {/* Main Body Content Container */}
      {/* `relative z-10` : sans position, le contenu passerait DERRIÈRE la
          texture, qui est positionnée. */}
      <main className="relative z-10 max-w-7xl mx-auto px-page py-5 sm:py-8 w-full flex-1 pb-nav">
        {/* Séance interrompue : proposition de reprise */}
        {resumableRide && (
          <div className="mb-5 p-4 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 space-y-3 animate-fade-up">
            <div className="flex items-start gap-2.5">
              <RotateCcw className="w-4 h-4 shrink-0 text-cyan-400 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-black text-cyan-300">Séance interrompue</div>
                <p className="text-[11px] text-stone-300 mt-1 leading-relaxed">
                  «&nbsp;{resumableRide.plan.nom}&nbsp;» s'est arrêtée{' '}
                  {formatInterruptionDelay(resumableRide)} au bloc{' '}
                  {resumableRide.currentStepIndex + 1}, après{' '}
                  {Math.floor(resumableRide.totalElapsedSec / 60)} min d'effort.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleResumeRide}
                className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-stone-950 font-black text-[11px] uppercase tracking-wider cursor-pointer transition-colors"
              >
                Reprendre
              </button>
              <button
                onClick={handleDiscardResumable}
                className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 font-bold text-[11px] cursor-pointer transition-colors"
              >
                Abandonner
              </button>
            </div>
          </div>
        )}

        {/* API Key Notice: IA features disabled until a Gemini key is provided */}
        {!isApiKeyConfigured && (
          /* Une ligne, pas un pavé : l'app reste utilisable sans clé, l'avis ne
             doit donc pas occuper le tiers de l'écran d'accueil. */
          <button
            onClick={() => setIsApiKeyModalOpen(true)}
            className="w-full mb-5 px-3.5 py-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-2.5 text-left cursor-pointer hover:bg-amber-500/15 transition-colors"
          >
            <KeyRound className="w-4 h-4 shrink-0 text-amber-400" />
            <span className="flex-1 min-w-0 text-[12px] text-amber-300 truncate">
              Fonctions IA désactivées — aucune clé enregistrée
            </span>
            <span className="text-[11px] font-black uppercase tracking-wider text-amber-400 shrink-0">
              Ajouter
            </span>
          </button>
        )}

        {/* GPS Notice Warning if denied */}
        {gpsStatusText && (
          <div className="mb-5 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-2.5 text-amber-300 text-xs">
            <ShieldAlert className="w-4 h-4 shrink-0 text-amber-400" />
            <span>{gpsStatusText} (Le mode simulateur d'allure et le guidage vocal restent 100% actifs).</span>
          </div>
        )}

        {/* TAB 1: Workouts Hub (Clean, uncluttered) */}
        {activeTab === 'workouts' && (
          <WorkoutSelector
            onStartWorkout={handleStartWorkout}
            onOpenCoachChat={() => setActiveTab('coach')}
            onOpenRoutesTab={() => setActiveTab('routes')}
            onOpenProgramTab={() => setActiveTab('program')}
            onOpenProfileTab={() => setActiveTab('profile')}
            cyclistProfile={cyclistProfile}
            activeProgram={activeProgram}
            selectedPlan={activePlan}
            onSelectPlan={(p) => setActivePlan(p)}
          />
        )}

        {/* TAB 2: Dedicated Routes & GPS Explorer (Real OpenStreetMap & GPX) */}
        {activeTab === 'routes' && (
          <RoutesExplorerScreen
            cyclistProfile={cyclistProfile}
            activePlan={activePlan}
            onSelectRouteForRide={handleSelectRouteForRide}
            onUpdateProfileCity={(cityName, coordinates) => {
              handleSaveProfile({
                ...cyclistProfile,
                homeCity: cityName,
                homeCoordinates: coordinates,
              });
            }}
          />
        )}

        {/* TAB 3: Training Plan & Periodized Dashboard */}
        {activeTab === 'program' && (
          <div className="space-y-4">
            {activeProgram ? (
              <ProgramDashboard
                program={activeProgram}
                onSelectWorkout={handleStartWorkout}
                onOpenCoachChat={() => setActiveTab('coach')}
              />
            ) : (
              <div className="p-8 rounded-3xl bg-stone-900 border border-stone-800 text-center space-y-4 max-w-2xl mx-auto my-6 shadow-2xl">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
                  <Calendar className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">
                    Aucun programme d'entraînement actif
                  </h3>
                  <p className="text-xs text-stone-400 mt-1">
                    Générez un plan structuré sur plusieurs semaines avec le coach Jean-Marc selon votre objectif de saison.
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab('coach')}
                  className="px-6 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-black text-xs uppercase tracking-wider cursor-pointer transition-all shadow-lg shadow-amber-500/20 inline-flex items-center gap-2"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>Créer mon programme avec le Coach</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: Sports Director Chat & Tactical Briefing */}
        {activeTab === 'coach' && (
          <div className="space-y-4">
            <VirtualCoachChat
              cyclistProfile={cyclistProfile}
              currentProgram={activeProgram}
              onSelectGeneratedPlan={(plan) => {
                setActivePlan(plan);
                setActiveTab('workouts');
              }}
              onProgramGenerated={(prog) => {
                handleProgramGenerated(prog);
                setActiveTab('program');
              }}
              onOpenProfileSettings={() => setActiveTab('profile')}
            />
          </div>
        )}

        {/* TAB 5: Profile & Zones Calibration */}
        {activeTab === 'profile' && (
          <ProfileAndZonesScreen
            profile={cyclistProfile}
            onSaveProfile={handleSaveProfile}
            onOpenCalibrationWizard={() => setIsOnboardingOpen(true)}
          />
        )}

        {/* TAB 6: Rides History */}
        {activeTab === 'history' && (
          <HistoryScreen onBack={() => setActiveTab('workouts')} />
        )}
      </main>

      {/* Footer (bureau : la barre basse occupe cette place sur mobile) */}
      <footer className="hidden md:block border-t border-stone-800 bg-stone-950 py-4 text-center text-xs text-stone-500">
        <p>CycloCoach Pro • Coaching Vocal Audio & Itinéraires Réels OpenStreetMap</p>
      </footer>

      {/* Préchargement vocal avant le départ */}
      {planPendingStart && (
        <RidePreparationModal
          isOpen
          plan={planPendingStart}
          onReady={handlePreparationReady}
          onCancel={() => setPlanPendingStart(null)}
        />
      )}

      {/* Barre de navigation basse (mobile) */}
      <BottomNav
        activeTab={activeTab}
        onSelect={setActiveTab}
        onPrimaryAction={() => handleStartWorkout(activePlan)}
      />

      {/* Invite d'installation : hors de l'en-tête collant pour passer
          au-dessus de la barre de navigation basse. */}
      <PwaInstallPrompt />

      {/* Calibration / Onboarding Wizard Modal */}
      <OnboardingModal
        isOpen={isOnboardingOpen}
        initialProfile={cyclistProfile}
        onComplete={handleCompleteOnboarding}
        onClose={() => setIsOnboardingOpen(false)}
      />

      {/* Voice & Earpiece Settings Modal */}
      <VoiceSettingsModal
        isOpen={isVoiceModalOpen}
        onClose={() => setIsVoiceModalOpen(false)}
      />

      {/* Gemini API Key Modal (clé stockée localement sur l'appareil) */}
      <ApiKeyModal
        isOpen={isApiKeyModalOpen}
        onClose={() => {
          setIsApiKeyModalOpen(false);
          setIsApiKeyConfigured(hasApiKey());
        }}
        onSaved={() => setIsApiKeyConfigured(hasApiKey())}
      />
    </div>
  );
}
