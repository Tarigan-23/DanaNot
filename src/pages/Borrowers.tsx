import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { 
  Plus, Search, Edit2, Trash2, X, Phone, MapPin, 
  CreditCard, ChevronRight, UserPlus, CheckCircle2,
  AlertCircle, ShieldCheck, Tag
} from 'lucide-react';
import { Borrower, Loan } from '../types';
import { formatCurrency, calculateLoan, getTodayISO, getNowISO } from '../utils';
import { 
  getBorrowers, addBorrower, updateBorrower, deleteBorrower, 
  getLoansByBorrower, addLoan, addPayment, subscribeDataChanges, 
  getTotalPaidForLoan 
} from '../services/storage';

export default function Borrowers() {
  const [searchParams] = useSearchParams();
  const [borrowers, setBorrowers] = useState<Borrower[]>([]);
  const [search, setSearch] = useState('');
  
  // Borrower Modal State
  const [showBorrowerModal, setShowBorrowerModal] = useState(false);
  const [editBorrowerId, setEditBorrowerId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State: Profile & Initial Loan
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [nik, setNik] = useState('');
  const [notes, setNotes] = useState('');

  const [includeLoan, setIncludeLoan] = useState(true);
  const [principal, setPrincipal] = useState('');
  const [interestFee, setInterestFee] = useState('');
  const [loanNotes, setLoanNotes] = useState('');

  // Quick Payment on Card State: Map of borrowerId -> payment input value
  const [quickPayInputs, setQuickPayInputs] = useState<Record<string, string>>({});
  const [quickPaySubmitting, setQuickPaySubmitting] = useState<Record<string, boolean>>({});
  const [notification, setNotification] = useState<{ id: string; success: boolean; text: string } | null>(null);

  const loadData = () => {
    setBorrowers(getBorrowers());
  };

  useEffect(() => {
    loadData();
    const unsub = subscribeDataChanges(loadData);
    return () => unsub();
  }, []);

  useEffect(() => {
    if (searchParams.get('action') === 'add') {
      resetBorrowerForm();
      setShowBorrowerModal(true);
    }
  }, [searchParams]);

  const resetBorrowerForm = () => {
    setName('');
    setPhone('');
    setAddress('');
    setNik('');
    setNotes('');
    setPrincipal('');
    setInterestFee('');
    setLoanNotes('');
    setEditBorrowerId(null);
    setIncludeLoan(true);
  };

  const handleSaveBorrower = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      if (editBorrowerId) {
        updateBorrower(editBorrowerId, {
          name: name.trim(),
          phone: phone.trim() || undefined,
          address: address.trim() || undefined,
          nik_identity: nik.trim() || undefined,
          notes: notes.trim() || undefined,
        });
      } else {
        const newBorrower = addBorrower({
          name: name.trim(),
          phone: phone.trim() || undefined,
          address: address.trim() || undefined,
          nik_identity: nik.trim() || undefined,
          notes: notes.trim() || undefined,
        });

        if (includeLoan && principal && Number(principal) > 0) {
          const principalNum = Math.round(Number(principal));
          const feeNum = Math.round(Number(interestFee) || 0);
          const totalDue = principalNum + feeNum;

          addLoan({
            borrower_id: newBorrower.id,
            principal_amount: principalNum,
            interest_fee: feeNum,
            total_due: totalDue,
            loan_date: getNowISO(),
            notes: loanNotes.trim() || undefined,
          });
        }
      }

      setShowBorrowerModal(false);
      resetBorrowerForm();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (b: Borrower) => {
    setEditBorrowerId(b.id);
    setName(b.name);
    setPhone(b.phone || '');
    setAddress(b.address || '');
    setNik(b.nik_identity || '');
    setNotes(b.notes || '');
    setIncludeLoan(false);
    setShowBorrowerModal(true);
  };

  const handleDelete = (id: string) => {
    deleteBorrower(id);
    setShowDeleteConfirm(null);
  };

  // Direct quick payment from card
  const handleQuickPayment = (borrowerId: string, borrowerName: string, activeLoans: Loan[], remainingTotal: number) => {
    const rawVal = quickPayInputs[borrowerId];
    if (!rawVal || Number(rawVal) <= 0) return;

    const amountNum = Math.round(Number(rawVal));

    if (activeLoans.length === 0) {
      alert('Peminjam ini tidak memiliki pinjaman aktif / belum lunas.');
      return;
    }

    if (amountNum > remainingTotal) {
      if (!confirm(`Jumlah pembayaran (${formatCurrency(amountNum)}) melebihi sisa tagihan (${formatCurrency(remainingTotal)}). Lanjutkan?`)) {
        return;
      }
    }

    // Set submitting flag for this specific card
    setQuickPaySubmitting((prev) => ({ ...prev, [borrowerId]: true }));

    try {
      // Allocate payment to the first active unpaid loan
      const targetLoan = activeLoans[0];

      addPayment({
        loan_id: targetLoan.id,
        borrower_id: borrowerId,
        payment_date: getNowISO(),
        amount: amountNum,
        payment_method: 'Tunai',
        notes: 'Pembayaran cepat dari daftar peminjam',
      });

      // Clear input on success
      setQuickPayInputs((prev) => ({ ...prev, [borrowerId]: '' }));

      // Show temporary toast notification
      setNotification({
        id: borrowerId,
        success: true,
        text: `Pembayaran ${formatCurrency(amountNum)} untuk ${borrowerName} berhasil dicatat!`,
      });

      setTimeout(() => {
        setNotification((prev) => (prev?.id === borrowerId ? null : prev));
      }, 3500);
    } catch (err: any) {
      setNotification({
        id: borrowerId,
        success: false,
        text: 'Gagal mencatat pembayaran. Silakan coba lagi.',
      });
    } finally {
      setQuickPaySubmitting((prev) => ({ ...prev, [borrowerId]: false }));
    }
  };

  const filtered = borrowers.filter((b) => {
    const q = search.toLowerCase();
    return (
      b.name.toLowerCase().includes(q) ||
      (b.phone || '').includes(q) ||
      (b.address || '').toLowerCase().includes(q) ||
      (b.nik_identity || '').includes(q)
    );
  });

  const previewCalculation =
    principal && Number(principal) > 0
      ? calculateLoan(Number(principal), Number(interestFee) || 0)
      : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Data Peminjam</h1>
          <p className="text-xs text-slate-400 mt-1">
            Kelola profil peminjam dan catat pembayaran langsung dari kartu peminjam
          </p>
        </div>
        <button
          onClick={() => {
            resetBorrowerForm();
            setShowBorrowerModal(true);
          }}
          className="btn-primary flex items-center gap-1.5 text-xs shadow-xs"
        >
          <UserPlus className="w-4 h-4" /> Tambah Peminjam Baru
        </button>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Cari nama peminjam, nomor HP, atau NIK..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input-field pl-10 text-sm"
        />
      </div>

      {/* Borrowers Cards List */}
      <div className="space-y-3.5">
        {filtered.length === 0 ? (
          <div className="card p-12 text-center text-slate-500 text-xs">
            {search ? 'Tidak ada peminjam yang sesuai dengan pencarian.' : 'Belum ada data peminjam. Silakan tambahkan peminjam baru.'}
          </div>
        ) : (
          filtered.map((b) => {
            const borrowerLoans = getLoansByBorrower(b.id);
            const activeLoans = borrowerLoans.filter((l) => l.status === 'belum_lunas');
            const totalDue = borrowerLoans.reduce((s, l) => s + (l.total_due || 0), 0);
            const totalPaid = borrowerLoans.reduce((s, l) => s + getTotalPaidForLoan(l.id), 0);
            const remaining = Math.max(0, totalDue - totalPaid);
            const isSubmittingQuick = !!quickPaySubmitting[b.id];
            const currentInput = quickPayInputs[b.id] || '';

            return (
              <div
                key={b.id}
                className="card p-4.5 bg-[#1e293b] border-slate-700/80 hover:border-slate-600 transition-all flex flex-col gap-3"
              >
                {/* Top Row: Borrower Info & Badges */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white font-bold flex items-center justify-center flex-shrink-0 text-base shadow-md">
                      {b.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Link to={`/borrowers/${b.id}`} className="text-base font-bold text-white hover:text-emerald-400 truncate">
                          {b.name}
                        </Link>
                        {activeLoans.length > 0 ? (
                          <span className="badge badge-warning text-[10px]">
                            {activeLoans.length} Pinjaman Aktif
                          </span>
                        ) : (
                          <span className="badge badge-success text-[10px]">Lunas</span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5 text-xs text-slate-400 mt-0.5">
                        {b.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3.5 h-3.5 text-emerald-400" /> {b.phone}
                          </span>
                        )}
                        {b.address && (
                          <span className="flex items-center gap-1 truncate max-w-xs">
                            <MapPin className="w-3.5 h-3.5 text-emerald-400" /> {b.address}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Sisa Tagihan Indicator */}
                  <div className="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-t-0 border-slate-700/60 pt-2 sm:pt-0">
                    <div className="text-left sm:text-right">
                      <span className="text-[11px] text-slate-400 block">Sisa Tagihan:</span>
                      <span className={`text-base font-extrabold ${remaining > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                        {formatCurrency(remaining)}
                      </span>
                    </div>

                    {/* Action buttons Edit / Delete */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleEdit(b)}
                        className="btn-secondary p-2 text-blue-400 hover:text-blue-300 rounded-lg text-xs"
                        title="Edit Peminjam"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setShowDeleteConfirm(b.id)}
                        className="btn-secondary p-2 text-red-400 hover:text-red-300 rounded-lg text-xs"
                        title="Hapus Peminjam"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Bottom Row: Direct Payment Input & Action Buttons */}
                <div className="pt-2 border-t border-slate-700/60 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type="number"
                      placeholder="Masukkan nominal pembayaran (Rp)..."
                      value={currentInput}
                      onChange={(e) =>
                        setQuickPayInputs({ ...quickPayInputs, [b.id]: e.target.value })
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleQuickPayment(b.id, b.name, activeLoans, remaining);
                        }
                      }}
                      disabled={remaining === 0 || isSubmittingQuick}
                      className="input-field text-xs py-2 bg-slate-900/80 border-slate-700 placeholder:text-slate-500 disabled:opacity-40"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleQuickPayment(b.id, b.name, activeLoans, remaining)}
                      disabled={!currentInput || Number(currentInput) <= 0 || remaining === 0 || isSubmittingQuick}
                      className="btn-primary text-xs py-2 px-3.5 flex-1 sm:flex-initial flex items-center justify-center gap-1.5 whitespace-nowrap disabled:opacity-40"
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                      {isSubmittingQuick ? 'Menyimpan...' : 'Catat Pembayaran'}
                    </button>

                    <Link
                      to={`/borrowers/${b.id}`}
                      className="btn-secondary text-xs py-2 px-3.5 flex items-center justify-center gap-1 whitespace-nowrap text-slate-200"
                    >
                      Detail <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>

                {/* Notification toast if any for this card */}
                {notification && notification.id === b.id && (
                  <div
                    className={`p-2.5 rounded-lg text-xs flex items-center gap-2 animate-in fade-in duration-200 ${
                      notification.success
                        ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-800/80'
                        : 'bg-red-950/70 text-red-300 border border-red-800/80'
                    }`}
                  >
                    {notification.success ? (
                      <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-400" />
                    ) : (
                      <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-400" />
                    )}
                    <span>{notification.text}</span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Add / Edit Borrower Modal */}
      {showBorrowerModal && (
        <div className="modal-overlay" onClick={() => setShowBorrowerModal(false)}>
          <div className="modal-content max-w-lg w-full bg-[#1e293b] border-slate-700" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4 border-b border-slate-700 pb-3">
              <h2 className="text-base font-bold text-white">
                {editBorrowerId ? 'Edit Profil Peminjam' : 'Tambah Peminjam Baru'}
              </h2>
              <button onClick={() => setShowBorrowerModal(false)} className="p-1 rounded-lg hover:bg-slate-800 text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveBorrower} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold mb-1 text-slate-300">Nama Lengkap Peminjam *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input-field text-sm"
                  required
                  placeholder="Contoh: Ahmad Sudirman"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1 text-slate-300">Nomor WhatsApp / HP</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="input-field text-xs"
                    placeholder="081234567890"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1 text-slate-300">NIK KTP (Opsional)</label>
                  <input
                    type="text"
                    value={nik}
                    onChange={(e) => setNik(e.target.value)}
                    className="input-field text-xs"
                    placeholder="16 digit NIK"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 text-slate-300">Alamat</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="input-field text-xs"
                  placeholder="Jl. Merdeka No. 10..."
                />
              </div>

              {/* Initial Loan Section if adding new borrower */}
              {!editBorrowerId && (
                <div className="border-t border-slate-700 pt-3.5 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-xs font-bold text-emerald-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={includeLoan}
                        onChange={(e) => setIncludeLoan(e.target.checked)}
                        className="rounded text-emerald-500"
                      />
                      <span>BUAT PINJAMAN PERTAMA SEKALIGUS</span>
                    </label>
                  </div>

                  {includeLoan && (
                    <div className="space-y-3 p-3.5 rounded-xl bg-slate-900/60 border border-slate-700/80">
                      <div>
                        <label className="block text-xs font-semibold mb-1 text-slate-300">
                          Jumlah Pinjaman Pokok (Rp) *
                        </label>
                        <input
                          type="number"
                          value={principal}
                          onChange={(e) => setPrincipal(e.target.value)}
                          className="input-field text-xs"
                          required={includeLoan}
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
                        <label className="block text-xs font-semibold mb-1 text-slate-300">
                          Catatan Pinjaman
                        </label>
                        <input
                          type="text"
                          value={loanNotes}
                          onChange={(e) => setLoanNotes(e.target.value)}
                          className="input-field text-xs"
                          placeholder="Keperluan pinjaman..."
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
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold mb-1 text-slate-300">Catatan Peminjam</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="input-field text-xs"
                  rows={2}
                  placeholder="Keterangan tambahan..."
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn-primary flex-1 text-xs disabled:opacity-50"
                >
                  {isSubmitting ? 'Menyimpan...' : editBorrowerId ? 'Simpan Perubahan' : 'Simpan Peminjam'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowBorrowerModal(false)}
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
            <h2 className="text-base font-bold mb-2 text-red-400">Hapus Data Peminjam?</h2>
            <p className="text-xs mb-4 text-slate-400">
              Semua riwayat pinjaman dan pembayaran terkait peminjam ini juga akan dihapus permanen.
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
    </div>
  );
}
