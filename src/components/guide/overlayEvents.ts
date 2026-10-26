/** Tiny window-event bus so any page can reopen the onboarding / what's-new dialogs. */
const ONBOARDING = 'lift-log:open-onboarding';
const WHATS_NEW = 'lift-log:open-whats-new';

export function openOnboarding(): void {
  window.dispatchEvent(new CustomEvent(ONBOARDING));
}

export function openWhatsNew(): void {
  window.dispatchEvent(new CustomEvent(WHATS_NEW));
}

function listen(name: string, cb: () => void): () => void {
  window.addEventListener(name, cb);
  return () => window.removeEventListener(name, cb);
}

export const onOpenOnboarding = (cb: () => void) => listen(ONBOARDING, cb);
export const onOpenWhatsNew = (cb: () => void) => listen(WHATS_NEW, cb);
