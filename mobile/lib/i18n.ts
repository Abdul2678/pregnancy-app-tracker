// lib/i18n.ts
// i18n for 10 languages with RTL awareness. Language persisted via settingsSlice.

import { I18n } from 'i18n-js';
import { getLocales } from 'expo-localization';
import { I18nManager } from 'react-native';

import en from '../locales/en.json';
import es from '../locales/es.json';
import fr from '../locales/fr.json';
import ar from '../locales/ar.json';
import hi from '../locales/hi.json';
import pt from '../locales/pt.json';
import ur from '../locales/ur.json';
import id from '../locales/id.json';
import tr from '../locales/tr.json';
import sw from '../locales/sw.json';

export const RTL_LANGUAGES = ['ar', 'ur', 'he', 'fa'];

export const SUPPORTED_LANGUAGES: {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
  rtl: boolean;
}[] = [
  { code: 'en', name: 'English',    nativeName: 'English',         flag: '🇬🇧', rtl: false },
  { code: 'ar', name: 'Arabic',     nativeName: 'العربية',          flag: '🇸🇦', rtl: true  },
  { code: 'fr', name: 'French',     nativeName: 'Français',        flag: '🇫🇷', rtl: false },
  { code: 'es', name: 'Spanish',    nativeName: 'Español',         flag: '🇪🇸', rtl: false },
  { code: 'ur', name: 'Urdu',       nativeName: 'اردو',             flag: '🇵🇰', rtl: true  },
  { code: 'hi', name: 'Hindi',      nativeName: 'हिन्दी',            flag: '🇮🇳', rtl: false },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português',       flag: '🇧🇷', rtl: false },
  { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia', flag: '🇮🇩', rtl: false },
  { code: 'tr', name: 'Turkish',    nativeName: 'Türkçe',          flag: '🇹🇷', rtl: false },
  { code: 'sw', name: 'Swahili',    nativeName: 'Kiswahili',       flag: '🇰🇪', rtl: false },
];

export const i18n = new I18n({ en, es, fr, ar, hi, pt, ur, id, tr, sw });
i18n.defaultLocale  = 'en';
i18n.enableFallback = true;

const deviceLocale = getLocales()[0]?.languageCode ?? 'en';
setLocale(deviceLocale);

export function setLocale(locale: string) {
  const base      = locale.split('-')[0];
  const supported = SUPPORTED_LANGUAGES.find((l) => l.code === base);
  i18n.locale     = supported ? base : 'en';
  const shouldRTL = RTL_LANGUAGES.includes(i18n.locale);
  if (I18nManager.isRTL !== shouldRTL) {
    I18nManager.allowRTL(shouldRTL);
    I18nManager.forceRTL(shouldRTL);
    // Native reload required for RTL flip to render correctly.
  }
}

export function getCurrentLocale(): string {
  return i18n.locale;
}

export function isRTL(): boolean {
  return RTL_LANGUAGES.includes(i18n.locale);
}

export function t(key: string, options?: Record<string, unknown>): string {
  return i18n.t(key, options);
}

export default i18n;
