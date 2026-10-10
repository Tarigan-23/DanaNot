import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, Users, FileText, CreditCard, BarChart3, 
  Menu, X, Wallet, Settings, Download, Wifi, WifiOff
} from 'lucide-react';
import { subscribePWAInstall } from '../services/pwa';
import PWAInstallModal from './PWAInstallModal';

interface LayoutProps {
  children: React.ReactNode;
}

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/borrowers', label: 'Peminjam', icon: Users },
  { path: '/loans', label: 'Pinjaman', icon: FileText },
  { path: '/payments', label: 'Pembayaran', icon: CreditCard },
  { path: '/reports', label: 'Laporan', icon: BarChart3 },
  { path: '/settings', label: 'Pengaturan', icon: Settings },
];

export default function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [canInstall, setCanInstall] = useState(false);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const unsubPWA = subscribePWAInstall((can) => setCanInstall(can));

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubPWA();
    };
  }, []);

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[#0b0f19] text-[#f8fafc]">
      {/* Sidebar Desktop */}
      <aside className="sidebar hidden lg:flex flex-col w-64 fixed h-full z-30 shadow-lg">
        {/* Brand Header */}
        <div className="p-5 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center shadow-md shadow-emerald-950/50">
              <Wallet className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-emerald-400 tracking-tight">DanaNote</h1>
              <p className="text-[11px] text-slate-400">Pencatatan Pinjaman</p>
            </div>
          </div>
        </div>

        {/* Network & Offline Status Banner */}
        <div className="px-4 py-2 bg-slate-900/60 border-b border-slate-800 flex items-center justify-between text-xs">
          <span className="text-slate-400 font-medium">Status App:</span>
          {isOnline ? (
            <span className="flex items-center gap-1 text-emerald-400 font-semibold">
              <Wifi className="w-3.5 h-3.5" /> Online
            </span>
          ) : (
            <span className="flex items-center gap-1 text-amber-400 font-semibold" title="Tersimpan lokal di IndexedDB">
              <WifiOff className="w-3.5 h-3.5" /> Offline (IDB)
            </span>
          )}
        </div>
        
        {/* Navigation Items */}
        <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive 
                    ? 'bg-emerald-600 text-white font-semibold shadow-md shadow-emerald-950/40' 
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* PWA Install Button Footer */}
        <div className="p-4 border-t border-slate-800 space-y-2">
          <button
            onClick={() => setShowInstallModal(true)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold bg-emerald-950/50 text-emerald-300 hover:bg-emerald-900/60 border border-emerald-800/60 transition-all"
          >
            <Download className="w-3.5 h-3.5" /> Pasang di Windows / HP
          </button>
          <div className="text-center text-[10px] text-slate-500 pt-1">
            DanaNote v1.0 • Offline Ready
          </div>
        </div>
      </aside>

      {/* Mobile Drawer Sidebar */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-xs" onClick={() => setSidebarOpen(false)} />
          <aside className="sidebar absolute left-0 top-0 h-full w-72 flex flex-col shadow-2xl animate-in slide-in-from-left duration-200 bg-[#090d16] border-r border-slate-800">
            <div className="p-4 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center shadow-xs">
                  <Wallet className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-base font-bold text-emerald-400">DanaNote</h1>
                  <p className="text-[10px] text-slate-400">Pencatatan Pinjaman Uang</p>
                </div>
              </div>
              <button onClick={() => setSidebarOpen(false)} className="p-1 rounded-lg hover:bg-slate-800 text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      isActive 
                        ? 'bg-emerald-600 text-white font-semibold' 
                        : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <item.icon className="w-4 h-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <div className="p-4 border-t border-slate-800">
              <button
                onClick={() => { setShowInstallModal(true); setSidebarOpen(false); }}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold bg-emerald-950/60 text-emerald-300 border border-emerald-800/60"
              >
                <Download className="w-3.5 h-3.5" /> Pasang Aplikasi (PWA)
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 lg:ml-64 flex flex-col min-h-screen pb-16 lg:pb-0">
        {/* Mobile Sticky Header */}
        <header className="lg:hidden sticky top-0 z-20 flex items-center justify-between px-4 py-3 border-b border-slate-800 backdrop-blur-md bg-[#090d16]/90">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300">
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <Wallet className="w-5 h-5 text-emerald-500" />
              <span className="font-bold text-base text-emerald-400">DanaNote</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isOnline && (
              <span className="badge badge-warning text-[10px] flex items-center gap-1">
                <WifiOff className="w-3 h-3" /> Offline
              </span>
            )}
            <button
              onClick={() => setShowInstallModal(true)}
              className="p-1.5 rounded-lg text-emerald-400 hover:bg-emerald-950/40"
              title="Pasang Aplikasi"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Page Container */}
        <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full flex-1">
          {children}
        </div>

        {/* Mobile Bottom Navigation Bar */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-[#090d16]/95 backdrop-blur-md border-t border-slate-800 flex justify-around py-1.5 px-2 shadow-2xl">
          {navItems.slice(0, 5).map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex flex-col items-center justify-center flex-1 py-1 text-[10px] font-medium transition-colors ${
                  isActive ? 'text-emerald-400 font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                <item.icon className={`w-4 h-4 mb-0.5 ${isActive ? 'scale-110' : ''}`} />
                <span>{item.label}</span>
              </Link>
            );
          })}
          <Link
            to="/settings"
            className={`flex flex-col items-center justify-center flex-1 py-1 text-[10px] font-medium transition-colors ${
              location.pathname === '/settings' ? 'text-emerald-400 font-bold' : 'text-slate-400'
            }`}
          >
            <Settings className="w-4 h-4 mb-0.5" />
            <span>Setelan</span>
          </Link>
        </nav>
      </main>

      {/* Global PWA Install Modal */}
      <PWAInstallModal
        isOpen={showInstallModal}
        onClose={() => setShowInstallModal(false)}
      />
    </div>
  );
}
