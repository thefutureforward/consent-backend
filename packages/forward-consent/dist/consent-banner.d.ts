// Tipos publicos del paquete.

export type SignalState = "granted" | "denied";

export interface Category {
  id: string;
  locked?: boolean;
  granted?: boolean;
  label: { es: string; en: string; [lang: string]: string };
  desc: { es: string; en: string; [lang: string]: string };
  signals: string[];
}

export interface Consent {
  consent_id: string | null;
  choice: "all" | "none" | "custom";
  categories: Record<string, boolean>;
  signals: Record<string, SignalState>;
  ts: number;
  version: string;
}

export interface ConsentColors {
  ink?: string; inkSoft?: string;
  accent?: string; accentHover?: string; accentSoft?: string; accentPale?: string;
  text?: string; textBright?: string;
  heading?: string; body?: string;
  border?: string; borderStrong?: string; switchOff?: string;
  pillFg?: string; pillBg?: string;
  cream?: string; panelBg?: string;
}

export interface ConsentConfig {
  namespace?: string;
  gtmId?: string;
  endpoint?: string;
  sessionId?: string;
  consentVersion?: string;
  defaultLanguage?: string;
  /** Con siteId + apiBase el banner descarga su config del backend (Fase 3). */
  siteId?: string;
  apiBase?: string;
  publicKey?: string;
  cookie?: { lifetimeMonths?: number; domain?: string };
  colors?: ConsentColors;
  fonts?: { heading?: string; body?: string; mono?: string };
  /** Carga IBM Plex desde Google Fonts. false si la CSP lo bloquea. */
  webfont?: boolean;
  activeDeletion?: boolean;
  /** Activa scripts type="text/plain" data-consent-category (sitios sin GTM). */
  manageScripts?: boolean;
  texts?: Record<string, Record<string, string>>;
  categories?: Category[];
  onConsentChange?: (consent: Consent) => void;
}

export function start(config?: ConsentConfig): void;
export function open(): void;
export function reset(): void;
export function setLanguage(lang: string): void;

declare const _default: {
  start: typeof start;
  open: typeof open;
  reset: typeof reset;
  setLanguage: typeof setLanguage;
};
export default _default;
