import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { LoanWithBorrower } from '../types';
import { formatCurrency, formatDate, isOverdue } from '../utils';
import { getLoans, getBorrower, getTotalPaidForLoan } from '../services/storage';

export default function Loans() {
  const [loans, setLoans] = useState<LoanWithBorrower[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('date_desc');
  const [page, setPage] = useState(1);
  const perPage = 10;

  useEffect(() => {
    loadLoans();
  }, []);

  const loadLoans = () => {
    const allLoans = getLoans();
    const withBorrower: LoanWithBorrower[] = allLoans.map(l => {
      const borrower = getBorrower(l.borrower_id);
      const totalPaid = getTotalPaidForLoan(l.id);
      return {
        ...l,
        borrower_name: borrower?.name || '-',
        total_paid: totalPaid,
        remaining: Math.max(0, l.total_due - totalPaid),
      };
    });
    setLoans(withBorrower);
  };

  const filtered = loans.filter(l => {
    const matchSearch = l.borrower_name.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || l.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const sorted = [...filtered].sort((a, b) => {
    switch (sortBy) {
      case 'date_asc': return new Date(a.loan_date).getTime() - new Date(b.loan_date).getTime();
      case 'date_desc': return new Date(b.loan_date).getTime() - new Date(a.loan_date).getTime();
      case 'amount_asc': return a.principal_amount - b.principal_amount;
      case 'amount_desc': return b.principal_amount - a.principal_amount;
      case 'remaining_asc': return a.remaining - b.remaining;
      case 'remaining_desc': return b.remaining - a.remaining;
      default: return 0;
    }
  });

  const totalPages = Math.ceil(sorted.length / perPage);
  const paginated = sorted.slice((page - 1) * perPage, page * perPage);

  const getStatusBadge = (loan: LoanWithBorrower) => {
    if (loan.status === 'lunas') return <span className="badge badge-success">Lunas</span>;
    if (loan.due_date && isOverdue(loan.due_date)) return <span className="badge badge-danger">Terlambat</span>;
    return <span className="badge badge-warning">Belum Lunas</span>;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Daftar Pinjaman</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Kelola dan pantau semua pinjaman</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
          <input type="text" placeholder="Cari nama peminjam..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="input-field pl-10" />
        </div>
        <div className="flex gap-2">
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }} className="input-field w-auto">
            <option value="all">Semua Status</option>
            <option value="belum_lunas">Belum Lunas</option>
            <option value="lunas">Lunas</option>
          </select>
          <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="input-field w-auto">
            <option value="date_desc">Terbaru</option>
            <option value="date_asc">Terlama</option>
            <option value="amount_desc">Nomor ↓</option>
            <option value="amount_asc">Nomor ↑</option>
            <option value="remaining_desc">Sisa ↓</option>
            <option value="remaining_asc">Sisa ↑</option>
          </select>
        </div>
      </div>

      {/* Table - Desktop */}
      <div className="card overflow-hidden hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b" style={{ borderColor: 'var(--border-color)' }}>
                <th className="text-left p-3 font-medium" style={{ color: 'var(--text-secondary)' }}>Peminjam</th>
                <th className="text-left p-3 font-medium" style={{ color: 'var(--text-secondary)' }}>Tanggal</th>
                <th className="text-right p-3 font-medium" style={{ color: 'var(--text-secondary)' }}>Pokok</th>
                <th className="text-right p-3 font-medium" style={{ color: 'var(--text-secondary)' }}>Bunga</th>
                <th className="text-right p-3 font-medium" style={{ color: 'var(--text-secondary)' }}>Tagihan</th>
                <th className="text-right p-3 font-medium" style={{ color: 'var(--text-secondary)' }}>Dibayar</th>
                <th className="text-right p-3 font-medium" style={{ color: 'var(--text-secondary)' }}>Sisa</th>
                <th className="text-center p-3 font-medium" style={{ color: 'var(--text-secondary)' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr><td colSpan={8} className="p-8 text-center" style={{ color: 'var(--text-secondary)' }}>Tidak ada data pinjaman</td></tr>
              ) : (
                paginated.map(l => (
                  <tr key={l.id} className="table-row">
                    <td className="p-3">
                      <Link to={`/borrowers/${l.borrower_id}`} className="font-medium hover:text-emerald-600">
                        {l.borrower_name}
                      </Link>
                    </td>
                    <td className="p-3">{formatDate(l.loan_date)}</td>
                    <td className="p-3 text-right">{formatCurrency(l.principal_amount)}</td>
                    <td className="p-3 text-right">{l.interest_rate}%</td>
                    <td className="p-3 text-right font-medium">{formatCurrency(l.total_due)}</td>
                    <td className="p-3 text-right text-emerald-600">{formatCurrency(l.total_paid)}</td>
                    <td className="p-3 text-right font-medium">{formatCurrency(l.remaining)}</td>
                    <td className="p-3 text-center">{getStatusBadge(l)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cards - Mobile */}
      <div className="md:hidden space-y-3">
        {paginated.length === 0 ? (
          <div className="card p-8 text-center">
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Tidak ada data pinjaman</p>
          </div>
        ) : (
          paginated.map(l => (
            <div key={l.id} className="card p-4">
              <div className="flex items-start justify-between mb-2">
                <Link to={`/borrowers/${l.borrower_id}`} className="font-semibold hover:text-emerald-600">
                  {l.borrower_name}
                </Link>
                {getStatusBadge(l)}
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span style={{ color: 'var(--text-secondary)' }}>Tanggal:</span>
                  <span className="ml-1">{formatDate(l.loan_date)}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-secondary)' }}>Bunga:</span>
                  <span className="ml-1">{l.interest_rate}%</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-secondary)' }}>Pokok:</span>
                  <span className="ml-1 font-medium">{formatCurrency(l.principal_amount)}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-secondary)' }}>Tagihan:</span>
                  <span className="ml-1 font-medium">{formatCurrency(l.total_due)}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-secondary)' }}>Dibayar:</span>
                  <span className="ml-1 text-emerald-600 font-medium">{formatCurrency(l.total_paid)}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-secondary)' }}>Sisa:</span>
                  <span className="ml-1 font-medium">{formatCurrency(l.remaining)}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary p-2 disabled:opacity-50">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Halaman {page} dari {totalPages}
          </span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="btn-secondary p-2 disabled:opacity-50">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
