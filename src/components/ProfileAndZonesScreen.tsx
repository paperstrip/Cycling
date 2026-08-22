import React, { useEffect, useState } from 'react';
import { CyclistProfile, CyclistLevel, PrimaryGoalType } from '../types';
import { loadTrainingContext } from '../utils/trainingContext';
import {
  recordFtpRevision,
  suggestFtpRevision,
  type FtpSuggestion,
} from '../utils/fitnessProgression';
import {
  calculatePowerZones,
  calculateHeartRateZones,
  calculateWattsPerKg,
  estimateInitialFtp,
  ZONE_DETAILS,
} from '../utils/zonesCalculator';
import {
  User,
  Zap,
  Heart,
  Target,
  Sliders,
  Sparkles,
  Award,
  Bike,
  MapPin,
  Clock,
  Activity,
  Check,
  RotateCcw,
  ShieldCheck,
  TrendingUp,
  Flame,
  Info,
} from 'lucide-react';

interface ProfileAndZonesScreenProps {
  profile: CyclistProfile;
  onSaveProfile: (profile: CyclistProfile) => void;
  onOpenCalibrationWizard: () => void;
}

export const ProfileAndZonesScreen: React.FC<ProfileAndZonesScreenProps> = ({
  profile,
  onSaveProfile,
  onOpenCalibrationWizard,
}) => {
  const [formData, setFormData] = useState<CyclistProfile>({ ...profile });
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);
  const [activeZoneTab, setActiveZoneTab] = useState<'power' | 'hr'>('power');
  // Révision de FTP déduite des allures réellement tenues. Proposée, jamais
  // appliquée d'office : modifier la FTP change toutes les zones.
  const [ftpSuggestion, setFtpSuggestion] = useState<FtpSuggestion | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadTrainingContext(profile)
      .then(({ metrics }) => {
        if (!cancelled) setFtpSuggestion(suggestFtpRevision(metrics, profile));
      })
      .catch(() => {
        /* Sans historique lisible, on ne propose simplement rien. */
      });
    return () => {
      cancelled = true;
    };
  }, [profile]);

  const applyFtpSuggestion = () => {
    if (!ftpSuggestion) return;
    handleUpdate({ ftpWatts: ftpSuggestion.suggestedFtp });
    recordFtpRevision();
    setFtpSuggestion(null);
  };

  const dismissFtpSuggestion = () => {
    recordFtpRevision();
    setFtpSuggestion(null);
  };

  const ftp = formData.ftpWatts || 240;
  const weight = formData.weightKg || 70;
  const maxHr = formData.maxHeartRate || 185;

  const wPerKg = calculateWattsPerKg(ftp, weight);
  const powerZones = calculatePowerZones(ftp);
  const hrZones = calculateHeartRateZones(maxHr);

  const handleUpdate = (partial: Partial<CyclistProfile>) => {
    const updated = { ...formData, ...partial };
    setFormData(updated);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const finalized: CyclistProfile = {
      ...formData,
      powerZones,
      heartRateZones: hrZones,
    };
    onSaveProfile(finalized);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleEstimateFtp = () => {
    const estimated = estimateInitialFtp(formData.level, weight);
    handleUpdate({ ftpWatts: estimated });
  };

  return (
    <div className="space-y-6 animate-fadeIn max-w-5xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-xl bg-amber-500/20 text-amber-400">
              <Activity className="w-5 h-5" />
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-white">
              Mon Profil & Calibrage Physiologique
            </h2>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 font-bold">
              Zones de Puissance Z1-Z7
            </span>
          </div>
          <p className="text-xs text-stone-400 mt-1">
            Personnalisez votre FTP, poids, fréquence cardiaque maximale et consultez vos plages d'entraînement cibles.
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenCalibrationWizard}
          className="px-4 py-2.5 rounded-2xl bg-stone-900 hover:bg-stone-800 border border-stone-700 text-xs font-bold text-amber-400 flex items-center gap-2 transition-all cursor-pointer shadow-md self-start sm:self-auto"
        >
          <Sliders className="w-4 h-4" />
          <span>Relancer l'assistant de calibrage</span>
        </button>
      </div>

      {/* Révision de FTP fondée sur les allures réellement tenues. La FTP ne
          bougeait jamais après l'inscription alors qu'elle fixe toutes les
          zones : quelqu'un qui progresse gardait des cibles trop faciles. */}
      {ftpSuggestion && (
        <div className="p-5 rounded-3xl bg-amber-500/10 border border-amber-500/30 space-y-3 animate-fade-up">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-amber-400 shrink-0" />
            <h3 className="text-sm font-black text-white">
              Votre FTP a probablement changé
            </h3>
          </div>

          <div className="flex items-center gap-3">
            <div className="px-3 py-2 rounded-xl bg-stone-950 border border-stone-800 text-center">
              <div className="text-[10px] uppercase text-stone-500 font-bold">Actuelle</div>
              <div className="font-mono text-lg font-black text-stone-400">
                {ftpSuggestion.currentFtp} W
              </div>
            </div>
            <span className="text-amber-400 font-black">→</span>
            <div className="px-3 py-2 rounded-xl bg-amber-500 text-center">
              <div className="text-[10px] uppercase text-stone-900/70 font-bold">Proposée</div>
              <div className="font-mono text-lg font-black text-stone-950">
                {ftpSuggestion.suggestedFtp} W
              </div>
            </div>
            <span className="font-mono text-sm font-bold text-amber-300">
              {ftpSuggestion.changePercent > 0 ? '+' : ''}
              {ftpSuggestion.changePercent} %
            </span>
          </div>

          <p className="text-[12px] text-amber-200/90 leading-relaxed">
            {ftpSuggestion.rationale}
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={applyFtpSuggestion}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 text-[12px] font-black cursor-pointer transition-colors"
            >
              Appliquer {ftpSuggestion.suggestedFtp} W
            </button>
            <button
              type="button"
              onClick={dismissFtpSuggestion}
              className="px-4 py-2 rounded-xl bg-stone-900 border border-stone-800 hover:border-stone-700 text-stone-300 text-[12px] font-bold cursor-pointer transition-colors"
            >
              Garder {ftpSuggestion.currentFtp} W
            </button>
          </div>
          <p className="text-[10.5px] text-stone-500">
            Après avoir appliqué, pensez à enregistrer le profil plus bas pour recalculer vos
            zones.
          </p>
        </div>
      )}

      {/* Hero Stats Card: W/kg and Level Gauge */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-stone-900 via-stone-900 to-amber-950/30 border border-stone-800 shadow-2xl grid grid-cols-1 sm:grid-cols-3 gap-6 items-center">
        {/* W/kg Gauge */}
        <div className="space-y-1">
          <span className="text-xs font-bold uppercase tracking-wider text-stone-400 flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            Rapport Poids / Puissance
          </span>
          <div className="text-3xl sm:text-4xl font-black text-amber-400 font-mono">
            {wPerKg} <span className="text-sm text-stone-400 font-sans font-bold">W / kg</span>
          </div>
          <p className="text-xs text-stone-300">
            {wPerKg < 2.5
              ? 'Cyclotourisme Découverte'
              : wPerKg < 3.5
              ? 'Cyclotouriste Régulier / Confirmé'
              : wPerKg < 4.5
              ? 'Cyclosportif / Coursier'
              : 'Élite / Compétiteur National'}
          </p>
        </div>

        {/* FTP & Max HR */}
        <div className="grid grid-cols-2 gap-3 sm:border-x sm:border-stone-800 sm:px-6">
          <div className="p-3 rounded-2xl bg-stone-950/80 border border-stone-800 text-center">
            <div className="text-[10px] text-stone-500 font-bold uppercase">FTP Seuil</div>
            <div className="text-xl font-black text-white font-mono">{ftp} W</div>
          </div>
          <div className="p-3 rounded-2xl bg-stone-950/80 border border-stone-800 text-center">
            <div className="text-[10px] text-stone-500 font-bold uppercase">FC Max</div>
            <div className="text-xl font-black text-rose-400 font-mono">{maxHr} bpm</div>
          </div>
        </div>

        {/* Home City & Bike */}
        <div className="space-y-1 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-white text-sm">{formData.name}</span>
            <span className="text-[10px] px-2 py-0.2 rounded bg-amber-500/20 text-amber-300 font-semibold capitalize">
              {formData.level.replace('_', ' ')}
            </span>
          </div>
          <div className="text-stone-400 flex items-center gap-1">
            <MapPin className="w-3 h-3 text-stone-500" />
            <span>Départ : {formData.homeCity || 'Non défini'}</span>
          </div>
          <div className="text-stone-400 flex items-center gap-1">
            <Bike className="w-3 h-3 text-stone-500" />
            <span className="capitalize">Vélo : {formData.bikeType || 'Route'}</span>
          </div>
        </div>
      </div>

      {/* Zones Visualizer Section */}
      <div className="p-6 rounded-3xl bg-stone-900 border border-stone-800 space-y-5 shadow-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-800 pb-3">
          <div>
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-amber-400" />
              Échelle d'Entraînement Physiologique & Zones Cibles
            </h3>
            <p className="text-xs text-stone-400">
              Basée sur le modèle Coggan 7 Zones et l'analyse de fréquence cardiaque
            </p>
          </div>

          <div className="flex items-center gap-1 p-1 bg-stone-950 rounded-xl border border-stone-800">
            <button
              onClick={() => setActiveZoneTab('power')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeZoneTab === 'power'
                  ? 'bg-amber-500 text-stone-950'
                  : 'text-stone-400 hover:text-white'
              }`}
            >
              Watts (Coggan)
            </button>
            <button
              onClick={() => setActiveZoneTab('hr')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeZoneTab === 'hr'
                  ? 'bg-rose-500 text-white'
                  : 'text-stone-400 hover:text-white'
              }`}
            >
              Cardio (FCmax)
            </button>
          </div>
        </div>

        {/* 7 Power Zones Grid */}
        {activeZoneTab === 'power' && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {ZONE_DETAILS.map((z, idx) => {
                let range = '';
                if (idx === 0) range = `< ${powerZones.z1[1]} W`;
                else if (idx === 1) range = `${powerZones.z2[0]} - ${powerZones.z2[1]} W`;
                else if (idx === 2) range = `${powerZones.z3[0]} - ${powerZones.z3[1]} W`;
                else if (idx === 3) range = `${powerZones.z4[0]} - ${powerZones.z4[1]} W`;
                else if (idx === 4) range = `${powerZones.z5[0]} - ${powerZones.z5[1]} W`;
                else if (idx === 5) range = `${powerZones.z6[0]} - ${powerZones.z6[1]} W`;
                else if (idx === 6) range = `> ${powerZones.z7[0]} W`;

                return (
                  <div
                    key={z.zone}
                    className={`p-4 rounded-2xl border ${z.color} space-y-2 text-xs flex flex-col justify-between`}
                  >
                    <div>
                      <div className="flex items-center justify-between font-black text-sm">
                        <span>
                          {z.zone} • {z.name}
                        </span>
                        <span className="font-mono text-xs">{z.pctFtp}</span>
                      </div>
                      <div className="text-lg font-black font-mono text-white mt-1">{range}</div>
                      <p className="text-[11px] text-stone-300 mt-1 leading-snug">{z.benefit}</p>
                    </div>

                    <div className="pt-2 border-t border-stone-800/60 text-[10px] text-stone-400 italic">
                      🌬️ {z.breathing}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Heart Rate Zones */}
        {activeZoneTab === 'hr' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
            {[
              { z: 'Z1 Récup', range: `${hrZones.z1[0]} - ${hrZones.z1[1]} bpm`, pct: '50-60%', desc: 'Aisance respiratoire' },
              { z: 'Z2 Endurance', range: `${hrZones.z2[0]} - ${hrZones.z2[1]} bpm`, pct: '60-70%', desc: 'Lipolyse et foncier' },
              { z: 'Z3 Tempo', range: `${hrZones.z3[0]} - ${hrZones.z3[1]} bpm`, pct: '70-80%', desc: 'Allure peloton' },
              { z: 'Z4 Seuil', range: `${hrZones.z4[0]} - ${hrZones.z4[1]} bpm`, pct: '80-90%', desc: 'Seuil lactique anaérobie' },
              { z: 'Z5 VO2 Max', range: `${hrZones.z5[0]} - ${hrZones.z5[1]} bpm`, pct: '90-100%', desc: 'Cœur au maximum' },
            ].map((hz, i) => (
              <div key={i} className="p-3.5 rounded-2xl bg-stone-950 border border-stone-800 text-center space-y-1">
                <div className="font-bold text-rose-400 text-xs">{hz.z}</div>
                <div className="font-mono font-black text-sm text-white">{hz.range}</div>
                <div className="text-[10px] text-stone-500 font-mono">{hz.pct} FCmax</div>
                <div className="text-[10px] text-stone-400">{hz.desc}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit Profile Form */}
      <form onSubmit={handleSave} className="p-6 rounded-3xl bg-stone-900 border border-stone-800 space-y-5 shadow-2xl">
        <h3 className="text-base font-black text-white flex items-center gap-2 border-b border-stone-800 pb-3">
          <User className="w-4 h-4 text-amber-400" />
          Modifier mes paramètres et données physiologiques
        </h3>

        {/* Réglage d'affichage, pas une déclaration d'identité : « Varié » est
            la valeur par défaut, personne n'a à se ranger dans une case pour
            que l'app ait des images. */}
        <div className="text-xs">
          <label className="block text-stone-300 font-bold mb-1.5">
            Photos de l'application
          </label>
          <div className="flex items-center gap-2">
            {(
              [
                { id: 'varie', label: 'Varié' },
                { id: 'femme', label: 'Cyclistes femmes' },
                { id: 'homme', label: 'Cyclistes hommes' },
              ] as const
            ).map((option) => {
              const isActive = (formData.illustrationPreference || 'varie') === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => handleUpdate({ illustrationPreference: option.id })}
                  className={`px-3.5 py-2 rounded-xl font-bold cursor-pointer transition-colors ${
                    isActive
                      ? 'bg-amber-500 text-stone-950'
                      : 'bg-stone-950 border border-stone-800 text-stone-400 hover:text-white'
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-stone-500 mt-1.5">
            Par défaut les deux séries alternent. Ce choix ne change que les images.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="block text-stone-300 font-bold mb-1.5">Nom ou Pseudo</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleUpdate({ name: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl bg-stone-950 border border-stone-800 text-white focus:border-amber-500 focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-stone-300 font-bold mb-1.5">Niveau de pratique</label>
            <select
              value={formData.level}
              onChange={(e) => handleUpdate({ level: e.target.value as CyclistLevel })}
              className="w-full px-3.5 py-2.5 rounded-xl bg-stone-950 border border-stone-800 text-white focus:border-amber-500 focus:outline-none cursor-pointer"
            >
              <option value="debutant">Débutant (Découverte & Forme)</option>
              <option value="intermediaire">Intermédiaire (Cyclotouriste régulier)</option>
              <option value="avance">Avancé (Cyclosportives & Granfondo)</option>
              <option value="competiteur_pro">Compétiteur / Élite (FFC, Masters)</option>
            </select>
          </div>

          <div>
            <label className="block text-stone-300 font-bold mb-1.5">Type de vélo</label>
            <select
              value={formData.bikeType || 'route'}
              onChange={(e) => handleUpdate({ bikeType: e.target.value as any })}
              className="w-full px-3.5 py-2.5 rounded-xl bg-stone-950 border border-stone-800 text-white focus:border-amber-500 focus:outline-none cursor-pointer"
            >
              <option value="route">Vélo de Route (Asphalte)</option>
              <option value="gravel">Gravel / Mixte</option>
              <option value="clm">Contre-la-Montre / Triathlon</option>
              <option value="polyvalent">Cyclotourisme</option>
            </select>
          </div>
        </div>

        {/* Ces trois valeurs sont le principal mur d'entrée pour qui débute :
            personne ne connaît sa FTP en watts sans l'avoir mesurée en labo ou
            avec un capteur. Elles sont donc explicitées, et rendues facultatives
            en pratique — les allures réelles prennent le relais. */}
        <div className="p-4 rounded-2xl bg-stone-900 border border-stone-800 space-y-3">
          <div className="flex items-start gap-2.5">
            <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1.5">
              <p className="text-[12.5px] text-stone-200 font-bold">
                Vous ne connaissez pas ces valeurs ? C'est normal.
              </p>
              <p className="text-[12px] text-stone-400 leading-relaxed">
                La FTP est la puissance que vous pourriez tenir une heure à fond. La mesurer
                demande un capteur de puissance. <span className="text-stone-200">L'app n'en a
                pas besoin pour fonctionner</span> : laissez-la estimer une valeur de départ, puis
                après trois ou quatre sorties, elle calera vos cibles sur vos allures réelles et
                vous proposera de corriger le chiffre.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleEstimateFtp}
            className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 text-[12px] font-black cursor-pointer transition-colors"
          >
            Estimer ma FTP d'après mon niveau et mon poids
          </button>
          <p className="text-[11px] text-stone-500">
            Pour la fréquence cardiaque maximale, si vous ne l'avez jamais mesurée, gardez la
            valeur proposée : elle ne sert qu'aux zones cardio, que l'app n'utilise pas pour
            piloter vos séances.
          </p>
        </div>

        {/* Row 2: FTP, Weight, HRmax */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs p-4 rounded-2xl bg-stone-950 border border-stone-800">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-stone-400 font-bold flex items-center gap-1">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                Puissance Seuil FTP (Watts)
              </label>
            </div>
            <input
              type="number"
              min="100"
              max="500"
              value={formData.ftpWatts || ''}
              onChange={(e) => handleUpdate({ ftpWatts: parseInt(e.target.value) || 240 })}
              className="w-full px-3 py-2 rounded-xl bg-stone-900 border border-stone-800 text-white font-mono font-bold"
            />
          </div>

          <div>
            <label className="block text-stone-400 font-bold mb-1">Poids du cycliste (kg)</label>
            <input
              type="number"
              min="45"
              max="130"
              step="0.5"
              value={formData.weightKg || ''}
              onChange={(e) => handleUpdate({ weightKg: parseFloat(e.target.value) || 70 })}
              className="w-full px-3 py-2 rounded-xl bg-stone-900 border border-stone-800 text-white font-mono font-bold"
            />
          </div>

          <div>
            <label className="block text-stone-400 font-bold mb-1 flex items-center gap-1">
              <Heart className="w-3.5 h-3.5 text-rose-400" />
              FC Max (bpm)
            </label>
            <input
              type="number"
              min="130"
              max="220"
              value={formData.maxHeartRate || ''}
              onChange={(e) => handleUpdate({ maxHeartRate: parseInt(e.target.value) || 185 })}
              className="w-full px-3 py-2 rounded-xl bg-stone-900 border border-stone-800 text-white font-mono font-bold"
            />
          </div>
        </div>

        {/* Goal Description */}
        <div className="text-xs space-y-1.5">
          <label className="block text-stone-300 font-bold">Votre objectif principal de saison</label>
          <input
            type="text"
            value={formData.goalDescription}
            onChange={(e) => handleUpdate({ goalDescription: e.target.value })}
            placeholder="Ex: Passer les bosses sans caler, préparer une cyclo de 120 km..."
            className="w-full px-3.5 py-2.5 rounded-xl bg-stone-950 border border-stone-800 text-white focus:border-amber-500 focus:outline-none"
          />
        </div>

        {/* Save button */}
        <div className="flex items-center justify-between pt-3 border-t border-stone-800">
          {savedSuccess ? (
            <span className="text-xs text-emerald-400 font-bold flex items-center gap-1 animate-fadeIn">
              <Check className="w-4 h-4" />
              Profil et zones enregistrés avec succès !
            </span>
          ) : (
            <div />
          )}

          <button
            type="submit"
            className="px-6 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-black uppercase tracking-wider text-xs flex items-center gap-2 cursor-pointer shadow-lg shadow-amber-500/20"
          >
            <Check className="w-4 h-4" />
            <span>Enregistrer les modifications</span>
          </button>
        </div>
      </form>
    </div>
  );
};
