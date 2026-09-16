import type { AskContext } from './question';

export type AskResult = 'copied' | 'failed';
export type AskProvider = (text: string, ctx: AskContext) => Promise<AskResult>;

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Clipboard API missing or blocked: fall back to a hidden textarea.
  }
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  } catch {
    return false;
  }
}

export const clipboardProvider: AskProvider = async (text) => ((await copyText(text)) ? 'copied' : 'failed');

let current: AskProvider = clipboardProvider;

/** Swap point for a future in-page AI tutor. */
export function setAskProvider(provider: AskProvider): void {
  current = provider;
}

export function getAskProvider(): AskProvider {
  return current;
}
