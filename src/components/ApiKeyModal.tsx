/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { KeyRound, ExternalLink, ShieldCheck, Eye, EyeOff, Trash2 } from 'lucide-react';
import { clearApiKey, getApiKey, saveApiKey } from '../utils/apiKey';

interface ApiKeyModalProps {
  isOpen: boolean;
  /** Empêche la fermeture tant qu'aucune clé n'est enregistrée (1er lancement). */
  isDismissable?: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({
  isOpen,
  isDismissable = true,
  onClose,
  onSaved,
}) => {
  const [value, setValue] = useState<string>('');
  const [isRevealed, setIsRevealed] = useState<boolean>(false);
  const [hasSavedKey, setHasSavedKey] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      const existing = getApiKey();
      setValue(existing);
      setHasSavedKey(existing.length > 0);
      setIsRevealed(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    const clean = value.trim();
    if (!clean) return;
    saveApiKey(clean);
    setHasSavedKey(true);
    if (onSaved) onSaved();
    onClose();
  };

  const handleClear = () => {
    clearApiKey();
    setValue('');
    setHasSavedKey(false);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-stone-950/90 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-3xl bg-stone-900 border border-stone-800 shadow-2xl overflow-hidden">
        {/* En-tête */}
        <div className="p-5 sm:p-6 bg-gradient-to-r from-stone-900 to-amber-950/40 border-b border-stone-800 flex items-start gap-3">
          <div className="w-11 h-11 shrink-0 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-black text-white">Clé API Gemini</h2>
            <p className="text-xs text-stone-400 mt-0.5">
              Nécessaire pour le coach IA, la génération de séances et la voix studio.
            </p>
          </div>
        </div>

        <div className="p-5 sm:p-6 space-y-4">
          {/* Champ de saisie */}
          <div className="space-y-2">
            <label htmlFor="gemini-api-key" className="text-[11px] font-bold uppercase tracking-wider text-stone-400">
              Votre clé
            </label>
            <div className="relative">
              <input
                id="gemini-api-key"
                type={isRevealed ? 'text' : 'password'}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSave();
                }}
                placeholder="AIza..."
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                className="w-full px-4 py-3 pr-12 rounded-2xl bg-stone-950 border border-stone-800 focus:border-amber-500 focus:outline-none text-sm text-white font-mono placeholder:text-stone-600"
              />
              <button
                type="button"
                onClick={() => setIsRevealed((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-stone-500 hover:text-stone-300 cursor-pointer"
                title={isRevealed ? 'Masquer' : 'Afficher'}
              >
                {isRevealed ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Note de confidentialité */}
          <div className="p-3 rounded-2xl bg-stone-950 border border-stone-800 flex gap-2.5">
            <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
            <p className="text-[11px] leading-relaxed text-stone-400">
              Votre clé est enregistrée <strong className="text-stone-200">uniquement sur cet appareil</strong>{' '}
              (stockage local du navigateur). Elle n'est envoyée qu'aux serveurs de Google et n'est
              jamais transmise à ce site ni à un tiers.
            </p>
          </div>

          {/* Lien d'obtention de la clé */}
          <a
            href="https://aistudio.google.com/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-400 hover:text-amber-300"
          >
            <span>Obtenir une clé gratuite sur Google AI Studio</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>

          <p className="text-[11px] text-stone-500 leading-relaxed">
            Sans clé, l'application reste utilisable : séances préenregistrées, chronomètre par
            intervalles, suivi GPS et voix de synthèse du navigateur fonctionnent normalement. Seules
            les fonctions IA sont désactivées.
          </p>
        </div>

        {/* Actions */}
        <div className="p-5 sm:p-6 pt-0 flex flex-wrap items-center gap-2">
          <button
            onClick={handleSave}
            disabled={!value.trim()}
            className="flex-1 min-w-[140px] px-5 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-stone-950 font-black text-xs uppercase tracking-wider cursor-pointer transition-all"
          >
            Enregistrer la clé
          </button>

          {hasSavedKey && (
            <button
              onClick={handleClear}
              className="px-4 py-3 rounded-2xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-bold cursor-pointer transition-colors flex items-center gap-1.5"
              title="Supprimer la clé de cet appareil"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Supprimer</span>
            </button>
          )}

          {isDismissable && (
            <button
              onClick={onClose}
              className="px-4 py-3 rounded-2xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-bold cursor-pointer transition-colors"
            >
              Fermer
            </button>
          )}

          {!isDismissable && (
            <button
              onClick={onClose}
              className="px-4 py-3 rounded-2xl bg-transparent hover:bg-stone-800 text-stone-500 hover:text-stone-300 text-xs font-bold cursor-pointer transition-colors"
            >
              Plus tard
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
