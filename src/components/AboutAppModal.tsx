import { useState } from 'react';
import { 
  Info, RefreshCw, CheckCircle2, AlertCircle, 
  ExternalLink, Calendar, GitCommit, X, Sparkles, ShieldCheck 
} from 'lucide-react';
import { UpdateState, checkForUpdate, applyAppUpdate } from '../services/updateService';
import { CURRENT_APP_VERSION, CURRENT_RELEASE_DATE, APP_CHANGELOG_HISTORY } from '../version';

interface AboutAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  updateState: UpdateState;
}

export default function AboutAppModal({ isOpen, onClose, updateState }: AboutAppModalProps) {
  const [checking, setChecking] = useState(false);
  const [checkMessage, setCheckMessage] = useState<{ type: 'success' | 'info' | 'error'; text: string } | null>(null);
  const [updating, setUpdating] = useState(false);

  if (!isOpen) return null;

  const handleManualCheck = async () => {
    setChecking(true);
    setCheckMessage(null);
    const result = await checkForUpdate(true);
    setChecking(false);

    if (result.hasUpdate) {
      setCheckMessage({
        type: 'info',
        text: `Versi baru v${updateState.latestVersion} tersedia! Silakan klik Update Sekarang.`
      });
    } else if (result.error) {
      setCheckMessage({
        type: 'error',
        text: result.error
      });
    } else {
      setCheckMessage({
        type: 'success',
        text: 'Aplikasi sudah menggunakan versi terbaru.'
      });
    }
  };

  const handleUpdate = async () => {
    setUpdating(true);
    try {
      await applyAppUpdate();
    } catch {
      setUpdating(false);
      setCheckMessage({
        type: 'error',
        text: 'Gagal memperbarui aplikasi secara otomatis. Silakan refresh halaman.'
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="w-full max-w-lg bg-[#111827] border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col text-slate-100 max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-md shadow-emerald-950/50">
              <Info className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Tentang DanaNote</h2>
              <p className="text-xs text-slate-400">Informasi versi, rilis, dan integritas data</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* Version Info Box */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
              <span className="text-[11px] text-slate-400 block mb-0.5">Versi Terpasang</span>
              <span className="text-base font-bold text-emerald-400">v{CURRENT_APP_VERSION}</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
              <span className="text-[11px] text-slate-400 block mb-0.5">Versi Server Terbaru</span>
              <span className="text-base font-bold text-blue-400">
                v{updateState.latestVersion || CURRENT_APP_VERSION}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
              <span className="text-[11px] text-slate-400 block mb-0.5">Tanggal Rilis</span>
              <span className="text-xs font-semibold text-slate-300">
                {CURRENT_RELEASE_DATE}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
              <span className="text-[11px] text-slate-400 block mb-0.5">Pemeriksaan Terakhir</span>
              <span className="text-xs font-semibold text-slate-300">
                {updateState.lastChecked ? updateState.lastChecked : 'Baru saja'}
              </span>
            </div>
          </div>

          {/* Action Check Status */}
          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs">
              {updateState.hasUpdate ? (
                <div className="flex items-center gap-1.5 text-amber-400 font-semibold">
                  <Sparkles className="w-4 h-4" />
                  <span>Tersedia pembaruan versi {updateState.latestVersion}</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Aplikasi sudah menggunakan versi terbaru.</span>
                </div>
              )}
            </div>

            <div className="flex gap-2 w-full sm:w-auto">
              {updateState.hasUpdate && (
                <button
                  onClick={handleUpdate}
                  disabled={updating}
                  className="btn-primary text-xs flex-1 sm:flex-none flex items-center justify-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${updating ? 'animate-spin' : ''}`} />
                  {updating ? 'Memperbarui...' : 'Update Sekarang'}
                </button>
              )}
              <button
                onClick={handleManualCheck}
                disabled={checking}
                className="btn-secondary text-xs flex-1 sm:flex-none flex items-center justify-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${checking ? 'animate-spin' : ''}`} />
                {checking ? 'Memeriksa...' : 'Periksa Pembaruan'}
              </button>
            </div>
          </div>

          {checkMessage && (
            <div
              className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                checkMessage.type === 'success'
                  ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-800/80'
                  : checkMessage.type === 'error'
                  ? 'bg-red-950/70 text-red-300 border border-red-800/80'
                  : 'bg-blue-950/70 text-blue-300 border border-blue-800/80'
              }`}
            >
              {checkMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
              )}
              <span>{checkMessage.text}</span>
            </div>
          )}

          {/* User Data Safety Guarantee */}
          <div className="p-3 bg-emerald-950/30 rounded-xl border border-emerald-800/40 flex items-start gap-2.5 text-xs text-emerald-300">
            <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
            <div>
              <strong className="block font-semibold text-white">Perlindungan Data 100%</strong>
              <span className="text-slate-300 text-[11px]">
                Data peminjam, buku pinjaman, cicilan, dan tabungan disimpan di IndexedDB & LocalStorage yang terisolasi aman dari proses update aplikasi.
              </span>
            </div>
          </div>

          {/* Changelog History */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <GitCommit className="w-4 h-4 text-emerald-400" />
              Riwayat Rilis & Catatan Perubahan:
            </h4>

            <div className="space-y-3 text-xs">
              {APP_CHANGELOG_HISTORY.map((hist) => (
                <div key={hist.version} className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                    <span className="font-bold text-emerald-400">Versi {hist.version}</span>
                    <span className="text-[11px] text-slate-400 flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> {hist.releaseDate}
                    </span>
                  </div>
                  {hist.changelog.map((sec, i) => (
                    <div key={i} className="space-y-1">
                      <p className="font-medium text-slate-300 text-[11px]">{sec.title}</p>
                      <ul className="space-y-1 pl-3 text-slate-400 text-[11px]">
                        {sec.items.map((it, j) => (
                          <li key={j} className="flex items-start gap-1.5">
                            <span className="w-1 h-1 rounded-full bg-slate-500 mt-1.5 flex-shrink-0" />
                            <span>{it}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-900/90 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="btn-secondary text-xs px-5 py-2"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
