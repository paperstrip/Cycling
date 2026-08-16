/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Clé Gemini optionnelle injectée au build. Laisser vide : la clé est normalement saisie dans l'app. */
  readonly VITE_GEMINI_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
