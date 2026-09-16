import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor wraps the Vite production build (`dist/`) into a native Android
 * WebView shell for APK releases. The web app is a pure SPA — no server —
 * so `webDir` points at the static build output.
 */
const config: CapacitorConfig = {
  appId: "app.securevaulthub.app",
  appName: "Secure Vault Hub",
  webDir: "dist",
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
  server: {
    androidScheme: "https",
  },
};

export default config;
