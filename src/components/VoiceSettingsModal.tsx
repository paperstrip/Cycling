import React, { useState, useEffect } from 'react';
import { VoiceSettings, CoachPersona, VoiceEngineMode, RadioAmbienceStyle } from '../types';
import { audioEngine } from '../utils/audioEngine';
import {
  Volume2,
  Sparkles,
  Radio,
  Sliders,
  Check,
  Play,
  X,
  UserCheck,
  Zap,
  Activity,
  Heart,
  Headphones,
  RotateCcw,
  Info,
  Smartphone,
  Flame,
  Loader2,
  Car,
  Mic,
} from 'lucide-react';

interface VoiceSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const VoiceSettingsModal: React.FC<VoiceSettingsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [settings, setSettings] = useState<VoiceSettings>(audioEngine.getSettings());
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [isPlayingSample, setIsPlayingSample] = useState<boolean>(false);
  const [activeSampleType, setActiveSampleType] = useState<string | null>(null);
  const [testStatusMessage, setTestStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSettings(audioEngine.getSettings());
      const loadVoices = () => {
        const voices = audioEngine.refreshVoices();
        setAvailableVoices(voices);
      };
      loadVoices();
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.onvoiceschanged = loadVoices;
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleUpdate = (partial: Partial<VoiceSettings>) => {
    const updated = { ...settings, ...partial };
    setSettings(updated);
    audioEngine.updateSettings(partial);
  };

  const handleTest = async (
    sampleType: 'effort' | 'recup' | 'conseil',
    forcedEngine?: VoiceEngineMode
  ) => {
    const engine = forcedEngine || settings.engineMode;
    audioEngine.unlockAudio();
    setIsPlayingSample(true);
    setActiveSampleType(sampleType);
    setTestStatusMessage(
      engine === 'gemini_neural'
        ? '🎙️ Voix IA Studio (Gemini) en cours...'
        : '⚡ Synthèse locale 0 ms...'
    );

    audioEngine.testVoice(sampleType, {
      forcedEngine,
      onEnd: () => {
        setIsPlayingSample(false);
        setActiveSampleType(null);
        setTestStatusMessage(null);
      },
      onError: (err: any) => {
        const msg = err?.message || '';
        if (msg.includes('429') || msg.includes('Quota')) {
          setTestStatusMessage('⚠️ Quota Gemini atteint - bascule synthèse locale');
        } else {
          setTestStatusMessage('⚠️ Note : bascule synthèse locale');
        }
        setTimeout(() => setTestStatusMessage(null), 4000);
      },
    });

    setTimeout(() => {
      setIsPlayingSample(false);
      setActiveSampleType(null);
      setTestStatusMessage(null);
    }, 7000);
  };

  const handleTestRadioChirp = () => {
    audioEngine.unlockAudio();
    audioEngine.playRadioChirp('start');
    setTimeout(() => {
      audioEngine.playRadioChirp('end');
    }, 1800);
  };

  const personas: {
    id: CoachPersona;
    title: string;
    subtitle: string;
    geminiVoice: string;
    icon: any;
    color: string;
  }[] = [
    {
      id: 'jean_marc_dynamique',
      title: 'Jean-Marc (Directeur Sportif)',
      subtitle: 'Dynamique, motivant, chaleureux et direct dans l\'oreillette',
      geminiVoice: 'Voix Fenrir (Studio Masculin HD)',
      icon: Zap,
      color: 'border-amber-500 bg-amber-500/10 text-amber-400',
    },
    {
      id: 'emilie_punchy',
      title: 'Émilie (Coach Pro)',
      subtitle: 'Énergique, naturelle, claire et communicative',
      geminiVoice: 'Voix Kore (Studio Féminin HD)',
      icon: Heart,
      color: 'border-rose-500 bg-rose-500/10 text-rose-400',
    },
    {
      id: 'marc_pose',
      title: 'Marc (Physiologiste)',
      subtitle: 'Posé, technique, rythmé et axé sur la gestion d\'allure',
      geminiVoice: 'Voix Puck (Studio Posé HD)',
      icon: Activity,
      color: 'border-cyan-500 bg-cyan-500/10 text-cyan-400',
    },
    {
      id: 'radio_tour',
      title: 'Radio Peloton',
      subtitle: 'Ambiance oreillette de course professionnelle WorldTour',
      geminiVoice: 'Voix Charon (Studio Course HD)',
      icon: Radio,
      color: 'border-emerald-500 bg-emerald-500/10 text-emerald-400',
    },
  ];

  const radioStyles: {
    id: RadioAmbienceStyle;
    title: string;
    desc: string;
    tag: string;
    icon: any;
  }[] = [
    {
      id: 'ds_car',
      title: 'Voiture Directeur Sportif (DS)',
      desc: 'Bip Motorola PTT, souffle continu de liaison HF et grondement cockpit',
      tag: 'Culte WorldTour',
      icon: Car,
    },
    {
      id: 'radio_tour_official',
      title: 'Radio Tour Officiel',
      desc: 'Carillon 3 tons officiel du Tour de France + friture de transmission',
      tag: 'Tour de France',
      icon: Radio,
    },
    {
      id: 'walkie_talkie_intense',
      title: 'Talkie-Walkie Peloton',
      desc: 'Squelch burst analogique et présence radio serrée',
      tag: 'Analogique',
      icon: Mic,
    },
    {
      id: 'modern_earpiece',
      title: 'Oreillette Électronique Pro',
      desc: 'Bip cristallin moderne sans friture continue',
      tag: 'Épuré',
      icon: Headphones,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fadeIn">
      <div className="bg-stone-900 border border-stone-800 rounded-3xl max-w-xl w-full p-5 sm:p-7 space-y-5 max-h-[92vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500 text-stone-950 flex items-center justify-center font-black shadow-lg shadow-amber-500/20 shrink-0">
              <Headphones className="w-5 h-5 fill-stone-950" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white flex items-center gap-2">
                Voix & Ambiance Oreillette Radio Tour
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  WorldTour
                </span>
              </h2>
              <p className="text-xs text-stone-400">
                Acoustique de course, souffle de liaison HF et timbres des directeurs sportifs
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* SECTION: Radio Ambience Styles (Key Feature) */}
        <div className="space-y-3 p-4 rounded-2xl bg-stone-950 border border-amber-500/30">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
              <Radio className="w-4 h-4 text-amber-400" />
              Ambiance Oreillette & Bips Radio Tour
            </label>

            <button
              type="button"
              onClick={handleTestRadioChirp}
              className="px-3 py-1 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-black text-[11px] flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
            >
              <Play className="w-3 h-3 fill-stone-950" />
              Écouter l'ambiance radio
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {radioStyles.map((style) => {
              const isSelected = settings.radioAmbience === style.id;
              const Icon = style.icon;
              return (
                <button
                  key={style.id}
                  type="button"
                  onClick={() => handleUpdate({ radioAmbience: style.id, earpieceBeep: true })}
                  className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-start gap-2.5 ${
                    isSelected
                      ? 'border-amber-500 bg-amber-500/10 text-white ring-1 ring-amber-500 shadow-md'
                      : 'bg-stone-900 border-stone-800 hover:border-stone-700 text-stone-300'
                  }`}
                >
                  <div
                    className={`p-2 rounded-xl shrink-0 mt-0.5 ${
                      isSelected ? 'bg-amber-500 text-stone-950' : 'bg-stone-800 text-stone-400'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between text-xs font-bold text-white">
                      <span>{style.title}</span>
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-stone-800 text-amber-400 font-mono">
                        {style.tag}
                      </span>
                    </div>
                    <p className="text-[10.5px] text-stone-400 mt-0.5 leading-snug">
                      {style.desc}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Radio Parameters: Static Carrier Volume & DSP Filter */}
          <div className="pt-2 border-t border-stone-850 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            {/* Carrier Hiss Slider */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-stone-300 font-semibold">Souffle radio en fond</span>
                <span className="font-mono text-amber-400 font-bold">
                  {Math.round((settings.radioStaticVolume ?? 0.35) * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0.0"
                max="0.8"
                step="0.05"
                value={settings.radioStaticVolume ?? 0.35}
                onChange={(e) => handleUpdate({ radioStaticVolume: parseFloat(e.target.value) })}
                className="w-full accent-amber-500 cursor-pointer"
              />
              <div className="flex justify-between text-[9px] text-stone-500 font-mono">
                <span>Discret</span>
                <span>Friture réaliste</span>
              </div>
            </div>

            {/* Filter Toggle */}
            <div
              onClick={() => handleUpdate({ radioDspFilter: !settings.radioDspFilter })}
              className="p-2.5 rounded-xl bg-stone-900 border border-stone-800 flex items-center justify-between cursor-pointer hover:border-stone-700 transition-colors"
            >
              <div className="pr-2">
                <div className="font-bold text-white text-[11px]">Filtre micro oreillette</div>
                <div className="text-[10px] text-stone-400 leading-tight">
                  Effet talkie-walkie (passe-bande 350Hz-3.2kHz)
                </div>
              </div>
              <input
                type="checkbox"
                checked={settings.radioDspFilter}
                onChange={() => {}}
                className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Voice Engine Selector */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider text-stone-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              Moteur de Synthèse Vocale
            </label>
            {testStatusMessage && (
              <span className="text-[11px] font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20 animate-pulse">
                {testStatusMessage}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* Mode 1: Gemini Neural Studio (Default & Recommended) */}
            <div
              onClick={() => handleUpdate({ engineMode: 'gemini_neural' })}
              className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                settings.engineMode === 'gemini_neural'
                  ? 'border-amber-500 bg-amber-500/10 text-white ring-1 ring-amber-500 shadow-md'
                  : 'bg-stone-950 border-stone-800 text-stone-400 hover:border-stone-700'
              }`}
            >
              <div>
                <div className="flex items-center justify-between font-bold text-xs text-white">
                  <span className="flex items-center gap-1.5 text-amber-400">
                    <Sparkles className="w-3.5 h-3.5" />
                    Voix IA Studio HD (Gemini)
                  </span>
                  {settings.engineMode === 'gemini_neural' ? (
                    <span className="text-[10px] bg-amber-500 text-stone-950 px-1.5 py-0.2 rounded font-black">
                      SÉLECTIONNÉ
                    </span>
                  ) : (
                    <span className="text-[10px] text-stone-500 font-mono">
                      Cliquer pour choisir
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-stone-300 mt-1 leading-snug">
                  Directeur sportif vocal réaliste avec intonation et émotion humaine (Haute Fidélité).
                </p>
              </div>

              <div className="mt-3 pt-2 border-t border-amber-500/20 flex items-center justify-between">
                <span className="text-[10px] text-amber-400/90 font-mono">
                  ★ Qualité Studio
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleUpdate({ engineMode: 'gemini_neural' });
                    handleTest('effort', 'gemini_neural');
                  }}
                  disabled={isPlayingSample}
                  className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 text-[10px] font-black flex items-center gap-1 cursor-pointer transition-all shadow disabled:opacity-50"
                >
                  <Play className="w-2.5 h-2.5 fill-stone-950" />
                  Tester Voix IA
                </button>
              </div>
            </div>

            {/* Mode 2: Local Device Web Speech */}
            <div
              onClick={() => handleUpdate({ engineMode: 'browser_speech' })}
              className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                settings.engineMode === 'browser_speech'
                  ? 'border-cyan-500 bg-cyan-500/10 text-white ring-1 ring-cyan-500 shadow-md'
                  : 'bg-stone-950 border-stone-800 text-stone-400 hover:border-stone-700'
              }`}
            >
              <div>
                <div className="flex items-center justify-between font-bold text-xs text-white">
                  <span className="flex items-center gap-1.5 text-cyan-400">
                    <Volume2 className="w-3.5 h-3.5" />
                    Synthèse Locale Instantanée
                  </span>
                  {settings.engineMode === 'browser_speech' ? (
                    <span className="text-[10px] bg-cyan-500 text-stone-950 px-1.5 py-0.2 rounded font-black">
                      SÉLECTIONNÉ
                    </span>
                  ) : (
                    <span className="text-[10px] text-stone-500 font-mono">
                      0 ms Latence
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-stone-300 mt-1 leading-snug">
                  Synthèse embarquée de l'appareil, 100% hors-ligne sans latence de réseau.
                </p>
              </div>

              <div className="mt-3 pt-2 border-t border-cyan-500/20 flex items-center justify-between">
                <span className="text-[10px] text-cyan-400/90 font-mono">
                  ⚡ 0 ms Latence
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleUpdate({ engineMode: 'browser_speech' });
                    handleTest('effort', 'browser_speech');
                  }}
                  disabled={isPlayingSample}
                  className="px-2.5 py-1 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-stone-950 text-[10px] font-black flex items-center gap-1 cursor-pointer transition-all shadow disabled:opacity-50"
                >
                  <Play className="w-2.5 h-2.5 fill-stone-950" />
                  Tester 0 latence
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Coach Persona Selector */}
        <div className="space-y-2.5">
          <label className="text-xs font-bold uppercase tracking-wider text-stone-300 flex items-center gap-1.5">
            <UserCheck className="w-3.5 h-3.5 text-amber-400" />
            Personnalité & Timbre du Coach
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {personas.map((p) => {
              const isSelected = settings.persona === p.id;
              const Icon = p.icon;
              return (
                <button
                  key={p.id}
                  onClick={() => handleUpdate({ persona: p.id })}
                  className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex items-start gap-3 ${
                    isSelected
                      ? `${p.color} ring-1 ring-amber-500 shadow-md`
                      : 'bg-stone-950 border-stone-800 hover:border-stone-700 text-stone-300'
                  }`}
                >
                  <div className="p-2 rounded-xl bg-stone-850 shrink-0 mt-0.5">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-xs text-white flex items-center justify-between">
                      <span className="truncate">{p.title}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-amber-400 shrink-0 ml-1" />}
                    </div>
                    <div className="text-[11px] text-stone-400 mt-0.5 leading-tight">
                      {p.subtitle}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Fallback voice dropdown if browser_speech is selected */}
        {settings.engineMode === 'browser_speech' && (
          <div className="space-y-2 p-3 rounded-2xl bg-stone-950 border border-stone-800">
            <label className="text-xs font-bold text-stone-300 flex items-center justify-between">
              <span>Voix du navigateur sélectionnée :</span>
              <span className="text-[10px] text-stone-500">{availableVoices.length} voix détectées</span>
            </label>

            <select
              value={settings.voiceURI || ''}
              onChange={(e) => handleUpdate({ voiceURI: e.target.value })}
              className="w-full py-2 px-3 rounded-xl bg-stone-900 border border-stone-700 text-xs text-white focus:outline-none focus:border-cyan-500 cursor-pointer"
            >
              <option value="">
                ★ Sélection automatique optimale (adaptée à {settings.persona.replace('_', ' ')})
              </option>
              {availableVoices.map((voice) => {
                const isNatural =
                  voice.name.toLowerCase().includes('natural') ||
                  voice.name.toLowerCase().includes('naturelle') ||
                  voice.name.toLowerCase().includes('online') ||
                  voice.name.toLowerCase().includes('enhanced') ||
                  voice.name.toLowerCase().includes('google') ||
                  voice.name.toLowerCase().includes('siri') ||
                  voice.name.toLowerCase().includes('premium');

                return (
                  <option key={voice.voiceURI} value={voice.voiceURI}>
                    {voice.name} {isNatural ? '★ [Naturelle / HD]' : ''} ({voice.lang})
                  </option>
                );
              })}
            </select>
          </div>
        )}

        {/* Fine Tuning: Speed & Volume */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-2xl bg-stone-950 border border-stone-800">
          {/* Speed */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-stone-300">Vitesse de parole</span>
              <span className="font-mono text-amber-400 font-bold">
                {settings.speedRate.toFixed(2)}x
              </span>
            </div>
            <input
              type="range"
              min="0.85"
              max="1.25"
              step="0.05"
              value={settings.speedRate}
              onChange={(e) => handleUpdate({ speedRate: parseFloat(e.target.value) })}
              className="w-full accent-amber-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-stone-500 font-mono">
              <span>Posé (0.85x)</span>
              <span>1.0x</span>
              <span>Rythmé (1.25x)</span>
            </div>
          </div>

          {/* Volume */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-stone-300">Volume audio</span>
              <span className="font-mono text-emerald-400 font-bold">
                {Math.round(settings.volume * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0.20"
              max="1.0"
              step="0.05"
              value={settings.volume}
              onChange={(e) => handleUpdate({ volume: parseFloat(e.target.value) })}
              className="w-full accent-emerald-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-stone-500 font-mono">
              <span>20%</span>
              <span>100% (Max)</span>
            </div>
          </div>
        </div>

        {/* Live Audio Test Actions */}
        <div className="space-y-2 pt-1 border-t border-stone-800">
          <div className="text-xs font-bold text-amber-400 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Volume2 className="w-3.5 h-3.5" />
              Tester le coach complet ({settings.engineMode === 'gemini_neural' ? 'Voix IA Studio' : 'Synthèse Locale'})
            </span>
            {isPlayingSample && (
              <span className="text-[11px] text-amber-400 flex items-center gap-1 font-normal animate-pulse">
                <Loader2 className="w-3 h-3 animate-spin" />
                Diffusion oreillette...
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <button
              onClick={() => handleTest('effort')}
              disabled={isPlayingSample}
              className={`p-2.5 rounded-xl border text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-60 ${
                activeSampleType === 'effort'
                  ? 'bg-rose-500/20 border-rose-500 text-rose-300 ring-1 ring-rose-500'
                  : 'bg-stone-850 hover:bg-stone-800 border-stone-700 text-rose-300'
              }`}
            >
              <Play className="w-3 h-3 fill-rose-300" />
              <span>Attaque / Sprint (Z5)</span>
            </button>

            <button
              onClick={() => handleTest('recup')}
              disabled={isPlayingSample}
              className={`p-2.5 rounded-xl border text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-60 ${
                activeSampleType === 'recup'
                  ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 ring-1 ring-emerald-500'
                  : 'bg-stone-850 hover:bg-stone-800 border-stone-700 text-emerald-300'
              }`}
            >
              <Play className="w-3 h-3 fill-emerald-300" />
              <span>Récupération (Z1)</span>
            </button>

            <button
              onClick={() => handleTest('conseil')}
              disabled={isPlayingSample}
              className={`p-2.5 rounded-xl border text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-60 ${
                activeSampleType === 'conseil'
                  ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 ring-1 ring-cyan-500'
                  : 'bg-stone-850 hover:bg-stone-800 border-stone-700 text-cyan-300'
              }`}
            >
              <Play className="w-3 h-3 fill-cyan-300" />
              <span>Conseil DS Oreillette</span>
            </button>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-stone-800 pt-4">
          <button
            onClick={() => {
              audioEngine.updateSettings({
                engineMode: 'gemini_neural',
                persona: 'jean_marc_dynamique',
                radioAmbience: 'ds_car',
                radioStaticVolume: 0.35,
                radioDspFilter: true,
                speedRate: 1.0,
                pitch: 1.0,
                volume: 1.0,
                earpieceBeep: true,
                naturalProsody: true,
                effortModulation: true,
              });
              setSettings(audioEngine.getSettings());
            }}
            className="text-xs text-stone-500 hover:text-stone-300 flex items-center gap-1 cursor-pointer transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Réinitialiser</span>
          </button>

          <button
            onClick={onClose}
            className="py-2.5 px-6 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-black text-xs uppercase tracking-wider transition-all cursor-pointer shadow-lg shadow-amber-500/20"
          >
            Enregistrer & Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
