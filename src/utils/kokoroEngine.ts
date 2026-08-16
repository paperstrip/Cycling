/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Moteur vocal Kokoro exécuté localement dans le navigateur.
 *
 * Gratuit, illimité et hors connexion une fois le modèle téléchargé.
 *
 * Contournement nécessaire pour le français
 * -----------------------------------------
 * `kokoro-js` sait phonémiser, mais sa correspondance code-langue est codée en
 * dur : `"a" === code ? "en-us" : "en"`. Toute voix non américaine est donc
 * phonémisée en anglais, ce qui donnerait du charabia sur du texte français.
 *
 * On court-circuite donc son chemin par défaut :
 *   1. phonémisation du texte avec `phonemizer` en `fr` (les données eSpeak
 *      françaises sont bien présentes dans le paquet) ;
 *   2. injection de la voix française `ff_siwis` dans la table des voix, que
 *      `get voices()` expose par référence ;
 *   3. appel de `generate_from_ids()`, API publique qui prend des identifiants
 *      de tokens et saute complètement la phonémisation interne.
 *
 * Ce chemin s'appuie sur deux détails d'implémentation (la table mutable et le
 * tokenizer exposé) : la version de `kokoro-js` est donc épinglée.
 */

/** Voix française du modèle Kokoro v1.0 (Siwis, féminine). */
const FRENCH_VOICE_ID = 'ff_siwis';

const MODEL_ID = 'onnx-community/Kokoro-82M-v1.0-ONNX';

export interface KokoroProgress {
  /** 0 à 100, progression du téléchargement du modèle. */
  percent: number;
  status: string;
}

export interface KokoroAudio {
  /** Échantillons audio bruts, entre -1 et 1. */
  samples: Float32Array;
  sampleRate: number;
}

let ttsInstance: any = null;
let loadingPromise: Promise<any> | null = null;

/** Octets téléchargés par fichier, pour une progression globale cohérente. */
const downloaded: Record<string, { loaded: number; total: number }> = {};

/** Sans limite, un téléchargement bloqué laisse l'interface figée sans explication. */
const MODEL_LOAD_TIMEOUT_MS = 5 * 60 * 1000;

/** Une phrase courte doit être synthétisée en quelques secondes. */
const SYNTHESIS_TIMEOUT_MS = 90 * 1000;

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(message)), ms)),
  ]);
}

export function isKokoroLoaded(): boolean {
  return ttsInstance !== null;
}

/**
 * Charge le modèle (téléchargement au premier appel, puis cache du navigateur).
 * Les imports sont dynamiques : sans cela, transformers.js alourdirait le
 * bundle principal de plusieurs mégaoctets pour tous les utilisateurs.
 */
export async function loadKokoro(onProgress?: (p: KokoroProgress) => void): Promise<any> {
  if (ttsInstance) return ttsInstance;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    const { KokoroTTS, env } = await import('kokoro-js');

    // Exécution mono-thread obligatoire.
    // Le runtime ONNX charge par défaut une variante multithread, qui exige
    // SharedArrayBuffer — lui-même conditionné aux en-têtes COOP/COEP que
    // GitHub Pages ne permet pas d'envoyer. Sans cela, l'initialisation des
    // threads reste bloquée indéfiniment APRÈS un téléchargement réussi, sans
    // jamais lever d'erreur.
    try {
      const wasmBackend = (env as any)?.backends?.onnx?.wasm;
      if (wasmBackend) {
        wasmBackend.numThreads = 1;
        wasmBackend.proxy = false;
      }
    } catch (err) {
      console.warn('Configuration mono-thread du runtime ONNX impossible:', err);
    }

    // Quantification 8 bits : ~86 Mo, contre ~326 Mo en fp32. Sur un téléphone
    // en 4G, fp32 est inutilisable — le téléchargement n'aboutit pas et rien
    // n'indique la cause. La perte de qualité est marginale pour des phrases
    // courtes, et le préchargement compense la lenteur du WebAssembly.
    const tts = await withTimeout(
      KokoroTTS.from_pretrained(MODEL_ID, {
        dtype: 'q8',
        device: 'wasm',
        progress_callback: (p: any) => {
          if (!onProgress) return;

          // transformers.js émet une progression par fichier : on cumule les
          // octets pour afficher une progression globale qui ne recule pas.
          if (p?.status === 'progress' && p.file && typeof p.total === 'number') {
            downloaded[p.file] = { loaded: p.loaded || 0, total: p.total };
          }
          const files = Object.values(downloaded);
          const loaded = files.reduce((a, f) => a + f.loaded, 0);
          const total = files.reduce((a, f) => a + f.total, 0);
          const percent = total > 0 ? Math.round((loaded / total) * 100) : 0;

          onProgress({
            percent,
            status:
              percent >= 100
                ? 'initialisation du moteur…'
                : total > 0
                  ? `${(loaded / 1048576).toFixed(0)} / ${(total / 1048576).toFixed(0)} Mo`
                  : p?.status || 'préparation',
          });
        },
      } as any),
      MODEL_LOAD_TIMEOUT_MS,
      "Le téléchargement du modèle vocal n'a pas abouti dans le temps imparti. "
        + 'Réessayez en Wi-Fi : le modèle pèse environ 86 Mo.',
    );

    onProgress?.({ percent: 100, status: 'moteur prêt' });

    // La voix française n'est pas déclarée dans la table de la librairie, alors
    // que le modèle la fournit. `voices` étant exposé par référence, on peut
    // l'y ajouter pour que la validation interne l'accepte.
    try {
      const voices = tts.voices as Record<string, unknown>;
      if (voices && !voices[FRENCH_VOICE_ID]) {
        voices[FRENCH_VOICE_ID] = {
          name: 'Siwis',
          language: 'fr-fr',
          gender: 'Female',
          traits: '',
          targetQuality: 'B',
          overallGrade: 'B',
        };
      }
    } catch (err) {
      console.warn("Impossible d'enregistrer la voix française Kokoro:", err);
    }

    ttsInstance = tts;
    return tts;
  })();

  try {
    return await loadingPromise;
  } catch (err) {
    // Un échec ne doit pas empêcher une nouvelle tentative plus tard.
    loadingPromise = null;
    throw err;
  }
}

/**
 * Synthétise du texte français.
 * @throws si le modèle ne peut pas être chargé ou si la synthèse échoue ; le
 *         moteur audio bascule alors sur la voix du navigateur.
 */
export async function synthesizeFrench(
  text: string,
  onProgress?: (p: KokoroProgress) => void,
): Promise<KokoroAudio> {
  const tts = await loadKokoro(onProgress);
  const clean = text.trim();
  if (!clean) throw new Error('Texte vide');

  // 1. Phonèmes français, produits hors de kokoro-js.
  onProgress?.({ percent: 100, status: 'phonémisation…' });
  const { phonemize } = await import('phonemizer');
  const phonemeChunks: string[] = await withTimeout(
    phonemize(clean, 'fr'),
    SYNTHESIS_TIMEOUT_MS,
    "La phonémisation française n'a pas abouti.",
  );
  const phonemes = Array.isArray(phonemeChunks) ? phonemeChunks.join(' ') : String(phonemeChunks);
  if (!phonemes.trim()) throw new Error('Phonémisation française vide');

  // 2. Tokenisation des phonèmes (et non du texte brut).
  const tokenizer = (tts as any).tokenizer;
  if (!tokenizer) throw new Error('Tokenizer Kokoro indisponible');
  const { input_ids } = await tokenizer(phonemes, {
    truncation: true,
  });

  // 3. Synthèse en sautant la phonémisation interne, anglophone par défaut.
  onProgress?.({ percent: 100, status: 'synthèse…' });
  const audio = await withTimeout<any>(
    tts.generate_from_ids(input_ids, { voice: FRENCH_VOICE_ID }),
    SYNTHESIS_TIMEOUT_MS,
    "La synthèse vocale n'a pas abouti (moteur trop lent ou mémoire insuffisante).",
  );

  const samples: Float32Array = audio?.audio ?? audio?.data;
  const sampleRate: number = audio?.sampling_rate ?? 24000;
  if (!samples || samples.length === 0) throw new Error('Aucun échantillon audio produit');

  return { samples, sampleRate };
}

/** Libère le modèle (utile pour récupérer de la mémoire sur mobile). */
export function unloadKokoro(): void {
  ttsInstance = null;
  loadingPromise = null;
}
