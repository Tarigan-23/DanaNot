import { useState } from 'react';
import { 
  Sparkles, RefreshCw, AlertCircle, X, ChevronRight, 
  CheckCircle2, ShieldCheck, ArrowRight
} from 'lucide-react';
import { UpdateState, dismissUpdateForSession, applyAppUpdate } from '../services/updateService';
import { CURRENT_APP_VERSION } from '../version';

interface UpdateModalProps {
  updateState: UpdateState;
  isProcessingTransaction?: boolean;
}

export default function UpdateModal({ updateState, isProcessingTransaction = false }: UpdateModalProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  // Jangan tampilkan notifikasi jika:
  // 1. Tidak ada update
  // 2. Pengguna sudah menunda di sesi ini
  // 3. Sedang dalam proses transaksi (isProcessingTransaction)
  if (!updateState.hasUpdate || updateState.isDismissedThisSession || isProcessingTransaction) {
    return null;
  }

  const handleUpdateNow = async () => {
    setIsUpdating(true);
    setErrorText(null);
    try {
      await applyAppUpdate();
    } catch (err: any) {
      setIsUpdating(false);
      setErrorText('Pembaruan gagal dimuat. Silakan periksa koneksi internet Anda.');
    }
  };

  const handleDismiss = () => {
    dismissUpdateForSession();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="w-full max-w-lg bg-[#111827] border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col text-slate-100 max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with vibrant accent */}
        <div className="relative p-6 bg-gradient-to-br from-emerald-950/70 via-slate-900 to-[#111827] border-b border-slate-800">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-950/60 flex-shrink-0">
                <Sparkles className="w-6 h-6 text-white animate-pulse" />
              </div>
              <div>
                <span className="text-[11px] font-semibold tracking-wider uppercase text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-md border border-emerald-800/60">
                  Pembaruan Baru Tersedia!
                </span>
                <h2 className="text-lg font-bold text-white mt-1">
                  DanaNote v{updateState.latestVersion}
                </h2>
              </div>
            </div>
            <button
              onClick={handleDismiss}
              disabled={isUpdating}
              className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800/80 transition-colors"
              title="Tunda notifikasi"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center gap-2 mt-4 text-xs text-slate-300">
            <span className="bg-slate-800/90 px-2.5 py-1 rounded-md text-slate-400 border border-slate-700/50">
              Versi Anda: <strong className="text-slate-200">v{CURRENT_APP_VERSION}</strong>
            </span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
            <span className="bg-emerald-950/80 px-2.5 py-1 rounded-md text-emerald-300 border border-emerald-800/50 font-semibold">
              Versi Baru: <strong>v{updateState.latestVersion}</strong>
            </span>
            {updateState.releaseDate && (
              <span className="text-[11px] text-slate-500 ml-auto">
                {updateState.releaseDate}
              </span>
            )}
          </div>
        </div>

        {/* Changelog Content */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          <p className="text-xs text-slate-300 leading-relaxed">
            Nikmati fitur terbaru, peningkatan performa, dan pembaruan sistem pada versi ini.
          </p>

          <div className="bg-slate-900/80 rounded-xl p-4 border border-slate-800 space-y-3">
            <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
              <ChevronRight className="w-4 h-4 text-emerald-500" />
              Catatan Pembaruan (Changelog):
            </h4>
            {updateState.changelog && updateState.changelog.length > 0 ? (
              <div className="space-y-3 text-xs">
                {updateState.changelog.map((section, idx) => (
                  <div key={idx} className="space-y-1.5">
                    <p className="font-semibold text-slate-200 text-xs">{section.title}</p>
                    <ul className="space-y-1 pl-3 text-slate-300">
                      {section.items.map((item, itemIdx) => (
                        <li key={itemIdx} className="flex items-start gap-2 text-xs">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 flex-shrink-0" />
                          <span className="leading-snug">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">Peningkatan performa dan kestabilan aplikasi.</p>
            )}
          </div>

          {/* User Data Safety Guarantee Badge */}
          <div className="p-3 bg-emerald-950/40 rounded-xl border border-emerald-800/50 flex items-start gap-2.5 text-xs text-emerald-300">
            <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
            <div>
              <strong className="block font-semibold text-white">Data Anda Aman 100%</strong>
              <span className="text-slate-300 text-[11px]">
                Seluruh catatan peminjam, pinjaman, pembayaran, tabungan, dan pengaturan di IndexedDB/LocalStorage tetap tersimpan utuh tanpa reset.
              </span>
            </div>
          </div>

          {errorText && (
            <div className="p-3 bg-red-950/60 rounded-xl border border-red-800/80 flex items-center gap-2 text-xs text-red-300">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <span>{errorText}</span>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="p-4 bg-slate-900/90 border-t border-slate-800 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleDismiss}
            disabled={isUpdating}
            className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-800 rounded-xl border border-slate-700/60 transition-all disabled:opacity-50"
          >
            Tunda Nanti
          </button>
          
          <button
            type="button"
            onClick={handleUpdateNow}
            disabled={isUpdating}
            className="btn-primary text-xs flex items-center gap-2 px-5 py-2.5 shadow-lg shadow-emerald-950/60 disabled:opacity-70"
          >
            {isUpdating ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Memperbarui Aplikasi...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Update Sekarang
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
