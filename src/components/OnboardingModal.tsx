import React, { useState } from 'react';
import { CyclistProfile, CyclistLevel, PrimaryGoalType, CoachPersona } from '../types';
import { calculatePowerZones, calculateHeartRateZones, calculateWattsPerKg, estimateInitialFtp, ZONE_DETAILS } from '../utils/zonesCalculator';
import { searchLocation, reverseGeocode } from '../utils/localRouteEngine';
import { audioEngine } from '../utils/audioEngine';
import {
  Zap,
  Heart,
  Target,
  User,
  MapPin,
  Bike,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  Check,
  Headphones,
  Flame,
  Award,
  Play,
  Compass,
  Sliders,
  Activity,
  Radio,
} from 'lucide-react';

interface OnboardingModalProps {
  isOpen: boolean;
  initialProfile: CyclistProfile;
  onComplete: (calibratedProfile: CyclistProfile) => void;
  onClose?: () => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  isOpen,
  initialProfile,
  onComplete,
  onClose,
}) => {
  const [step, setStep] = useState<number>(1);
  const [name, setName] = useState<string>(initialProfile.name || 'Cycliste');
  const [level, setLevel] = useState<CyclistLevel>(initialProfile.level || 'intermediaire');
  const [primaryGoal, setPrimaryGoal] = useState<PrimaryGoalType>(initialProfile.primaryGoal || 'puissance_ftp');
  const [goalDescription, setGoalDescription] = useState<string>(initialProfile.goalDescription || '');
  const [bikeType, setBikeType] = useState<'route' | 'gravel' | 'clm' | 'polyvalent'>(initialProfile.bikeType || 'route');

  // Physiological stats
  const [weightKg, setWeightKg] = useState<number>(initialProfile.weightKg || 70);
  const [ftpWatts, setFtpWatts] = useState<number>(initialProfile.ftpWatts || 240);
  const [maxHeartRate, setMaxHeartRate] = useState<number>(initialProfile.maxHeartRate || 185);
  const [weeklyHours, setWeeklyHours] = useState<number>(initialProfile.weeklyHoursAvailable || 6);

  // Home location for local real-road routes
  const [homeCity, setHomeCity] = useState<string>(initialProfile.homeCity || 'Paris');
  const [citySearchResults, setCitySearchResults] = useState<any[]>([]);
  const [isSearchingCity, setIsSearchingCity] = useState<boolean>(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number }>(
    initialProfile.homeCoordinates || { lat: 48.8566, lng: 2.3522 }
  );

  // Voice Persona
  const [persona, setPersona] = useState<CoachPersona>('jean_marc_dynamique');

  if (!isOpen) return null;

  const wPerKg = calculateWattsPerKg(ftpWatts, weightKg);
  const calculatedPowerZones = calculatePowerZones(ftpWatts);
  const calculatedHrZones = calculateHeartRateZones(maxHeartRate);

  const handleEstimateFtp = () => {
    const estimated = estimateInitialFtp(level, weightKg);
    setFtpWatts(estimated);
  };

  const handleDetectGps = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const newCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setCoords(newCoords);
          const detectedCity = await reverseGeocode(newCoords.lat, newCoords.lng);
          setHomeCity(detectedCity);
        },
        (err) => {
          console.warn('Geolocation failed:', err);
        }
      );
    }
  };

  const handleSearchCity = async (q: string) => {
    setHomeCity(q);
    if (q.length > 2) {
      setIsSearchingCity(true);
      const results = await searchLocation(q);
      setCitySearchResults(results);
      setIsSearchingCity(false);
    } else {
      setCitySearchResults([]);
    }
  };

  const handleSelectCity = (result: any) => {
    setHomeCity(result.city || result.displayName);
    setCoords({ lat: result.lat, lng: result.lng });
    setCitySearchResults([]);
  };

  const handleTestVoice = () => {
    audioEngine.unlockAudio();
    audioEngine.updateSettings({ persona });
    audioEngine.testVoice('conseil');
  };

  const handleFinish = () => {
    const finalProfile: CyclistProfile = {
      name: name.trim() || 'Cycliste',
      level,
      primaryGoal,
      goalDescription: goalDescription.trim() || 'Progression et plaisir sur le vélo',
      ftpWatts,
      weightKg,
      maxHeartRate,
      weeklyHoursAvailable: weeklyHours,
      bikeType,
      homeCity,
      homeCoordinates: coords,
      isCalibrated: true,
      powerZones: calculatedPowerZones,
      heartRateZones: calculatedHrZones,
      preferredTerrain: 'vallonne',
      strengths: 'Régularité et endurance',
      weaknesses: 'Relances en bosse',
    };

    audioEngine.updateSettings({ persona });
    onComplete(finalProfile);
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-950/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="w-full max-w-2xl bg-stone-900 border border-stone-800 rounded-3xl p-5 sm:p-8 space-y-6 shadow-2xl my-6">
        {/* Progress Bar & Header */}
        <div className="space-y-3 border-b border-stone-800 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-amber-500 text-stone-950 flex items-center justify-center font-black text-sm shadow-md shadow-amber-500/20">
                <Sliders className="w-4 h-4 fill-stone-950" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-black text-white">
                  Calibrage Initial & Profil Cycliste
                </h2>
                <p className="text-xs text-stone-400">
                  Étape {step} sur 4 • Personnalisation de vos zones et itinéraires
                </p>
              </div>
            </div>
            {onClose && (
              <button
                onClick={onClose}
                className="text-stone-400 hover:text-white p-1 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          {/* Stepper Dots */}
          <div className="grid grid-cols-4 gap-2 pt-1">
            {[
              { num: 1, label: 'Identité & Vélo' },
              { num: 2, label: 'Objectifs' },
              { num: 3, label: 'Puissance FTP' },
              { num: 4, label: 'Oreillette & Zones' },
            ].map((s) => (
              <div
                key={s.num}
                className={`h-1.5 rounded-full transition-all ${
                  step >= s.num ? 'bg-amber-500 shadow-sm shadow-amber-500/50' : 'bg-stone-800'
                }`}
              />
            ))}
          </div>
        </div>

        {/* STEP 1: Identity, City/GPS & Bike */}
        {step === 1 && (
          <div className="space-y-4 animate-fadeIn text-xs">
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-200 flex items-start gap-2.5">
              <Compass className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-amber-300 font-semibold">Itinéraires sur vraies routes : </strong>
                Indiquez votre ville ou activez le GPS pour que Jean-Marc génère des boucles d'entraînement précises sur les routes secondaires de votre région.
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-stone-300 font-bold mb-1.5 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-amber-400" />
                  Prénom ou Pseudo
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Arnaud"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-stone-950 border border-stone-800 text-white font-semibold focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="relative">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-stone-300 font-bold flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-amber-400" />
                    Ville / Point de départ
                  </label>
                  <button
                    type="button"
                    onClick={handleDetectGps}
                    className="text-[10px] text-amber-400 hover:underline font-bold flex items-center gap-1 cursor-pointer"
                  >
                    📍 GPS actuel
                  </button>
                </div>
                <input
                  type="text"
                  value={homeCity}
                  onChange={(e) => handleSearchCity(e.target.value)}
                  placeholder="Ex: Bruxelles, Lyon, Paris, Nice, Annecy..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-stone-950 border border-stone-800 text-white focus:border-amber-500 focus:outline-none"
                />
                {citySearchResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-stone-900 border border-stone-700 rounded-xl overflow-hidden shadow-2xl z-20">
                    {citySearchResults.map((res, i) => (
                      <div
                        key={i}
                        onClick={() => handleSelectCity(res)}
                        className="p-2.5 hover:bg-stone-800 cursor-pointer text-stone-200 border-b border-stone-800 last:border-0"
                      >
                        <div className="font-bold text-white text-xs">{res.city}</div>
                        <div className="text-[10px] text-stone-400 truncate">{res.displayName}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Bike Type */}
            <div>
              <label className="block text-stone-300 font-bold mb-2 flex items-center gap-1.5">
                <Bike className="w-3.5 h-3.5 text-amber-400" />
                Type de vélo principal
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: 'route', label: 'Vélo de Route', desc: 'Asphalte & Cols' },
                  { id: 'gravel', label: 'Gravel / Mixte', desc: 'Routes & Chemins' },
                  { id: 'clm', label: 'Contre-la-Montre', desc: 'Aéro & Chrono' },
                  { id: 'polyvalent', label: 'Cyclotourisme', desc: 'Endurance & Balade' },
                ].map((b) => {
                  const isSel = bikeType === b.id;
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => setBikeType(b.id as any)}
                      className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                        isSel
                          ? 'border-amber-500 bg-amber-500/10 text-white ring-1 ring-amber-500'
                          : 'bg-stone-950 border-stone-800 text-stone-400 hover:border-stone-700'
                      }`}
                    >
                      <div className="font-bold text-white text-xs">{b.label}</div>
                      <div className="text-[10px] text-stone-400 mt-0.5">{b.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: Level & Seasonal Goal */}
        {step === 2 && (
          <div className="space-y-4 animate-fadeIn text-xs">
            <div>
              <label className="block text-stone-300 font-bold mb-2">Votre niveau de pratique actuel</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  { id: 'debutant', label: 'Débutant', desc: 'Découverte, remise en forme, sorties < 50 km' },
                  { id: 'intermediaire', label: 'Intermédiaire', desc: 'Sorties régulières (50-90 km), recherche de rythme' },
                  { id: 'avance', label: 'Avancé', desc: 'Cyclosportives, 100+ km, habitué aux cols et intensités' },
                  { id: 'competiteur_pro', label: 'Compétiteur / Élite', desc: 'Courses FFC, granfondos chronométrés, haute puissance' },
                ].map((lvl) => {
                  const isSel = level === lvl.id;
                  return (
                    <button
                      key={lvl.id}
                      type="button"
                      onClick={() => setLevel(lvl.id as CyclistLevel)}
                      className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                        isSel
                          ? 'border-amber-500 bg-amber-500/10 text-white ring-1 ring-amber-500'
                          : 'bg-stone-950 border-stone-800 text-stone-400 hover:border-stone-700'
                      }`}
                    >
                      <div className="font-bold text-white text-xs">{lvl.label}</div>
                      <div className="text-[11px] text-stone-400 mt-0.5">{lvl.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Primary Goal */}
            <div>
              <label className="block text-stone-300 font-bold mb-2 flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-amber-400" />
                Objectif de progression prioritaire
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  { id: 'puissance_ftp', label: '⚡ Puissance Seuil FTP' },
                  { id: 'endurance_cyclo', label: '🚴 Endurance & 100+ km' },
                  { id: 'grimpeur_col', label: '⛰️ Grimpeur & Cols' },
                  { id: 'sprint_crit', label: '🔥 Relances & Critérium' },
                  { id: 'perte_poids', label: '🥗 Affûtage & Forme' },
                  { id: 'reprise', label: '🌱 Reprise douce' },
                ].map((g) => {
                  const isSel = primaryGoal === g.id;
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => setPrimaryGoal(g.id as PrimaryGoalType)}
                      className={`p-2.5 rounded-xl border text-left font-medium transition-all cursor-pointer ${
                        isSel
                          ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                          : 'bg-stone-950 border-stone-800 text-stone-400 hover:border-stone-700'
                      }`}
                    >
                      {g.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Goal note */}
            <div>
              <label className="block text-stone-300 font-bold mb-1">
                Précision de votre objectif ou course visée (optionnel)
              </label>
              <input
                type="text"
                value={goalDescription}
                onChange={(e) => setGoalDescription(e.target.value)}
                placeholder="Ex: Passer les bosses sans caler, préparer une cyclo de 120 km..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-stone-950 border border-stone-800 text-white focus:border-amber-500 focus:outline-none"
              />
            </div>
          </div>
        )}

        {/* STEP 3: Physiological Calibration (Watts, Weight, W/kg, FCmax) */}
        {step === 3 && (
          <div className="space-y-4 animate-fadeIn text-xs">
            <div className="p-4 rounded-2xl bg-gradient-to-r from-stone-950 to-amber-950/30 border border-stone-800 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-stone-400">Rapport Poids / Puissance</span>
                <div className="text-2xl sm:text-3xl font-black text-amber-400 font-mono flex items-baseline gap-1 mt-0.5">
                  {wPerKg} <span className="text-sm font-bold text-stone-400">W / kg</span>
                </div>
                <p className="text-[11px] text-stone-300">
                  {wPerKg < 2.5
                    ? 'Niveau Cyclo Découverte'
                    : wPerKg < 3.5
                    ? 'Niveau Cyclotouriste Confirmé'
                    : wPerKg < 4.5
                    ? 'Niveau Cyclosportif / Coursier'
                    : 'Niveau Élite / Compétition'}
                </p>
              </div>

              <button
                type="button"
                onClick={handleEstimateFtp}
                className="px-3 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 font-bold flex items-center gap-1.5 cursor-pointer text-xs"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Estimer ma FTP
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Weight */}
              <div className="p-3.5 rounded-2xl bg-stone-950 border border-stone-800">
                <label className="block text-stone-300 font-bold mb-1 flex items-center justify-between">
                  <span>Poids (kg)</span>
                  <span className="font-mono text-amber-400 font-bold">{weightKg} kg</span>
                </label>
                <input
                  type="range"
                  min="45"
                  max="120"
                  step="0.5"
                  value={weightKg}
                  onChange={(e) => setWeightKg(parseFloat(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>

              {/* FTP Watts */}
              <div className="p-3.5 rounded-2xl bg-stone-950 border border-stone-800">
                <label className="block text-stone-300 font-bold mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                    FTP Seuil (Watts)
                  </span>
                  <span className="font-mono text-amber-400 font-bold">{ftpWatts} W</span>
                </label>
                <input
                  type="range"
                  min="120"
                  max="450"
                  step="5"
                  value={ftpWatts}
                  onChange={(e) => setFtpWatts(parseInt(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>

              {/* Max Heart Rate */}
              <div className="p-3.5 rounded-2xl bg-stone-950 border border-stone-800">
                <label className="block text-stone-300 font-bold mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Heart className="w-3.5 h-3.5 text-rose-400" />
                    FC Max (bpm)
                  </span>
                  <span className="font-mono text-rose-400 font-bold">{maxHeartRate} bpm</span>
                </label>
                <input
                  type="range"
                  min="140"
                  max="215"
                  step="1"
                  value={maxHeartRate}
                  onChange={(e) => setMaxHeartRate(parseInt(e.target.value))}
                  className="w-full accent-rose-500 cursor-pointer"
                />
              </div>
            </div>

            {/* Weekly availability */}
            <div className="p-3 rounded-2xl bg-stone-950 border border-stone-800 flex items-center justify-between">
              <span className="text-stone-300 font-semibold">Volume d'entraînement disponible par semaine :</span>
              <span className="font-mono text-amber-400 font-bold">{weeklyHours} heures / semaine</span>
            </div>
          </div>
        )}

        {/* STEP 4: Calculated Zones & Voice DS Selection */}
        {step === 4 && (
          <div className="space-y-4 animate-fadeIn text-xs">
            {/* Zones Preview */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-white uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-amber-400" />
                  Vos 7 Zones de Puissance Calibrées (FTP {ftpWatts} W)
                </h4>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { z: 'Z1 Récup', range: `< ${calculatedPowerZones.z1[1]} W`, color: 'bg-stone-800 text-stone-300 border-stone-700' },
                  { z: 'Z2 Endurance', range: `${calculatedPowerZones.z2[0]}-${calculatedPowerZones.z2[1]} W`, color: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' },
                  { z: 'Z3 Tempo', range: `${calculatedPowerZones.z3[0]}-${calculatedPowerZones.z3[1]} W`, color: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30' },
                  { z: 'Z4 Seuil', range: `${calculatedPowerZones.z4[0]}-${calculatedPowerZones.z4[1]} W`, color: 'bg-amber-500/10 text-amber-300 border-amber-500/30' },
                  { z: 'Z5 VO2max', range: `${calculatedPowerZones.z5[0]}-${calculatedPowerZones.z5[1]} W`, color: 'bg-rose-500/10 text-rose-300 border-rose-500/30' },
                  { z: 'Z6 Anaérobie', range: `${calculatedPowerZones.z6[0]}-${calculatedPowerZones.z6[1]} W`, color: 'bg-purple-500/10 text-purple-300 border-purple-500/30' },
                  { z: 'Z7 Sprint', range: `> ${calculatedPowerZones.z7[0]} W`, color: 'bg-red-500/10 text-red-300 border-red-500/30' },
                  { z: 'FC Seuil (Z4)', range: `${calculatedHrZones.z4[0]}-${calculatedHrZones.z4[1]} bpm`, color: 'bg-stone-850 text-rose-400 border-stone-700' },
                ].map((item, idx) => (
                  <div key={idx} className={`p-2 rounded-xl border text-center ${item.color}`}>
                    <div className="font-bold text-[10px]">{item.z}</div>
                    <div className="font-mono font-black text-xs mt-0.5">{item.range}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Coach Voice Persona Selection */}
            <div className="space-y-2 pt-2 border-t border-stone-800">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-stone-300 flex items-center gap-1.5">
                  <Headphones className="w-3.5 h-3.5 text-amber-400" />
                  Voix du Directeur Sportif dans l'oreillette
                </label>
                <button
                  type="button"
                  onClick={handleTestVoice}
                  className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 font-black text-[10px] flex items-center gap-1 cursor-pointer transition-all shadow-md"
                >
                  <Play className="w-3 h-3 fill-stone-950" />
                  Tester l'oreillette
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'jean_marc_dynamique', name: 'Jean-Marc (DS Pro)', desc: 'Direct, motivant et dynamique' },
                  { id: 'emilie_punchy', name: 'Émilie (Coach Pro)', desc: 'Énergique et communicative' },
                  { id: 'marc_pose', name: 'Marc (Physiologiste)', desc: 'Posé, précis et technique' },
                  { id: 'radio_tour', name: 'Radio Peloton', desc: 'Ambiance oreillette Tour de France' },
                ].map((p) => {
                  const isSel = persona === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setPersona(p.id as CoachPersona)}
                      className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                        isSel
                          ? 'border-amber-500 bg-amber-500/10 text-white ring-1 ring-amber-500'
                          : 'bg-stone-950 border-stone-800 text-stone-400 hover:border-stone-700'
                      }`}
                    >
                      <div className="font-bold text-white text-xs">{p.name}</div>
                      <div className="text-[10px] text-stone-400">{p.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Footer Navigation Buttons */}
        <div className="flex items-center justify-between border-t border-stone-800 pt-4">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep(step - 1)}
              className="px-4 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 font-bold flex items-center gap-1.5 cursor-pointer text-xs transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Précédent</span>
            </button>
          ) : (
            <div />
          )}

          {step < 4 ? (
            <button
              type="button"
              onClick={() => setStep(step + 1)}
              className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-black uppercase tracking-wider flex items-center gap-1.5 cursor-pointer text-xs transition-all shadow-lg shadow-amber-500/20"
            >
              <span>Continuer</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleFinish}
              className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-black uppercase tracking-wider flex items-center gap-2 cursor-pointer text-xs transition-all shadow-lg shadow-emerald-500/20"
            >
              <Check className="w-4 h-4" />
              <span>Valider & Commencer</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
