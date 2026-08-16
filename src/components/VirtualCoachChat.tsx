import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage, CyclistProfile, TrainingProgram, WorkoutPlan } from '../types';
import { chatWithCoach, generateTrainingProgram, generateWorkoutPlan } from '../utils/geminiClient';
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
      const data = await chatWithCoach({
        messages: newMessages,
        cyclistProfile,
        currentProgram,
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
    } catch (e) {
      console.error(e);
      setMessages((prev) => [
        ...prev,
        {
          id: 'err-' + Date.now(),
          sender: 'coach',
          text: "Je suis là ! Donnez-moi vos créneaux et vos sensations pour adapter les prochaines séances.",
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExecuteAction = async (action: NonNullable<ChatMessage['suggestedAction']>) => {
    setIsGeneratingAction(true);
    try {
      if (action.type === 'generate_program') {
        const program: TrainingProgram = await generateTrainingProgram({
          cyclistProfile,
          goalDetails: action.payload?.payloadPrompt || cyclistProfile.goalDescription,
          durationWeeks: 4,
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
        });
        onSelectGeneratedPlan(plan);
      }
    } catch (err) {
      console.error(err);
      alert('Erreur lors de la création. Veuillez réessayer.');
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
    <div className="flex flex-col h-[700px] max-h-[85vh] rounded-2xl bg-stone-900 border border-stone-800 shadow-2xl overflow-hidden">
      {/* Header Coach Identity */}
      <div className="p-4 sm:p-5 bg-gradient-to-r from-stone-900 via-stone-900 to-amber-950/40 border-b border-stone-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-12 h-12 rounded-2xl bg-amber-500 text-stone-950 flex items-center justify-center font-black shadow-lg shadow-amber-500/20">
              <Sparkles className="w-6 h-6 fill-stone-950" />
            </div>
            <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-stone-900" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-black text-white">Coach Jean-Marc</h2>
              <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-400 text-[10px] font-bold uppercase tracking-wider">
                Expert Pro FFC
              </span>
            </div>
            <p className="text-xs text-stone-400">
              Entraînement scientifique, objectifs partagés & parcours optimisés
            </p>
          </div>
        </div>

        <button
          onClick={onOpenProfileSettings}
          className="px-3 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-semibold border border-stone-700 transition-colors cursor-pointer flex items-center gap-1.5"
        >
          <Target className="w-3.5 h-3.5 text-amber-400" />
          <span className="hidden sm:inline">Mon Profil & Objectifs</span>
        </button>
      </div>

      {/* Profile quick bar */}
      <div className="px-4 py-2 bg-stone-950/80 border-b border-stone-800/80 text-xs text-stone-400 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <span className="text-stone-300 font-semibold">{cyclistProfile.name}</span>
          <span className="text-stone-600">|</span>
          <span className="capitalize text-amber-400 font-medium">Niveau {cyclistProfile.level.replace('_', ' ')}</span>
          {cyclistProfile.ftpWatts && (
            <>
              <span className="text-stone-600">|</span>
              <span>FTP : <strong className="text-white font-mono">{cyclistProfile.ftpWatts} W</strong></span>
            </>
          )}
          <span className="text-stone-600">|</span>
          <span>Dispo : <strong className="text-white font-mono">{cyclistProfile.weeklyHoursAvailable || 6}h/sem</strong></span>
        </div>

        {currentProgram && (
          <div className="flex items-center gap-1.5 text-emerald-400 font-medium text-[11px]">
            <Award className="w-3.5 h-3.5" />
            <span>Programme actif : {currentProgram.title}</span>
          </div>
        )}
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
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div
                className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-4 text-xs leading-relaxed space-y-3 ${
                  isCoach
                    ? 'bg-stone-850 border border-stone-750 text-stone-100'
                    : 'bg-amber-500 text-stone-950 font-medium'
                }`}
              >
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
