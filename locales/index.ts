import React, { createContext, useContext, useState } from 'react';
import enRaw from './en.json';
import ptBRRaw from './pt-BR.json';

// ─── Types ────────────────────────────────────────────────────────────────────

export type LanguageCode = 'en' | 'pt-BR';

export interface LanguageMeta {
  name: string;
  code: LanguageCode;
  flag: string;
}

export const AVAILABLE_LANGUAGES: LanguageMeta[] = [
  { code: 'en',    name: 'English',           flag: '🇺🇸' },
  { code: 'pt-BR', name: 'Português (Brasil)', flag: '🇧🇷' },
];

type TranslationMap = Record<string, string>;

// ─── Flatten nested JSON to dot-notation keys ─────────────────────────────────

function flatten(obj: Record<string, unknown>, prefix = ''): TranslationMap {
  const result: TranslationMap = {};
  for (const key in obj) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    const val = obj[key];
    if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
      Object.assign(result, flatten(val as Record<string, unknown>, fullKey));
    } else {
      result[fullKey] = String(val);
    }
  }
  return result;
}

const translations: Record<LanguageCode, TranslationMap> = {
  'en':    flatten(enRaw as Record<string, unknown>),
  'pt-BR': flatten(ptBRRaw as Record<string, unknown>),
};

// ─── Translation function factory ─────────────────────────────────────────────

export type TFunction = (key: string, vars?: Record<string, string>) => string;

function buildT(map: TranslationMap): TFunction {
  return (key, vars) => {
    let str = map[key] ?? key;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        str = str.split(`{${k}}`).join(v);
      }
    }
    return str;
  };
}

// ─── Singleton for non-React modules (cliEngine, etc.) ────────────────────────

let _globalT: TFunction = buildT(translations['en']);

/** Call this inside non-React modules (services, engines). Resolves to the currently active locale. */
export const t: TFunction = (key, vars) => _globalT(key, vars);

// ─── React Context ─────────────────────────────────────────────────────────────

interface I18nContextValue {
  lang: LanguageCode;
  setLang: (lang: LanguageCode) => void;
  t: TFunction;
}

const I18nContext = createContext<I18nContextValue>({
  lang: 'en',
  setLang: () => {},
  t,
});

// ─── Provider ─────────────────────────────────────────────────────────────────

const LS_KEY = 'logicgatesim_lang';

interface I18nProviderProps {
  children: React.ReactNode;
}

export function I18nProvider({ children }: I18nProviderProps) {
  const saved = (localStorage.getItem(LS_KEY) as LanguageCode | null) ?? 'en';
  const [lang, setLangState] = useState<LanguageCode>(saved);

  const tFn = buildT(translations[lang]);
  // Keep singleton in sync so non-React code (cliEngine) always resolves correctly
  _globalT = tFn;

  const setLang = (l: LanguageCode) => {
    localStorage.setItem(LS_KEY, l);
    setLangState(l);
  };

  return React.createElement(
    I18nContext.Provider,
    { value: { lang, setLang, t: tFn } },
    children
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useTranslation(): I18nContextValue {
  return useContext(I18nContext);
}
