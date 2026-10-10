import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Phone, MapPin, CreditCard, Printer, Calendar } from 'lucide-react';
import { Borrower, Loan } from '../types';
import { formatCurrency, formatDate, getTodayISO, isOverdue } from '../utils';
import { getBorrower, getLoansByBorrower, getPaymentsByLoan, getTotalPaidForLoan, addPayment, getLoan } from '../services/storage';

export default function BorrowerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [borrower, setBorrower] = useState<Borrower | null>(null);
  const [loans, setLoans] = useState<(Loan & { total_paid: number; remaining: number })[]>([]);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [selectedLoanId, setSelectedLoanId] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState(getTodayISO());
  const [payMethod, setPayMethod] = useState('');
  const [payNotes, setPayNotes] = useState('');

  useEffect(() => {
    if (!id) return;
    const b = getBorrower(id);
    if (!b) { navigate('/borrowers'); return; }
    setBorrower(b);
    loadLoans(id);
  }, [id]);

  const loadLoans = (borrowerId: string) => {
    const borrowerLoans = getLoansByBorrower(borrowerId).map(l => ({
      ...l,
      total_paid: getTotalPaidForLoan(l.id),
      remaining: Math.max(0, l.total_due - getTotalPaidForLoan(l.id)),
    }));
    setLoans(borrowerLoans);
  };

  if (!borrower) return null;

  const totalPrincipal = loans.reduce((s, l) => s + l.principal_amount, 0);
  const totalInterest = loans.reduce((s, l) => s + l.total_interest, 0);
  const totalDue = loans.reduce((s, l) => s + l.total_due, 0);
  const totalPaid = loans.reduce((s, l) => s + l.total_paid, 0);
  const totalRemaining = totalDue - totalPaid;

  const handlePayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoanId || !payAmount || Number(payAmount) <= 0) return;
    
    addPayment({
      loan_id: selectedLoanId,
      payment_date: payDate,
      amount: Math.round(Number(payAmount)),
      payment_method: payMethod || undefined,
      notes: payNotes || undefined,
    });

    setShowPaymentForm(false);
    setPayAmount(''); setPayMethod(''); setPayNotes('');
    if (id) loadLoans(id);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 no-print">
        <button onClick={() => navigate('/borrowers')} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{borrower.name}</h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Detail peminjam</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowPaymentForm(true)} className="btn-primary flex items-center gap-2 text-sm">
            <CreditCard className="w-4 h-4" /> Bayar
          </button>
          <button onClick={handlePrint} className="btn-secondary flex items-center gap-2 text-sm">
            <Printer className="w-4 h-4" /> Cetak
          </button>
        </div>
      </div>

      {/* Borrower Info */}
      <div className="card p-5">
        <h2 className="font-semibold mb-3">Informasi Peminjam</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2">
            <Phone className="w-4 h-4 text-emerald-600" />
            <span style={{ color: 'var(--text-secondary)' }}>Telepon:</span>
            <span className="font-medium">{borrower.phone || '-'}</span>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-emerald-600" />
            <span style={{ color: 'var(--text-secondary)' }}>Alamat:</span>
            <span className="font-medium">{borrower.address || '-'}</span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-emerald-600" />
            <span style={{ color: 'var(--text-secondary)' }}>Terdaftar:</span>
            <span className="font-medium">{formatDate(borrower.created_at)}</span>
          </div>
          {borrower.notes && (
            <div className="sm:col-span-2">
              <span style={{ color: 'var(--text-secondary)' }}>Catatan:</span>
              <span className="ml-2 font-medium">{borrower.notes}</span>
            </div>
          )}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="card p-3">
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Total Pokok</p>
          <p className="text-base font-bold mt-1">{formatCurrency(totalPrincipal)}</p>
        </div>
        <div className="card p-3">
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Total Bunga</p>
          <p className="text-base font-bold mt-1">{formatCurrency(totalInterest)}</p>
        </div>
        <div className="card p-3">
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Total Tagihan</p>
          <p className="text-base font-bold mt-1">{formatCurrency(totalDue)}</p>
        </div>
        <div className="card p-3">
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Total Dibayar</p>
          <p className="text-base font-bold mt-1 text-emerald-600">{formatCurrency(totalPaid)}</p>
        </div>
        <div className="card p-3">
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Sisa Tunggakan</p>
          <p className="text-base font-bold mt-1 text-red-600">{formatCurrency(Math.max(0, totalRemaining))}</p>
        </div>
      </div>

      {/* Loans */}
      <div className="space-y-4">
        <h2 className="font-semibold">Daftar Pinjaman ({loans.length})</h2>
        {loans.length === 0 ? (
          <div className="card p-6 text-center">
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Belum ada pinjaman</p>
          </div>
        ) : (
          loans.map(loan => {
            const payments = getPaymentsByLoan(loan.id);
            return (
              <div key={loan.id} className="card p-5">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">Pinjaman {formatDate(loan.loan_date)}</p>
                      <span className={`badge ${loan.status === 'lunas' ? 'badge-success' : loan.due_date && isOverdue(loan.due_date) ? 'badge-danger' : 'badge-warning'}`}>
                        {loan.status === 'lunas' ? 'Lunas' : loan.due_date && isOverdue(loan.due_date) ? 'Terlambat' : 'Belum Lunas'}
                      </span>
                    </div>
                    {loan.due_date && (
                      <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                        Jatuh tempo: {formatDate(loan.due_date)}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold">{formatCurrency(loan.total_due)}</p>
                    <p className="text-xs text-emerald-600">Dibayar: {formatCurrency(loan.total_paid)}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs mb-4">
                  <div>
                    <span style={{ color: 'var(--text-secondary)' }}>Pokok</span>
                    <p className="font-medium">{formatCurrency(loan.principal_amount)}</p>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-secondary)' }}>Bunga</span>
                    <p className="font-medium">{loan.interest_rate}% ({loan.interest_type === 'once' ? 'sekali' : 'per bulan'})</p>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-secondary)' }}>Total Bunga</span>
                    <p className="font-medium">{formatCurrency(loan.total_interest)}</p>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-secondary)' }}>Sisa</span>
                    <p className="font-medium text-red-600">{formatCurrency(loan.remaining)}</p>
                  </div>
                </div>

                {/* Payment History for this loan */}
                {payments.length > 0 && (
                  <div className="border-t pt-3" style={{ borderColor: 'var(--border-color)' }}>
                    <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>RIWAYAT PEMBAYARAN</p>
                    <div className="space-y-2">
                      {payments.map((p, idx) => {
                        const paidBefore = payments.slice(0, idx).reduce((s, x) => s + x.amount, 0);
                        const remainingAfter = Math.max(0, loan.total_due - paidBefore - p.amount);
                        return (
                          <div key={p.id} className="flex items-center justify-between text-xs py-1 border-b last:border-0" style={{ borderColor: 'var(--border-color)' }}>
                            <span>{formatDate(p.payment_date)} {p.payment_method && `• ${p.payment_method}`}</span>
                            <div className="flex items-center gap-3">
                              <span className="text-emerald-600 font-medium">+{formatCurrency(p.amount)}</span>
                              <span style={{ color: 'var(--text-secondary)' }}>Sisa: {formatCurrency(remainingAfter)}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {loan.notes && (
                  <p className="text-xs mt-3 pt-3 border-t" style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}>
                    Catatan: {loan.notes}
                  </p>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Payment Form Modal */}
      {showPaymentForm && (
        <div className="modal-overlay" onClick={() => setShowPaymentForm(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4">Catat Pembayaran - {borrower.name}</h2>
            <form onSubmit={handlePayment} className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1">Pilih Pinjaman *</label>
                <select value={selectedLoanId} onChange={e => setSelectedLoanId(e.target.value)} className="input-field" required>
                  <option value="">-- Pilih Pinjaman --</option>
                  {loans.filter(l => l.status === 'belum_lunas').map(l => (
                    <option key={l.id} value={l.id}>
                      {formatCurrency(l.principal_amount)} - Sisa: {formatCurrency(l.remaining)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1">Tanggal *</label>
                  <input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} className="input-field" required />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Jumlah (Rp) *</label>
                  <input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)} className="input-field" required min="1" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Metode</label>
                <select value={payMethod} onChange={e => setPayMethod(e.target.value)} className="input-field">
                  <option value="">-- Pilih --</option>
                  <option value="Tunai">Tunai</option>
                  <option value="Transfer Bank">Transfer Bank</option>
                  <option value="E-Wallet">E-Wallet</option>
                  <option value="Lainnya">Lainnya</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Catatan</label>
                <input type="text" value={payNotes} onChange={e => setPayNotes(e.target.value)} className="input-field" placeholder="Opsional" />
              </div>
              <div className="flex gap-3">
                <button type="submit" className="btn-primary flex-1">Simpan</button>
                <button type="button" onClick={() => setShowPaymentForm(false)} className="btn-secondary flex-1">Batal</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
