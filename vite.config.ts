import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {defineConfig, type Plugin} from 'vite';

// Chemin de base du site.
// - GitHub Pages sert le projet depuis https://<user>.github.io/<repo>/ : le
//   workflow de déploiement fournit BASE_PATH="/Cycling/".
// - En local (npm run dev / preview), on reste à la racine "/".
const base = process.env.BASE_PATH || '/';

/**
 * Injecte dans le service worker la liste des assets produits par le build et
 * un identifiant de version. Sans cela, le SW ne connaît pas les noms hachés
 * des fichiers JS/CSS et ne peut pas garantir un fonctionnement hors ligne dès
 * la première visite ; l'identifiant force par ailleurs le renouvellement du
 * cache à chaque déploiement.
 */
function pwaServiceWorker(): Plugin {
  return {
    name: 'cyclocoach-sw',
    apply: 'build',
    writeBundle(options, bundle) {
      const outDir = options.dir || 'dist';
      const swPath = path.join(outDir, 'sw.js');
      if (!fs.existsSync(swPath)) return;

      // Seuls les assets du chargement initial sont préchargés. Les chunks
      // importés dynamiquement (moteur vocal Kokoro, phonémiseur, runtime ONNX)
      // pèsent plusieurs mégaoctets : les précharger imposerait ce coût à tous,
      // y compris à ceux qui n'activent jamais ce moteur.
      const assets = Object.entries(bundle)
        .filter(([file, chunk]) => {
          if (/\.css$/.test(file)) return true;
          if (!/\.js$/.test(file)) return false;
          return chunk.type === 'chunk' && chunk.isEntry;
        })
        .map(([file]) => `./${file}`);

      const buildId = Date.now().toString(36);

      const source = fs
        .readFileSync(swPath, 'utf-8')
        .replace("'__BUILD_ID__'", JSON.stringify(buildId))
        .replace("'__PRECACHE_ASSETS__'", JSON.stringify(assets));

      fs.writeFileSync(swPath, source);
      console.log(`  sw.js  ${assets.length} assets préchargés (build ${buildId})`);

      // Données de prononciation eSpeak NG (toutes langues, dont le français).
      // Elles doivent être servies À CÔTÉ du chunk JS du moteur : Emscripten
      // résout ce fichier relativement à l'URL de son script et ignore
      // l'option locateFile pour le paquet de données.
      const espeakData = path.resolve(
        __dirname,
        'node_modules/@echogarden/espeak-ng-emscripten/espeak-ng.data',
      );
      if (fs.existsSync(espeakData)) {
        const assetsDir = path.join(outDir, 'assets');
        fs.mkdirSync(assetsDir, { recursive: true });
        fs.copyFileSync(espeakData, path.join(assetsDir, 'espeak-ng.data'));
        const mo = (fs.statSync(espeakData).size / 1048576).toFixed(0);
        console.log(`  espeak-ng.data  ${mo} Mo copiés dans assets/`);
      } else {
        console.warn('  espeak-ng.data introuvable : la voix française locale sera indisponible');
      }
    },
  };
}

export default defineConfig(() => {
  return {
    base,
    plugins: [react(), tailwindcss(), pwaServiceWorker()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      outDir: 'dist',
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
