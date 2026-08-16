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
  Compass,
  Calendar,
  MessageSquare,
  Activity,
  History,
  Headphones,
  Sliders,
  Play,
  MapPin,
  CheckCircle,
  ShieldAlert,
  UserCheck,
  KeyRound,
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
  const [activeProgram, setActiveProgram] = useState<TrainingProgram | null>(getStoredActiveProgram());

  // Modals
  const [isOnboardingOpen, setIsOnboardingOpen] = useState<boolean>(!hasCompletedOnboarding());
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState<boolean>(false);
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState<boolean>(false);
  const [isApiKeyConfigured, setIsApiKeyConfigured] = useState<boolean>(hasApiKey());

  // GPS Availability Status
  const [isGpsAvailable, setIsGpsAvailable] = useState<boolean>(true);
  const [gpsStatusText, setGpsStatusText] = useState<string | null>(null);

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
    audioEngine.unlockAudio();
    setActivePlan(plan);
    setIsLiveRideActive(true);
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
  };

  const handleCancelRide = () => {
    setIsLiveRideActive(false);
  };

  // If in live ride, show full screen rider interface
  if (isLiveRideActive) {
    return (
      <LiveRideScreen
        plan={activePlan}
        onFinishRide={handleFinishRide}
        onCancelRide={handleCancelRide}
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
    <div className="min-h-screen bg-stone-950 text-white flex flex-col justify-between selection:bg-amber-500 selection:text-stone-950 font-sans">
      {/* Top Main Navigation Header */}
      <header className="sticky top-0 z-40 bg-stone-950/90 backdrop-blur-md border-b border-stone-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16 sm:h-18 gap-3">
            {/* Logo and App Title */}
            <div
              onClick={() => setActiveTab('workouts')}
              className="flex items-center gap-3 cursor-pointer select-none shrink-0"
            >
              <div className="w-10 h-10 rounded-2xl bg-amber-500 text-stone-950 flex items-center justify-center font-black shadow-lg shadow-amber-500/20">
                <Zap className="w-5 h-5 fill-stone-950" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-base sm:text-lg font-black tracking-tight text-white">
                    CycloCoach
                  </span>
                  <span className="text-[10px] font-black uppercase px-2 py-0.2 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                    Pro
                  </span>
                </div>
                <div className="text-[10.5px] text-stone-400 hidden sm:block">
                  Coaching vocal & parcours GPS sur-mesure
                </div>
              </div>
            </div>

            {/* Desktop Navigation Tabs */}
            <nav className="hidden md:flex items-center gap-1 bg-stone-900/80 p-1.5 rounded-2xl border border-stone-800">
              {[
                { id: 'workouts', label: 'Séances', icon: Zap },
                { id: 'routes', label: 'Itinéraires & GPS', icon: Compass },
                { id: 'program', label: 'Programme', icon: Calendar },
                { id: 'coach', label: 'Coach DS', icon: MessageSquare },
                { id: 'profile', label: 'Profil & Zones', icon: Activity },
                { id: 'history', label: 'Historique', icon: History },
              ].map((tab) => {
                const isSelected = activeTab === tab.id;
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    id={`nav-tab-${tab.id}`}
                    onClick={() => setActiveTab(tab.id as MainNavTab)}
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
                className={`p-2.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${
                  isApiKeyConfigured
                    ? 'bg-stone-900 hover:bg-stone-800 border-stone-800 hover:border-stone-700 text-stone-400'
                    : 'bg-amber-500/15 hover:bg-amber-500/25 border-amber-500/40 text-amber-400'
                }`}
                title="Clé API Gemini (fonctions IA)"
              >
                <KeyRound className="w-4 h-4" />
              </button>

              <button
                id="btn-header-voice-modal"
                onClick={() => setIsVoiceModalOpen(true)}
                className="p-2.5 sm:px-3 sm:py-2 rounded-xl bg-stone-900 hover:bg-stone-800 border border-stone-800 hover:border-stone-700 text-xs font-bold text-amber-400 flex items-center gap-1.5 cursor-pointer transition-colors"
                title="Ambiance oreillette & voix du coach"
              >
                <Headphones className="w-4 h-4" />
                <span className="hidden sm:inline">Oreillette Radio</span>
              </button>

              <button
                onClick={() => setActiveTab('profile')}
                className="p-1.5 sm:px-3 sm:py-1.5 rounded-xl bg-stone-900 hover:bg-stone-850 border border-stone-800 text-left flex items-center gap-2 cursor-pointer transition-colors"
              >
                <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 font-black text-xs flex items-center justify-center">
                  {cyclistProfile.name.charAt(0).toUpperCase()}
                </div>
                <div className="hidden sm:block text-left">
                  <div className="text-[11px] font-bold text-white leading-tight">
                    {cyclistProfile.name}
                  </div>
                  <div className="text-[9px] font-mono text-stone-400">
                    {cyclistProfile.ftpWatts || 240} W • {cyclistProfile.homeCity || 'GPS'}
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Mobile Tab Bar (Scrollable on small screens) */}
          <div className="flex md:hidden items-center gap-1 py-2 overflow-x-auto no-scrollbar border-t border-stone-850">
            {[
              { id: 'workouts', label: 'Séances', icon: Zap },
              { id: 'routes', label: 'Itinéraires', icon: Compass },
              { id: 'program', label: 'Programme', icon: Calendar },
              { id: 'coach', label: 'Coach DS', icon: MessageSquare },
              { id: 'profile', label: 'Profil', icon: Activity },
              { id: 'history', label: 'Historique', icon: History },
            ].map((tab) => {
              const isSelected = activeTab === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as MainNavTab)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 shrink-0 cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-amber-500 text-stone-950'
                      : 'bg-stone-900 text-stone-400'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Main Body Content Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 w-full flex-1">
        {/* API Key Notice: IA features disabled until a Gemini key is provided */}
        {!isApiKeyConfigured && (
          <div className="mb-5 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-wrap items-center gap-2.5 text-amber-300 text-xs">
            <KeyRound className="w-4 h-4 shrink-0 text-amber-400" />
            <span className="flex-1 min-w-[200px]">
              Aucune clé Gemini enregistrée : le coach IA, la génération de séances et la voix studio
              sont désactivés. Les séances préenregistrées, le GPS et la voix du navigateur restent
              disponibles.
            </span>
            <button
              onClick={() => setIsApiKeyModalOpen(true)}
              className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-black text-[11px] uppercase tracking-wider cursor-pointer transition-colors"
            >
              Ajouter ma clé
            </button>
          </div>
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

      {/* Footer */}
      <footer className="border-t border-stone-800 bg-stone-950 py-4 text-center text-xs text-stone-500">
        <p>CycloCoach Pro • Coaching Vocal Audio & Itinéraires Réels OpenStreetMap</p>
      </footer>

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
