import * as path from 'path';
import * as fs from 'fs';

export type TelegramLocale = 'fr' | 'en';

const DEFAULT_LOCALE: TelegramLocale = 'fr';
const SUPPORTED_LOCALES: TelegramLocale[] = ['fr', 'en'];

let cache: Record<string, Record<string, unknown>> = {};

function loadLocale(lang: string): Record<string, unknown> {
  const locale = SUPPORTED_LOCALES.includes(lang as TelegramLocale) ? lang : DEFAULT_LOCALE;
  if (cache[locale]) {
    return cache[locale];
  }
  const filePath = path.join(__dirname, 'locales', `${locale}.json`);
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    cache[locale] = JSON.parse(content) as Record<string, unknown>;
    return cache[locale];
  } catch {
    if (locale !== DEFAULT_LOCALE) {
      return loadLocale(DEFAULT_LOCALE);
    }
    return {};
  }
}

/**
 * Récupère une traduction par clé (notation pointée, ex: "menu.devices").
 * Remplace {{param}} par les valeurs de params.
 */
export function t(
  lang: string,
  key: string,
  params?: Record<string, string | number>,
): string {
  const locale = loadLocale(lang);
  const keys = key.split('.');
  let value: unknown = locale;
  for (const k of keys) {
    value = (value as Record<string, unknown>)?.[k];
    if (value === undefined) return key;
  }
  let str = typeof value === 'string' ? value : String(value);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      str = str.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v));
    }
  }
  return str;
}

/**
 * Langue par défaut du bot (si non configurée).
 */
export function getDefaultLocale(): TelegramLocale {
  return DEFAULT_LOCALE;
}

/**
 * Liste des langues supportées.
 */
export function getSupportedLocales(): TelegramLocale[] {
  return [...SUPPORTED_LOCALES];
}
