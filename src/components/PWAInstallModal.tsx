import { useState, useEffect } from 'react';
import { 
  X, Download, Monitor, Smartphone, Apple, CheckCircle2, 
  Share2, PlusSquare, ArrowRight, ShieldCheck, WifiOff
} from 'lucide-react';
import { promptPWAInstall, subscribePWAInstall, getDevicePlatform, isAppInstalled } from '../services/pwa';

interface PWAInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function PWAInstallModal({ isOpen, onClose }: PWAInstallModalProps) {
  const [canDirectInstall, setCanDirectInstall] = useState(false);
  const [platform, setPlatform] = useState<'ios' | 'android' | 'windows' | 'mac' | 'other'>('windows');
  const [activeTab, setActiveTab] = useState<'windows' | 'android' | 'ios'>('windows');
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const plat = getDevicePlatform();
    setPlatform(plat);
    if (plat === 'ios') setActiveTab('ios');
    else if (plat === 'android') setActiveTab('android');
    else setActiveTab('windows');

    setInstalled(isAppInstalled());
    const unsub = subscribePWAInstall((can) => setCanDirectInstall(can));
    return () => unsub();
  }, []);

  if (!isOpen) return null;

  const handleDirectInstall = async () => {
    const outcome = await promptPWAInstall();
    if (outcome === 'accepted') {
      onClose();
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="modal-content max-w-lg w-full max-h-[90vh] flex flex-col p-0 overflow-hidden" 
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-emerald-600 to-teal-700 text-white flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20">
              <Download className="w-6 h-6 text-emerald-200" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Pasang Aplikasi DanaNote</h2>
              <p className="text-xs text-emerald-100 mt-0.5">
                Bisa dibuka cepat, layar penuh, dan 100% bekerja offline!
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-1 rounded-lg hover:bg-white/20 text-white/80 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Platform Selector Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-2 gap-2">
          <button
            onClick={() => setActiveTab('windows')}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'windows'
                ? 'bg-white dark:bg-gray-700 text-emerald-600 dark:text-emerald-400 shadow-xs'
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <Monitor className="w-4 h-4" /> Windows / PC
          </button>
          <button
            onClick={() => setActiveTab('android')}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'android'
                ? 'bg-white dark:bg-gray-700 text-emerald-600 dark:text-emerald-400 shadow-xs'
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <Smartphone className="w-4 h-4" /> Android
          </button>
          <button
            onClick={() => setActiveTab('ios')}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'ios'
                ? 'bg-white dark:bg-gray-700 text-emerald-600 dark:text-emerald-400 shadow-xs'
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <Apple className="w-4 h-4" /> iPhone / iPad
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {/* Key PWA Benefits */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-900/50">
              <WifiOff className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>Dukungan Penuh Offline</span>
            </div>
            <div className="flex items-center gap-2 p-2 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 border border-blue-100 dark:border-blue-900/50">
              <ShieldCheck className="w-4 h-4 text-blue-600 flex-shrink-0" />
              <span>Data Aman di Perangkat</span>
            </div>
          </div>

          {/* Direct Install Button if supported */}
          {canDirectInstall && (
            <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">Instalasi Cepat Siap</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">Klik tombol berikut untuk memasang langsung.</p>
              </div>
              <button
                onClick={handleDirectInstall}
                className="btn-primary text-xs flex items-center gap-1.5 whitespace-nowrap shadow-md"
              >
                <Download className="w-4 h-4" /> Pasang Sekarang
              </button>
            </div>
          )}

          {/* Step by step for Windows */}
          {activeTab === 'windows' && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200">
                Cara Pasang di Windows (Google Chrome / Microsoft Edge):
              </h3>
              <ol className="space-y-2.5 text-xs text-gray-600 dark:text-gray-300 list-decimal list-inside">
                <li className="p-2.5 rounded-lg bg-gray-50 dark:bg-gray-800/80 border border-gray-100 dark:border-gray-700">
                  <span className="font-semibold text-gray-900 dark:text-white">Opsi 1:</span> Klik ikon <strong>Install / Pasang Aplikasi</strong> di bilah alamat (URL bar) browser di sebelah kanan atas.
                </li>
                <li className="p-2.5 rounded-lg bg-gray-50 dark:bg-gray-800/80 border border-gray-100 dark:border-gray-700">
                  <span className="font-semibold text-gray-900 dark:text-white">Opsi 2:</span> Buka menu titik tiga (⋮) di pojok kanan atas browser &rarr; Pilih <strong>"Pasang DanaNote"</strong> atau <strong>"Aplikasi" &rarr; "Pasang situs ini sebagai aplikasi"</strong>.
                </li>
                <li className="p-2.5 rounded-lg bg-gray-50 dark:bg-gray-800/80 border border-gray-100 dark:border-gray-700">
                  Ikon DanaNote akan muncul di Desktop dan Start Menu Windows Anda.
                </li>
              </ol>
            </div>
          )}

          {/* Step by step for Android */}
          {activeTab === 'android' && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200">
                Cara Pasang di HP Android (Google Chrome):
              </h3>
              <ol className="space-y-2.5 text-xs text-gray-600 dark:text-gray-300 list-decimal list-inside">
                <li className="p-2.5 rounded-lg bg-gray-50 dark:bg-gray-800/80 border border-gray-100 dark:border-gray-700">
                  Tekan menu titik tiga (<strong>⋮</strong>) di pojok kanan atas Chrome.
                </li>
                <li className="p-2.5 rounded-lg bg-gray-50 dark:bg-gray-800/80 border border-gray-100 dark:border-gray-700">
                  Pilih menu <strong>"Tambahkan ke Layar Utama"</strong> atau <strong>"Pasang Aplikasi"</strong>.
                </li>
                <li className="p-2.5 rounded-lg bg-gray-50 dark:bg-gray-800/80 border border-gray-100 dark:border-gray-700">
                  Tekan <strong>"Pasang / Install"</strong>. Aplikasi akan terpasang di daftar aplikasi HP Anda layaknya aplikasi native.
                </li>
              </ol>
            </div>
          )}

          {/* Step by step for iOS iPhone */}
          {activeTab === 'ios' && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200">
                Cara Pasang di iPhone / iPad (Safari):
              </h3>
              <div className="space-y-2.5 text-xs text-gray-600 dark:text-gray-300">
                <div className="p-2.5 rounded-lg bg-gray-50 dark:bg-gray-800/80 border border-gray-100 dark:border-gray-700 flex items-start gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 font-bold flex items-center justify-center flex-shrink-0">
                    1
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">Buka di Browser Safari</p>
                    <p>Pastikan Anda membuka website DanaNote menggunakan Safari.</p>
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-gray-50 dark:bg-gray-800/80 border border-gray-100 dark:border-gray-700 flex items-start gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 font-bold flex items-center justify-center flex-shrink-0">
                    2
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
                      Tekan Tombol Bagikan <Share2 className="w-4 h-4 text-blue-500" />
                    </p>
                    <p>Tombol kotak dengan tanda panah ke atas di bagian bawah layar Safari.</p>
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-gray-50 dark:bg-gray-800/80 border border-gray-100 dark:border-gray-700 flex items-start gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 font-bold flex items-center justify-center flex-shrink-0">
                    3
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
                      Pilih "Tambah ke Layar Utama" <PlusSquare className="w-4 h-4 text-gray-700 dark:text-gray-300" />
                    </p>
                    <p>Gulir ke bawah dan ketuk <em>"Add to Home Screen"</em>.</p>
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-gray-50 dark:bg-gray-800/80 border border-gray-100 dark:border-gray-700 flex items-start gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 font-bold flex items-center justify-center flex-shrink-0">
                    4
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">Ketuk "Tambah" (Add)</p>
                    <p>Selesai! Ikon DanaNote akan siap di layar depan iPhone Anda.</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary text-xs px-4">
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
