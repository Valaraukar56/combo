/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/**
 * Preload-bridged API exposed by `electron/preload.cjs`. Only present when the
 * app runs inside Electron — undefined in a regular browser tab.
 */
interface ComboUpdateInfo {
  version: string | null;
  releaseName: string | null;
  releaseNotes: string | null;
}

interface ComboBridge {
  onUpdateReady(callback: (info: ComboUpdateInfo) => void): () => void;
  installUpdate(): void;
}

interface Window {
  combo?: ComboBridge;
}
