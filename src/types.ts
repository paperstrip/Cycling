export type IntensityZone = 'facile' | 'moyen' | 'seuil' | 'a_fond';
export type BlockType = 'echauffement' | 'effort' | 'recup' | 'retour_calme';
export type CyclistLevel = 'debutant' | 'intermediaire' | 'avance' | 'competiteur_pro';
export type PrimaryGoalType = 'perte_poids' | 'endurance_cyclo' | 'puissance_ftp' | 'grimpeur_col' | 'sprint_crit' | 'reprise';

export interface PowerZones {
  z1: [number, number]; // Récupération (<55% FTP)
  z2: [number, number]; // Endurance fondamentale (56-75% FTP)
  z3: [number, number]; // Tempo (76-90% FTP)
  z4: [number, number]; // Seuil lactique (91-105% FTP)
  z5: [number, number]; // VO2 Max (106-120% FTP)
  z6: [number, number]; // Capacité anaérobie (121-150% FTP)
  z7: [number, number]; // Neuromusculaire / Sprint (>150% FTP)
}

export interface HeartRateZones {
  z1: [number, number]; // <60% FCmax
  z2: [number, number]; // 60-70% FCmax
  z3: [number, number]; // 70-80% FCmax
  z4: [number, number]; // 80-90% FCmax
  z5: [number, number]; // 90-100% FCmax
}

export interface CyclistProfile {
  name: string;
  level: CyclistLevel;
  primaryGoal: PrimaryGoalType;
  goalDescription: string;
  targetEventDate?: string;
  ftpWatts?: number;
  weightKg?: number;
  maxHeartRate?: number;
  restingHeartRate?: number;
  weeklyHoursAvailable?: number;
  preferredTerrain?: 'plat' | 'vallonne' | 'montagne' | 'mixte';
  bikeType?: 'route' | 'gravel' | 'clm' | 'polyvalent';
  homeCity?: string;
  homeCoordinates?: { lat: number; lng: number };
  isCalibrated?: boolean;
  powerZones?: PowerZones;
  heartRateZones?: HeartRateZones;
  strengths?: string;
  weaknesses?: string;
  /**
   * Qui l'on voit sur les photos de l'app.
   *
   * Par défaut « varie » : les deux séries alternent. Ce n'est pas une case à
   * cocher sur l'identité de la personne — on ne lui demande pas de se ranger
   * dans une catégorie pour avoir des images — mais un réglage d'affichage,
   * qu'elle peut fixer si elle préfère ne voir qu'une seule série.
   */
  illustrationPreference?: IllustrationPreference;
}

export type IllustrationPreference = 'varie' | 'femme' | 'homme';

export interface RouteWaypoint {
  name: string;
  lat?: number;
  lng?: number;
  elevationM: number;
  distanceFromStartKm: number;
  instruction: string;
  segmentType: 'plat' | 'faux_plat_montant' | 'cote_raide' | 'descente' | 'ligne_droite_roulante';
  associatedBlockIndex?: number;
  pacingAdvice?: string;
}

export interface CyclingRoute {
  id: string;
  name: string;
  description: string;
  startLocationName?: string;
  originCoords?: { lat: number; lng: number };
  estimatedDistanceKm: number;
  totalAscentM: number;
  terrainType: 'plat' | 'vallonne' | 'montagne' | 'urbain_et_campagne';
  recommendedBikeType: 'route' | 'gravel' | 'clm' | 'polyvalent';
  idealForWorkout: string;
  waypoints: RouteWaypoint[];
  gpxPoints?: { lat: number; lng: number; ele: number }[];
  pacingStrategy: string;
  safetyTips: string[];
  isCustom?: boolean;
  surface?: 'asphalte_parfait' | 'mixte_gravel' | 'petites_routes_calmes';
  /**
   * D'où vient le tracé. `estimation` signale une boucle géométrique, non
   * calée sur des routes : l'écran doit le dire au lieu de la présenter comme
   * un itinéraire praticable.
   */
  routeSource?: 'roads' | 'estimation';
  /** `estimated` = dénivelé calculé par modèle, pas mesuré. */
  elevationSource?: 'measured' | 'estimated' | 'unknown';
}

export interface WorkoutBlock {
  type: BlockType;
  duree_sec: number;
  cible: IntensityZone;
  repetitions?: number;
  recup_sec?: number;
  recup_cible?: IntensityZone;
  consigne_vocale?: string;
  cadence_recommandee?: string;
  focus_technique?: string;
}

export interface WorkoutPlan {
  id?: string;
  nom: string;
  description: string;
  objectif: string;
  blocs: WorkoutBlock[];
  coachTips?: string[];
  routeSuggestion?: CyclingRoute;
  difficultyRating?: 1 | 2 | 3 | 4 | 5;
  targetTSS?: number;
}

export interface ScheduledWorkout {
  id: string;
  dayNumber: number; // 1 to 7 or 1 to 28
  dayOfWeek: string;
  title: string;
  type: 'velo' | 'recup_active' | 'repos' | 'renfo_core';
  targetDurationMinutes: number;
  workoutPlan?: WorkoutPlan;
  notes: string;
  isCompleted?: boolean;
}

export interface TrainingProgram {
  id: string;
  title: string;
  overview: string;
  durationWeeks: number;
  targetGoal: string;
  cyclistLevel: CyclistLevel;
  weeklyVolumeHours: number;
  pedagogicalAdvice: string[];
  workouts: ScheduledWorkout[];
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  sender: 'coach' | 'cyclist';
  text: string;
  timestamp: number;
  /** Message d'erreur système, à ne pas confondre avec une réponse du coach. */
  isError?: boolean;
  suggestedAction?: {
    type:
      | 'generate_plan'
      | 'generate_program'
      | 'suggest_route'
      | 'start_workout'
      /** Actions locales : simple navigation, aucun appel à l'IA. */
      | 'open_workout'
      | 'open_routes';
    payload?: any;
    label: string;
  };
}

export interface ExecutionStep {
  stepIndex: number;
  title: string;
  type: BlockType;
  durationSec: number;
  targetIntensity: IntensityZone;
  vocalPrompt: string;
  cadencePrompt?: string;
  focusTechnique?: string;
  repetitionInfo?: {
    current: number;
    total: number;
  };
}

export interface GPSPoint {
  timestamp: number;
  latitude: number;
  longitude: number;
  speedKmh: number;
  accuracy: number;
  altitude?: number | null;
}

export interface StepExecutionRecord {
  stepIndex: number;
  title: string;
  type: BlockType;
  targetIntensity: IntensityZone;
  plannedDurationSec: number;
  actualDurationSec: number;
  startTimestamp: number;
  endTimestamp: number;
  avgSpeedKmh: number;
  maxSpeedKmh: number;
  distanceKm: number;
}

export interface CoachVoiceEvent {
  id: string;
  timeSec: number;
  timestamp: number;
  text: string;
  source: 'plan' | 'gemini_coach' | 'countdown';
}

export interface RideRecord {
  id: string;
  date: string;
  planName: string;
  planGoal: string;
  totalDurationSec: number;
  totalDistanceKm: number;
  avgSpeedKmh: number;
  maxSpeedKmh: number;
  steps: StepExecutionRecord[];
  gpsTrack: { lat: number; lng: number; speed: number }[];
  coachMessages: CoachVoiceEvent[];
  routeTaken?: CyclingRoute;
  coachDebrief?: string;
}

export type CoachPersona = 'jean_marc_dynamique' | 'marc_pose' | 'emilie_punchy' | 'radio_tour';
export type VoiceEngineMode =
  | 'gemini_neural' // Gemini TTS : voix la plus expressive, soumise à un quota
  | 'kokoro_local' // Kokoro exécuté dans le navigateur : gratuit, illimité, hors connexion
  | 'browser_speech'; // Synthèse du système : instantanée, sans téléchargement
export type RadioAmbienceStyle = 'ds_car' | 'radio_tour_official' | 'walkie_talkie_intense' | 'modern_earpiece' | 'off';

export interface VoiceSettings {
  engineMode: VoiceEngineMode; // 'gemini_neural' (Studio HD réaliste) or 'browser_speech' (synthèse locale)
  voiceURI?: string;
  persona: CoachPersona;
  geminiVoiceName?: 'Fenrir' | 'Kore' | 'Puck' | 'Charon' | 'Zephyr';
  speedRate: number; // 0.85 to 1.3, default 1.05
  pitch: number; // 0.8 to 1.2, default 1.0
  volume: number; // 0.1 to 1.0, default 1.0
  earpieceBeep: boolean; // Authentic radio chirp before coach talks
  radioAmbience: RadioAmbienceStyle; // 'ds_car' | 'radio_tour_official' | 'walkie_talkie_intense' | 'modern_earpiece' | 'off'
  radioStaticVolume: number; // 0.0 to 1.0, volume of the continuous radio carrier & cockpit hum
  radioDspFilter: boolean; // Apply bandpass HF filter & walkie-talkie micro resonance
  naturalProsody: boolean; // Auto-expand cycling abbreviations & natural breath pauses
  effortModulation: boolean; // Adapt speech cadence/energy according to interval intensity
}

export interface LiveTelemetry {
  currentSpeedKmh: number;
  averageSpeedKmh: number;
  maxSpeedKmh: number;
  totalDistanceKm: number;
  totalTimeElapsedSec: number;
  currentStepRemainingSec: number;
  currentStepElapsedSec: number;
  currentStepIndex: number;
  totalSteps: number;
  gpsAccuracy: number | null;
  isGpsActive: boolean;
  isSimulated: boolean;
}
