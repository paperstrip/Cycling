# CycloCoach

Application de coaching cycliste vocal : séances par intervalles, suivi GPS temps réel,
coach IA (Gemini), génération de programmes et itinéraires, voix studio dans l'oreillette.

100 % web, sans backend : l'app tourne entièrement dans le navigateur et s'installe
sur iPhone comme une application (PWA).

---

## 1. Activer GitHub Pages (à faire une seule fois)

1. Sur GitHub, ouvre **Settings → Pages**.
2. Dans **Build and deployment → Source**, choisis **GitHub Actions**.
3. C'est tout. À chaque push sur `main`, le workflow `.github/workflows/deploy.yml`
   construit le site et le publie.

Le site sera disponible sur :

```
https://<ton-compte-github>.github.io/Cycling/
```

Tu peux suivre le déploiement dans l'onglet **Actions** du dépôt (environ 1 minute).

## 2. Installer l'app sur l'iPhone

1. Ouvre l'URL ci-dessus dans **Safari** (obligatoire : Chrome iOS ne sait pas installer de PWA).
2. Bouton **Partager** → **Sur l'écran d'accueil**.
3. Lance CycloCoach depuis l'icône : plein écran, sans barre d'adresse.

À la première sortie, Safari demandera l'autorisation de **géolocalisation** — accepte-la
pour le suivi GPS. Le son du coach nécessite une première interaction avec l'écran
(règle iOS), c'est le cas dès que tu appuies sur « Démarrer la séance ».

> HTTPS est requis pour le GPS et l'installation PWA : GitHub Pages le fournit
> automatiquement.

### Ce que l'installation apporte

- **Plein écran** sans barre d'adresse, icône dédiée sur l'écran d'accueil.
- **Fonctionnement hors connexion** : l'interface, les séances préenregistrées,
  le chronomètre et le GPS restent opérationnels sans réseau (utile en pleine
  campagne). Un bandeau signale le mode hors connexion.
- **Écran maintenu allumé** pendant la sortie, et réactivé automatiquement au
  retour dans l'app.
- **Mises à jour** : quand une nouvelle version est déployée, un bandeau
  « Nouvelle version disponible » propose d'actualiser — rien n'est écrasé en
  pleine séance.
- **Raccourcis** : un appui long sur l'icône ouvre directement une séance ou le
  coach.

## 3. Clé API Gemini

Les fonctions IA (coach, génération de séances/programmes, voix studio) utilisent
l'API Gemini de Google. **Aucune clé n'est stockée dans ce dépôt.**

1. Récupère une clé gratuite sur https://aistudio.google.com/apikey
2. Dans l'app, appuie sur l'icône 🔑 en haut à droite, colle la clé, enregistre.

La clé est conservée **uniquement dans le stockage local de ton appareil** et n'est
envoyée qu'aux serveurs de Google. Elle n'est ni publiée sur le site, ni commitée.

**Sans clé, l'app reste utilisable** : séances préenregistrées, chronomètre par
intervalles, suivi GPS, cartes OpenStreetMap et voix de synthèse du navigateur
fonctionnent normalement. Seules les fonctions IA sont désactivées.

## 4. Développement local

```bash
npm install
npm run dev      # http://localhost:5173
npm run lint     # vérification TypeScript
npm run build    # build de production dans dist/
npm run preview  # sert le build de production
```

Pour reproduire exactement l'URL de GitHub Pages en local :

```bash
BASE_PATH=/Cycling/ npm run build && BASE_PATH=/Cycling/ npm run preview
```

### Variable optionnelle

`VITE_GEMINI_API_KEY` permet d'injecter une clé au build (pratique en local, via un
fichier `.env.local`). À **ne pas** utiliser pour le déploiement public : la clé
serait lisible dans le JavaScript du site.

## Architecture

- **React 19 + Vite + Tailwind 4** — application monopage statique.
- **`src/utils/geminiClient.ts`** — tous les appels Gemini, exécutés côté navigateur
  (remplace l'ancien serveur Express d'AI Studio, incompatible avec un hébergement statique).
- **`src/utils/apiKey.ts`** — stockage local de la clé API.
- **`src/utils/voiceCache.ts`** — cache IndexedDB des clips vocaux et
  préchargement d'une séance avant le départ : la lecture devient instantanée
  et une séance déjà préparée ne consomme plus de quota.
- **`src/utils/rideAnalytics.ts`** — analyse locale de l'effort (écart à la
  cible, tendance, régularité) et décision de solliciter l'IA.
- **`src/utils/geoTracker.ts`** — suivi GPS via l'API Geolocation.
- **`src/utils/audioEngine.ts`** — moteur audio (voix Gemini TTS avec repli automatique
  sur la synthèse vocale du navigateur).
- **`src/utils/pwa.ts`** — cycle de vie PWA : service worker, détection des mises
  à jour, état d'installation et de connexion.
- **`public/sw.js`** — service worker : préchargement des assets du build
  (injectés par le plugin `pwaServiceWorker` de `vite.config.ts`), réseau
  d'abord pour le HTML, cache d'abord pour les assets.
- **`src/components/BottomNav.tsx`** — navigation basse mobile ; les mêmes
  destinations alimentent la barre haute sur grand écran.
- **`src/components/WorkoutProfileBar.tsx`** — profil d'intensité de la séance,
  réutilisé en direct pendant la sortie pour situer le bloc en cours.

### Icônes

Les PNG de `public/` (`apple-touch-icon.png`, `icon-192`, `icon-512`,
`icon-maskable-512`) sont générés à partir de `public/icon.svg`. iOS ignore les
SVG pour l'écran d'accueil : le PNG 180×180 est indispensable.
