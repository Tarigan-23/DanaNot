import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  Plus, X, Trash2, Search, Printer, CreditCard, PiggyBank, AlertCircle 
} from 'lucide-react';
import { Payment, Loan, Borrower } from '../types';
import { formatCurrency, formatDate, formatDateTime, getNowISO } from '../utils';
import { 
  getPayments, getLoans, getBorrowers, getBorrower, 
  getLoan, addPayment, deletePayment, getTotalPaidForLoan, 
  subscribeDataChanges, getBorrowerSavings 
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
  const [formError, setFormError] = useState<string | null>(null);

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
  const [borrowerSavingsBalance, setBorrowerSavingsBalance] = useState(0);

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
      const sav = getBorrowerSavings(selectedBorrower);
      setBorrowerSavingsBalance(sav.currentBalance);
    } else {
      setBorrowerLoans([]);
      setSelectedLoan('');
      setBorrowerSavingsBalance(0);
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

  const handleUseMaxSavings = () => {
    if (borrowerSavingsBalance <= 0) return;
    const maxUsable = remaining > 0 ? Math.min(borrowerSavingsBalance, remaining) : borrowerSavingsBalance;
    setAmount(String(maxUsable));
    setPaymentMethod('Tabungan');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoan || !amount || Number(amount) <= 0 || isSubmitting) return;

    setFormError(null);
    const amountNum = Math.round(Number(amount));
    const isSavings = paymentMethod === 'Tabungan';

    if (isSavings && amountNum > borrowerSavingsBalance) {
      setFormError(`Saldo tabungan tidak mencukupi! Saldo tersedia hanya ${formatCurrency(borrowerSavingsBalance)}.`);
      return;
    }

    if (amountNum > remaining && remaining > 0) {
      if (isSavings) {
        setFormError(`Pembayaran menggunakan tabungan tidak boleh melebihi sisa tagihan (${formatCurrency(remaining)}).`);
        return;
      }
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
        is_savings_payment: isSavings,
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
    } catch (err: any) {
      setFormError(err.message || 'Gagal mencatat transaksi pembayaran.');
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
    setBorrowerSavingsBalance(0);
    setFormError(null);
  };

  const filtered = payments.filter((p) => {
    const q = search.toLowerCase();
    const matchSearch =
      (p.borrower_name || '').toLowerCase().includes(q) ||
      (p.receipt_no || '').toLowerCase().includes(q) ||
      (p.notes || '').toLowerCase().includes(q);

    let matchMethod = true;
    if (methodFilter === 'Tabungan') {
      matchMethod = p.is_savings_payment === true || p.payment_method === 'Tabungan';
    } else if (methodFilter === 'Tunai') {
      matchMethod = !p.is_savings_payment && (p.payment_method === 'Tunai' || !p.payment_method);
    } else if (methodFilter !== 'all') {
      matchMethod = p.payment_method === methodFilter;
    }

    return matchSearch && matchMethod;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Riwayat Pembayaran</h1>
          <p className="text-xs text-slate-400 mt-1">
            Catat pelunasan pinjaman tunai atau gunakan saldo tabungan peminjam
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

      {/* Filter and Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Cari nama peminjam, kuitansi, atau catatan..."
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
            <option value="Tabungan">Gunakan Tabungan</option>
            <option value="Transfer Bank">Transfer Bank</option>
            <option value="E-Wallet">E-Wallet</option>
          </select>
        </div>
      </div>

      {/* Payments List (Desktop Table) */}
      <div className="card overflow-hidden hidden md:block bg-[#1e293b] border-slate-700/80">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-900/60 border-b border-slate-700">
              <tr>
                <th className="text-left p-3.5 font-bold text-slate-400">Tanggal & Waktu</th>
                <th className="text-left p-3.5 font-bold text-slate-400">No. Kuitansi</th>
                <th className="text-left p-3.5 font-bold text-slate-400">Peminjam</th>
                <th className="text-right p-3.5 font-bold text-slate-400">Nominal Masuk</th>
                <th className="text-left p-3.5 font-bold text-slate-400">Metode Pembayaran</th>
                <th className="text-left p-3.5 font-bold text-slate-400">Catatan</th>
                <th className="text-center p-3.5 font-bold text-slate-400">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/60">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-10 text-center text-slate-500">
                    Tidak ada catatan pembayaran yang sesuai kriteria.
                  </td>
                </tr>
              ) : (
                filtered.map((p) => {
                  const isSavings = p.is_savings_payment || p.payment_method === 'Tabungan';

                  return (
                    <tr key={p.id} className="table-row">
                      <td className="p-3.5 font-medium text-slate-300">
                        {formatDateTime(p.payment_date)}
                      </td>
                      <td className="p-3.5 font-mono text-slate-400">{p.receipt_no || '-'}</td>
                      <td className="p-3.5">
                        <span className="font-bold text-white block">{p.borrower_name}</span>
                        {p.loan_principal ? (
                          <span className="text-[10px] text-slate-400">
                            Pokok: {formatCurrency(p.loan_principal)}
                          </span>
                        ) : null}
                      </td>
                      <td className="p-3.5 text-right font-bold text-emerald-400 text-sm">
                        {formatCurrency(p.amount)}
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`badge text-[11px] ${
                            isSavings
                              ? 'bg-purple-950/80 text-purple-300 border-purple-800 flex items-center gap-1 w-fit'
                              : 'badge-secondary'
                          }`}
                        >
                          {isSavings && <PiggyBank className="w-3 h-3" />}
                          {isSavings ? 'Potong Tabungan' : p.payment_method || 'Tunai'}
                        </span>
                      </td>
                      <td className="p-3.5 text-slate-400 max-w-xs truncate">{p.notes || '-'}</td>
                      <td className="p-3.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => {
                              setActivePayment(p);
                              setActiveLoan(getLoan(p.loan_id));
                              setActiveBorrower(getBorrower(p.borrower_id || ''));
                              setReceiptModalOpen(true);
                            }}
                            className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
                            title="Cetak Kuitansi"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setShowDeleteConfirm(p.id)}
                            className="p-1.5 rounded hover:bg-slate-800 text-red-400 hover:text-red-300"
                            title="Hapus Pembayaran"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payments List (Mobile Cards) */}
      <div className="md:hidden space-y-3">
        {filtered.length === 0 ? (
          <div className="card p-8 text-center text-xs text-slate-500 bg-[#1e293b]">
            Belum ada pembayaran.
          </div>
        ) : (
          filtered.map((p) => {
            const isSavings = p.is_savings_payment || p.payment_method === 'Tabungan';

            return (
              <div key={p.id} className="card p-4 space-y-2.5 bg-[#1e293b] border-slate-700/80">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="font-bold text-sm text-white">{p.borrower_name}</h2>
                    <p className="text-[11px] text-slate-400 font-mono mt-0.5">{p.receipt_no}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-emerald-400 font-bold text-sm block">
                      +{formatCurrency(p.amount)}
                    </span>
                    <span className="text-[10px] text-slate-400">{formatDate(p.payment_date)}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-700/60 text-xs">
                  <span
                    className={`badge text-[10px] ${
                      isSavings
                        ? 'bg-purple-950/80 text-purple-300 border-purple-800 flex items-center gap-1'
                        : 'badge-secondary'
                    }`}
                  >
                    {isSavings && <PiggyBank className="w-3 h-3" />}
                    {isSavings ? 'Potong Tabungan' : p.payment_method || 'Tunai'}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setActivePayment(p);
                        setActiveLoan(getLoan(p.loan_id));
                        setActiveBorrower(getBorrower(p.borrower_id || ''));
                        setReceiptModalOpen(true);
                      }}
                      className="btn-secondary p-1.5 text-xs rounded-lg"
                    >
                      <Printer className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(p.id)}
                      className="btn-secondary p-1.5 text-xs text-red-400 rounded-lg"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                {p.notes && <p className="text-[11px] text-slate-400 italic">"{p.notes}"</p>}
              </div>
            );
          })
        )}
      </div>

      {/* Record Payment Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-content max-w-md w-full bg-[#1e293b] border-slate-700" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3 border-b border-slate-700 pb-2">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-emerald-400" /> Catat Pembayaran Pinjaman
              </h2>
              <button onClick={() => setShowForm(false)} className="p-1 rounded-lg hover:bg-slate-800 text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="mb-3 p-2.5 rounded-lg bg-red-950/70 border border-red-800 text-xs text-red-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{formError}</span>
              </div>
            )}

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
                    <div className="mt-1.5 flex items-center justify-between text-[11px]">
                      <span className="text-red-400 font-semibold">
                        Sisa tagihan: {formatCurrency(remaining)}
                      </span>
                      {borrowerSavingsBalance > 0 && (
                        <button
                          type="button"
                          onClick={handleUseMaxSavings}
                          className="text-emerald-400 hover:text-emerald-300 font-bold underline flex items-center gap-1"
                        >
                          <PiggyBank className="w-3 h-3" /> Gunakan Tabungan ({formatCurrency(borrowerSavingsBalance)})
                        </button>
                      )}
                    </div>
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
                  <option value="Tunai">Tunai (Cash)</option>
                  <option value="Tabungan">Gunakan Saldo Tabungan Peminjam</option>
                  <option value="Transfer Bank">Transfer Bank</option>
                  <option value="E-Wallet">E-Wallet (QRIS / GoPay / Dana / OVO)</option>
                  <option value="Lainnya">Lainnya</option>
                </select>
              </div>

              {paymentMethod === 'Tabungan' && (
                <div className="p-2.5 rounded-lg bg-purple-950/40 border border-purple-800/80 text-xs text-purple-200">
                  <div className="flex justify-between font-semibold">
                    <span>Saldo Tabungan Tersedia:</span>
                    <span>{formatCurrency(borrowerSavingsBalance)}</span>
                  </div>
                  <p className="text-[10px] text-purple-300 mt-1">
                    Pembayaran tabungan akan mengurangi saldo tabungan peminjam dan tidak dihitung sebagai uang tunai masuk.
                  </p>
                </div>
              )}

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
              Transaksi pembayaran ini akan dihapus. Jika dibayar dengan tabungan, saldo tabungan akan dipulihkan secara konsisten.
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
