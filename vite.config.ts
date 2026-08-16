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

      const assets = Object.keys(bundle)
        .filter((file) => /\.(js|css|woff2?|png|svg)$/.test(file))
        .map((file) => `./${file}`);

      const buildId = Date.now().toString(36);

      const source = fs
        .readFileSync(swPath, 'utf-8')
        .replace("'__BUILD_ID__'", JSON.stringify(buildId))
        .replace("'__PRECACHE_ASSETS__'", JSON.stringify(assets));

      fs.writeFileSync(swPath, source);
      console.log(`  sw.js  ${assets.length} assets préchargés (build ${buildId})`);
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
