/// <reference types="vite/client" />

/**
 * Typed build-time variables.
 *
 * Vite only exposes `import.meta.env` keys that are declared somewhere, so an
 * undeclared variable reads as `undefined` at runtime while TypeScript still
 * believes it exists. Declaring them here — including the ones we intend to be
 * absent by default — keeps "not configured" an explicit, checkable state
 * rather than a typo that silently disables a security check.
 */
interface ImportMetaEnv {
  readonly VITE_CONVEX_URL: string;
  /**
   * Comma-separated list of origins allowed to frame the app.
   *
   * Absent or empty on purpose in most deployments: the embed channel then
   * denies every inbound navigation instead of trusting all origins.
   */
  readonly VITE_ALLOWED_EMBED_ORIGINS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
