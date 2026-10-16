import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Wallet, TrendingUp, CreditCard, AlertTriangle, 
  Users, Plus, ArrowRight, Clock, Percent, PiggyBank
} from 'lucide-react';
import { formatCurrency, formatDate } from '../utils';
import { 
  getDashboardStats, getRecentPayments, getRecentLoans, 
  subscribeDataChanges 
} from '../services/storage';

export default function Dashboard() {
  const [stats, setStats] = useState(getDashboardStats());
  const [recentPayments, setRecentPayments] = useState(getRecentPayments(6));
  const [recentLoans, setRecentLoans] = useState(getRecentLoans(6));

  const refreshData = () => {
    setStats(getDashboardStats());
    setRecentPayments(getRecentPayments(6));
    setRecentLoans(getRecentLoans(6));
  };

  useEffect(() => {
    refreshData();
    const unsub = subscribeDataChanges(refreshData);
    return () => unsub();
  }, []);

  const statCards = [
    { label: 'Total Pinjaman Pokok', value: stats.totalPrincipal, isCurrency: true, icon: Wallet, color: 'emerald' },
    { label: 'Total Bunga Pinjaman', value: stats.totalInterestFee, isCurrency: true, icon: Percent, color: 'purple' },
    { label: 'Total Tagihan (Pokok + Bunga)', value: stats.totalDue, isCurrency: true, icon: TrendingUp, color: 'blue' },
    { label: 'Total Pembayaran Tunai', value: stats.totalPaidCash, isCurrency: true, icon: CreditCard, color: 'green' },
    { label: 'Saldo Tabungan Peminjam', value: stats.totalSavingsBalance, isCurrency: true, icon: PiggyBank, color: 'teal' },
    { label: 'Sisa Tagihan Belum Lunas', value: stats.totalRemaining, isCurrency: true, icon: AlertTriangle, color: 'red' },
  ];

  const colorMap: Record<string, string> = {
    emerald: 'bg-emerald-950/40 text-emerald-400 border border-emerald-800/60',
    purple: 'bg-purple-950/40 text-purple-400 border border-purple-800/60',
    blue: 'bg-blue-950/40 text-blue-400 border border-blue-800/60',
    green: 'bg-emerald-950/40 text-emerald-400 border border-emerald-800/60',
    red: 'bg-red-950/40 text-red-400 border border-red-800/60',
    teal: 'bg-teal-950/40 text-teal-400 border border-teal-800/60',
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Dashboard Ringkasan</h1>
          <p className="text-xs text-slate-400 mt-1">
            Pantau arus peminjaman, bunga pinjaman, saldo tabungan, dan pembayaran secara real-time
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/borrowers?action=add" className="btn-primary flex items-center gap-1.5 text-xs shadow-xs">
            <Plus className="w-4 h-4" /> Tambah Peminjam
          </Link>
          <Link to="/payments?action=add" className="btn-secondary flex items-center gap-1.5 text-xs shadow-xs">
            <CreditCard className="w-4 h-4 text-emerald-400" /> Catat Pembayaran
          </Link>
        </div>
      </div>

      {/* Stats Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {statCards.map((card, i) => (
          <div key={i} className="card p-4.5 flex items-center gap-4 bg-[#1e293b] border-slate-700/80">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${colorMap[card.color]}`}>
              <card.icon className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-400 truncate">{card.label}</p>
              <p className="text-lg md:text-xl font-extrabold mt-0.5 tracking-tight text-white truncate">
                {card.isCurrency ? formatCurrency(card.value as number) : card.value}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Content Columns: Recent Payments & Recent Loans */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Payments */}
        <div className="card p-5 bg-[#1e293b] border-slate-700/80">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-700">
            <h2 className="font-semibold text-sm flex items-center gap-2 text-white">
              <Clock className="w-4 h-4 text-emerald-400" /> Pembayaran Terbaru
            </h2>
            <Link to="/payments" className="text-xs text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1">
              Lihat Semua <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {recentPayments.length === 0 ? (
            <p className="text-xs py-8 text-center text-slate-500">Belum ada riwayat pembayaran</p>
          ) : (
            <div className="divide-y divide-slate-700/60">
              {recentPayments.map((p) => {
                const isSavings = p.is_savings_payment || p.payment_method === 'Tabungan';

                return (
                  <div key={p.id} className="py-3 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-semibold text-white">{p.borrower_name || 'Tanpa Nama'}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {formatDate(p.payment_date)} • {isSavings ? 'Tabungan Peminjam' : p.payment_method || 'Tunai'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`font-bold ${isSavings ? 'text-purple-400' : 'text-emerald-400'}`}>
                        +{formatCurrency(p.amount)}
                      </p>
                      <span className="text-[10px] text-slate-400 font-mono">{p.receipt_no}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent Loans */}
        <div className="card p-5 bg-[#1e293b] border-slate-700/80">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-700">
            <h2 className="font-semibold text-sm flex items-center gap-2 text-white">
              <TrendingUp className="w-4 h-4 text-blue-400" /> Pinjaman Terbaru
            </h2>
            <Link to="/loans" className="text-xs text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1">
              Lihat Semua <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {recentLoans.length === 0 ? (
            <p className="text-xs py-8 text-center text-slate-500">Belum ada riwayat pinjaman</p>
          ) : (
            <div className="divide-y divide-slate-700/60">
              {recentLoans.map((l) => (
                <div key={l.id} className="py-3 flex items-center justify-between text-xs">
                  <div>
                    <p className="font-semibold text-white">{l.borrower_name || 'Tanpa Nama'}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {formatDate(l.loan_date)} • Bunga: {l.interest_rate !== undefined ? `${l.interest_rate}%` : '20%'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-white">{formatCurrency(l.total_due)}</p>
                    <span className={`badge ${l.status === 'lunas' ? 'badge-success' : 'badge-warning'} text-[10px]`}>
                      {l.status === 'lunas' ? 'Lunas' : 'Belum Lunas'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
