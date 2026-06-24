import { createContext, useContext, useCallback } from 'react';

/**
 * Disabled multi-language translator. Always returns the original English strings.
 */
const I18nContext = createContext(null);

export function I18nProvider({ children }) {
  const t = useCallback((text) => text, []);

  return (
    <I18nContext.Provider value={{ lang: 'en', setLang: () => {}, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export const useI18n = () => useContext(I18nContext);
