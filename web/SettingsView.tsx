import { Globe2 } from 'lucide-react';
import { t, useLanguage, type Language } from './i18n';

export function LanguageSelect({ compact = false }: { compact?: boolean }) {
  const { language, setLanguage } = useLanguage();
  return <label className={`language-select ${compact ? 'compact' : ''}`}>
    <span><Globe2 size={18} />{t('App language')}</span>
    <select aria-label={t('App language')} value={language} onChange={event => setLanguage(event.target.value as Language)}>
      <option value="en" lang="en">English</option>
      <option value="it" lang="it">Italiano</option>
    </select>
  </label>;
}
export default function SettingsView() {
  return <><div className="page-heading"><div><span className="eyebrow">{t('YOUR PREFERENCES')}</span><h1>{t('Settings')}</h1><p>{t('Make the archive feel at home.')}</p></div></div>
    <section className="panel language-settings"><h2>{t('Language')}</h2><LanguageSelect />
      <p>{t('English is the default. Your choice is saved in this browser and applies immediately.')}</p>
      <p>{t('Archived websites, site names and your notes stay in their original language. Capture settings are unchanged.')}</p>
    </section></>;
}
