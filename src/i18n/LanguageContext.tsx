import React, { createContext, useContext, useState, useEffect } from 'react';
import { TranslationDictionary } from './types';
import { en } from './en';
import { bn } from './bn';

type Language = 'en' | 'bn';

interface LanguageContextType {
  language: Language;
  t: TranslationDictionary;
  setLanguage: (lang: Language) => void;
}

const LanguageContext = createContext<LanguageContextType>({
  language: 'en',
  t: en,
  setLanguage: () => {},
});

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('watchanime_lang');
    return (saved === 'bn' || saved === 'en') ? saved : 'en';
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('watchanime_lang', lang);
  };

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const value = {
    language,
    t: language === 'bn' ? bn : en,
    setLanguage,
  };

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export const useLanguage = () => useContext(LanguageContext);
