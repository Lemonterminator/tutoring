import { signal } from '@preact/signals';

/** Site-wide colour theme: follow the OS (auto, the default) or force light / dark. */
export type ThemeChoice = 'auto' | 'light' | 'dark';

export const THEME_STORAGE_KEY = 'tutoring:theme';
export const THEME_ATTRIBUTE = 'data-theme';
const DARK_QUERY = '(prefers-color-scheme: dark)';

function isExplicit(value: unknown): value is 'light' | 'dark' {
  return value === 'light' || value === 'dark';
}

function readAttribute(): ThemeChoice {
  if (typeof document === 'undefined') return 'auto';
  const value = document.documentElement.getAttribute(THEME_ATTRIBUTE);
  return isExplicit(value) ? value : 'auto';
}

function readStoredTheme(): ThemeChoice {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return isExplicit(value) ? value : 'auto';
  } catch {
    // Storage is blocked: trust whatever the page already shows (the head script found nothing either).
    return readAttribute();
  }
}

/** Put the choice on <html>: `data-theme="light|dark"`, or no attribute for auto. */
export function applyTheme(choice: ThemeChoice): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (choice === 'auto') root.removeAttribute(THEME_ATTRIBUTE);
  else root.setAttribute(THEME_ATTRIBUTE, choice);
}

export const themeChoice = signal<ThemeChoice>(readStoredTheme());
applyTheme(themeChoice.value);

export function setTheme(next: ThemeChoice): void {
  themeChoice.value = next;
  applyTheme(next);
  try {
    if (next === 'auto') localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, next);
  } catch {
    // Storage can be unavailable for file:// pages or private windows; the choice just isn't remembered.
  }
}

/** The theme that is actually showing, after resolving Auto against the OS preference. */
export function resolvedTheme(): 'light' | 'dark' {
  const attribute = readAttribute();
  if (attribute !== 'auto') return attribute;
  return typeof window !== 'undefined' && window.matchMedia?.(DARK_QUERY).matches ? 'dark' : 'light';
}

/**
 * Call `listener` whenever the showing theme may have changed: the `data-theme` attribute on <html>
 * changes, or the OS colour-scheme preference changes (matters for Auto). For code that reads CSS
 * colours in JS and has to repaint. Returns an unsubscribe function.
 */
export function onThemeChange(listener: () => void): () => void {
  if (typeof document === 'undefined') return () => {};
  const observer = typeof MutationObserver !== 'undefined' ? new MutationObserver(listener) : null;
  observer?.observe(document.documentElement, { attributes: true, attributeFilter: [THEME_ATTRIBUTE] });
  const media = typeof window !== 'undefined' ? window.matchMedia?.(DARK_QUERY) : undefined;
  media?.addEventListener?.('change', listener);
  return () => {
    observer?.disconnect();
    media?.removeEventListener?.('change', listener);
  };
}

// Keep several open tabs in step.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== THEME_STORAGE_KEY) return;
    const next: ThemeChoice = isExplicit(event.newValue) ? event.newValue : 'auto';
    themeChoice.value = next;
    applyTheme(next);
  });
}
