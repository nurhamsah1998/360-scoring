import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'
import en from './en.json'
import id from './id.json'

export const LANGUAGES = ['en', 'id'] as const
export type Lang = (typeof LANGUAGES)[number]

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { en: { translation: en }, id: { translation: id } },
    fallbackLng: 'en',
    supportedLngs: LANGUAGES,
    nonExplicitSupportedLngs: true,
    interpolation: { escapeValue: false },
    detection: { order: ['localStorage', 'navigator'], caches: ['localStorage'], lookupLocalStorage: 'lang' },
  })

i18n.on('languageChanged', (lng) => {
  document.documentElement.lang = lng
})
document.documentElement.lang = i18n.resolvedLanguage ?? 'en'

export const currentLang = (): Lang => (i18n.resolvedLanguage === 'id' ? 'id' : 'en')

export default i18n
