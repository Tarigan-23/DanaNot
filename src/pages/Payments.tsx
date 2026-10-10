import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  Plus, X, Trash2, Search, Printer, CreditCard 
} from 'lucide-react';
import { Payment, Loan, Borrower } from '../types';
import { formatCurrency, formatDate, formatDateTime, getNowISO } from '../utils';
import { 
  getPayments, getLoans, getBorrowers, getBorrower, 
  getLoan, addPayment, deletePayment, getTotalPaidForLoan, 
  subscribeDataChanges 
} from '../services/storage';
import ReceiptModal from '../components/ReceiptModal';

interface PaymentWithDetails extends Payment {
  borrower_name?: string;
  borrower_phone?: string;
  loan_principal?: number;
  loan_total_due?: number;
}

export default function Payments() {
  const [searchParams] = useSearchParams();
  const [payments, setPayments] = useState<PaymentWithDetails[]>([]);
  const [borrowers, setBorrowers] = useState<Borrower[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter state
  const [search, setSearch] = useState('');
  const [methodFilter, setMethodFilter] = useState('all');

  // Form state
  const [selectedBorrower, setSelectedBorrower] = useState('');
  const [selectedLoan, setSelectedLoan] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Tunai');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [borrowerLoans, setBorrowerLoans] = useState<Loan[]>([]);
  const [remaining, setRemaining] = useState(0);

  // Receipt Modal State
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [activePayment, setActivePayment] = useState<Payment | undefined>(undefined);
  const [activeBorrower, setActiveBorrower] = useState<Borrower | undefined>(undefined);
  const [activeLoan, setActiveLoan] = useState<Loan | undefined>(undefined);

  const loadPayments = () => {
    const allPayments = getPayments().sort(
      (a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime()
    );
    const allBorrowers = getBorrowers();
    setBorrowers(allBorrowers);

    const withDetails: PaymentWithDetails[] = allPayments.map((p) => {
      const loan = getLoan(p.loan_id);
      const borrower = loan ? allBorrowers.find((b) => b.id === loan.borrower_id) : undefined;
      return {
        ...p,
        borrower_name: borrower?.name || '-',
        borrower_phone: borrower?.phone,
        loan_principal: loan?.principal_amount || 0,
        loan_total_due: loan?.total_due || 0,
      };
    });
    setPayments(withDetails);
  };

  useEffect(() => {
    loadPayments();
    const unsub = subscribeDataChanges(loadPayments);
    return () => unsub();
  }, []);

  useEffect(() => {
    if (searchParams.get('action') === 'add') {
      resetForm();
      setShowForm(true);
    }
  }, [searchParams]);

  useEffect(() => {
    if (selectedBorrower) {
      const bLoans = getLoans().filter((l) => l.borrower_id === selectedBorrower);
      setBorrowerLoans(bLoans);
      const activeFirst = bLoans.find((l) => l.status === 'belum_lunas') || bLoans[0];
      setSelectedLoan(activeFirst ? activeFirst.id : '');
    } else {
      setBorrowerLoans([]);
      setSelectedLoan('');
    }
  }, [selectedBorrower]);

  useEffect(() => {
    if (selectedLoan) {
      const loan = getLoan(selectedLoan);
      if (loan) {
        const totalPaid = getTotalPaidForLoan(selectedLoan);
        setRemaining(Math.max(0, loan.total_due - totalPaid));
      }
    }
  }, [selectedLoan]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoan || !amount || Number(amount) <= 0 || isSubmitting) return;

    const amountNum = Math.round(Number(amount));

    if (amountNum > remaining && remaining > 0) {
      if (
        !confirm(
          `Jumlah pembayaran (${formatCurrency(amountNum)}) melebihi sisa tagihan (${formatCurrency(remaining)}). Lanjutkan?`
        )
      ) {
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const newPayment = addPayment({
        loan_id: selectedLoan,
        borrower_id: selectedBorrower || undefined,
        payment_date: getNowISO(),
        amount: amountNum,
        payment_method: paymentMethod || undefined,
        notes: paymentNotes.trim() || undefined,
      });

      const targetLoan = getLoan(selectedLoan);
      const targetBorrower = getBorrower(selectedBorrower);

      setShowForm(false);
      resetForm();

      // Trigger receipt print modal
      setActivePayment(newPayment);
      setActiveLoan(targetLoan);
      setActiveBorrower(targetBorrower);
      setReceiptModalOpen(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = (id: string) => {
    deletePayment(id);
    setShowDeleteConfirm(null);
  };

  const resetForm = () => {
    setSelectedBorrower('');
    setSelectedLoan('');
    setAmount('');
    setPaymentMethod('Tunai');
    setPaymentNotes('');
    setRemaining(0);
  };

  const openReceiptModal = (p: PaymentWithDetails) => {
    const loan = getLoan(p.loan_id);
    const borrower = loan ? getBorrower(loan.borrower_id) : undefined;
    setActivePayment(p);
    setActiveLoan(loan);
    setActiveBorrower(borrower);
    setReceiptModalOpen(true);
  };

  const filtered = payments.filter((p) => {
    const q = search.toLowerCase();
    const matchSearch =
      (p.borrower_name || '').toLowerCase().includes(q) ||
      (p.receipt_no || '').toLowerCase().includes(q) ||
      (p.notes || '').toLowerCase().includes(q);

    const matchMethod = methodFilter === 'all' || p.payment_method === methodFilter;
    return matchSearch && matchMethod;
  });

  const totalPaymentsAmount = filtered.reduce((s, p) => s + (p.amount || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Riwayat Pembayaran</h1>
          <p className="text-xs text-slate-400 mt-1">
            Catat dan pantau seluruh transaksi pembayaran angsuran dan pelunasan
          </p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
          className="btn-primary flex items-center gap-1.5 text-xs shadow-xs"
        >
          <Plus className="w-4 h-4" /> Catat Pembayaran Baru
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Cari nama peminjam, no kuitansi, atau catatan..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field pl-10 text-sm"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value)}
            className="input-field w-auto text-xs"
          >
            <option value="all">Semua Metode</option>
            <option value="Tunai">Tunai</option>
            <option value="Transfer Bank">Transfer Bank</option>
            <option value="E-Wallet">E-Wallet</option>
            <option value="Lainnya">Lainnya</option>
          </select>
        </div>
      </div>

      {/* Summary Badge */}
      <div className="flex items-center justify-between text-xs px-1 text-slate-400">
        <span>Menampilkan {filtered.length} transaksi pembayaran</span>
        <span>
          Total Terpilih: <strong className="text-emerald-400 font-bold">{formatCurrency(totalPaymentsAmount)}</strong>
        </span>
      </div>

      {/* Payments List */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="card p-12 text-center text-xs text-slate-500 bg-[#1e293b]">
            Belum ada transaksi pembayaran yang tercatat.
          </div>
        ) : (
          filtered.map((p) => (
            <div key={p.id} className="card p-4 flex items-center justify-between gap-4 bg-[#1e293b] border-slate-700/80 hover:border-slate-600 transition-all">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-sm text-white">{p.borrower_name}</span>
                  {p.payment_method && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-medium border border-slate-700">
                      {p.payment_method}
                    </span>
                  )}
                  {p.receipt_no && (
                    <span className="text-[10px] font-mono text-slate-500">
                      {p.receipt_no}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-400 mt-1">
                  <span>Waktu: {formatDateTime(p.payment_date)}</span>
                  {p.notes && <span>• {p.notes}</span>}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-base font-bold text-emerald-400 whitespace-nowrap">
                  +{formatCurrency(p.amount)}
                </span>
                <button
                  onClick={() => openReceiptModal(p)}
                  className="btn-secondary p-1.5 rounded-lg text-slate-400 hover:text-white"
                  title="Cetak Kuitansi"
                >
                  <Printer className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(p.id)}
                  className="btn-secondary p-1.5 rounded-lg text-red-400 hover:text-red-300"
                  title="Hapus Pembayaran"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Record Payment Form Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-content max-w-md w-full bg-[#1e293b] border-slate-700" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4 border-b border-slate-700 pb-3">
              <h2 className="text-base font-bold text-white">Catat Pembayaran Baru</h2>
              <button onClick={() => setShowForm(false)} className="p-1 rounded-lg hover:bg-slate-800 text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold mb-1 text-slate-300">Pilih Peminjam *</label>
                <select
                  value={selectedBorrower}
                  onChange={(e) => setSelectedBorrower(e.target.value)}
                  className="input-field text-xs"
                  required
                >
                  <option value="">-- Pilih Peminjam --</option>
                  {borrowers.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              {selectedBorrower && (
                <div>
                  <label className="block text-xs font-semibold mb-1 text-slate-300">Pilih Pinjaman *</label>
                  <select
                    value={selectedLoan}
                    onChange={(e) => setSelectedLoan(e.target.value)}
                    className="input-field text-xs"
                    required
                  >
                    <option value="">-- Pilih Pinjaman --</option>
                    {borrowerLoans.length === 0 ? (
                      <option disabled>Peminjam belum memiliki pinjaman</option>
                    ) : (
                      borrowerLoans.map((l) => (
                        <option key={l.id} value={l.id}>
                          Pokok {formatCurrency(l.principal_amount)} ({formatDate(l.loan_date)}) - {l.status === 'lunas' ? 'LUNAS' : `Sisa: ${formatCurrency(Math.max(0, l.total_due - getTotalPaidForLoan(l.id)))}`}
                        </option>
                      ))
                    )}
                  </select>
                  {remaining > 0 && (
                    <p className="text-[11px] mt-1 text-emerald-400 font-medium">
                      Sisa tagihan saat ini: {formatCurrency(remaining)}
                    </p>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold mb-1 text-slate-300">Nominal Pembayaran (Rp) *</label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="input-field text-xs"
                  required
                  min="1"
                  placeholder="Contoh: 300000"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 text-slate-300">Metode Pembayaran</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="input-field text-xs"
                >
                  <option value="Tunai">Tunai</option>
                  <option value="Transfer Bank">Transfer Bank</option>
                  <option value="E-Wallet">E-Wallet (QRIS / GoPay / Dana / OVO)</option>
                  <option value="Lainnya">Lainnya</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 text-slate-300">Catatan Pembayaran</label>
                <input
                  type="text"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  className="input-field text-xs"
                  placeholder="Keterangan..."
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting || !selectedLoan}
                  className="btn-primary flex-1 text-xs disabled:opacity-50"
                >
                  {isSubmitting ? 'Menyimpan...' : 'Simpan Pembayaran'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
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
            <h2 className="text-base font-bold mb-2 text-red-400">Hapus Pembayaran?</h2>
            <p className="text-xs mb-4 text-slate-400">
              Transaksi pembayaran ini akan dihapus dan sisa tagihan peminjam akan dihitung ulang secara otomatis.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => handleDelete(showDeleteConfirm)}
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
      {activePayment && activeBorrower && (
        <ReceiptModal
          isOpen={receiptModalOpen}
          onClose={() => setReceiptModalOpen(false)}
          type="payment"
          payment={activePayment}
          loan={activeLoan}
          borrower={activeBorrower}
          totalPaid={activeLoan ? getTotalPaidForLoan(activeLoan.id) : 0}
          remaining={activeLoan ? Math.max(0, activeLoan.total_due - getTotalPaidForLoan(activeLoan.id)) : 0}
        />
      )}
    </div>
  );
}
