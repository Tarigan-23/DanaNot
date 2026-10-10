import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, X, Trash2 } from 'lucide-react';
import { Payment, Loan, Borrower } from '../types';
import { formatCurrency, formatDate, getTodayISO } from '../utils';
import { getPayments, getLoans, getBorrowers, getBorrower, getLoan, addPayment, deletePayment, getTotalPaidForLoan } from '../services/storage';

interface PaymentWithDetails extends Payment {
  borrower_name?: string;
  loan_principal?: number;
}

export default function Payments() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [payments, setPayments] = useState<PaymentWithDetails[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  
  // Form state
  const [selectedBorrower, setSelectedBorrower] = useState('');
  const [selectedLoan, setSelectedLoan] = useState('');
  const [paymentDate, setPaymentDate] = useState(getTodayISO());
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [borrowers, setBorrowers] = useState<Borrower[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    loadPayments();
    setBorrowers(getBorrowers());
    if (searchParams.get('action') === 'add') {
      setShowForm(true);
    }
  }, []);

  useEffect(() => {
    if (selectedBorrower) {
      const borrowerLoans = getLoans().filter(l => l.borrower_id === selectedBorrower && l.status === 'belum_lunas');
      setLoans(borrowerLoans);
      setSelectedLoan('');
    } else {
      setLoans([]);
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

  const loadPayments = () => {
    const allPayments = getPayments().sort((a, b) => 
      new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime()
    );
    
    const withDetails: PaymentWithDetails[] = allPayments.map(p => {
      const loan = getLoan(p.loan_id);
      const borrower = loan ? getBorrower(loan.borrower_id) : undefined;
      return {
        ...p,
        borrower_name: borrower?.name || '-',
        loan_principal: loan?.principal_amount || 0,
      };
    });
    setPayments(withDetails);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoan || !amount || Number(amount) <= 0) return;
    
    const amountNum = Math.round(Number(amount));
    
    if (amountNum > remaining) {
      if (!confirm(`Jumlah pembayaran (${formatCurrency(amountNum)}) melebihi sisa tagihan (${formatCurrency(remaining)}). Lanjutkan?`)) {
        return;
      }
    }

    addPayment({
      loan_id: selectedLoan,
      payment_date: paymentDate,
      amount: amountNum,
      payment_method: paymentMethod || undefined,
      notes: paymentNotes || undefined,
    });

    loadPayments();
    setShowForm(false);
    resetForm();
    setSearchParams({});
  };

  const handleDelete = (id: string) => {
    deletePayment(id);
    loadPayments();
    setShowDeleteConfirm(null);
  };

  const resetForm = () => {
    setSelectedBorrower(''); setSelectedLoan(''); setPaymentDate(getTodayISO());
    setAmount(''); setPaymentMethod(''); setPaymentNotes(''); setRemaining(0);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Riwayat Pembayaran</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Catat dan pantau semua pembayaran</p>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true); }} className="btn-primary flex items-center gap-2 text-sm">
          <Plus className="w-4 h-4" /> Catat Pembayaran
        </button>
      </div>

      {/* Payments List */}
      <div className="space-y-3">
        {payments.length === 0 ? (
          <div className="card p-8 text-center">
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Belum ada pembayaran tercatat</p>
          </div>
        ) : (
          payments.map(p => (
            <div key={p.id} className="card p-4 flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm">{p.borrower_name}</span>
                  {p.payment_method && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800" style={{ color: 'var(--text-secondary)' }}>
                      {p.payment_method}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--text-secondary)' }}>
                  <span>{formatDate(p.payment_date)}</span>
                  {p.notes && <span>• {p.notes}</span>}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-emerald-600">+{formatCurrency(p.amount)}</span>
                <button onClick={() => setShowDeleteConfirm(p.id)} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800">
                  <Trash2 className="w-3.5 h-3.5 text-red-400" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Payment Form Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={() => { setShowForm(false); setSearchParams({}); }}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Catat Pembayaran</h2>
              <button onClick={() => { setShowForm(false); setSearchParams({}); }} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1">Pilih Peminjam *</label>
                <select value={selectedBorrower} onChange={e => setSelectedBorrower(e.target.value)} className="input-field" required>
                  <option value="">-- Pilih Peminjam --</option>
                  {borrowers.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>

              {selectedBorrower && (
                <div>
                  <label className="block text-xs font-medium mb-1">Pilih Pinjaman *</label>
                  <select value={selectedLoan} onChange={e => setSelectedLoan(e.target.value)} className="input-field" required>
                    <option value="">-- Pilih Pinjaman --</option>
                    {loans.length === 0 ? (
                      <option disabled>Tidak ada pinjaman aktif</option>
                    ) : (
                      loans.map(l => (
                        <option key={l.id} value={l.id}>
                          {formatCurrency(l.principal_amount)} - {formatDate(l.loan_date)}
                        </option>
                      ))
                    )}
                  </select>
                  {remaining > 0 && (
                    <p className="text-xs mt-1 text-emerald-600">Sisa tagihan: {formatCurrency(remaining)}</p>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1">Tanggal Pembayaran *</label>
                  <input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} className="input-field" required />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Jumlah (Rp) *</label>
                  <input type="number" value={amount} onChange={e => setAmount(e.target.value)} className="input-field" required min="1" placeholder="0" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">Metode Pembayaran</label>
                <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className="input-field">
                  <option value="">-- Pilih Metode --</option>
                  <option value="Tunai">Tunai</option>
                  <option value="Transfer Bank">Transfer Bank</option>
                  <option value="E-Wallet">E-Wallet</option>
                  <option value="Lainnya">Lainnya</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">Catatan</label>
                <textarea value={paymentNotes} onChange={e => setPaymentNotes(e.target.value)} className="input-field" rows={2} placeholder="Opsional" />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="submit" className="btn-primary flex-1">Simpan Pembayaran</button>
                <button type="button" onClick={() => { setShowForm(false); setSearchParams({}); }} className="btn-secondary flex-1">Batal</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="modal-overlay" onClick={() => setShowDeleteConfirm(null)}>
          <div className="modal-content max-w-sm" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-2">Hapus Pembayaran?</h2>
            <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
              Pembayaran ini akan dihapus dan sisa tagihan akan dihitung ulang. Tindakan ini tidak dapat dibatalkan.
            </p>
            <div className="flex gap-3">
              <button onClick={() => handleDelete(showDeleteConfirm)} className="btn-danger flex-1">Ya, Hapus</button>
              <button onClick={() => setShowDeleteConfirm(null)} className="btn-secondary flex-1">Batal</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
