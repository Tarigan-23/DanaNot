import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Edit2, Trash2, X, Phone, MapPin } from 'lucide-react';
import { Borrower } from '../types';
import { formatCurrency, calculateLoan, getTodayISO } from '../utils';
import { getBorrowers, addBorrower, updateBorrower, deleteBorrower, getLoansByBorrower, addLoan, updateLoan } from '../services/storage';

export default function Borrowers() {
  const [borrowers, setBorrowers] = useState<Borrower[]>([]);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showLoanPreview, setShowLoanPreview] = useState(false);
  
  // Form state
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [principal, setPrincipal] = useState('');
  const [interestRate, setInterestRate] = useState('');
  const [interestType, setInterestType] = useState<'once' | 'monthly'>('once');
  const [loanDate, setLoanDate] = useState(getTodayISO());
  const [dueDate, setDueDate] = useState('');
  const [loanNotes, setLoanNotes] = useState('');

  useEffect(() => {
    setBorrowers(getBorrowers());
  }, []);

  const resetForm = () => {
    setName(''); setPhone(''); setAddress(''); setNotes('');
    setPrincipal(''); setInterestRate(''); setInterestType('once');
    setLoanDate(getTodayISO()); setDueDate(''); setLoanNotes('');
    setEditId(null); setShowLoanPreview(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !principal || Number(principal) <= 0) return;

    const principalNum = Math.round(Number(principal));
    const rateNum = Number(interestRate) || 0;
    const { totalInterest, totalDue } = calculateLoan(principalNum, rateNum, interestType);

    if (editId) {
      updateBorrower(editId, { name: name.trim(), phone, address, notes });
      // Update the loan too
      const loans = getLoansByBorrower(editId);
      if (loans.length > 0) {
        updateLoan(loans[0].id, {
          principal_amount: principalNum,
          interest_rate: rateNum,
          interest_type: interestType,
          total_interest: totalInterest,
          total_due: totalDue,
          loan_date: loanDate,
          due_date: dueDate || undefined,
          notes: loanNotes,
        });
      }
    } else {
      const borrower = addBorrower({ name: name.trim(), phone, address, notes });
      addLoan({
        borrower_id: borrower.id,
        principal_amount: principalNum,
        interest_rate: rateNum,
        interest_type: interestType,
        total_interest: totalInterest,
        total_due: totalDue,
        loan_date: loanDate,
        due_date: dueDate || undefined,
        notes: loanNotes,
      });
    }

    setBorrowers(getBorrowers());
    setShowForm(false);
    resetForm();
  };

  const handleEdit = (b: Borrower) => {
    setEditId(b.id);
    setName(b.name);
    setPhone(b.phone || '');
    setAddress(b.address || '');
    setNotes(b.notes || '');
    
    const loans = getLoansByBorrower(b.id);
    if (loans.length > 0) {
      const loan = loans[0];
      setPrincipal(String(loan.principal_amount));
      setInterestRate(String(loan.interest_rate));
      setInterestType(loan.interest_type);
      setLoanDate(loan.loan_date.split('T')[0]);
      setDueDate(loan.due_date ? loan.due_date.split('T')[0] : '');
      setLoanNotes(loan.notes || '');
      setShowLoanPreview(true);
    }
    
    setShowForm(true);
  };

  const handleDelete = (id: string) => {
    deleteBorrower(id);
    setBorrowers(getBorrowers());
    setShowDeleteConfirm(null);
  };

  const filtered = borrowers.filter(b => 
    b.name.toLowerCase().includes(search.toLowerCase()) ||
    (b.phone || '').includes(search)
  );

  const loanPreview = principal && Number(principal) > 0 ? calculateLoan(Number(principal), Number(interestRate) || 0, interestType) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Data Peminjam</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Kelola data peminjam dan pinjaman</p>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true); setShowLoanPreview(true); }} className="btn-primary flex items-center gap-2 text-sm">
          <Plus className="w-4 h-4" /> Tambah Peminjam
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
        <input
          type="text"
          placeholder="Cari nama atau nomor telepon..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="input-field pl-10"
        />
      </div>

      {/* List */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="card p-8 text-center">
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {search ? 'Tidak ada peminjam ditemukan' : 'Belum ada data peminjam. Tambahkan peminjam baru.'}
            </p>
          </div>
        ) : (
          filtered.map(b => (
            <div key={b.id} className="card p-4 flex items-center justify-between">
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400">{b.name.charAt(0).toUpperCase()}</span>
                </div>
                <div className="min-w-0">
                  <Link to={`/borrowers/${b.id}`} className="text-sm font-semibold hover:text-emerald-600 truncate block">
                    {b.name}
                  </Link>
                  <div className="flex items-center gap-3 text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                    {b.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{b.phone}</span>}
                    {b.address && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{b.address}</span>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => handleEdit(b)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                  <Edit2 className="w-4 h-4 text-blue-500" />
                </button>
                <button onClick={() => setShowDeleteConfirm(b.id)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                  <Trash2 className="w-4 h-4 text-red-500" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add/Edit Form Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-content max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">{editId ? 'Edit Peminjam' : 'Tambah Peminjam Baru'}</h2>
              <button onClick={() => { setShowForm(false); resetForm(); }} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1">Nama Lengkap *</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} className="input-field" required placeholder="Masukkan nama peminjam" />
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1">No. Telepon</label>
                  <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} className="input-field" placeholder="Opsional" />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Alamat</label>
                  <input type="text" value={address} onChange={e => setAddress(e.target.value)} className="input-field" placeholder="Opsional" />
                </div>
              </div>

              <div className="border-t pt-4" style={{ borderColor: 'var(--border-color)' }}>
                <p className="text-xs font-semibold text-emerald-600 mb-3">DATA PINJAMAN</p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium mb-1">Jumlah Pinjaman (Rp) *</label>
                    <input type="number" value={principal} onChange={e => setPrincipal(e.target.value)} className="input-field" required min="1" placeholder="1000000" />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium mb-1">Bunga (%)</label>
                      <input type="number" value={interestRate} onChange={e => setInterestRate(e.target.value)} className="input-field" min="0" step="0.1" placeholder="10" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">Jenis Bunga</label>
                      <select value={interestType} onChange={e => setInterestType(e.target.value as 'once' | 'monthly')} className="input-field">
                        <option value="once">Sekali (Flat)</option>
                        <option value="monthly">Per Bulan</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium mb-1">Tanggal Pinjaman</label>
                      <input type="date" value={loanDate} onChange={e => setLoanDate(e.target.value)} className="input-field" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">Jatuh Tempo</label>
                      <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="input-field" />
                    </div>
                  </div>

                  {/* Loan Preview */}
                  {loanPreview && (
                    <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-3 space-y-1">
                      <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Simulasi Perhitungan:</p>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <span style={{ color: 'var(--text-secondary)' }}>Pinjaman Pokok:</span>
                        <span className="font-medium text-right">{formatCurrency(Number(principal))}</span>
                        <span style={{ color: 'var(--text-secondary)' }}>Total Bunga:</span>
                        <span className="font-medium text-right">{formatCurrency(loanPreview.totalInterest)}</span>
                        <span style={{ color: 'var(--text-secondary)' }}>Total Tagihan:</span>
                        <span className="font-bold text-emerald-700 dark:text-emerald-400 text-right">{formatCurrency(loanPreview.totalDue)}</span>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-medium mb-1">Catatan Pinjaman</label>
                    <textarea value={loanNotes} onChange={e => setLoanNotes(e.target.value)} className="input-field" rows={2} placeholder="Opsional" />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">Catatan Peminjam</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} className="input-field" rows={2} placeholder="Catatan tambahan tentang peminjam" />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="submit" className="btn-primary flex-1">
                  {editId ? 'Simpan Perubahan' : 'Simpan'}
                </button>
                <button type="button" onClick={() => { setShowForm(false); resetForm(); }} className="btn-secondary flex-1">
                  Batal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="modal-overlay" onClick={() => setShowDeleteConfirm(null)}>
          <div className="modal-content max-w-sm" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-2">Konfirmasi Hapus</h2>
            <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
              Apakah Anda yakin ingin menghapus peminjam ini? Semua data pinjaman dan pembayaran terkait juga akan dihapus. Tindakan ini tidak dapat dibatalkan.
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
