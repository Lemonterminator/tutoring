import type { Plugin } from 'vite';

/**
 * Classic (non-module) inline script for every page's <head>. It runs before the body paints and sets
 * `data-theme="light|dark"` on <html> from localStorage (`tutoring:theme`), so an explicit choice
 * never flashes the other theme. Auto (nothing stored) leaves the attribute off; CSS then follows the OS.
 * Keep the key and attribute in sync with framework/theme/theme-state.ts (a test checks this).
 */
export const themeHeadScript =
  "(function(){try{var t=localStorage.getItem('tutoring:theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t);}catch(e){}})();";

export function themeHead(): Plugin {
  return {
    name: 'tutoring-theme-head',
    transformIndexHtml: {
      order: 'pre',
      handler: () => [{ tag: 'script', children: themeHeadScript, injectTo: 'head-prepend' as const }],
    },
  };
}
