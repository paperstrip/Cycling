import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage, CyclistProfile, TrainingProgram, WorkoutPlan } from '../types';
import {
  chatWithCoach,
  generateTrainingProgram,
  generateWorkoutPlan,
  isOverloadedError,
} from '../utils/geminiClient';
import { loadTrainingSummary } from '../utils/trainingContext';
import {
  Sparkles,
  Send,
  User,
  Bot,
  Calendar,
  Zap,
  Navigation,
  CheckCircle2,
  TrendingUp,
  Target,
  ArrowRight,
  RefreshCw,
  Flame,
  Award,
  BookOpen,
  AlertTriangle,
} from 'lucide-react';

interface VirtualCoachChatProps {
  cyclistProfile: CyclistProfile;
  currentProgram: TrainingProgram | null;
  onSelectGeneratedPlan: (plan: WorkoutPlan) => void;
  onProgramGenerated: (program: TrainingProgram) => void;
  onOpenProfileSettings: () => void;
}

export const VirtualCoachChat: React.FC<VirtualCoachChatProps> = ({
  cyclistProfile,
  currentProgram,
  onSelectGeneratedPlan,
  onProgramGenerated,
  onOpenProfileSettings,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-1',
      sender: 'coach',
      text: `Bonjour ${cyclistProfile.name} ! Je suis Jean-Marc, votre entraîneur cycliste dédié. Mon rôle est de vous accompagner avec une approche professionnelle, qu'il s'agisse de préparer un col mythique, de faire exploser votre puissance au seuil (FTP) ou de structurer votre progression semaine après semaine.`,
      timestamp: Date.now() - 30000,
    },
    {
      id: 'welcome-2',
      sender: 'coach',
      text: `Actuellement, votre objectif enregistré est : "${cyclistProfile.goalDescription || 'Progression globale'}". Que souhaiteriez-vous travailler aujourd'hui ? Nous pouvons concevoir une séance spécifique adaptée à un parcours idéal, ou élaborer un programme complet sur plusieurs semaines.`,
      timestamp: Date.now() - 10000,
      suggestedAction: {
        type: 'generate_program',
        label: 'Créer mon programme d\'entraînement complet (4 semaines)',
        payload: { durationWeeks: 4 },
      },
    },
  ]);

  const [inputVal, setInputVal] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isGeneratingAction, setIsGeneratingAction] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  /**
   * Traduit un échec technique en cause lisible.
   *
   * Une phrase générique présentée comme une réponse du coach masquait l'échec
   * réel : on croyait être ignoré. Chaque cause mène à une action différente,
   * la distinguer est donc utile et pas seulement cosmétique.
   */
  const explainFailure = (e: any): string => {
    const raw = e?.message || String(e || '');
    if (raw.includes('clé API') || raw.includes('API key') || raw.includes('API_KEY')) {
      return "Aucune clé IA n'est configurée. Ajoutez-la via l'icône 🔑 en haut de l'écran pour que le coach puisse répondre.";
    }
    if (raw.includes('429') || raw.includes('RESOURCE_EXHAUSTED') || raw.includes('quota')) {
      return 'Quota IA atteint. Réessayez dans quelques minutes : le coach répondra à nouveau.';
    }
    if (isOverloadedError(e)) {
      // Le message brut de Google est en anglais et enrobé de JSON : inutile de
      // l'infliger. La reprise automatique a déjà échoué quatre fois ici.
      return "Les serveurs de Google sont saturés en ce moment. J'ai déjà réessayé plusieurs fois sans succès — renvoyez votre message dans une minute, ça repartira. Votre clé et votre quota ne sont pas en cause.";
    }
    if (raw.includes('403') || raw.includes('401') || raw.includes('PERMISSION')) {
      return "La clé IA a été refusée. Vérifiez-la via l'icône 🔑 en haut de l'écran.";
    }
    if (raw.includes('fetch') || raw.includes('network')) {
      return 'Pas de connexion : le coach a besoin du réseau pour répondre.';
    }
    // Message technique conservé, mais débarrassé de son enrobage JSON.
    const readable = (raw.match(/"message"\s*:\s*"([^"]+)"/)?.[1] || raw).slice(0, 180);
    return `Le coach n'a pas pu répondre. ${readable}`;
  };

  const pushError = (e: any) => {
    setMessages((prev) => [
      ...prev,
      {
        id: 'err-' + Date.now(),
        sender: 'coach',
        text: explainFailure(e),
        timestamp: Date.now(),
        isError: true,
      },
    ]);
  };

  const handleSendMessage = async (customText?: string) => {
    const textToSend = customText || inputVal.trim();
    if (!textToSend || isLoading) return;

    const userMsg: ChatMessage = {
      id: 'user-' + Date.now(),
      sender: 'cyclist',
      text: textToSend,
      timestamp: Date.now(),
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInputVal('');
    setIsLoading(true);

    try {
      // Le coach ne voyait que le profil déclaré : il ne pouvait donc rien dire
      // de ce qui a été réellement fait. Le bilan est recalculé à chaque
      // message, pour qu'une sortie enregistrée entre-temps compte.
      const trainingSummary = await loadTrainingSummary(cyclistProfile);

      const data = await chatWithCoach({
        messages: newMessages,
        cyclistProfile,
        currentProgram,
        trainingSummary,
      });

      const coachMsg: ChatMessage = {
        id: 'coach-' + Date.now(),
        sender: 'coach',
        text: data.coachReply || "Je prends bien note ! Continuons à bâtir votre progression.",
        timestamp: Date.now(),
        suggestedAction: data.suggestedAction
          ? {
              type: data.suggestedAction.type,
              label: data.suggestedAction.label,
              payload: { payloadPrompt: data.suggestedAction.payloadPrompt },
            }
          : undefined,
      };

      setMessages((prev) => [...prev, coachMsg]);
    } catch (e: any) {
      console.error(e);

      pushError(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExecuteAction = async (action: NonNullable<ChatMessage['suggestedAction']>) => {
    setIsGeneratingAction(true);
    try {
      const trainingSummary = await loadTrainingSummary(cyclistProfile);

      if (action.type === 'generate_program') {
        const program: TrainingProgram = await generateTrainingProgram({
          cyclistProfile,
          goalDetails: action.payload?.payloadPrompt || cyclistProfile.goalDescription,
          durationWeeks: 4,
          trainingSummary,
        });
        onProgramGenerated(program);

        setMessages((prev) => [
          ...prev,
          {
            id: 'prog-created-' + Date.now(),
            sender: 'coach',
            text: `🎯 Votre programme complet **"${program.title}"** sur ${program.durationWeeks} semaines est prêt et activé ! Vous pouvez consulter le planning détaillé des séances dès maintenant.`,
            timestamp: Date.now(),
          },
        ]);
      } else if (action.type === 'generate_plan' || action.type === 'start_workout') {
        const promptToUse = action.payload?.payloadPrompt || 'Séance spécifique pour progression ' + cyclistProfile.primaryGoal;
        const plan: WorkoutPlan = await generateWorkoutPlan({
          prompt: promptToUse,
          cyclistProfile,
          trainingSummary,
        });
        onSelectGeneratedPlan(plan);
      }
    } catch (err) {
      console.error(err);
      // Une `alert()` sortait de la conversation et n'apprenait rien : la cause
      // s'affiche désormais dans le fil, au même endroit que le reste.
      pushError(err);
    } finally {
      setIsGeneratingAction(false);
    }
  };

  const quickPrompts = [
    "Comment améliorer ma puissance au seuil FTP ?",
    "Crée-moi un programme de 4 semaines pour une cyclosportive de 120 km",
    "J'ai 1h ce soir, quelle séance de fractionné faire avec quel parcours ?",
    "Comment bien récupérer après une sortie longue et intense ?",
  ];

  return (
    // Hauteur calée sur la fenêtre (dvh tient compte des barres mobiles) : la
    // conversation défile dans son propre cadre, sans double défilement.
    <div className="flex flex-col h-[calc(100dvh-13rem)] min-h-[26rem] md:h-[700px] md:max-h-[85vh] rounded-2xl bg-stone-900 border border-stone-800 shadow-2xl overflow-hidden">
      {/* En-tête compact : le contexte du cycliste tient sur une ligne, la
          conversation occupe le reste de l'écran. L'empilement précédent
          consommait un tiers de la hauteur avant le premier message. */}
      <div className="px-4 py-3 bg-stone-900 border-b border-stone-800 flex items-center gap-3">
        <div className="relative shrink-0">
          <div className="w-9 h-9 rounded-xl bg-amber-500 text-stone-950 flex items-center justify-center">
            <Sparkles className="w-4.5 h-4.5 fill-stone-950" />
          </div>
          <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-stone-900" />
        </div>

        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-black text-white leading-tight">Coach Jean-Marc</h2>
          <p className="text-[10.5px] text-stone-400 truncate">
            {cyclistProfile.ftpWatts ? `${cyclistProfile.ftpWatts} W` : 'FTP à définir'} ·{' '}
            {cyclistProfile.weeklyHoursAvailable || 6} h/sem
            {currentProgram ? ` · ${currentProgram.title}` : ''}
          </p>
        </div>

        <button
          onClick={onOpenProfileSettings}
          aria-label="Mon profil et mes objectifs"
          className="p-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-amber-400 border border-stone-700 transition-colors cursor-pointer shrink-0"
        >
          <Target className="w-4 h-4" />
        </button>
      </div>

      {/* Messages List */}
      <div className="flex-1 p-4 sm:p-5 overflow-y-auto space-y-4">
        {messages.map((msg) => {
          const isCoach = msg.sender === 'coach';
          return (
            <div
              key={msg.id}
              className={`flex items-start gap-3 ${isCoach ? 'justify-start' : 'justify-end'}`}
            >
              {isCoach && (
                <div
                  className={`w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 mt-0.5 ${
                    msg.isError
                      ? 'bg-rose-500/20 border-rose-500/40 text-rose-400'
                      : 'bg-amber-500/20 border-amber-500/30 text-amber-400'
                  }`}
                >
                  {msg.isError ? <AlertTriangle className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>
              )}

              <div
                className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-4 text-xs leading-relaxed space-y-3 ${
                  msg.isError
                    ? 'bg-rose-500/10 border border-rose-500/40 text-rose-200'
                    : isCoach
                      ? 'bg-stone-850 border border-stone-750 text-stone-100'
                      : 'bg-amber-500 text-stone-950 font-medium'
                }`}
              >
                {msg.isError && (
                  <div className="text-[10px] font-black uppercase tracking-wider text-rose-400">
                    Le coach n'a pas pu répondre
                  </div>
                )}
                <div className="whitespace-pre-line font-normal">
                  {msg.text}
                </div>

                {/* Suggested Action Button inside Coach bubble */}
                {isCoach && msg.suggestedAction && (
                  <div className="pt-2 border-t border-stone-700/60">
                    <button
                      onClick={() => handleExecuteAction(msg.suggestedAction!)}
                      disabled={isGeneratingAction}
                      className="w-full py-2.5 px-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-stone-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all cursor-pointer disabled:opacity-50"
                    >
                      {isGeneratingAction ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Conception en cours avec Jean-Marc...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5 fill-stone-950" />
                          <span>{msg.suggestedAction.label}</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </>
                      )}
                    </button>
                  </div>
                )}

                <div
                  className={`text-[10px] text-right ${
                    isCoach ? 'text-stone-500' : 'text-stone-900/70'
                  }`}
                >
                  {new Date(msg.timestamp).toLocaleTimeString('fr-FR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              </div>

              {!isCoach && (
                <div className="w-8 h-8 rounded-xl bg-stone-800 text-amber-400 flex items-center justify-center shrink-0 mt-0.5 border border-stone-700">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          );
        })}

        {isLoading && (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4" />
            </div>
            <div className="p-3.5 rounded-2xl bg-stone-850 border border-stone-800 text-xs text-amber-400 flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
              <span>Jean-Marc réfléchit à la meilleure stratégie d'entraînement...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Quick Prompts */}
      <div className="px-4 py-2.5 bg-stone-950 border-t border-stone-800/80 flex items-center gap-2 overflow-x-auto no-scrollbar">
        <span className="text-[10px] uppercase font-bold text-stone-500 shrink-0">Idées :</span>
        {quickPrompts.map((qp, idx) => (
          <button
            key={idx}
            onClick={() => handleSendMessage(qp)}
            disabled={isLoading || isGeneratingAction}
            className="px-2.5 py-1 rounded-lg bg-stone-900 hover:bg-stone-800 border border-stone-800 hover:border-amber-500/40 text-[11px] text-stone-300 whitespace-nowrap transition-colors cursor-pointer disabled:opacity-50"
          >
            {qp}
          </button>
        ))}
      </div>

      {/* Input Box */}
      <div className="p-3 sm:p-4 bg-stone-900 border-t border-stone-800">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center gap-2"
        >
          <input
            id="coach-chat-input"
            type="text"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            placeholder="Échangez avec votre coach (ex: mes sensations, mes courses, mes objectifs...)"
            disabled={isLoading || isGeneratingAction}
            className="flex-1 px-4 py-3 rounded-xl bg-stone-950 border border-stone-800 focus:border-amber-500 focus:outline-none text-white text-xs placeholder:text-stone-500 transition-colors"
          />

          <button
            id="coach-chat-submit"
            type="submit"
            disabled={!inputVal.trim() || isLoading || isGeneratingAction}
            className="py-3 px-5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-black text-xs uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-amber-500/20"
          >
            <Send className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Envoyer</span>
          </button>
        </form>
      </div>
    </div>
  );
};
