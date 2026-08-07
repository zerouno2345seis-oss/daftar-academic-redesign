export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

type PwaWindow = Window & {
  __ytAcademicInstallPrompt?: BeforeInstallPromptEvent;
  __ytAcademicPwaPromptInitialized?: boolean;
};

export const initializePwaInstallPrompt = () => {
  if (typeof window === 'undefined') return;
  const pwaWindow = window as PwaWindow;
  if (pwaWindow.__ytAcademicPwaPromptInitialized) return;

  pwaWindow.__ytAcademicPwaPromptInitialized = true;
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    pwaWindow.__ytAcademicInstallPrompt = event as BeforeInstallPromptEvent;
    window.dispatchEvent(new Event('yt-pwa-install-available'));
  });
};

export const getDeferredInstallPrompt = () => {
  if (typeof window === 'undefined') return null;
  return (window as PwaWindow).__ytAcademicInstallPrompt || null;
};

export const clearDeferredInstallPrompt = () => {
  if (typeof window !== 'undefined') {
    delete (window as PwaWindow).__ytAcademicInstallPrompt;
  }
};
