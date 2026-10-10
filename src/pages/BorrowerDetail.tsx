import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Phone, MapPin, CreditCard, Printer, 
  Calendar, MessageCircle, PlusCircle, Trash2, Tag, ShieldCheck
} from 'lucide-react';
import { Borrower, Loan, Payment } from '../types';
import { 
  formatCurrency, formatDate, formatDateTime, getNowISO, 
  generateWhatsAppReminder, calculateLoan 
} from '../utils';
import { 
  getBorrower, getLoansByBorrower, getPaymentsByLoan, 
  getTotalPaidForLoan, addPayment, addLoan, deletePayment, 
  subscribeDataChanges 
} from '../services/storage';
import ReceiptModal from '../components/ReceiptModal';

export default function BorrowerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [borrower, setBorrower] = useState<Borrower | null>(null);
  const [loans, setLoans] = useState<(Loan & { total_paid: number; remaining: number })[]>([]);
  
  // Payment Modal State
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [selectedLoanId, setSelectedLoanId] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('Tunai');
  const [payNotes, setPayNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // New Loan Modal State
  const [showNewLoanModal, setShowNewLoanModal] = useState(false);
  const [principal, setPrincipal] = useState('');
  const [interestFee, setInterestFee] = useState('');
  const [loanNotes, setLoanNotes] = useState('');

  // Receipt & Print Modal State
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [receiptType, setReceiptType] = useState<'payment' | 'loan_statement'>('loan_statement');
  const [activeReceiptPayment, setActiveReceiptPayment] = useState<Payment | undefined>(undefined);
  const [activeReceiptLoan, setActiveReceiptLoan] = useState<Loan | undefined>(undefined);

  const loadData = () => {
    if (!id) return;
    const b = getBorrower(id);
    if (!b) {
      navigate('/borrowers');
      return;
    }
    setBorrower(b);

    const borrowerLoans = getLoansByBorrower(id).map((l) => {
      const totalPaid = getTotalPaidForLoan(l.id);
      return {
        ...l,
        total_paid: totalPaid,
        remaining: Math.max(0, l.total_due - totalPaid),
      };
    });
    setLoans(borrowerLoans);
  };

  useEffect(() => {
    loadData();
    const unsub = subscribeDataChanges(loadData);
    return () => unsub();
  }, [id]);

  if (!borrower) return null;

  const totalPrincipal = loans.reduce((s, l) => s + (l.principal_amount || 0), 0);
  const totalInterestFee = loans.reduce((s, l) => s + (l.interest_fee || (l as any).total_interest || 0), 0);
  const totalDue = loans.reduce((s, l) => s + (l.total_due || 0), 0);
  const totalPaid = loans.reduce((s, l) => s + (l.total_paid || 0), 0);
  const totalRemaining = Math.max(0, totalDue - totalPaid);

  const activeLoan = loans.find((l) => l.status === 'belum_lunas') || loans[0];

  const handlePayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoanId || !payAmount || Number(payAmount) <= 0 || isSubmitting) return;

    const targetLoan = loans.find((l) => l.id === selectedLoanId);
    const amountNum = Math.round(Number(payAmount));

    if (targetLoan && amountNum > targetLoan.remaining && targetLoan.remaining > 0) {
      if (
        !confirm(
          `Jumlah pembayaran (${formatCurrency(amountNum)}) melebihi sisa tagihan (${formatCurrency(targetLoan.remaining)}). Lanjutkan?`
        )
      ) {
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const newPayment = addPayment({
        loan_id: selectedLoanId,
        borrower_id: borrower.id,
        payment_date: getNowISO(),
        amount: amountNum,
        payment_method: payMethod || undefined,
        notes: payNotes.trim() || undefined,
      });

      setShowPaymentForm(false);
      setPayAmount('');
      setPayNotes('');

      // Prompt to view receipt
      setActiveReceiptPayment(newPayment);
      setActiveReceiptLoan(targetLoan);
      setReceiptType('payment');
      setReceiptModalOpen(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveLoan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!principal || Number(principal) <= 0 || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const principalNum = Math.round(Number(principal));
      const feeNum = Math.round(Number(interestFee) || 0);
      const totalDue = principalNum + feeNum;

      addLoan({
        borrower_id: borrower.id,
        principal_amount: principalNum,
        interest_fee: feeNum,
        total_due: totalDue,
        loan_date: getNowISO(),
        notes: loanNotes.trim() || undefined,
      });

      setShowNewLoanModal(false);
      setPrincipal('');
      setInterestFee('');
      setLoanNotes('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openLoanStatementModal = (loan: Loan) => {
    setActiveReceiptLoan(loan);
    setReceiptType('loan_statement');
    setReceiptModalOpen(true);
  };

  const openPaymentReceiptModal = (p: Payment, loan: Loan) => {
    setActiveReceiptPayment(p);
    setActiveReceiptLoan(loan);
    setReceiptType('payment');
    setReceiptModalOpen(true);
  };

  const whatsappReminder = activeLoan
    ? generateWhatsAppReminder(
        borrower.name,
        borrower.phone,
        activeLoan,
        activeLoan.total_paid,
        activeLoan.remaining
      )
    : { url: '', text: '' };

  const loanPreview =
    principal && Number(principal) > 0
      ? calculateLoan(Number(principal), Number(interestFee) || 0)
      : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/borrowers')}
            className="btn-secondary p-2 rounded-xl"
            title="Kembali ke Daftar Peminjam"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-white">{borrower.name}</h1>
              {totalRemaining === 0 ? (
                <span className="badge badge-success text-xs">Lunas</span>
              ) : (
                <span className="badge badge-warning text-xs">Belum Lunas</span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">Rincian profil & riwayat transaksi</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {whatsappReminder.url && (
            <a
              href={whatsappReminder.url}
              target="_blank"
              rel="noreferrer"
              className="p-2 rounded-xl bg-green-600 hover:bg-green-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
            >
              <MessageCircle className="w-4 h-4" /> Kirim Rincian Tagihan (WA)
            </a>
          )}
          <button
            onClick={() => {
              const active = loans.find((l) => l.status === 'belum_lunas');
              setSelectedLoanId(active ? active.id : loans[0]?.id || '');
              setShowPaymentForm(true);
            }}
            disabled={loans.length === 0}
            className="btn-primary text-xs flex items-center gap-1.5 shadow-xs disabled:opacity-50"
          >
            <CreditCard className="w-4 h-4" /> Catat Pembayaran
          </button>
          <button
            onClick={() => setShowNewLoanModal(true)}
            className="btn-secondary text-xs flex items-center gap-1.5 shadow-xs"
          >
            <PlusCircle className="w-4 h-4 text-emerald-400" /> Pinjaman Baru
          </button>
        </div>
      </div>

      {/* Borrower Profile Card */}
      <div className="card p-5 bg-[#1e293b] border-slate-700/80">
        <h2 className="font-semibold text-sm mb-3 border-b border-slate-700 pb-2 text-white">
          Informasi Profil Peminjam
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="flex items-center gap-2">
            <Phone className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <div>
              <span className="text-slate-400 block">No. Telepon / WhatsApp:</span>
              <span className="font-medium text-slate-200">{borrower.phone || '-'}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <div>
              <span className="text-slate-400 block">Alamat Domisili:</span>
              <span className="font-medium text-slate-200">{borrower.address || '-'}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <div>
              <span className="text-slate-400 block">Terdaftar Sejak:</span>
              <span className="font-medium text-slate-200">{formatDate(borrower.created_at)}</span>
            </div>
          </div>
          {borrower.nik_identity && (
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <div>
                <span className="text-slate-400 block">NIK KTP:</span>
                <span className="font-medium text-slate-200">{borrower.nik_identity}</span>
              </div>
            </div>
          )}
          {borrower.notes && (
            <div className="sm:col-span-2">
              <span className="text-slate-400 block">Catatan:</span>
              <span className="font-medium text-slate-300">{borrower.notes}</span>
            </div>
          )}
        </div>
      </div>

      {/* Summary Highlights */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="card p-3.5 bg-[#1e293b] border-slate-700/80">
          <p className="text-[11px] text-slate-400">Total Pokok</p>
          <p className="text-base font-bold mt-0.5 text-white">{formatCurrency(totalPrincipal)}</p>
        </div>
        <div className="card p-3.5 bg-[#1e293b] border-slate-700/80">
          <p className="text-[11px] text-slate-400">Total Jasa Pinjam</p>
          <p className="text-base font-bold mt-0.5 text-purple-400">{formatCurrency(totalInterestFee)}</p>
        </div>
        <div className="card p-3.5 bg-[#1e293b] border-slate-700/80">
          <p className="text-[11px] text-slate-400">Total Tagihan</p>
          <p className="text-base font-bold mt-0.5 text-white">{formatCurrency(totalDue)}</p>
        </div>
        <div className="card p-3.5 bg-[#1e293b] border-slate-700/80">
          <p className="text-[11px] text-slate-400">Total Pembayaran</p>
          <p className="text-base font-bold mt-0.5 text-emerald-400">{formatCurrency(totalPaid)}</p>
        </div>
        <div className="card p-3.5 col-span-2 md:col-span-1 bg-red-950/30 border-red-800/60">
          <p className="text-[11px] text-red-400 font-semibold">Sisa Tagihan</p>
          <p className="text-base font-bold mt-0.5 text-red-400">{formatCurrency(totalRemaining)}</p>
        </div>
      </div>

      {/* Loans List & Payments History */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-base text-white">Daftar Pinjaman ({loans.length})</h2>
        </div>

        {loans.length === 0 ? (
          <div className="card p-8 text-center text-slate-500 text-xs bg-[#1e293b]">
            Belum ada pinjaman tercatat untuk peminjam ini.
          </div>
        ) : (
          loans.map((loan) => {
            const payments = getPaymentsByLoan(loan.id);

            return (
              <div key={loan.id} className="card p-5 space-y-4 bg-[#1e293b] border-slate-700/80">
                {/* Loan Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-700 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-white">
                        Pinjaman Tanggal {formatDate(loan.loan_date)}
                      </span>
                      <span className={`badge ${loan.status === 'lunas' ? 'badge-success' : 'badge-warning'} text-[10px]`}>
                        {loan.status === 'lunas' ? 'Lunas' : 'Belum Lunas'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Waktu Transaksi: {formatDateTime(loan.loan_date)}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="text-[11px] text-slate-400 block">Sisa / Total:</span>
                      <p className="font-bold text-sm">
                        <span className="text-red-400">{formatCurrency(loan.remaining)}</span> / {formatCurrency(loan.total_due)}
                      </p>
                    </div>
                    <button
                      onClick={() => openLoanStatementModal(loan)}
                      className="btn-secondary p-2 text-xs flex items-center gap-1 rounded-lg"
                      title="Cetak Bukti Pinjaman"
                    >
                      <Printer className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Loan Metrics Breakdown */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs bg-slate-900/60 p-3 rounded-xl border border-slate-700/60">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Pinjaman Pokok:</span>
                    <span className="font-semibold text-slate-200">{formatCurrency(loan.principal_amount)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Jasa Pinjam:</span>
                    <span className="font-semibold text-purple-400">
                      {formatCurrency(loan.interest_fee || (loan as any).total_interest || 0)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Total Tagihan:</span>
                    <span className="font-bold text-white">{formatCurrency(loan.total_due)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Telah Dibayar:</span>
                    <span className="font-semibold text-emerald-400">{formatCurrency(loan.total_paid)}</span>
                  </div>
                </div>

                {/* Payments Table for This Loan */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-400">RIWAYAT PEMBAYARAN ({payments.length})</span>
                    {loan.status !== 'lunas' && (
                      <button
                        onClick={() => {
                          setSelectedLoanId(loan.id);
                          setShowPaymentForm(true);
                        }}
                        className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1"
                      >
                        <PlusCircle className="w-3.5 h-3.5" /> Bayar Pinjaman Ini
                      </button>
                    )}
                  </div>

                  {payments.length === 0 ? (
                    <p className="text-xs text-slate-500 py-2">Belum ada pembayaran untuk pinjaman ini.</p>
                  ) : (
                    <div className="divide-y divide-slate-700/60 text-xs">
                      {payments.map((p, idx) => {
                        const paidBefore = payments.slice(0, idx).reduce((s, x) => s + x.amount, 0);
                        const remainingAfter = Math.max(0, loan.total_due - paidBefore - p.amount);

                        return (
                          <div key={p.id} className="py-2.5 flex items-center justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-slate-200">{formatDateTime(p.payment_date)}</span>
                                {p.payment_method && (
                                  <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-slate-400 border border-slate-700">
                                    {p.payment_method}
                                  </span>
                                )}
                              </div>
                              {p.notes && <p className="text-[11px] text-slate-400 mt-0.5">{p.notes}</p>}
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="text-right">
                                <span className="text-emerald-400 font-bold">+{formatCurrency(p.amount)}</span>
                                <p className="text-[10px] text-slate-400">Sisa: {formatCurrency(remainingAfter)}</p>
                              </div>
                              <button
                                onClick={() => openPaymentReceiptModal(p, loan)}
                                className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
                                title="Cetak Kuitansi"
                              >
                                <Printer className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => {
                                  if (confirm('Hapus transaksi pembayaran ini? Saldo tagihan akan dihitung ulang.')) {
                                    deletePayment(p.id);
                                  }
                                }}
                                className="p-1 rounded hover:bg-slate-800 text-red-400 hover:text-red-300"
                                title="Hapus Pembayaran"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {loan.notes && (
                  <p className="text-xs text-slate-400 pt-2 border-t border-slate-700">
                    Catatan: {loan.notes}
                  </p>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Record Payment Modal */}
      {showPaymentForm && (
        <div className="modal-overlay" onClick={() => setShowPaymentForm(false)}>
          <div className="modal-content max-w-md w-full bg-[#1e293b] border-slate-700" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-base font-bold mb-3 border-b border-slate-700 pb-2 text-white">
              Catat Pembayaran — {borrower.name}
            </h2>
            <form onSubmit={handlePayment} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold mb-1 text-slate-300">Pilih Pinjaman *</label>
                <select
                  value={selectedLoanId}
                  onChange={(e) => setSelectedLoanId(e.target.value)}
                  className="input-field text-xs"
                  required
                >
                  <option value="">-- Pilih Pinjaman --</option>
                  {loans.map((l) => (
                    <option key={l.id} value={l.id}>
                      Pokok {formatCurrency(l.principal_amount)} ({formatDate(l.loan_date)}) - Sisa: {formatCurrency(l.remaining)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 text-slate-300">Nominal Pembayaran (Rp) *</label>
                <input
                  type="number"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="input-field text-xs"
                  required
                  min="1"
                  placeholder="Contoh: 300000"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 text-slate-300">Metode Pembayaran</label>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value)}
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
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  className="input-field text-xs"
                  placeholder="Contoh: Cicilan pelunasan tahap 1..."
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn-primary flex-1 text-xs disabled:opacity-50"
                >
                  {isSubmitting ? 'Menyimpan...' : 'Simpan Pembayaran'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowPaymentForm(false)}
                  className="btn-secondary flex-1 text-xs"
                >
                  Batal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Loan Modal */}
      {showNewLoanModal && (
        <div className="modal-overlay" onClick={() => setShowNewLoanModal(false)}>
          <div className="modal-content max-w-md w-full bg-[#1e293b] border-slate-700" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-base font-bold mb-3 border-b border-slate-700 pb-2 text-white">
              Tambah Pinjaman Baru — {borrower.name}
            </h2>
            <form onSubmit={handleSaveLoan} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold mb-1 text-slate-300">
                  Nominal Pinjaman Pokok (Rp) *
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
                  placeholder="Keperluan pinjaman..."
                />
              </div>

              {loanPreview && (
                <div className="p-3 rounded-lg bg-emerald-950/40 text-xs space-y-1 border border-emerald-800/80">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Pinjaman Pokok:</span>
                    <span className="font-semibold text-slate-200">
                      {formatCurrency(loanPreview.principal)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Jasa Pinjam:</span>
                    <span className="font-semibold text-emerald-400">
                      {formatCurrency(loanPreview.interestFee)}
                    </span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-emerald-800/60">
                    <span className="text-slate-300 font-bold">TOTAL TAGIHAN:</span>
                    <span className="font-bold text-emerald-400 text-sm">
                      {formatCurrency(loanPreview.totalDue)}
                    </span>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn-primary flex-1 text-xs disabled:opacity-50"
                >
                  {isSubmitting ? 'Menyimpan...' : 'Simpan Pinjaman'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowNewLoanModal(false)}
                  className="btn-secondary flex-1 text-xs"
                >
                  Batal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Printable Receipt & Agreement Modal */}
      <ReceiptModal
        isOpen={receiptModalOpen}
        onClose={() => setReceiptModalOpen(false)}
        type={receiptType}
        payment={activeReceiptPayment}
        loan={activeReceiptLoan}
        borrower={borrower}
        totalPaid={activeReceiptLoan ? getTotalPaidForLoan(activeReceiptLoan.id) : totalPaid}
        remaining={activeReceiptLoan ? Math.max(0, activeReceiptLoan.total_due - getTotalPaidForLoan(activeReceiptLoan.id)) : totalRemaining}
      />
    </div>
  );
}
