import React, { useState } from 'react';
import { CyclistProfile, CyclistLevel, PrimaryGoalType } from '../types';
import { Target, Zap, Clock, ShieldCheck, Heart, User, Check, Sparkles } from 'lucide-react';

interface ProfileModalProps {
  profile: CyclistProfile;
  onSave: (newProfile: CyclistProfile) => void;
  onClose: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({ profile, onSave, onClose }) => {
  const [formData, setFormData] = useState<CyclistProfile>({ ...profile });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-2xl bg-stone-900 border border-stone-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl my-8">
        {/* Title */}
        <div className="flex items-center justify-between border-b border-stone-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-stone-950 flex items-center justify-center font-bold">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white">Profil & Objectifs Cyclistes</h2>
              <p className="text-xs text-stone-400">Permet au coach Jean-Marc de calibrer vos intensités et parcours</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-white p-2 text-sm font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 text-xs">
          {/* Row 1: Name & Level */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-stone-300 font-bold mb-1.5 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-amber-500" />
                Votre Prénom / Nom
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-stone-950 border border-stone-800 text-white focus:border-amber-500 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-stone-300 font-bold mb-1.5">Niveau de pratique</label>
              <select
                value={formData.level}
                onChange={(e) => setFormData({ ...formData, level: e.target.value as CyclistLevel })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-stone-950 border border-stone-800 text-white focus:border-amber-500 focus:outline-none"
              >
                <option value="debutant">Débutant (Découverte & Forme)</option>
                <option value="intermediaire">Intermédiaire (Cyclotouriste régulier)</option>
                <option value="avance">Avancé (Cyclosportives & Granfondo)</option>
                <option value="competiteur_pro">Compétiteur / Élite (FFC, Masters, Pro)</option>
              </select>
            </div>
          </div>

          {/* Row 2: Primary Goal */}
          <div>
            <label className="block text-stone-300 font-bold mb-1.5 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              Objectif Prioritaire Actuel
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                { id: 'puissance_ftp', label: 'Puissance FTP & Seuil' },
                { id: 'endurance_cyclo', label: 'Endurance & 100+ km' },
                { id: 'grimpeur_col', label: 'Grimpeur & Cols' },
                { id: 'sprint_crit', label: 'Explosivité & Critérium' },
                { id: 'perte_poids', label: 'Affûtage & Bien-être' },
                { id: 'reprise', label: 'Reprise progressive' },
              ].map((g) => {
                const isSelected = formData.primaryGoal === g.id;
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setFormData({ ...formData, primaryGoal: g.id as PrimaryGoalType })}
                    className={`p-2.5 rounded-xl border text-left font-medium transition-all cursor-pointer ${
                      isSelected
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

          {/* Description of the Goal */}
          <div>
            <label className="block text-stone-300 font-bold mb-1.5">
              Description de votre défi / échéance
            </label>
            <textarea
              rows={2}
              value={formData.goalDescription}
              onChange={(e) => setFormData({ ...formData, goalDescription: e.target.value })}
              placeholder="Ex: Préparation de la Marmotte Granfondo en juillet, objectif moins de 7h..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-stone-950 border border-stone-800 text-white focus:border-amber-500 focus:outline-none resize-none"
            />
          </div>

          {/* Row 3: Physiologic Data (Watts, Heart, Hours) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-2xl bg-stone-950 border border-stone-800">
            <div>
              <label className="block text-stone-400 font-bold mb-1 flex items-center gap-1">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                Puissance FTP (Watts)
              </label>
              <input
                type="number"
                min="100"
                max="500"
                value={formData.ftpWatts || ''}
                onChange={(e) => setFormData({ ...formData, ftpWatts: Number(e.target.value) || undefined })}
                placeholder="Ex: 250"
                className="w-full px-3 py-2 rounded-lg bg-stone-900 border border-stone-800 text-white font-mono"
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
                max="225"
                value={formData.maxHeartRate || ''}
                onChange={(e) => setFormData({ ...formData, maxHeartRate: Number(e.target.value) || undefined })}
                placeholder="Ex: 188"
                className="w-full px-3 py-2 rounded-lg bg-stone-900 border border-stone-800 text-white font-mono"
              />
            </div>

            <div>
              <label className="block text-stone-400 font-bold mb-1 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-cyan-400" />
                Disponibilité (h/semaine)
              </label>
              <input
                type="number"
                min="1"
                max="30"
                value={formData.weeklyHoursAvailable || ''}
                onChange={(e) => setFormData({ ...formData, weeklyHoursAvailable: Number(e.target.value) || undefined })}
                placeholder="Ex: 6"
                className="w-full px-3 py-2 rounded-lg bg-stone-900 border border-stone-800 text-white font-mono"
              />
            </div>
          </div>

          {/* Row 4: Strengths / Weaknesses */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-stone-400 font-bold mb-1">Vos points forts</label>
              <input
                type="text"
                value={formData.strengths || ''}
                onChange={(e) => setFormData({ ...formData, strengths: e.target.value })}
                placeholder="Ex: Endurance, régularité au train"
                className="w-full px-3 py-2 rounded-lg bg-stone-950 border border-stone-800 text-white"
              />
            </div>

            <div>
              <label className="block text-stone-400 font-bold mb-1">Vos points à travailler</label>
              <input
                type="text"
                value={formData.weaknesses || ''}
                onChange={(e) => setFormData({ ...formData, weaknesses: e.target.value })}
                placeholder="Ex: Relances explosives, côtes raides"
                className="w-full px-3 py-2 rounded-lg bg-stone-950 border border-stone-800 text-white"
              />
            </div>
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-stone-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 font-bold cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-black uppercase tracking-wider flex items-center gap-2 cursor-pointer shadow-lg shadow-amber-500/20"
            >
              <Check className="w-4 h-4" />
              <span>Enregistrer mon profil</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
