// PWA & Platform Detection Service

let deferredPrompt: any = null;
type PWAInstallListener = (canInstall: boolean) => void;
const installListeners = new Set<PWAInstallListener>();

export function registerServiceWorker(): void {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          console.log('[DanaNote PWA] Service Worker registered with scope:', reg.scope);

          reg.onupdatefound = () => {
            const installingWorker = reg.installing;
            if (installingWorker) {
              installingWorker.onstatechange = () => {
                if (installingWorker.state === 'installed') {
                  if (navigator.serviceWorker.controller) {
                    console.log('[DanaNote PWA] Versi baru tersedia!');
                  }
                }
              };
            }
          };
        })
        .catch((err) => {
          console.warn('[DanaNote PWA] Service Worker registration failed:', err);
        });
    });
  }
}

// Capture Chrome/Edge beforeinstallprompt
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    installListeners.forEach((fn) => fn(true));
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    installListeners.forEach((fn) => fn(false));
    console.log('[DanaNote PWA] App installed successfully');
  });
}

export function subscribePWAInstall(callback: PWAInstallListener): () => void {
  installListeners.add(callback);
  callback(!!deferredPrompt);
  return () => installListeners.delete(callback);
}

export async function promptPWAInstall(): Promise<'accepted' | 'dismissed' | 'unsupported'> {
  if (!deferredPrompt) {
    return 'unsupported';
  }
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  deferredPrompt = null;
  installListeners.forEach((fn) => fn(false));
  return outcome;
}

export function isAppInstalled(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true ||
    document.referrer.includes('android-app://')
  );
}

export function getDevicePlatform(): 'ios' | 'android' | 'windows' | 'mac' | 'other' {
  if (typeof window === 'undefined') return 'other';
  const ua = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return 'ios';
  if (/android/.test(ua)) return 'android';
  if (/windows/.test(ua)) return 'windows';
  if (/macintosh|mac os x/.test(ua)) return 'mac';
  return 'other';
}
