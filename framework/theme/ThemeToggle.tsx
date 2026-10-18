import { setTheme, themeChoice, type ThemeChoice } from './theme-state';

export type ThemeToggleLang = 'en' | 'zh' | 'fi';

const GROUP_LABEL: Record<ThemeToggleLang, string> = { en: 'Theme', zh: '主题', fi: 'Teema' };
const OPTIONS: { value: ThemeChoice; label: Record<ThemeToggleLang, string> }[] = [
  { value: 'auto', label: { en: 'Auto', zh: '自动', fi: 'Auto' } },
  { value: 'light', label: { en: 'Light', zh: '浅色', fi: 'Vaalea' } },
  { value: 'dark', label: { en: 'Dark', zh: '深色', fi: 'Tumma' } },
];

/** Auto / Light / Dark segmented control for the page top bar. Labels follow the page language. */
export function ThemeToggle({ lang = 'en' }: { lang?: ThemeToggleLang }) {
  const current = themeChoice.value;
  return (
    <div class="seg theme-toggle" role="group" aria-label={GROUP_LABEL[lang]}>
      {OPTIONS.map((option) => (
        <button type="button" key={option.value} data-theme-choice={option.value} aria-pressed={current === option.value} onClick={() => setTheme(option.value)}>
          {option.label[lang]}
        </button>
      ))}
    </div>
  );
}
