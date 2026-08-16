/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Client Gemini exécuté directement dans le navigateur.
 *
 * Ce module remplace l'ancien serveur Express (`server.ts`) qui exposait les
 * routes `/api/*`. L'application peut ainsi être hébergée en statique
 * (GitHub Pages) sans aucun backend.
 */

import { GoogleGenAI, Modality, Type } from '@google/genai';
import { getApiKey, MissingApiKeyError, onApiKeyChange } from './apiKey';

const TEXT_MODEL = 'gemini-3.7-flash';
const TTS_MODEL = 'gemini-3.1-flash-tts-preview';

let cachedClient: GoogleGenAI | null = null;
let cachedKey = '';

// La clé peut changer en cours de session : on invalide le client mémorisé.
onApiKeyChange(() => {
  cachedClient = null;
  cachedKey = '';
});

function getClient(): GoogleGenAI {
  const apiKey = getApiKey();
  if (!apiKey) throw new MissingApiKeyError();
  if (!cachedClient || cachedKey !== apiKey) {
    cachedClient = new GoogleGenAI({ apiKey });
    cachedKey = apiKey;
  }
  return cachedClient;
}

function parseJson<T>(raw: string | undefined): T {
  return JSON.parse(raw || '{}') as T;
}

/** Détecte un dépassement de quota Gemini (utilisé pour le repli voix locale). */
export function isQuotaError(error: any): boolean {
  const asText =
    typeof error === 'string' ? error : error?.message || JSON.stringify(error) || '';
  return (
    error?.status === 429 ||
    asText.includes('429') ||
    asText.includes('RESOURCE_EXHAUSTED') ||
    asText.includes('Quota exceeded') ||
    asText.includes('quota')
  );
}

/* ------------------------------------------------------------------ */
/* 1. Génération d'une séance à partir d'une description libre         */
/* ------------------------------------------------------------------ */

export async function generateWorkoutPlan(params: {
  prompt: string;
  cyclistProfile?: any;
  userLocation?: { lat: number; lng: number } | null;
}): Promise<any> {
  const { prompt, cyclistProfile, userLocation } = params;
  if (!prompt || typeof prompt !== 'string') {
    throw new Error('Le champ prompt est requis');
  }

  const systemInstruction = `Tu es Jean-Marc, entraîneur cycliste professionnel d'élite (ex-Directeur Sportif WorldTour et physiologiste diplômé FFC/UCI).
Tu entraînes aussi bien des cyclistes amateurs motivés que des compétiteurs exigeants.
Ton objectif est de créer une séance d'entraînement cycliste structurée, scientifiquement précise et adaptée à la demande de l'utilisateur.

Pour chaque séance :
1. Échauffement progressif (6 à 15 minutes, cible 'facile' ou 'moyen') avec activation neuromusculaire.
2. Corps de séance précis (intervalles, tempo, seuil, PMA/VO2max, sprints ou endurance) avec cadences cibles (ex: 95-100 rpm pour la vélocité, 55-65 rpm pour la force sous-max).
3. Retour au calme (5 à 10 minutes, cible 'facile').
4. Des consignes vocales courtes et percutantes pour la synthèse vocale pendant le roulage.
5. Des conseils de pro (nutrition de l'effort, technique de pédalage, gestion mentale de la douleur).
6. Un itinéraire recommandé adapté à la nature des intervalles (ex: longues lignes droites sans feux pour du Sweetspot/Seuil, faux-plat montant ou côte régulière pour du VO2max/Force, boucle plate pour les sprints).

Les valeurs d'intensité acceptées sont :
- 'facile' (Z1/Z2 - Endurance fondamentale / Récupération active)
- 'moyen' (Z3 - Tempo / Rythme soutenu)
- 'seuil' (Z4 - Seuil lactique / SweetSpot 88-94% FTP)
- 'a_fond' (Z5-Z7 - PMA / VO2max / Anaérobie / Sprint maximal)`;

  const profileContext = cyclistProfile
    ? `Profil du cycliste : Niveau=${cyclistProfile.level || 'intermediaire'}, Objectif=${cyclistProfile.primaryGoal || 'puissance_ftp'}, FTP=${cyclistProfile.ftpWatts || 250}W, FC Max=${cyclistProfile.maxHeartRate || 185}bpm, Heures/semaine=${cyclistProfile.weeklyHoursAvailable || 6}h.`
    : '';

  const locationContext =
    userLocation?.lat && userLocation?.lng
      ? `Localisation départ approximative : Lat ${userLocation.lat.toFixed(4)}, Lng ${userLocation.lng.toFixed(4)}.`
      : '';

  const response = await getClient().models.generateContent({
    model: TEXT_MODEL,
    contents: `Génère une séance cycliste d'élite complète pour : "${prompt}". ${profileContext} ${locationContext}`,
    config: {
      systemInstruction,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          nom: {
            type: Type.STRING,
            description:
              "Titre court et professionnel (ex: VO2max 5x(2'/2') en Faux-Plat, Sweetspot 3x10min Haute Cadence)",
          },
          description: {
            type: Type.STRING,
            description: 'Explication physiologique claire des bénéfices et adaptations visées',
          },
          objectif: {
            type: Type.STRING,
            description:
              'Objectif clé (ex: Développement de la puissance aérobie maximale & tolérance lactique)',
          },
          difficultyRating: {
            type: Type.INTEGER,
            description: "Niveau d'exigence physique de 1 (très facile) à 5 (extrême)",
          },
          targetTSS: {
            type: Type.INTEGER,
            description: "Estimation de la charge d'entraînement Training Stress Score (ex: 65)",
          },
          coachTips: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description:
              "3 à 4 conseils d'experts sur l'hydratation, la cadence, la posture et la respiration",
          },
          blocs: {
            type: Type.ARRAY,
            description: "Liste chronologique des blocs d'entraînement",
            items: {
              type: Type.OBJECT,
              properties: {
                type: {
                  type: Type.STRING,
                  description: "Type de bloc : 'echauffement', 'effort', 'recup', ou 'retour_calme'",
                },
                duree_sec: {
                  type: Type.INTEGER,
                  description: 'Durée en secondes de la phase principale',
                },
                cible: {
                  type: Type.STRING,
                  description: "Intensité cible : 'facile', 'moyen', 'seuil', 'a_fond'",
                },
                repetitions: {
                  type: Type.INTEGER,
                  description: 'Nombre de répétitions (optionnel)',
                },
                recup_sec: {
                  type: Type.INTEGER,
                  description:
                    'Durée en secondes de la récupération entre répétitions (optionnel)',
                },
                recup_cible: {
                  type: Type.STRING,
                  description: "Intensité de la récupération (ex: 'facile')",
                },
                consigne_vocale: {
                  type: Type.STRING,
                  description: 'Instruction courte (<15 mots) et motivante prononcée au départ du bloc',
                },
                cadence_recommandee: {
                  type: Type.STRING,
                  description: "Plage de cadence conseillée (ex: '90-95 rpm')",
                },
                focus_technique: {
                  type: Type.STRING,
                  description:
                    "Point technique (ex: 'Buste stable, mains aux cocottes, épaules relâchées')",
                },
              },
              required: ['type', 'duree_sec', 'cible', 'consigne_vocale'],
            },
          },
          routeSuggestion: {
            type: Type.OBJECT,
            description: 'Itinéraire suggéré et adapté à la séance',
            properties: {
              id: { type: Type.STRING },
              name: {
                type: Type.STRING,
                description: 'Nom évocateur du parcours (ex: Circuit des Coteaux & Faux-Plats)',
              },
              description: {
                type: Type.STRING,
                description: 'Description du profil topo et des conditions idéales',
              },
              estimatedDistanceKm: { type: Type.NUMBER, description: 'Distance totale estimée en km' },
              totalAscentM: { type: Type.NUMBER, description: 'Dénivelé positif estimé en mètres' },
              terrainType: {
                type: Type.STRING,
                description: "'plat' | 'vallonne' | 'montagne' | 'urbain_et_campagne'",
              },
              recommendedBikeType: {
                type: Type.STRING,
                description: "'route' | 'gravel' | 'clm' | 'polyvalent'",
              },
              idealForWorkout: {
                type: Type.STRING,
                description: 'Pourquoi ce type de profil convient exactement aux blocs',
              },
              pacingStrategy: {
                type: Type.STRING,
                description:
                  'Conseil de gestion de parcours (ex: Garder du braquet dans les descentes, placer les séries dans la montée)',
              },
              safetyTips: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: '2 à 3 consignes de sécurité (visibilité, priorités, carrefours)',
              },
              waypoints: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    elevationM: { type: Type.NUMBER },
                    distanceFromStartKm: { type: Type.NUMBER },
                    instruction: { type: Type.STRING },
                    segmentType: {
                      type: Type.STRING,
                      description:
                        "'plat' | 'faux_plat_montant' | 'cote_raide' | 'descente' | 'ligne_droite_roulante'",
                    },
                    pacingAdvice: { type: Type.STRING },
                  },
                  required: [
                    'name',
                    'elevationM',
                    'distanceFromStartKm',
                    'instruction',
                    'segmentType',
                  ],
                },
              },
            },
            required: [
              'name',
              'description',
              'estimatedDistanceKm',
              'totalAscentM',
              'terrainType',
              'idealForWorkout',
              'pacingStrategy',
              'waypoints',
            ],
          },
        },
        required: ['nom', 'description', 'objectif', 'blocs', 'coachTips', 'routeSuggestion'],
      },
    },
  });

  const parsed = parseJson<any>(response.text);
  if (parsed.routeSuggestion && !parsed.routeSuggestion.id) {
    parsed.routeSuggestion.id = 'route-' + Date.now();
  }
  return parsed;
}

/* ------------------------------------------------------------------ */
/* 2. Chat avec le coach virtuel                                       */
/* ------------------------------------------------------------------ */

export async function chatWithCoach(params: {
  messages: any[];
  cyclistProfile?: any;
  currentProgram?: any;
}): Promise<{ coachReply: string; suggestedAction?: any }> {
  const { messages, cyclistProfile, currentProgram } = params;
  if (!messages || !Array.isArray(messages)) {
    throw new Error('Historique de messages requis');
  }

  const systemInstruction = `Tu es Jean-Marc, entraîneur cycliste virtuel d'exception.
Ton approche combine rigueur scientifique de l'entraînement moderne (puissance, FTP, TSS, polarisation 80/20, périodisation, surcompensation) et grande proximité humaine, bienveillante et très encourageante.
Tu t'adresses aussi bien à un débutant qui veut préparer sa première cyclo de 50km qu'à un coureur FFC/Granfondo cherchant à franchir un palier.

Dans tes échanges :
- Pose des questions pertinentes si des éléments manquent (disponibilités hebdomadaires, ressenti de fatigue, échéance d'objectif, matériel capteur/cardio).
- Félicite chaleureusement les réussites et donne des encouragements puissants et professionnels.
- Lorsque l'utilisateur a clarifié son besoin ou souhaite un programme complet, propose-lui explicitement d'éditer ou de générer son programme d'entraînement personnalisé ou une séance clé.
- Reste toujours dans ton rôle d'entraîneur de vélo passionné, constructif et motivant. Réponds en français clair, précis et dynamique.`;

  const conversationHistory = messages
    .map((m: any) => `${m.sender === 'cyclist' ? 'Cycliste' : 'Coach Jean-Marc'}: ${m.text}`)
    .join('\n');

  const profileContext = cyclistProfile
    ? `Profil connu : Nom=${cyclistProfile.name || 'Cycliste'}, Niveau=${cyclistProfile.level || 'intermediaire'}, Objectif=${cyclistProfile.primaryGoal || 'Progression'}, FTP=${cyclistProfile.ftpWatts || 'Non renseigné'}W, Volume dispo=${cyclistProfile.weeklyHoursAvailable || 6}h/semaine.`
    : 'Profil non encore configuré.';

  const programContext = currentProgram
    ? `Programme en cours : "${currentProgram.title}" (${currentProgram.durationWeeks} semaines).`
    : 'Aucun programme actif pour le moment.';

  const prompt = `Contexte :\n${profileContext}\n${programContext}\n\nHistorique de la discussion :\n${conversationHistory}\n\nDonne la prochaine réponse du Coach Jean-Marc. Sois chaleureux, motivant et d'une expertise irréprochable. Si la discussion converge vers la création d'un programme complet ou d'une séance spécifique, indique une suggestion d'action concrète.`;

  const response = await getClient().models.generateContent({
    model: TEXT_MODEL,
    contents: prompt,
    config: {
      systemInstruction,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          coachReply: {
            type: Type.STRING,
            description: "Le texte de réponse de l'entraîneur (chaleureux, professionnel, structuré)",
          },
          suggestedAction: {
            type: Type.OBJECT,
            properties: {
              type: {
                type: Type.STRING,
                description: "'generate_program' | 'generate_plan' | 'suggest_route' | 'start_workout'",
              },
              label: {
                type: Type.STRING,
                description:
                  "Texte du bouton d'action suggéré (ex: 'Créer mon programme sur 4 semaines', 'Générer la séance Seuil')",
              },
              payloadPrompt: {
                type: Type.STRING,
                description: "Prompt affiné prêt à l'emploi pour lancer la génération",
              },
            },
          },
        },
        required: ['coachReply'],
      },
    },
  });

  return parseJson(response.text);
}

/* ------------------------------------------------------------------ */
/* 3. Génération d'un programme complet sur plusieurs semaines         */
/* ------------------------------------------------------------------ */

export async function generateTrainingProgram(params: {
  cyclistProfile?: any;
  goalDetails?: string;
  durationWeeks?: number;
}): Promise<any> {
  const { cyclistProfile, goalDetails, durationWeeks = 4 } = params;

  const systemInstruction = `Tu es un maître entraîneur cycliste créant un programme d'entraînement complet, progressif et structuré sur plusieurs semaines.
Applique les principes physiologiques fondamentaux :
- Périodisation (phase de reprise/foncier, phase de développement spécifique, phase d'affûtage/tapering).
- Équilibre charge/récupération (principe de surcompensation, jamais 3 séances dures consécutives, inclusion de jours de repos et de récupération active).
- Progression hebdomadaire de la charge (semaine de décharge programmée toutes les 3 ou 4 semaines).
- Pour chaque jour de la semaine, attribue un type de séance précis et, pour les séances clés de vélo, fournis la structure complète des blocs avec intensités et consignes vocales.`;

  const profileText = cyclistProfile
    ? `Cycliste : Niveau=${cyclistProfile.level || 'intermediaire'}, Objectif principal=${cyclistProfile.primaryGoal || 'Progression'}, Description objectif=${cyclistProfile.goalDescription || ''}, FTP=${cyclistProfile.ftpWatts || 240}W, Heures dispo par semaine=${cyclistProfile.weeklyHoursAvailable || 6}h.`
    : `Cycliste intermédiaire, 6 heures disponibles par semaine.`;

  const prompt = `Crée un programme cycliste professionnel complet sur ${durationWeeks} semaines.
${profileText}
Détails supplémentaires : ${goalDetails || 'Progression générale en endurance, puissance au seuil et aisance en montée'}.

Chaque semaine doit contenir :
- Une séance d'endurance fondamentale (Z2)
- Une ou deux séances d'intervalles spécifiques (VO2max, Sweetspot, Fartlek ou PMA selon la phase)
- Des jours de repos ou de récupération active (moulinage très souple Z1)
- Une sortie longue le week-end`;

  const response = await getClient().models.generateContent({
    model: TEXT_MODEL,
    contents: prompt,
    config: {
      systemInstruction,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: {
            type: Type.STRING,
            description:
              'Nom percutant du programme (ex: Programme Objectif 100km & Puissance FTP - 4 Semaines)',
          },
          overview: {
            type: Type.STRING,
            description: "Présentation de la stratégie d'entraînement et des paliers de progression",
          },
          durationWeeks: { type: Type.INTEGER },
          targetGoal: { type: Type.STRING },
          cyclistLevel: { type: Type.STRING },
          weeklyVolumeHours: { type: Type.NUMBER },
          pedagogicalAdvice: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description:
              "5 conseils clés d'entraînement professionnel (sommeil, nutrition glucidique, respect des allures lentes Z2, affûtage, régularité)",
          },
          workouts: {
            type: Type.ARRAY,
            description:
              'Liste chronologique des séances du programme (ex: 28 séances pour 4 semaines, 7 jours par semaine)',
            items: {
              type: Type.OBJECT,
              properties: {
                dayNumber: { type: Type.INTEGER, description: 'Numéro de jour (1, 2, 3...)' },
                dayOfWeek: {
                  type: Type.STRING,
                  description: 'Lundi, Mardi, Mercredi, Jeudi, Vendredi, Samedi, Dimanche',
                },
                title: {
                  type: Type.STRING,
                  description:
                    'Titre de la séance (ex: Intervalles PMA 30/30, Sortie Longue Endurance, Repos Complet)',
                },
                type: {
                  type: Type.STRING,
                  description: "'velo' | 'recup_active' | 'repos' | 'renfo_core'",
                },
                targetDurationMinutes: {
                  type: Type.INTEGER,
                  description: 'Durée totale estimée en minutes',
                },
                notes: { type: Type.STRING, description: "Consignes de l'entraîneur pour cette journée" },
                workoutPlan: {
                  type: Type.OBJECT,
                  description: "Plan détaillé si c'est une séance sur le vélo",
                  properties: {
                    nom: { type: Type.STRING },
                    description: { type: Type.STRING },
                    objectif: { type: Type.STRING },
                    blocs: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          type: { type: Type.STRING },
                          duree_sec: { type: Type.INTEGER },
                          cible: { type: Type.STRING },
                          repetitions: { type: Type.INTEGER },
                          recup_sec: { type: Type.INTEGER },
                          recup_cible: { type: Type.STRING },
                          consigne_vocale: { type: Type.STRING },
                          cadence_recommandee: { type: Type.STRING },
                        },
                        required: ['type', 'duree_sec', 'cible', 'consigne_vocale'],
                      },
                    },
                  },
                  required: ['nom', 'description', 'objectif', 'blocs'],
                },
              },
              required: ['dayNumber', 'dayOfWeek', 'title', 'type', 'targetDurationMinutes', 'notes'],
            },
          },
        },
        required: ['title', 'overview', 'durationWeeks', 'targetGoal', 'pedagogicalAdvice', 'workouts'],
      },
    },
  });

  const parsed = parseJson<any>(response.text);
  parsed.id = 'program-' + Date.now();
  parsed.createdAt = new Date().toISOString();
  return parsed;
}

/* ------------------------------------------------------------------ */
/* 4. Génération d'un itinéraire adapté à la séance                    */
/* ------------------------------------------------------------------ */

export async function generateRoute(params: {
  workoutPlan?: any;
  userLocation?: { lat: number; lng: number } | null;
  terrainPreference?: string;
  targetDistanceKm?: number;
}): Promise<any> {
  const { workoutPlan, userLocation, terrainPreference, targetDistanceKm } = params;

  const systemInstruction = `Tu es un cartographe et entraîneur cycliste expert.
Tu crées un itinéraire d'entraînement cycliste idéal en phase exacte avec les besoins physiologiques de la séance.
Par exemple :
- Pour du Seuil / Sweetspot : Privilégie de longues sections planes ou faux-plats roulants continus sans intersections dangereuses.
- Pour du VO2max / PMA : Prévois des segments en côte régulière ou faux-plats montants pour favoriser le maintien d'une puissance élevée sans bloquer par la vitesse en descente.
- Pour de la Récupération active : Parcours plat, bitume lisse, zéro fort pourcentage.

Donne des waypoints précis, le profil d'élévation, les conseils de braquet/rythme et les consignes de sécurité.`;

  const prompt = `Génère un itinéraire cycliste optimal pour cette séance :
- Séance : "${workoutPlan?.nom || 'Entraînement cycliste'}" (${workoutPlan?.objectif || ''})
- Durée prévue : ${Math.round(
    (workoutPlan?.blocs?.reduce(
      (acc: number, b: any) => acc + b.duree_sec * (b.repetitions || 1),
      0,
    ) || 3600) / 60,
  )} minutes
- Distance cible souhaitée : ${targetDistanceKm || 35} km
- Terrain préféré : ${terrainPreference || 'vallonne'}
- Localisation approximative : Lat ${userLocation?.lat || 48.8566}, Lng ${userLocation?.lng || 2.3522}`;

  const response = await getClient().models.generateContent({
    model: TEXT_MODEL,
    contents: prompt,
    config: {
      systemInstruction,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          name: {
            type: Type.STRING,
            description: 'Nom du parcours (ex: Boucle des Plateaux & Faux-Plats du Sud)',
          },
          description: { type: Type.STRING, description: 'Description complète du tracé' },
          estimatedDistanceKm: { type: Type.NUMBER },
          totalAscentM: { type: Type.NUMBER },
          terrainType: { type: Type.STRING },
          recommendedBikeType: { type: Type.STRING },
          idealForWorkout: {
            type: Type.STRING,
            description: 'Pourquoi ce parcours est parfait pour les intervalles prévus',
          },
          pacingStrategy: {
            type: Type.STRING,
            description: "Comment gérer son braquet, son allure et son effort sur chaque secteur",
          },
          safetyTips: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          waypoints: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                elevationM: { type: Type.NUMBER },
                distanceFromStartKm: { type: Type.NUMBER },
                instruction: { type: Type.STRING },
                segmentType: { type: Type.STRING },
                pacingAdvice: { type: Type.STRING },
              },
              required: ['name', 'elevationM', 'distanceFromStartKm', 'instruction', 'segmentType'],
            },
          },
        },
        required: [
          'name',
          'description',
          'estimatedDistanceKm',
          'totalAscentM',
          'terrainType',
          'idealForWorkout',
          'pacingStrategy',
          'waypoints',
          'safetyTips',
        ],
      },
    },
  });

  const parsed = parseJson<any>(response.text);
  parsed.id = 'route-' + Date.now();
  return parsed;
}

/* ------------------------------------------------------------------ */
/* 5. Débriefing post-séance                                           */
/* ------------------------------------------------------------------ */

const FALLBACK_DEBRIEF =
  'Bravo pour cette belle séance ! Vous avez respecté l\'engagement sur les blocs clés. Pensez à bien vous hydrater et consommer des protéines et glucides dans les 30 minutes qui suivent.';

export async function generateRideDebrief(params: {
  rideRecord?: any;
  cyclistProfile?: any;
}): Promise<string> {
  const { rideRecord, cyclistProfile } = params;

  try {
    const prompt = `Analyse cette sortie cycliste terminée :
- Séance prévue : ${rideRecord?.planName} (${rideRecord?.planGoal})
- Durée totale : ${Math.round(rideRecord?.totalDurationSec / 60)} minutes
- Distance totale : ${rideRecord?.totalDistanceKm.toFixed(1)} km
- Vitesse moyenne : ${rideRecord?.avgSpeedKmh.toFixed(1)} km/h
- Vitesse max : ${rideRecord?.maxSpeedKmh.toFixed(1)} km/h
- Blocs exécutés : ${rideRecord?.steps?.length || 0}
Détail des blocs :
${rideRecord?.steps
  ?.map(
    (s: any, idx: number) =>
      `Bloc ${idx + 1} (${s.title}, cible: ${s.targetIntensity}): prévu ${s.plannedDurationSec}s, réalisé ${s.actualDurationSec}s, vitesse moy ${s.avgSpeedKmh.toFixed(1)}km/h`,
  )
  .join('\n')}

Profil coureur : Niveau=${cyclistProfile?.level || 'intermediaire'}, Objectif=${cyclistProfile?.primaryGoal || 'Progression'}.

En tant que Coach d'élite Jean-Marc, rédige un débriefing post-séance constructif et motivant en 3 parties :
1. Les points forts et le respect des cibles physiologiques.
2. Les axes d'amélioration technique/gestion d'effort.
3. Le conseil de récupération immédiat (nutrition de récupération, étirements/sommeil, prochaine séance).`;

    const response = await getClient().models.generateContent({
      model: TEXT_MODEL,
      contents: prompt,
      config: {
        systemInstruction:
          'Tu es Jean-Marc, entraîneur cycliste professionnel. Ton débriefing doit être motivant, valorisant mais techniquement aiguisé pour faire progresser le coureur.',
      },
    });

    return response.text || FALLBACK_DEBRIEF;
  } catch (error) {
    console.warn('Erreur debrief coach:', error);
    return FALLBACK_DEBRIEF;
  }
}

/* ------------------------------------------------------------------ */
/* 6. Commentaire motivant en direct pendant la sortie                 */
/* ------------------------------------------------------------------ */

const FALLBACK_MOTIVATION =
  'Garde le rythme et fluidifie ton coup de pédale, tu es parfaitement dans l\'allure !';

export async function generateLiveMotivation(payload: {
  blockName?: string;
  blockType?: string;
  targetIntensity?: string;
  timeRemainingInBlockSec?: number;
  totalTimeElapsedSec?: number;
  currentSpeedKmh?: number;
  averageSpeedKmh?: number;
  currentDistanceKm?: number;
  workoutGoal?: string;
  stepNumber?: number;
  totalSteps?: number;
  cyclistName?: string;
  cyclistLevel?: string;
}): Promise<string> {
  try {
    const prompt = `Données télémétriques actuelles du cycliste :
- Coureur : ${payload.cyclistName || 'Champion'} (Niveau: ${payload.cyclistLevel || 'intermédiaire'})
- Étape : ${payload.stepNumber || 1} sur ${payload.totalSteps || 1} (${payload.blockName || 'Bloc en cours'})
- Type de bloc : ${payload.blockType || 'effort'}
- Intensité requise : ${payload.targetIntensity || 'a_fond'}
- Temps restant dans le bloc : ${Math.round(payload.timeRemainingInBlockSec || 0)}s
- Temps total écoulé : ${Math.floor((payload.totalTimeElapsedSec || 0) / 60)} min
- Vitesse instantanée : ${(payload.currentSpeedKmh || 0).toFixed(1)} km/h
- Vitesse moyenne globale : ${(payload.averageSpeedKmh || 0).toFixed(1)} km/h
- Distance parcourue : ${(payload.currentDistanceKm || 0).toFixed(2)} km
- Objectif global : ${payload.workoutGoal || 'Entraînement'}

Rédige un message audio de coach cycliste en français : 1 à 2 phrases courtes, très énergiques, impactantes et rythmées (maximum 25 mots), adaptées à la situation pour motiver, encourager avec passion ou réguler l'effort. Pas de fioritures, pas de balises.`;

    const response = await getClient().models.generateContent({
      model: TEXT_MODEL,
      contents: prompt,
      config: {
        systemInstruction:
          "Tu es Jean-Marc, coach cycliste d'élite dans l'oreillette d'un coureur en plein effort. Sois direct, dynamique, bienveillant mais exigeant. Donne des conseils précis (posture, cadence, régularité, respiration ventrale, relance en danseuse, gainage).",
        temperature: 0.85,
      },
    });

    return (response.text || '').trim().replace(/^["']|["']$/g, '') || FALLBACK_MOTIVATION;
  } catch (error) {
    console.warn('Erreur commentaire coach:', error);
    return FALLBACK_MOTIVATION;
  }
}

/* ------------------------------------------------------------------ */
/* 6 bis. Analyse semi-temps réel de la sortie                         */
/* ------------------------------------------------------------------ */

export interface LiveAnalysisInput {
  /** Motif du déclenchement, pour cadrer la réponse. */
  reason: string;
  blockName: string;
  blockType: string;
  targetIntensity: string;
  stepNumber: number;
  totalSteps: number;
  stepElapsedSec: number;
  stepRemainingSec: number;
  totalElapsedSec: number;
  currentSpeedKmh: number;
  avgSpeedInBlockKmh: number;
  targetSpeedKmh: number;
  deviationPercent: number;
  verdict: string;
  trend: string;
  variability: number;
  totalDistanceKm: number;
  workoutGoal: string;
  cyclistName?: string;
  cyclistLevel?: string;
  /** Derniers messages déjà prononcés, pour ne pas se répéter. */
  recentMessages: string[];
}

export interface LiveAnalysisResult {
  /** Phrase courte prononcée dans l'oreillette. */
  comment: string;
  /** Consigne d'allure exploitable par l'interface. */
  action: 'accelerer' | 'maintenir' | 'reduire' | 'recuperer';
  /** Point technique bref affiché à l'écran. */
  focus: string;
  /** 1 = information, 3 = correction urgente. */
  urgence: number;
}

const FALLBACK_ANALYSIS: LiveAnalysisResult = {
  comment: 'Garde le rythme et fluidifie ton coup de pédale, tu es dans l\'allure !',
  action: 'maintenir',
  focus: 'Buste stable, épaules relâchées',
  urgence: 1,
};

/**
 * Analyse la situation courante et renvoie une consigne adaptée.
 * Contrairement au commentaire périodique, le modèle reçoit ici l'écart réel à
 * la cible, la tendance et l'historique récent : il peut donc corriger plutôt
 * que d'encourager dans le vide.
 */
export async function analyzeLiveRide(input: LiveAnalysisInput): Promise<LiveAnalysisResult> {
  try {
    const reasonBrief: Record<string, string> = {
      derive_effort:
        "Le cycliste s'écarte nettement de l'intensité demandée : corrige son allure sans le décourager.",
      debut_bloc_dur:
        "Le bloc d'effort vient de commencer : donne un point technique précis pour bien l'installer.",
      fin_de_bloc:
        'Le bloc se termine dans quelques secondes : relance-le pour finir proprement.',
      point_regulier: "Point d'étape régulier : situe l'effort et motive.",
    };

    const prompt = `Situation actuelle du cycliste :
- Coureur : ${input.cyclistName || 'Champion'} (niveau ${input.cyclistLevel || 'intermédiaire'})
- Bloc ${input.stepNumber}/${input.totalSteps} : "${input.blockName}" (type ${input.blockType}, intensité demandée ${input.targetIntensity})
- Écoulé dans le bloc : ${Math.round(input.stepElapsedSec)}s, restant : ${Math.round(input.stepRemainingSec)}s
- Temps total : ${Math.floor(input.totalElapsedSec / 60)} min, distance ${input.totalDistanceKm.toFixed(1)} km
- Vitesse instantanée : ${input.currentSpeedKmh.toFixed(1)} km/h
- Moyenne sur ce bloc : ${input.avgSpeedInBlockKmh.toFixed(1)} km/h pour une cible de ${input.targetSpeedKmh.toFixed(1)} km/h
- Écart à la cible : ${input.deviationPercent.toFixed(0)} % (${input.verdict})
- Tendance : ${input.trend}, régularité (écart-type) : ${input.variability.toFixed(1)}
- Objectif de la séance : ${input.workoutGoal}

Contexte : ${reasonBrief[input.reason] || reasonBrief.point_regulier}

${
  input.recentMessages.length > 0
    ? `Tu as déjà dit récemment :\n${input.recentMessages.map((m) => `- "${m}"`).join('\n')}\nNe répète ni ces phrases ni leur idée.`
    : ''
}

Réponds en français, 25 mots maximum pour le commentaire audio.`;

    const response = await getClient().models.generateContent({
      model: TEXT_MODEL,
      contents: prompt,
      config: {
        systemInstruction:
          "Tu es Jean-Marc, directeur sportif dans l'oreillette d'un cycliste en plein effort. Tu analyses des données réelles et tu corriges l'allure avec précision : cadence, posture, respiration, gestion de l'effort. Direct, exigeant, jamais bavard. Si l'écart à la cible est important, la correction passe avant l'encouragement.",
        temperature: 0.8,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            comment: {
              type: Type.STRING,
              description: 'Phrase prononcée dans l\'oreillette, 25 mots maximum, percutante',
            },
            action: {
              type: Type.STRING,
              description: "Consigne d'allure : 'accelerer', 'maintenir', 'reduire' ou 'recuperer'",
            },
            focus: {
              type: Type.STRING,
              description: 'Point technique très bref affiché à l\'écran (moins de 8 mots)',
            },
            urgence: {
              type: Type.INTEGER,
              description: '1 = information, 2 = ajustement, 3 = correction urgente',
            },
          },
          required: ['comment', 'action', 'focus', 'urgence'],
        },
      },
    });

    const parsed = parseJson<LiveAnalysisResult>(response.text);
    if (!parsed.comment) return FALLBACK_ANALYSIS;
    return {
      comment: parsed.comment.trim().replace(/^["']|["']$/g, ''),
      action: parsed.action || 'maintenir',
      focus: parsed.focus || '',
      urgence: Math.min(3, Math.max(1, parsed.urgence || 1)),
    };
  } catch (error) {
    console.warn('Analyse temps réel indisponible:', error);
    return FALLBACK_ANALYSIS;
  }
}

/* ------------------------------------------------------------------ */
/* 7. Synthèse vocale neuronale (Gemini TTS)                           */
/* ------------------------------------------------------------------ */

export interface TtsResult {
  audioBase64: string;
  mimeType: string;
  sampleRate: number;
  voiceName: string;
}

// Cache mémoire des audios générés (réponse instantanée, économie de quota).
const ttsAudioCache = new Map<string, TtsResult>();

export async function synthesizeSpeech(params: {
  text: string;
  persona?: string;
}): Promise<TtsResult> {
  const { text, persona } = params;
  if (!text || typeof text !== 'string') {
    throw new Error('Texte requis pour la synthèse vocale');
  }

  let voiceName = 'Fenrir'; // Voix masculine énergique par défaut
  if (persona === 'emilie_punchy') {
    voiceName = 'Kore';
  } else if (persona === 'marc_pose') {
    voiceName = 'Puck';
  } else if (persona === 'radio_tour') {
    voiceName = 'Charon';
  }

  const cleanText = text.trim();
  const cacheKey = `${voiceName}_${cleanText}`;

  const cached = ttsAudioCache.get(cacheKey);
  if (cached) return cached;

  const response = await getClient().models.generateContent({
    model: TTS_MODEL,
    contents: [{ parts: [{ text: cleanText }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName },
        },
      },
    },
  });

  let audioData: string | undefined;
  let mimeType = 'audio/pcm;rate=24000';

  for (const candidate of response.candidates || []) {
    for (const part of candidate.content?.parts || []) {
      if (part.inlineData?.data) {
        audioData = part.inlineData.data;
        mimeType = part.inlineData.mimeType || mimeType;
        break;
      }
    }
    if (audioData) break;
  }

  if (!audioData) {
    throw new Error('Aucun flux audio généré par le modèle');
  }

  const result: TtsResult = {
    audioBase64: audioData,
    mimeType,
    sampleRate: 24000,
    voiceName,
  };

  // Plafonne le cache à 200 entrées.
  if (ttsAudioCache.size > 200) {
    const firstKey = ttsAudioCache.keys().next().value;
    if (firstKey) ttsAudioCache.delete(firstKey);
  }
  ttsAudioCache.set(cacheKey, result);

  return result;
}
