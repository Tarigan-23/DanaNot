import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { 
  Search, ChevronLeft, ChevronRight, Plus, 
  Trash2, Printer, Tag
} from 'lucide-react';
import { LoanWithBorrower, Borrower } from '../types';
import { formatCurrency, formatDate, calculateLoan, getNowISO } from '../utils';
import { 
  getLoans, getBorrowers, getTotalPaidForLoan, 
  addLoan, deleteLoan, subscribeDataChanges, getBorrower 
} from '../services/storage';
import ReceiptModal from '../components/ReceiptModal';

export default function Loans() {
  const [searchParams] = useSearchParams();
  const [loans, setLoans] = useState<LoanWithBorrower[]>([]);
  const [borrowers, setBorrowers] = useState<Borrower[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('date_desc');
  const [page, setPage] = useState(1);
  const perPage = 10;

  // Add Loan Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedBorrowerId, setSelectedBorrowerId] = useState('');
  const [principal, setPrincipal] = useState('');
  const [interestFee, setInterestFee] = useState('');
  const [loanNotes, setLoanNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete Confirm State
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  // Printable Statement Modal State
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [activeLoan, setActiveLoan] = useState<LoanWithBorrower | null>(null);

  const loadLoans = () => {
    const allLoans = getLoans();
    const allBorrowers = getBorrowers();
    setBorrowers(allBorrowers);

    const withBorrower: LoanWithBorrower[] = allLoans.map((l) => {
      const borrower = allBorrowers.find((b) => b.id === l.borrower_id);
      const totalPaid = getTotalPaidForLoan(l.id);
      return {
        ...l,
        borrower_name: borrower?.name || 'Tanpa Nama',
        borrower_phone: borrower?.phone,
        borrower_address: borrower?.address,
        total_paid: totalPaid,
        remaining: Math.max(0, l.total_due - totalPaid),
      };
    });
    setLoans(withBorrower);
  };

  useEffect(() => {
    loadLoans();
    const unsub = subscribeDataChanges(loadLoans);
    return () => unsub();
  }, []);

  useEffect(() => {
    if (searchParams.get('action') === 'add') {
      setShowAddModal(true);
    }
  }, [searchParams]);

  const handleSaveLoan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBorrowerId || !principal || Number(principal) <= 0 || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const principalNum = Math.round(Number(principal));
      const feeNum = Math.round(Number(interestFee) || 0);
      const totalDue = principalNum + feeNum;

      addLoan({
        borrower_id: selectedBorrowerId,
        principal_amount: principalNum,
        interest_fee: feeNum,
        total_due: totalDue,
        loan_date: getNowISO(),
        notes: loanNotes.trim() || undefined,
      });

      setShowAddModal(false);
      setPrincipal('');
      setInterestFee('');
      setSelectedBorrowerId('');
      setLoanNotes('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteLoan = (loanId: string) => {
    deleteLoan(loanId);
    setShowDeleteConfirm(null);
  };

  const filtered = loans.filter((l) => {
    const matchSearch =
      l.borrower_name.toLowerCase().includes(search.toLowerCase()) ||
      (l.notes || '').toLowerCase().includes(search.toLowerCase());

    const matchStatus = statusFilter === 'all' || l.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const sorted = [...filtered].sort((a, b) => {
    switch (sortBy) {
      case 'date_asc':
        return new Date(a.loan_date).getTime() - new Date(b.loan_date).getTime();
      case 'date_desc':
        return new Date(b.loan_date).getTime() - new Date(a.loan_date).getTime();
      case 'amount_asc':
        return a.principal_amount - b.principal_amount;
      case 'amount_desc':
        return b.principal_amount - a.principal_amount;
      case 'remaining_asc':
        return a.remaining - b.remaining;
      case 'remaining_desc':
        return b.remaining - a.remaining;
      default:
        return 0;
    }
  });

  const totalPages = Math.ceil(sorted.length / perPage) || 1;
  const paginated = sorted.slice((page - 1) * perPage, page * perPage);

  const previewCalculation =
    principal && Number(principal) > 0
      ? calculateLoan(Number(principal), Number(interestFee) || 0)
      : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Daftar Pinjaman</h1>
          <p className="text-xs text-slate-400 mt-1">
            Kelola transaksi pinjaman pokok, nominal jasa pinjam, dan status pelunasan
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="btn-primary flex items-center gap-1.5 text-xs shadow-xs"
        >
          <Plus className="w-4 h-4" /> Buat Pinjaman Baru
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Cari nama peminjam atau catatan..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="input-field pl-10 text-sm"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="input-field w-auto text-xs"
          >
            <option value="all">Semua Status</option>
            <option value="belum_lunas">Belum Lunas</option>
            <option value="lunas">Lunas</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="input-field w-auto text-xs"
          >
            <option value="date_desc">Tanggal Terbaru</option>
            <option value="date_asc">Tanggal Terlama</option>
            <option value="remaining_desc">Sisa Tagihan Terbesar</option>
            <option value="remaining_asc">Sisa Tagihan Terkecil</option>
            <option value="amount_desc">Pokok Pinjaman Terbesar</option>
            <option value="amount_asc">Pokok Pinjaman Terkecil</option>
          </select>
        </div>
      </div>

      {/* Desktop Table View */}
      <div className="card overflow-hidden hidden md:block bg-[#1e293b] border-slate-700/80">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-900/60 border-b border-slate-700">
              <tr>
                <th className="text-left p-3.5 font-bold text-slate-400">Peminjam</th>
                <th className="text-left p-3.5 font-bold text-slate-400">Tgl Pinjam</th>
                <th className="text-right p-3.5 font-bold text-slate-400">Pokok Pinjaman</th>
                <th className="text-right p-3.5 font-bold text-slate-400">Jasa Pinjam</th>
                <th className="text-right p-3.5 font-bold text-slate-400">Total Tagihan</th>
                <th className="text-right p-3.5 font-bold text-slate-400">Dibayar</th>
                <th className="text-right p-3.5 font-bold text-slate-400">Sisa Tagihan</th>
                <th className="text-center p-3.5 font-bold text-slate-400">Status</th>
                <th className="text-center p-3.5 font-bold text-slate-400">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/60">
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-10 text-center text-slate-500">
                    Tidak ada catatan pinjaman yang sesuai.
                  </td>
                </tr>
              ) : (
                paginated.map((l) => (
                  <tr key={l.id} className="table-row">
                    <td className="p-3.5">
                      <Link to={`/borrowers/${l.borrower_id}`} className="font-bold text-white hover:text-emerald-400 block">
                        {l.borrower_name}
                      </Link>
                      {l.notes && <p className="text-[11px] text-slate-400 mt-0.5 truncate max-w-xs">{l.notes}</p>}
                    </td>
                    <td className="p-3.5 font-medium text-slate-300">{formatDate(l.loan_date)}</td>
                    <td className="p-3.5 text-right font-medium text-slate-200">{formatCurrency(l.principal_amount)}</td>
                    <td className="p-3.5 text-right font-medium text-purple-400">
                      {formatCurrency(l.interest_fee || (l as any).total_interest || 0)}
                    </td>
                    <td className="p-3.5 text-right font-bold text-white">{formatCurrency(l.total_due)}</td>
                    <td className="p-3.5 text-right text-emerald-400 font-bold">{formatCurrency(l.total_paid)}</td>
                    <td className="p-3.5 text-right font-bold text-red-400">{formatCurrency(l.remaining)}</td>
                    <td className="p-3.5 text-center">
                      <span className={`badge ${l.status === 'lunas' ? 'badge-success' : 'badge-warning'} text-[10px]`}>
                        {l.status === 'lunas' ? 'Lunas' : 'Belum Lunas'}
                      </span>
                    </td>
                    <td className="p-3.5 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => {
                            setActiveLoan(l);
                            setReceiptModalOpen(true);
                          }}
                          className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
                          title="Cetak Bukti Pinjaman"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setShowDeleteConfirm(l.id)}
                          className="p-1.5 rounded hover:bg-slate-800 text-red-400 hover:text-red-300"
                          title="Hapus Pinjaman"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Cards View */}
      <div className="md:hidden space-y-3">
        {paginated.length === 0 ? (
          <div className="card p-8 text-center text-xs text-slate-500 bg-[#1e293b]">
            Tidak ada data pinjaman.
          </div>
        ) : (
          paginated.map((l) => (
            <div key={l.id} className="card p-4 space-y-3 bg-[#1e293b] border-slate-700/80">
              <div className="flex items-start justify-between">
                <div>
                  <Link to={`/borrowers/${l.borrower_id}`} className="font-bold text-sm text-white hover:text-emerald-400 block">
                    {l.borrower_name}
                  </Link>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Tanggal Pinjam: {formatDate(l.loan_date)}
                  </p>
                </div>
                <span className={`badge ${l.status === 'lunas' ? 'badge-success' : 'badge-warning'} text-[10px]`}>
                  {l.status === 'lunas' ? 'Lunas' : 'Belum Lunas'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs bg-slate-900/60 p-2.5 rounded-lg border border-slate-700/60">
                <div>
                  <span className="text-slate-400 block text-[10px]">Pokok Pinjaman:</span>
                  <span className="font-medium text-slate-200">{formatCurrency(l.principal_amount)}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Jasa Pinjam:</span>
                  <span className="font-semibold text-purple-400">
                    {formatCurrency(l.interest_fee || (l as any).total_interest || 0)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Telah Dibayar:</span>
                  <span className="font-semibold text-emerald-400">{formatCurrency(l.total_paid)}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Sisa Tagihan:</span>
                  <span className="font-bold text-red-400">{formatCurrency(l.remaining)}</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1 text-xs">
                <Link to={`/borrowers/${l.borrower_id}`} className="text-emerald-400 font-semibold text-[11px]">
                  Rincian & Bayar &rarr;
                </Link>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      setActiveLoan(l);
                      setReceiptModalOpen(true);
                    }}
                    className="btn-secondary p-1.5 text-xs rounded-lg"
                  >
                    <Printer className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(l.id)}
                    className="btn-secondary p-1.5 text-xs text-red-400 rounded-lg"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="btn-secondary p-2 disabled:opacity-40 text-xs"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs text-slate-400">
            Halaman {page} dari {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="btn-secondary p-2 disabled:opacity-40 text-xs"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Add Loan Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content max-w-md w-full bg-[#1e293b] border-slate-700" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-base font-bold mb-3 border-b border-slate-700 pb-2 text-white">
              Buat Pinjaman Baru
            </h2>
            <form onSubmit={handleSaveLoan} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold mb-1 text-slate-300">Pilih Peminjam *</label>
                <select
                  value={selectedBorrowerId}
                  onChange={(e) => setSelectedBorrowerId(e.target.value)}
                  className="input-field text-xs"
                  required
                >
                  <option value="">-- Pilih Peminjam --</option>
                  {borrowers.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} {b.phone ? `(${b.phone})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 text-slate-300">
                  Jumlah Pinjaman Pokok (Rp) *
                </label>
                <input
                  type="number"
                  value={principal}
                  onChange={(e) => setPrincipal(e.target.value)}
                  className="input-field text-xs"
                  required
                  min="1000"
                  step="1000"
                  placeholder="Contoh: 1000000"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 text-slate-300">
                  Jasa Pinjam (Rp) (Nominal Tetap)
                </label>
                <input
                  type="number"
                  value={interestFee}
                  onChange={(e) => setInterestFee(e.target.value)}
                  className="input-field text-xs"
                  min="0"
                  step="1000"
                  placeholder="Contoh: 200000"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 text-slate-300">Catatan Pinjaman</label>
                <input
                  type="text"
                  value={loanNotes}
                  onChange={(e) => setLoanNotes(e.target.value)}
                  className="input-field text-xs"
                  placeholder="Keperluan / catatan..."
                />
              </div>

              {previewCalculation && (
                <div className="p-3 rounded-lg bg-emerald-950/40 text-xs space-y-1 border border-emerald-800/80">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Pokok Pinjaman:</span>
                    <span className="font-semibold text-slate-200">
                      {formatCurrency(previewCalculation.principal)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Jasa Pinjam:</span>
                    <span className="font-semibold text-emerald-400">
                      {formatCurrency(previewCalculation.interestFee)}
                    </span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-emerald-800/60">
                    <span className="text-slate-300 font-bold">TOTAL TAGIHAN:</span>
                    <span className="font-bold text-emerald-400 text-sm">
                      {formatCurrency(previewCalculation.totalDue)}
                    </span>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting || !selectedBorrowerId}
                  className="btn-primary flex-1 text-xs disabled:opacity-50"
                >
                  {isSubmitting ? 'Menyimpan...' : 'Simpan Pinjaman'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn-secondary flex-1 text-xs"
                >
                  Batal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="modal-overlay" onClick={() => setShowDeleteConfirm(null)}>
          <div className="modal-content max-w-sm bg-[#1e293b] border-slate-700" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-base font-bold mb-2 text-red-400">Hapus Pinjaman Ini?</h2>
            <p className="text-xs mb-4 text-slate-400">
              Pinjaman dan seluruh riwayat transaksi pembayaran terkait pinjaman ini akan dihapus permanen.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => handleDeleteLoan(showDeleteConfirm)}
                className="btn-danger flex-1 text-xs"
              >
                Ya, Hapus
              </button>
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="btn-secondary flex-1 text-xs"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Printable Receipt Modal */}
      {activeLoan && (
        <ReceiptModal
          isOpen={receiptModalOpen}
          onClose={() => setReceiptModalOpen(false)}
          type="loan_statement"
          loan={activeLoan}
          borrower={getBorrower(activeLoan.borrower_id)}
          totalPaid={activeLoan.total_paid}
          remaining={activeLoan.remaining}
        />
      )}
    </div>
  );
}
