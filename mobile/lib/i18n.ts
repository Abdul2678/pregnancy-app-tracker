// lib/i18n.ts
// i18n setup for 10+ languages with RTL awareness.

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

export const RTL_LANGUAGES = ['ar', 'ur'];

export const i18n = new I18n({
  en,
  es,
  fr,
  ar,
  hi,
  pt,
  ur,
});

i18n.defaultLocale = 'en';
i18n.enableFallback = true;

const deviceLocale = getLocales()[0]?.languageCode ?? 'en';
setLocale(deviceLocale);

export function setLocale(locale: string) {
  i18n.locale = locale;
  const isRTL = RTL_LANGUAGES.includes(locale);
  if (I18nManager.isRTL !== isRTL) {
    I18nManager.allowRTL(isRTL);
    I18nManager.forceRTL(isRTL);
    // Note: a full app reload is needed for RTL flip to take effect on native.
  }
}

export function t(key: string, options?: Record<string, unknown>) {
  return i18n.t(key, options);
}

export default i18n;
