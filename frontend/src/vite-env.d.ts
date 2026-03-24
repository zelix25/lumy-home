/// <reference types="vite/client" />

interface Window {
  /** Préfixe injecté par le broker HTTP tunnel (my-lumy), ex. `/tunnel/http/<jwt>` */
  __LUMY_TUNNEL_BASENAME__?: string;
}

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_WS_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

