import { useState, useEffect, useRef } from 'react';
import { 
  Settings as SettingsIcon, Download, Upload, Database, RefreshCw, 
  Trash2, Cloud, Wifi, WifiOff, CheckCircle2, 
  AlertCircle, Smartphone, Percent, PiggyBank, Save
} from 'lucide-react';
import { 
  getBorrowers, getLoans, getPayments, getSavingsTransactions, createBackup, 
  restoreBackup, clearAllData, seedDemoData, getSyncConfig, 
  saveSyncConfig, getAppSettings, updateAppSettings 
} from '../services/storage';
import { syncToCloud, testCloudConnection } from '../services/sync';
import { exportToJSONFile } from '../utils';
import { isAppInstalled } from '../services/pwa';
import PWAInstallModal from '../components/PWAInstallModal';
import AboutAppModal from '../components/AboutAppModal';
import { CURRENT_APP_VERSION, CURRENT_RELEASE_DATE } from '../version';
import { subscribeUpdate, getUpdateState, UpdateState } from '../services/updateService';

export default function Settings() {
  const [borrowersCount, setBorrowersCount] = useState(0);
  const [loansCount, setLoansCount] = useState(0);
  const [paymentsCount, setPaymentsCount] = useState(0);
  const [savingsCount, setSavingsCount] = useState(0);
  const [isPWAInstalled, setIsPWAInstalled] = useState(false);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [updateState, setUpdateState] = useState<UpdateState>(getUpdateState());
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // App Financial Rules Setting State
  const [interestRate, setInterestRate] = useState(20);
  const [savingsRate, setSavingsRate] = useState(5);
  const [rulesSavedMessage, setRulesSavedMessage] = useState(false);

  // Cloud Sync Form State
  const [syncConfig, setSyncConfigState] = useState(getSyncConfig());
  const [isTestingSync, setIsTestingSync] = useState(false);
  const [syncTestMessage, setSyncTestMessage] = useState<{ success: boolean; text: string } | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Restore & Reset state
  const [restoreMode, setRestoreMode] = useState<'replace' | 'merge'>('replace');
  const [restoreStatus, setRestoreStatus] = useState<{ success: boolean; text: string } | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    refreshCounts();
    const currentSettings = getAppSettings();
    setInterestRate(currentSettings.defaultInterestRate);
    setSavingsRate(currentSettings.defaultSavingsRate);
    setIsPWAInstalled(isAppInstalled());

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const unsubUpdate = subscribeUpdate((st) => setUpdateState(st));

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubUpdate();
    };
  }, []);

  const refreshCounts = () => {
    setBorrowersCount(getBorrowers().length);
    setLoansCount(getLoans().length);
    setPaymentsCount(getPayments().length);
    setSavingsCount(getSavingsTransactions().length);
  };

  const handleSaveFinancialRules = (e: React.FormEvent) => {
    e.preventDefault();
    const validInterest = Math.max(0, Number(interestRate) || 0);
    const validSavings = Math.max(0, Number(savingsRate) || 0);

    updateAppSettings({
      defaultInterestRate: validInterest,
      defaultSavingsRate: validSavings,
    });

    setRulesSavedMessage(true);
    setTimeout(() => setRulesSavedMessage(false), 3000);
  };

  const handleBackupDownload = () => {
    const backup = createBackup();
    exportToJSONFile(backup, 'dananote_cadangan_lengkap');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        const result = await restoreBackup(json, restoreMode);
        if (result.success) {
          setRestoreStatus({
            success: true,
            text: `Berhasil memulihkan ${result.counts.borrowers} peminjam, ${result.counts.loans} pinjaman, ${result.counts.payments} pembayaran, dan ${result.counts.savings} mutasi tabungan.`,
          });
          refreshCounts();
          const cur = getAppSettings();
          setInterestRate(cur.defaultInterestRate);
          setSavingsRate(cur.defaultSavingsRate);
        } else {
          setRestoreStatus({ success: false, text: result.message });
        }
      } catch (err: any) {
        setRestoreStatus({ success: false, text: 'File cadangan JSON rusak atau format salah.' });
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClearDatabase = async () => {
    await clearAllData();
    refreshCounts();
    setShowClearConfirm(false);
    setRestoreStatus({ success: true, text: 'Seluruh database telah dikosongkan. Data tidak akan diisi ulang otomatis.' });
  };

  const handleSeedDemo = () => {
    seedDemoData();
    refreshCounts();
    setRestoreStatus({ success: true, text: 'Data simulasi contoh berhasil dimuat.' });
  };

  const handleSaveSyncConfig = (e: React.FormEvent) => {
    e.preventDefault();
    saveSyncConfig(syncConfig);
    setSyncTestMessage({ success: true, text: 'Pengaturan cloud sync disimpan.' });
  };

  const handleTestConnection = async () => {
    if (!syncConfig.supabaseUrl || !syncConfig.supabaseAnonKey) {
      setSyncTestMessage({ success: false, text: 'Mohon isi URL dan Anon Key Supabase.' });
      return;
    }
    setIsTestingSync(true);
    setSyncTestMessage(null);
    const res = await testCloudConnection(syncConfig.supabaseUrl, syncConfig.supabaseAnonKey);
    setIsTestingSync(false);
    setSyncTestMessage({ success: res.success, text: res.message });
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    const res = await syncToCloud();
    setIsSyncing(false);
    setSyncTestMessage({ success: res.success, text: res.message });
    setSyncConfigState(getSyncConfig());
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
          <SettingsIcon className="w-6 h-6 text-emerald-400" /> Pengaturan & Cadangan
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Atur persentase bunga default, tabungan otomatis peminjam, pencadangan data, dan integrasi cloud
        </p>
      </div>

      {/* Financial Rules Card (BUNGA & TABUNGAN DEFAULT) */}
      <div className="card p-5 space-y-4 bg-[#1e293b] border-slate-700/80">
        <div className="flex items-center justify-between border-b border-slate-700 pb-3">
          <div className="flex items-center gap-2 font-semibold text-white text-sm">
            <Percent className="w-5 h-5 text-emerald-400" />
            <h3>Pengaturan Bunga & Tabungan Default</h3>
          </div>
          <span className="badge badge-success text-[11px]">Snapshot Transaksi</span>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed">
          Atur tarif persentase standar untuk transaksi pinjaman baru berikutnya. Perubahan pengaturan ini tidak akan mengubah perhitungan pinjaman lama yang sudah tersimpan sebelumnya.
        </p>

        <form onSubmit={handleSaveFinancialRules} className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
          <div>
            <label className="block text-xs font-semibold mb-1 text-slate-300 flex items-center gap-1.5">
              <Percent className="w-3.5 h-3.5 text-purple-400" />
              Bunga Pinjaman Default (%)
            </label>
            <div className="relative">
              <input
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={interestRate}
                onChange={(e) => setInterestRate(Number(e.target.value))}
                className="input-field text-xs pr-8"
                required
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">%</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Standar 20%. Ditambahkan sebagai Jasa Pinjam ke total tagihan.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1 text-slate-300 flex items-center gap-1.5">
              <PiggyBank className="w-3.5 h-3.5 text-emerald-400" />
              Tabungan Otomatis Peminjam Default (%)
            </label>
            <div className="relative">
              <input
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={savingsRate}
                onChange={(e) => setSavingsRate(Number(e.target.value))}
                className="input-field text-xs pr-8"
                required
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">%</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Standar 5%. Dihitung dari pokok dan dicatat otomatis ke saldo tabungan peminjam.
            </p>
          </div>

          <div className="sm:col-span-2 flex items-center gap-3 pt-1">
            <button type="submit" className="btn-primary text-xs flex items-center gap-1.5">
              <Save className="w-3.5 h-3.5" /> Simpan Perubahan Bunga & Tabungan
            </button>
            {rulesSavedMessage && (
              <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4" /> Pengaturan berhasil disimpan!
              </span>
            )}
          </div>
        </form>
      </div>

      {/* PWA & Platform Status Banner */}
      <div className="card p-5 bg-gradient-to-r from-emerald-950/40 via-teal-950/20 to-transparent border-emerald-800/60">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center flex-shrink-0 shadow-md">
              <Smartphone className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-base text-white">Aplikasi PWA & Offline Support</h2>
                <span className={`badge ${isPWAInstalled ? 'badge-success' : 'badge-warning'}`}>
                  {isPWAInstalled ? 'Terpasang di Perangkat' : 'Web Browser'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                DanaNote dapat dipasang di Windows, Android, dan iPhone tanpa toko aplikasi.
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowInstallModal(true)}
            className="btn-primary text-xs flex items-center justify-center gap-1.5 whitespace-nowrap"
          >
            <Download className="w-4 h-4" /> Panduan & Pasang App
          </button>
        </div>
      </div>

      {/* About App & Update Management Card */}
      <div className="card p-5 space-y-4 bg-[#1e293b] border-slate-700/80">
        <div className="flex items-center justify-between border-b border-slate-700 pb-3">
          <div className="flex items-center gap-2 font-semibold text-white text-sm">
            <RefreshCw className="w-5 h-5 text-emerald-400" />
            <h3>Versi Aplikasi & Pembaruan Otomatis</h3>
          </div>
          <span className="badge badge-success text-[11px]">v{CURRENT_APP_VERSION}</span>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-900/60 p-3.5 rounded-xl border border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white">DanaNote Versi {CURRENT_APP_VERSION}</span>
              <span className="text-slate-500 text-xs">•</span>
              <span className="text-xs text-slate-400">{CURRENT_RELEASE_DATE}</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Sistem update otomatis mendeteksi rilis baru saat online dan mengisolasi data pengguna tanpa reset.
            </p>
          </div>
          <button
            onClick={() => setShowAboutModal(true)}
            className="btn-secondary text-xs flex items-center gap-1.5 whitespace-nowrap"
          >
            <RefreshCw className="w-3.5 h-3.5 text-emerald-400" /> Periksa Pembaruan & Changelog
          </button>
        </div>
      </div>

      {/* Storage & Database Health Card */}
      <div className="card p-5 space-y-4 bg-[#1e293b] border-slate-700/80">
        <div className="flex items-center justify-between border-b border-slate-700 pb-3">
          <div className="flex items-center gap-2 font-semibold text-white text-sm">
            <Database className="w-5 h-5 text-emerald-400" />
            <h3>Status Penyimpanan Database Lokal</h3>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="flex items-center gap-1 text-emerald-400 font-semibold">
              <CheckCircle2 className="w-4 h-4" /> IndexedDB & LocalStorage Sinkron
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-700/60">
            <span className="text-xs text-slate-400 block">Total Peminjam</span>
            <span className="text-xl font-bold text-emerald-400">{borrowersCount}</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-700/60">
            <span className="text-xs text-slate-400 block">Total Pinjaman</span>
            <span className="text-xl font-bold text-blue-400">{loansCount}</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-700/60">
            <span className="text-xs text-slate-400 block">Transaksi Bayar</span>
            <span className="text-xl font-bold text-teal-400">{paymentsCount}</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-700/60">
            <span className="text-xs text-slate-400 block">Mutasi Tabungan</span>
            <span className="text-xl font-bold text-purple-400">{savingsCount}</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          <button
            onClick={handleBackupDownload}
            className="btn-primary text-xs flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" /> Unduh Cadangan JSON
          </button>
          <button
            onClick={handleSeedDemo}
            className="btn-secondary text-xs flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Muat Data Simulasi
          </button>
          <button
            onClick={() => setShowClearConfirm(true)}
            className="btn-danger text-xs flex items-center gap-1.5 ml-auto"
          >
            <Trash2 className="w-3.5 h-3.5" /> Kosongkan Data
          </button>
        </div>
      </div>

      {/* Restore Section */}
      <div className="card p-5 space-y-4 bg-[#1e293b] border-slate-700/80">
        <div className="flex items-center gap-2 font-semibold text-white text-sm border-b border-slate-700 pb-3">
          <Upload className="w-5 h-5 text-blue-400" />
          <h3>Pemulihan Data (Restore JSON)</h3>
        </div>

        <p className="text-xs text-slate-400">
          Unggah file cadangan <code>.json</code> untuk mengembalikan data peminjam, pinjaman, tabungan, dan riwayat pembayaran.
        </p>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex items-center gap-3 text-xs">
            <label className="flex items-center gap-1.5 cursor-pointer text-slate-300">
              <input
                type="radio"
                name="restoreMode"
                value="replace"
                checked={restoreMode === 'replace'}
                onChange={() => setRestoreMode('replace')}
                className="text-emerald-500"
              />
              <span>Ganti Seluruh Data</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer text-slate-300">
              <input
                type="radio"
                name="restoreMode"
                value="merge"
                checked={restoreMode === 'merge'}
                onChange={() => setRestoreMode('merge')}
                className="text-emerald-500"
              />
              <span>Gabungkan (Merge)</span>
            </label>
          </div>

          <div>
            <input
              type="file"
              accept=".json"
              ref={fileInputRef}
              onChange={handleFileUpload}
              className="hidden"
              id="restore-file-input"
            />
            <label htmlFor="restore-file-input" className="btn-secondary text-xs cursor-pointer inline-flex items-center gap-1.5">
              <Upload className="w-3.5 h-3.5" /> Pilih File Cadangan (.json)
            </label>
          </div>
        </div>

        {restoreStatus && (
          <div
            className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
              restoreStatus.success
                ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-800/80'
                : 'bg-red-950/70 text-red-300 border border-red-800/80'
            }`}
          >
            {restoreStatus.success ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
            <span>{restoreStatus.text}</span>
          </div>
        )}
      </div>

      {/* Cloud Sync (Optional) Section */}
      <div className="card p-5 space-y-4 bg-[#1e293b] border-slate-700/80">
        <div className="flex items-center justify-between border-b border-slate-700 pb-3">
          <div className="flex items-center gap-2 font-semibold text-white text-sm">
            <Cloud className="w-5 h-5 text-emerald-400" />
            <h3>Sinkronisasi Cloud Opsional (Supabase)</h3>
          </div>
          <div className="flex items-center gap-1 text-xs">
            {isOnline ? (
              <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                <Wifi className="w-3.5 h-3.5" /> Online
              </span>
            ) : (
              <span className="flex items-center gap-1 text-amber-400 font-semibold">
                <WifiOff className="w-3.5 h-3.5" /> Offline
              </span>
            )}
          </div>
        </div>

        <form onSubmit={handleSaveSyncConfig} className="space-y-3">
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={syncConfig.enabled}
              onChange={(e) => setSyncConfigState({ ...syncConfig, enabled: e.target.checked })}
              className="rounded text-emerald-500"
            />
            <span>Aktifkan Integrasi Cloud Supabase</span>
          </label>

          {syncConfig.enabled && (
            <div className="space-y-3 pt-2">
              <div>
                <label className="block text-xs font-medium mb-1 text-slate-400">Supabase Project URL</label>
                <input
                  type="text"
                  placeholder="https://your-project.supabase.co"
                  value={syncConfig.supabaseUrl}
                  onChange={(e) => setSyncConfigState({ ...syncConfig, supabaseUrl: e.target.value })}
                  className="input-field text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1 text-slate-400">Supabase Anon Key</label>
                <input
                  type="password"
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  value={syncConfig.supabaseAnonKey}
                  onChange={(e) => setSyncConfigState({ ...syncConfig, supabaseAnonKey: e.target.value })}
                  className="input-field text-xs font-mono"
                />
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                <button type="submit" className="btn-primary text-xs">
                  Simpan Pengaturan
                </button>
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={isTestingSync}
                  className="btn-secondary text-xs flex items-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isTestingSync ? 'animate-spin' : ''}`} />
                  {isTestingSync ? 'Menguji...' : 'Uji Koneksi'}
                </button>
                <button
                  type="button"
                  onClick={handleManualSync}
                  disabled={isSyncing || !isOnline}
                  className="btn-secondary text-xs flex items-center gap-1.5"
                >
                  <Cloud className={`w-3.5 h-3.5 ${isSyncing ? 'animate-pulse' : ''}`} />
                  {isSyncing ? 'Menyinkronkan...' : 'Sinkronkan Sekarang'}
                </button>
              </div>
            </div>
          )}
        </form>

        {syncTestMessage && (
          <div
            className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
              syncTestMessage.success
                ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-800/80'
                : 'bg-red-950/70 text-red-300 border border-red-800/80'
            }`}
          >
            {syncTestMessage.success ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
            <span>{syncTestMessage.text}</span>
          </div>
        )}
      </div>

      {/* Clear Database Confirmation Modal */}
      {showClearConfirm && (
        <div className="modal-overlay" onClick={() => setShowClearConfirm(false)}>
          <div className="modal-content max-w-sm bg-[#1e293b] border-slate-700" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-base font-bold mb-2 text-red-400">Kosongkan Semua Data?</h2>
            <p className="text-xs mb-4 text-slate-400">
              Seluruh data peminjam, pinjaman, tabungan, dan riwayat pembayaran akan dihapus permanen dari browser ini. Aplikasi tidak akan mereset ke data simulasi secara otomatis.
            </p>
            <div className="flex gap-3">
              <button onClick={handleClearDatabase} className="btn-danger flex-1 text-xs">
                Ya, Hapus Semua
              </button>
              <button onClick={() => setShowClearConfirm(false)} className="btn-secondary flex-1 text-xs">
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PWA Install Modal */}
      <PWAInstallModal
        isOpen={showInstallModal}
        onClose={() => setShowInstallModal(false)}
      />

      {/* About App Modal */}
      <AboutAppModal
        isOpen={showAboutModal}
        onClose={() => setShowAboutModal(false)}
        updateState={updateState}
      />
    </div>
  );
}
