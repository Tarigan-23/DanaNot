import { CURRENT_APP_VERSION, isNewerVersion, VersionInfo, APP_CHANGELOG_HISTORY } from '../version';

export interface UpdateState {
  hasUpdate: boolean;
  latestVersion: string;
  releaseDate: string;
  changelog: VersionInfo['changelog'];
  isChecking: boolean;
  lastChecked: string | null;
  error: string | null;
  isDismissedThisSession: boolean;
  swWaiting: boolean;
}

type UpdateListener = (state: UpdateState) => void;

let registration: ServiceWorkerRegistration | null = null;
const listeners = new Set<UpdateListener>();

// Status state in memory
let state: UpdateState = {
  hasUpdate: false,
  latestVersion: CURRENT_APP_VERSION,
  releaseDate: '',
  changelog: [],
  isChecking: false,
  lastChecked: null,
  error: null,
  isDismissedThisSession: false,
  swWaiting: false,
};

// Key for sessionStorage dismissal
const DISMISSED_SESSION_KEY = 'dananote_update_dismissed_version';

function notifyListeners() {
  listeners.forEach((listener) => {
    try {
      listener({ ...state });
    } catch (e) {
      console.error('Error in update listener:', e);
    }
  });
}

/**
 * Cek apakah update versi ini sudah pernah ditunda oleh pengguna di sesi browser ini.
 */
function isVersionDismissed(version: string): boolean {
  try {
    const dismissed = sessionStorage.getItem(DISMISSED_SESSION_KEY);
    return dismissed === version;
  } catch {
    return false;
  }
}

/**
 * Tunda notifikasi update untuk sesi ini.
 */
export function dismissUpdateForSession(): void {
  try {
    if (state.latestVersion) {
      sessionStorage.setItem(DISMISSED_SESSION_KEY, state.latestVersion);
    }
  } catch (e) {
    console.warn('Could not set sessionStorage for update dismissal:', e);
  }
  state.isDismissedThisSession = true;
  notifyListeners();
}

/**
 * Cek ketersediaan pembaruan dari version.json (hemat bandwidth, no-cache).
 */
export async function checkForUpdate(isManual: boolean = false): Promise<{ hasUpdate: boolean; error?: string }> {
  // Jika offline, jangan anggap sebagai error pembaruan bagi pengguna otomatis
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    if (isManual) {
      state.error = 'Perangkat sedang offline. Sambungkan internet untuk memeriksa versi terbaru.';
      notifyListeners();
      return { hasUpdate: false, error: state.error };
    }
    return { hasUpdate: false };
  }

  // Jika sedang memeriksa, hindari double request
  if (state.isChecking) {
    return { hasUpdate: state.hasUpdate };
  }

  state.isChecking = true;
  state.error = null;
  notifyListeners();

  // Juga trigger pembaruan Service Worker jika ada
  if (registration) {
    try {
      registration.update().catch(() => {});
    } catch {
      // SW update error ignored
    }
  }

  try {
    // Tambahkan timestamp query parameter untuk bypass browser disk/memory cache 100%
    const url = `/version.json?_t=${Date.now()}`;
    const res = await fetch(url, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
      },
    });

    if (!res.ok) {
      throw new Error(`Gagal mengambil data versi (${res.status})`);
    }

    const data: VersionInfo = await res.json();
    const updateAvailable = isNewerVersion(data.version, CURRENT_APP_VERSION);
    const dismissed = isVersionDismissed(data.version);

    state.hasUpdate = updateAvailable;
    state.latestVersion = data.version;
    state.releaseDate = data.releaseDate || '';
    state.changelog = data.changelog || [];
    state.lastChecked = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    state.isDismissedThisSession = dismissed;
    state.isChecking = false;
    state.error = null;

    notifyListeners();
    return { hasUpdate: updateAvailable };
  } catch (err: any) {
    console.warn('[DanaNote Update] Check failed:', err);
    state.isChecking = false;
    state.error = isManual ? (err.message || 'Gagal memeriksa pembaruan') : null;
    notifyListeners();
    return { hasUpdate: false, error: err.message };
  }
}

/**
 * Lakukan proses update aplikasi:
 * 1. Menjaga integritas data pengguna di localStorage & IndexedDB.
 * 2. Mengaktifkan Service Worker baru melalui SKIP_WAITING bila ada.
 * 3. Membersihkan HTTP caches versi lama jika ada.
 * 4. Mereload halaman dengan cache bust agar aset JS baru dimuat.
 */
export async function applyAppUpdate(): Promise<void> {
  try {
    console.log('[DanaNote Update] Applying update...');

    // 1. Jika ada service worker yang sedang 'waiting'
    if (registration && registration.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      // Tunggu sebentar agar controller berganti
      await new Promise((resolve) => setTimeout(resolve, 350));
    }

    // 2. Bersihkan caches lama dari Cache Storage API
    if (typeof caches !== 'undefined') {
      try {
        const cacheKeys = await caches.keys();
        await Promise.all(
          cacheKeys.map((key) => {
            // Hapus cache versi lama yang bukan cache saat ini jika perlu
            if (key.startsWith('dananote-cache-')) {
              return caches.delete(key);
            }
            return Promise.resolve(true);
          })
        );
      } catch (cacheErr) {
        console.warn('Cache clear warning:', cacheErr);
      }
    }

    // 3. Bersihkan sessionStorage dismissal
    try {
      sessionStorage.removeItem(DISMISSED_SESSION_KEY);
    } catch {}

    // 4. Reload aman tanpa merusak LocalStorage / IndexedDB
    // Gunakan window.location.reload() dengan query param cache buster
    const currentUrl = new URL(window.location.href);
    currentUrl.searchParams.set('_v', Date.now().toString());
    window.location.href = currentUrl.toString();
  } catch (err) {
    console.error('[DanaNote Update] Apply update failed:', err);
    // Fallback reload
    window.location.reload();
  }
}

/**
 * Inisialisasi Service Worker & Update Listener
 */
export function initUpdateService(): void {
  if (typeof window === 'undefined') return;

  // Dengarkan online/offline
  window.addEventListener('online', () => {
    // Saat koneksi pulih, lakukan pengecekan versi baru
    setTimeout(() => {
      checkForUpdate(false);
    }, 2000);
  });

  // Registrasi Service Worker jika didukung
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          registration = reg;
          console.log('[DanaNote SW] Registered with scope:', reg.scope);

          // Cek apakah ada SW yang sedang waiting
          if (reg.waiting) {
            state.swWaiting = true;
            notifyListeners();
          }

          reg.onupdatefound = () => {
            const installing = reg.installing;
            if (installing) {
              installing.onstatechange = () => {
                if (installing.state === 'installed') {
                  if (navigator.serviceWorker.controller) {
                    // SW baru berhasil diinstall dan sedang menunggu aktivasi
                    state.swWaiting = true;
                    // Trigger check untuk memperbarui modal info versi
                    checkForUpdate(false);
                  }
                }
              };
            }
          };
        })
        .catch((err) => {
          console.warn('[DanaNote SW] Registration failed:', err);
        });

      // Handle controller change (jika SW baru mengambil alih)
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('[DanaNote SW] Controller changed.');
      });
    });
  }

  // Pengecekan awal setelah aplikasi terbuka (beri jeda 2.5 detik agar render awal tidak terhambat)
  setTimeout(() => {
    checkForUpdate(false);
  }, 2500);

  // Interval berkala: setiap 30 menit (hemat bandwidth & tidak spam)
  const CHECK_INTERVAL = 30 * 60 * 1000;
  setInterval(() => {
    checkForUpdate(false);
  }, CHECK_INTERVAL);
}

/**
 * Subscribe komponen UI ke perubahan state update
 */
export function subscribeUpdate(listener: UpdateListener): () => void {
  listeners.add(listener);
  // Langsung panggil sekali dengan state awal
  listener({ ...state });
  return () => listeners.delete(listener);
}

export function getUpdateState(): UpdateState {
  return { ...state };
}
