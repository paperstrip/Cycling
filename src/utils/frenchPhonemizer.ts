/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Phonémisation française via eSpeak NG (build Emscripten complet).
 *
 * Pourquoi ce module existe
 * -------------------------
 * Kokoro ne lit pas du texte mais des phonèmes, et sa phonémisation dépend
 * d'eSpeak NG. Le paquet `phonemizer` livré avec `kokoro-js` est un build
 * eSpeak compilé avec les dictionnaires anglais uniquement : `phonemize(t, 'fr')`
 * y est rejeté d'emblée. Résultat, du texte français y serait prononcé avec les
 * règles anglaises (« Allez » → /ɐlˈɛz/ au lieu de /alˈe/).
 *
 * Ce build-ci embarque toutes les langues, dont `fr_dict`. On l'utilise donc
 * uniquement pour produire les phonèmes, que l'on injecte ensuite dans Kokoro
 * via son API `generate_from_ids`.
 *
 * Le fichier de données pèse 24 Mo : le module n'est chargé qu'à la demande.
 */

/** Handle du worker eSpeak, conservé entre les appels. */
let workerPromise: Promise<{ module: any; worker: any }> | null = null;

/** Mode 1 = sortie en alphabet phonétique international, celui qu'attend Kokoro. */
const IPA_MODE = 1;

async function getWorker(): Promise<{ module: any; worker: any }> {
  if (workerPromise) return workerPromise;

  workerPromise = (async () => {
    const initEspeak = (await import('@echogarden/espeak-ng-emscripten')).default;

    const module = await initEspeak({
      // Les fichiers du module sont déposés à côté de son chunk JS, dans
      // assets/ : c'est là qu'Emscripten va les chercher.
      locateFile: (path: string) => `${import.meta.env.BASE_URL}assets/${path}`,
    });

    const worker = new module.eSpeakNGWorker();

    // 0 = succès (convention eSpeak). Toute autre valeur signale que la voix
    // française n'a pas pu être chargée.
    const status = worker.set_voice('fr', 0);
    if (status !== 0) {
      throw new Error(`Voix française eSpeak indisponible (code ${status})`);
    }

    return { module, worker };
  })();

  try {
    return await workerPromise;
  } catch (err) {
    workerPromise = null;
    throw err;
  }
}

/** Lit une chaîne C terminée par zéro dans la mémoire du module. */
function readCString(module: any, ptr: number): string {
  if (typeof module.UTF8ToString === 'function') return module.UTF8ToString(ptr);
  const heap: Uint8Array = module.HEAPU8 || new Uint8Array(module.wasmMemory.buffer);
  let end = ptr;
  while (heap[end] !== 0) end++;
  return new TextDecoder('utf-8').decode(heap.subarray(ptr, end));
}

/**
 * Convertit du texte français en phonèmes API, au format attendu par Kokoro.
 *
 * eSpeak sépare chaque phonème par « _ » et les propositions par « | » ; Kokoro
 * attend une chaîne continue. Exemple :
 *   "Allez champion"  →  "alˈe ʃɑ̃pjˈɔ̃"
 */
export async function phonemizeFrench(text: string): Promise<string> {
  const clean = text.trim();
  if (!clean) return '';

  const { module, worker } = await getWorker();
  const result = worker.text_to_phonemes(clean, IPA_MODE);
  const raw = readCString(module, result.ptr);

  return raw
    .replace(/_/g, '') // séparateurs de phonèmes
    .replace(/\s*\|\s*/g, ' ') // frontières de propositions
    .replace(/\s+/g, ' ')
    .trim();
}

/** Libère le moteur (récupération mémoire sur mobile). */
export function unloadFrenchPhonemizer(): void {
  workerPromise = null;
}
