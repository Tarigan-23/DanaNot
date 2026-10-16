export interface VersionInfo {
  version: string;
  releaseDate: string;
  minSupportedVersion?: string;
  changelog: {
    title: string;
    items: string[];
  }[];
  critical?: boolean;
}

// Versi aplikasi yang sedang berjalan di klien ini
export const CURRENT_APP_VERSION = '1.1.0';
export const CURRENT_RELEASE_DATE = '17 Oktober 2026';

// Konfigurasi changelog bawaan untuk rilis saat ini dan sebelumnya
export const APP_CHANGELOG_HISTORY: VersionInfo[] = [
  {
    version: '1.1.0',
    releaseDate: '17 Oktober 2026',
    changelog: [
      {
        title: 'Fitur Sistem Pembaruan Otomatis (Update System)',
        items: [
          'Pendeteksian versi baru otomatis saat online & hemat bandwidth.',
          'Modal notifikasi update modern dengan opsi Update Sekarang dan Tunda.',
          'Pembersihan cache aset dan aktivasi Service Worker baru yang aman.',
          'Menu "Tentang Aplikasi & Versi" lengkap dengan tombol Cek Pembaruan manual.',
          'Jaminan 100% data peminjam, pinjaman, dan tabungan tetap aman di IndexedDB/LocalStorage.'
        ]
      },
      {
        title: 'Penyempurnaan PWA & Pengaturan',
        items: [
          'Status PWA terpasang vs browser web dengan panduan instalasi lengkap.',
          'Pemisahan header cache Vercel agar file versi selalu segar dan tidak terjebak cache.'
        ]
      }
    ]
  },
  {
    version: '1.0.0',
    releaseDate: '10 Oktober 2026',
    changelog: [
      {
        title: 'Rilis Perdana DanaNote',
        items: [
          'Pencatatan pinjaman, bunga pinjaman manual/default, dan tabungan peminjam.',
          'Penyimpanan offline-first dengan IndexedDB dan LocalStorage sinkron.',
          'Cetak nota angsuran, ekspor/impor cadangan JSON, dan sinkronisasi Supabase opsional.'
        ]
      }
    ]
  }
];

// Helper perbandingan versi semver (misal "1.1.0" vs "1.0.0")
export function compareVersions(v1: string, v2: string): number {
  const clean1 = v1.replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0);
  const clean2 = v2.replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0);

  const maxLen = Math.max(clean1.length, clean2.length);
  for (let i = 0; i < maxLen; i++) {
    const num1 = clean1[i] || 0;
    const num2 = clean2[i] || 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }
  return 0;
}

export function isNewerVersion(remoteVersion: string, currentVersion: string = CURRENT_APP_VERSION): boolean {
  return compareVersions(remoteVersion, currentVersion) > 0;
}
