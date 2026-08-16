import { CyclistProfile, TrainingProgram, CyclingRoute, VoiceSettings } from '../types';
import { calculatePowerZones, calculateHeartRateZones } from './zonesCalculator';

const STORAGE_KEYS = {
  PROFILE: 'cyclocoach_user_profile_v3',
  ACTIVE_PROGRAM: 'cyclocoach_active_program_v3',
  SAVED_ROUTES: 'cyclocoach_saved_routes_v3',
  VOICE_SETTINGS: 'cyclocoach_voice_settings_v4',
  HAS_SEEN_ONBOARDING: 'cyclocoach_onboarding_completed_v3',
};

export const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  engineMode: 'gemini_neural',
  persona: 'jean_marc_dynamique',
  geminiVoiceName: 'Fenrir',
  speedRate: 1.05,
  pitch: 1.0,
  volume: 1.0,
  earpieceBeep: true,
  radioAmbience: 'ds_car',
  radioStaticVolume: 0.35,
  radioDspFilter: true,
  naturalProsody: true,
  effortModulation: true,
};

export function getStoredVoiceSettings(): VoiceSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.VOICE_SETTINGS);
    if (raw) {
      return { ...DEFAULT_VOICE_SETTINGS, ...JSON.parse(raw) };
    }
  } catch (e) {
    console.error('Erreur lecture réglages voix:', e);
  }
  return DEFAULT_VOICE_SETTINGS;
}

export function saveStoredVoiceSettings(settings: VoiceSettings): void {
  try {
    localStorage.setItem(STORAGE_KEYS.VOICE_SETTINGS, JSON.stringify(settings));
  } catch (e) {
    console.error('Erreur sauvegarde réglages voix:', e);
  }
}

export const DEFAULT_PROFILE: CyclistProfile = {
  name: 'Cycliste',
  level: 'intermediaire',
  primaryGoal: 'puissance_ftp',
  goalDescription: 'Augmenter ma puissance au seuil FTP et franchir les bosses avec aisance',
  ftpWatts: 240,
  weightKg: 70,
  maxHeartRate: 185,
  restingHeartRate: 55,
  weeklyHoursAvailable: 6,
  preferredTerrain: 'vallonne',
  bikeType: 'route',
  homeCity: 'Paris / Île-de-France',
  homeCoordinates: { lat: 48.8566, lng: 2.3522 },
  isCalibrated: false,
  powerZones: calculatePowerZones(240),
  heartRateZones: calculateHeartRateZones(185),
  strengths: 'Endurance de base, régularité sur le plat',
  weaknesses: 'Changements de rythme brusques et montées raides',
};

export function getStoredProfile(): CyclistProfile {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PROFILE);
    if (raw) {
      const parsed = JSON.parse(raw);
      const ftp = parsed.ftpWatts || 240;
      const hr = parsed.maxHeartRate || 185;
      return {
        ...DEFAULT_PROFILE,
        ...parsed,
        powerZones: calculatePowerZones(ftp),
        heartRateZones: calculateHeartRateZones(hr),
      };
    }
  } catch (e) {
    console.error('Erreur lecture profil local:', e);
  }
  return DEFAULT_PROFILE;
}

export function saveStoredProfile(profile: CyclistProfile): void {
  try {
    const ftp = profile.ftpWatts || 240;
    const hr = profile.maxHeartRate || 185;
    const complete = {
      ...profile,
      powerZones: calculatePowerZones(ftp),
      heartRateZones: calculateHeartRateZones(hr),
    };
    localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(complete));
  } catch (e) {
    console.error('Erreur sauvegarde profil:', e);
  }
}

export function hasCompletedOnboarding(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEYS.HAS_SEEN_ONBOARDING) === 'true';
  } catch {
    return false;
  }
}

export function setCompletedOnboarding(completed: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEYS.HAS_SEEN_ONBOARDING, completed ? 'true' : 'false');
  } catch (e) {
    console.error('Erreur stockage onboarding:', e);
  }
}

export function getStoredActiveProgram(): TrainingProgram | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ACTIVE_PROGRAM);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Erreur lecture programme:', e);
  }
  return null;
}

export function saveStoredActiveProgram(program: TrainingProgram | null): void {
  try {
    if (!program) {
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_PROGRAM);
    } else {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_PROGRAM, JSON.stringify(program));
    }
  } catch (e) {
    console.error('Erreur sauvegarde programme:', e);
  }
}

export function getSavedRoutes(): CyclingRoute[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SAVED_ROUTES);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Erreur lecture parcours:', e);
  }
  return [];
}

export function saveCustomRoute(route: CyclingRoute): void {
  try {
    const current = getSavedRoutes();
    const filtered = current.filter((r) => r.id !== route.id);
    filtered.unshift(route);
    localStorage.setItem(STORAGE_KEYS.SAVED_ROUTES, JSON.stringify(filtered.slice(0, 25)));
  } catch (e) {
    console.error('Erreur sauvegarde route:', e);
  }
}

export function deleteCustomRoute(routeId: string): void {
  try {
    const current = getSavedRoutes();
    const filtered = current.filter((r) => r.id !== routeId);
    localStorage.setItem(STORAGE_KEYS.SAVED_ROUTES, JSON.stringify(filtered));
  } catch (e) {
    console.error('Erreur suppression route:', e);
  }
}
