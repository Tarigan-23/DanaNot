import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Wallet, TrendingUp, CreditCard, AlertTriangle, 
  Users, FileX, Plus, ArrowRight, Clock
} from 'lucide-react';
import { formatCurrency, formatDate } from '../utils';
import { getDashboardStats, getRecentPayments, getRecentLoans, getOverdueLoans } from '../services/storage';

export default function Dashboard() {
  const [stats, setStats] = useState(getDashboardStats());
  const [recentPayments, setRecentPayments] = useState(getRecentPayments(5));
  const [recentLoans, setRecentLoans] = useState(getRecentLoans(5));
  const [overdueLoans, setOverdueLoans] = useState(getOverdueLoans());

  useEffect(() => {
    setStats(getDashboardStats());
    setRecentPayments(getRecentPayments(5));
    setRecentLoans(getRecentLoans(5));
    setOverdueLoans(getOverdueLoans());
  }, []);

  const statCards = [
    { label: 'Total Pinjaman Pokok', value: stats.totalPrincipal, icon: Wallet, color: 'emerald' },
    { label: 'Total Tagihan', value: stats.totalDue, icon: TrendingUp, color: 'blue' },
    { label: 'Total Pembayaran', value: stats.totalPaid, icon: CreditCard, color: 'green' },
    { label: 'Sisa Tunggakan', value: stats.totalRemaining, icon: AlertTriangle, color: 'red' },
    { label: 'Jumlah Peminjam', value: stats.totalBorrowers, icon: Users, color: 'purple' },
    { label: 'Belum Lunas', value: stats.unpaidLoans, icon: FileX, color: 'orange' },
  ];

  const colorMap: Record<string, string> = {
    emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400',
    blue: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400',
    green: 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400',
    red: 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400',
    purple: 'bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400',
    orange: 'bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400',
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Ringkasan data peminjaman uang Anda</p>
        </div>
        <div className="flex gap-2">
          <Link to="/borrowers?action=add" className="btn-primary flex items-center gap-2 text-sm">
            <Plus className="w-4 h-4" /> Tambah Peminjam
          </Link>
          <Link to="/payments?action=add" className="btn-secondary flex items-center gap-2 text-sm">
            <CreditCard className="w-4 h-4" /> Catat Pembayaran
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {statCards.map((card, i) => (
          <div key={i} className="card p-4 flex items-start gap-4">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${colorMap[card.color]}`}>
              <card.icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{card.label}</p>
              <p className="text-xl font-bold mt-0.5">
                {typeof card.value === 'number' && card.label.includes('Jumlah') || card.label.includes('Belum')
                  ? card.value.toLocaleString('id-ID')
                  : formatCurrency(card.value as number)
                }
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Payments */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-600" /> Pembayaran Terbaru
            </h2>
            <Link to="/payments" className="text-sm text-emerald-600 hover:text-emerald-700 flex items-center gap-1">
              Lihat Semua <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {recentPayments.length === 0 ? (
            <p className="text-sm py-4 text-center" style={{ color: 'var(--text-secondary)' }}>Belum ada pembayaran</p>
          ) : (
            <div className="space-y-3">
              {recentPayments.map(p => (
                <div key={p.id} className="flex items-center justify-between py-2 border-b last:border-0" style={{ borderColor: 'var(--border-color)' }}>
                  <div>
                    <p className="text-sm font-medium">{p.borrower_name || '-'}</p>
                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{formatDate(p.payment_date)}</p>
                  </div>
                  <span className="text-sm font-semibold text-emerald-600">+{formatCurrency(p.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Loans */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold flex items-center gap-2">
              <FileX className="w-4 h-4 text-emerald-600" /> Pinjaman Terbaru
            </h2>
            <Link to="/loans" className="text-sm text-emerald-600 hover:text-emerald-700 flex items-center gap-1">
              Lihat Semua <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {recentLoans.length === 0 ? (
            <p className="text-sm py-4 text-center" style={{ color: 'var(--text-secondary)' }}>Belum ada pinjaman</p>
          ) : (
            <div className="space-y-3">
              {recentLoans.map(l => (
                <div key={l.id} className="flex items-center justify-between py-2 border-b last:border-0" style={{ borderColor: 'var(--border-color)' }}>
                  <div>
                    <p className="text-sm font-medium">{l.borrower_name || '-'}</p>
                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{formatDate(l.loan_date)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{formatCurrency(l.total_due)}</p>
                    <span className={`badge ${l.status === 'lunas' ? 'badge-success' : 'badge-warning'}`}>
                      {l.status === 'lunas' ? 'Lunas' : 'Belum Lunas'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Overdue Loans */}
      {overdueLoans.length > 0 && (
        <div className="card p-5 border-l-4 border-l-red-500">
          <h2 className="font-semibold flex items-center gap-2 text-red-600 mb-4">
            <AlertTriangle className="w-4 h-4" /> Pinjaman Jatuh Tempo / Terlambat
          </h2>
          <div className="space-y-3">
            {overdueLoans.map(l => (
              <div key={l.id} className="flex items-center justify-between py-2 border-b last:border-0" style={{ borderColor: 'var(--border-color)' }}>
                <div>
                  <Link to={`/borrowers/${l.borrower_id}`} className="text-sm font-medium hover:text-emerald-600">
                    {l.borrower_name || '-'}
                  </Link>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    Jatuh tempo: {formatDate(l.due_date || '')}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-red-600">{formatCurrency(l.total_due)}</p>
                  <span className="badge badge-danger">Terlambat</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
