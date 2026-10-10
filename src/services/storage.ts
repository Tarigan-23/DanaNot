import { Borrower, Loan, Payment, DashboardStats, DatabaseBackup, CloudSyncConfig } from '../types';
import { generateId, generateReceiptNo } from '../utils';
import { getDB, isIndexedDBSupported } from './db';

const STORAGE_KEYS = {
  borrowers: 'dananote_borrowers',
  loans: 'dananote_loans',
  payments: 'dananote_payments',
  syncConfig: 'dananote_sync_config',
};

// In-memory cache for instant zero-latency reads
let memoryCache = {
  borrowers: [] as Borrower[],
  loans: [] as Loan[],
  payments: [] as Payment[],
  initialized: false,
};

// Event listeners for data updates
type Listener = () => void;
const listeners = new Set<Listener>();

export function subscribeDataChanges(callback: Listener): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function notifyChange() {
  listeners.forEach((cb) => {
    try {
      cb();
    } catch (e) {
      console.error('Error in change listener:', e);
    }
  });
}

// LocalStorage Helper
function getLocal<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error(`Error reading ${key} from localStorage:`, e);
    return [];
  }
}

function setLocal<T>(key: string, data: T[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.warn(`Error writing ${key} to localStorage:`, e);
  }
}

// Persist single entity to IndexedDB in background
async function persistToIndexedDB(
  storeName: 'borrowers' | 'loans' | 'payments',
  action: 'put' | 'delete' | 'clear',
  data?: any
) {
  if (!isIndexedDBSupported()) return;
  try {
    const db = await getDB();
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);

    if (action === 'put' && data) {
      await store.put(data);
    } else if (action === 'delete' && data) {
      await store.delete(data);
    } else if (action === 'clear') {
      await store.clear();
    }
    await tx.done;
  } catch (err) {
    console.warn(`IndexedDB background error on ${storeName}:`, err);
  }
}

// Migration normalization for loans
function normalizeLoan(l: any): Loan {
  const fee = Number(l.interest_fee ?? l.total_interest ?? 0);
  const principal = Number(l.principal_amount || 0);
  const totalDue = Number(l.total_due || principal + fee);
  return {
    ...l,
    principal_amount: principal,
    interest_fee: fee,
    total_due: totalDue,
    status: l.status === 'lunas' ? 'lunas' : 'belum_lunas',
    loan_date: l.loan_date || new Date().toISOString(),
  };
}

// Initialize Database & migrate existing localStorage / IndexedDB data
export async function initializeStorage(): Promise<void> {
  if (memoryCache.initialized) return;

  // 1. Initial seed from localStorage for instant display
  const localBorrowers = getLocal<Borrower>(STORAGE_KEYS.borrowers);
  const localLoans = getLocal<any>(STORAGE_KEYS.loans).map(normalizeLoan);
  const localPayments = getLocal<Payment>(STORAGE_KEYS.payments);

  memoryCache.borrowers = localBorrowers;
  memoryCache.loans = localLoans;
  memoryCache.payments = localPayments;
  memoryCache.initialized = true;

  // 2. Hydrate & sync with IndexedDB
  if (isIndexedDBSupported()) {
    try {
      const db = await getDB();
      const idbBorrowers = await db.getAll('borrowers');
      const idbLoansRaw = await db.getAll('loans');
      const idbLoans = idbLoansRaw.map(normalizeLoan);
      const idbPayments = await db.getAll('payments');

      if (idbBorrowers.length === 0 && localBorrowers.length > 0) {
        // Migrate from localStorage to IndexedDB
        const txB = db.transaction('borrowers', 'readwrite');
        for (const b of localBorrowers) await txB.store.put(b);
        await txB.done;

        const txL = db.transaction('loans', 'readwrite');
        for (const l of localLoans) await txL.store.put(l);
        await txL.done;

        const txP = db.transaction('payments', 'readwrite');
        for (const p of localPayments) await txP.store.put(p);
        await txP.done;
      } else if (idbBorrowers.length > 0) {
        memoryCache.borrowers = idbBorrowers;
        memoryCache.loans = idbLoans;
        memoryCache.payments = idbPayments;

        setLocal(STORAGE_KEYS.borrowers, idbBorrowers);
        setLocal(STORAGE_KEYS.loans, idbLoans);
        setLocal(STORAGE_KEYS.payments, idbPayments);
      }
    } catch (e) {
      console.error('Failed to initialize IndexedDB:', e);
    }
  }

  // 3. Seed demo data if totally empty
  if (memoryCache.borrowers.length === 0) {
    seedDemoData();
  }

  notifyChange();
}

// -------------------------------------------------------------
// BORROWERS CRUD
// -------------------------------------------------------------
export function getBorrowers(): Borrower[] {
  if (!memoryCache.initialized) {
    memoryCache.borrowers = getLocal<Borrower>(STORAGE_KEYS.borrowers);
  }
  return [...memoryCache.borrowers];
}

export function getBorrower(id: string): Borrower | undefined {
  return getBorrowers().find((b) => b.id === id);
}

export function addBorrower(data: Omit<Borrower, 'id' | 'created_at' | 'updated_at'>): Borrower {
  const now = new Date().toISOString();
  const borrower: Borrower = {
    ...data,
    id: generateId(),
    created_at: now,
    updated_at: now,
    sync_status: 'pending',
  };

  memoryCache.borrowers.push(borrower);
  setLocal(STORAGE_KEYS.borrowers, memoryCache.borrowers);
  persistToIndexedDB('borrowers', 'put', borrower);
  notifyChange();
  return borrower;
}

export function updateBorrower(
  id: string,
  data: Partial<Omit<Borrower, 'id' | 'created_at'>>
): Borrower | null {
  const idx = memoryCache.borrowers.findIndex((b) => b.id === id);
  if (idx === -1) return null;

  const updated: Borrower = {
    ...memoryCache.borrowers[idx],
    ...data,
    updated_at: new Date().toISOString(),
    sync_status: 'pending',
  };

  memoryCache.borrowers[idx] = updated;
  setLocal(STORAGE_KEYS.borrowers, memoryCache.borrowers);
  persistToIndexedDB('borrowers', 'put', updated);
  notifyChange();
  return updated;
}

export function deleteBorrower(id: string): boolean {
  memoryCache.borrowers = memoryCache.borrowers.filter((b) => b.id !== id);
  setLocal(STORAGE_KEYS.borrowers, memoryCache.borrowers);
  persistToIndexedDB('borrowers', 'delete', id);

  // Cascade delete related loans
  const loansToDelete = memoryCache.loans.filter((l) => l.borrower_id === id);
  const loanIdsToDelete = new Set(loansToDelete.map((l) => l.id));

  memoryCache.loans = memoryCache.loans.filter((l) => l.borrower_id !== id);
  setLocal(STORAGE_KEYS.loans, memoryCache.loans);
  loansToDelete.forEach((l) => persistToIndexedDB('loans', 'delete', l.id));

  // Cascade delete related payments
  const paymentsToDelete = memoryCache.payments.filter((p) => loanIdsToDelete.has(p.loan_id));
  memoryCache.payments = memoryCache.payments.filter((p) => !loanIdsToDelete.has(p.loan_id));
  setLocal(STORAGE_KEYS.payments, memoryCache.payments);
  paymentsToDelete.forEach((p) => persistToIndexedDB('payments', 'delete', p.id));

  notifyChange();
  return true;
}

// -------------------------------------------------------------
// LOANS CRUD
// -------------------------------------------------------------
export function getLoans(): Loan[] {
  if (!memoryCache.initialized) {
    memoryCache.loans = getLocal<any>(STORAGE_KEYS.loans).map(normalizeLoan);
  }
  return [...memoryCache.loans];
}

export function getLoan(id: string): Loan | undefined {
  return getLoans().find((l) => l.id === id);
}

export function getLoansByBorrower(borrowerId: string): Loan[] {
  return getLoans().filter((l) => l.borrower_id === borrowerId);
}

export function addLoan(
  data: Omit<Loan, 'id' | 'created_at' | 'updated_at' | 'status'> & { status?: 'lunas' | 'belum_lunas' }
): Loan {
  const now = new Date().toISOString();
  const fee = Math.max(0, Math.round(Number(data.interest_fee) || 0));
  const principal = Math.max(0, Math.round(Number(data.principal_amount) || 0));
  const totalDue = data.total_due || principal + fee;

  const loan: Loan = {
    ...data,
    id: generateId(),
    principal_amount: principal,
    interest_fee: fee,
    total_due: totalDue,
    status: data.status || 'belum_lunas',
    loan_date: data.loan_date || now,
    created_at: now,
    updated_at: now,
    sync_status: 'pending',
  };

  memoryCache.loans.push(loan);
  setLocal(STORAGE_KEYS.loans, memoryCache.loans);
  persistToIndexedDB('loans', 'put', loan);
  notifyChange();
  return loan;
}

export function updateLoan(
  id: string,
  data: Partial<Omit<Loan, 'id' | 'created_at'>>
): Loan | null {
  const idx = memoryCache.loans.findIndex((l) => l.id === id);
  if (idx === -1) return null;

  const updated: Loan = {
    ...memoryCache.loans[idx],
    ...data,
    updated_at: new Date().toISOString(),
    sync_status: 'pending',
  };

  memoryCache.loans[idx] = updated;
  setLocal(STORAGE_KEYS.loans, memoryCache.loans);
  persistToIndexedDB('loans', 'put', updated);
  notifyChange();
  return updated;
}

export function deleteLoan(id: string): boolean {
  memoryCache.loans = memoryCache.loans.filter((l) => l.id !== id);
  setLocal(STORAGE_KEYS.loans, memoryCache.loans);
  persistToIndexedDB('loans', 'delete', id);

  const paymentsToDelete = memoryCache.payments.filter((p) => p.loan_id === id);
  memoryCache.payments = memoryCache.payments.filter((p) => p.loan_id !== id);
  setLocal(STORAGE_KEYS.payments, memoryCache.payments);
  paymentsToDelete.forEach((p) => persistToIndexedDB('payments', 'delete', p.id));

  notifyChange();
  return true;
}

// -------------------------------------------------------------
// PAYMENTS CRUD
// -------------------------------------------------------------
export function getPayments(): Payment[] {
  if (!memoryCache.initialized) {
    memoryCache.payments = getLocal<Payment>(STORAGE_KEYS.payments);
  }
  return [...memoryCache.payments];
}

export function getPayment(id: string): Payment | undefined {
  return getPayments().find((p) => p.id === id);
}

export function getPaymentsByLoan(loanId: string): Payment[] {
  return getPayments()
    .filter((p) => p.loan_id === loanId)
    .sort((a, b) => new Date(a.payment_date).getTime() - new Date(b.payment_date).getTime());
}

export function getTotalPaidForLoan(loanId: string): number {
  return getPaymentsByLoan(loanId).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
}

export function addPayment(
  data: Omit<Payment, 'id' | 'created_at' | 'receipt_no'> & { receipt_no?: string }
): Payment {
  const now = new Date().toISOString();
  const payment: Payment = {
    ...data,
    id: generateId(),
    receipt_no: data.receipt_no || generateReceiptNo(),
    payment_date: data.payment_date || now,
    created_at: now,
    sync_status: 'pending',
  };

  memoryCache.payments.push(payment);
  setLocal(STORAGE_KEYS.payments, memoryCache.payments);
  persistToIndexedDB('payments', 'put', payment);

  // Recalculate loan status
  recalculateLoanStatus(data.loan_id);
  notifyChange();
  return payment;
}

export function deletePayment(id: string): boolean {
  const payment = getPayment(id);
  if (!payment) return false;

  const loanId = payment.loan_id;
  memoryCache.payments = memoryCache.payments.filter((p) => p.id !== id);
  setLocal(STORAGE_KEYS.payments, memoryCache.payments);
  persistToIndexedDB('payments', 'delete', id);

  recalculateLoanStatus(loanId);
  notifyChange();
  return true;
}

function recalculateLoanStatus(loanId: string) {
  const loan = getLoan(loanId);
  if (!loan) return;

  const totalPaid = getTotalPaidForLoan(loanId);
  const isPaid = totalPaid >= loan.total_due;
  const newStatus: 'lunas' | 'belum_lunas' = isPaid ? 'lunas' : 'belum_lunas';

  updateLoan(loanId, { status: newStatus });
}

// -------------------------------------------------------------
// DASHBOARD & STATS
// -------------------------------------------------------------
export function getDashboardStats(): DashboardStats {
  const loans = getLoans();
  const payments = getPayments();
  const borrowers = getBorrowers();

  const totalPrincipal = loans.reduce((sum, l) => sum + (l.principal_amount || 0), 0);
  const totalInterestFee = loans.reduce((sum, l) => sum + (l.interest_fee || 0), 0);
  const totalDue = loans.reduce((sum, l) => sum + (l.total_due || 0), 0);
  const totalPaid = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
  const totalRemaining = Math.max(0, totalDue - totalPaid);
  const totalBorrowers = borrowers.length;

  const unpaidLoans = loans.filter((l) => l.status === 'belum_lunas').length;
  const paidLoans = loans.filter((l) => l.status === 'lunas').length;

  // Count borrowers who have at least 1 active unpaid loan
  const borrowerWithUnpaidLoan = new Set(
    loans.filter((l) => l.status === 'belum_lunas').map((l) => l.borrower_id)
  );
  const activeBorrowersCount = borrowerWithUnpaidLoan.size;

  const recoveryRate = totalDue > 0 ? Math.min(100, Math.round((totalPaid / totalDue) * 100)) : 0;

  return {
    totalPrincipal,
    totalInterestFee,
    totalDue,
    totalPaid,
    totalRemaining,
    totalBorrowers,
    activeBorrowersCount,
    unpaidLoans,
    paidLoans,
    recoveryRate,
  };
}

export function getRecentPayments(limit: number = 5): (Payment & { loan?: Loan; borrower_name?: string })[] {
  const payments = [...getPayments()]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, limit);

  return payments.map((p) => {
    const loan = getLoan(p.loan_id);
    const borrower = loan ? getBorrower(loan.borrower_id) : undefined;
    return { ...p, loan, borrower_name: borrower?.name };
  });
}

export function getRecentLoans(limit: number = 5): (Loan & { borrower_name?: string })[] {
  const loans = [...getLoans()]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, limit);

  return loans.map((l) => {
    const borrower = getBorrower(l.borrower_id);
    return { ...l, borrower_name: borrower?.name };
  });
}

// -------------------------------------------------------------
// BACKUP & RESTORE
// -------------------------------------------------------------
export function createBackup(): DatabaseBackup {
  return {
    app: 'DanaNote',
    version: 2,
    exported_at: new Date().toISOString(),
    data: {
      borrowers: getBorrowers(),
      loans: getLoans(),
      payments: getPayments(),
    },
  };
}

export async function restoreBackup(
  backupData: any,
  mode: 'replace' | 'merge' = 'replace'
): Promise<{ success: boolean; message: string; counts: { borrowers: number; loans: number; payments: number } }> {
  try {
    if (!backupData || !backupData.data || !Array.isArray(backupData.data.borrowers)) {
      throw new Error('Format file cadangan tidak valid.');
    }

    const newBorrowers: Borrower[] = backupData.data.borrowers || [];
    const newLoans: Loan[] = (backupData.data.loans || []).map(normalizeLoan);
    const newPayments: Payment[] = backupData.data.payments || [];

    if (mode === 'replace') {
      memoryCache.borrowers = newBorrowers;
      memoryCache.loans = newLoans;
      memoryCache.payments = newPayments;
    } else {
      const bMap = new Map(memoryCache.borrowers.map((b) => [b.id, b]));
      newBorrowers.forEach((b) => bMap.set(b.id, b));
      memoryCache.borrowers = Array.from(bMap.values());

      const lMap = new Map(memoryCache.loans.map((l) => [l.id, l]));
      newLoans.forEach((l) => lMap.set(l.id, l));
      memoryCache.loans = Array.from(lMap.values());

      const pMap = new Map(memoryCache.payments.map((p) => [p.id, p]));
      newPayments.forEach((p) => pMap.set(p.id, p));
      memoryCache.payments = Array.from(pMap.values());
    }

    setLocal(STORAGE_KEYS.borrowers, memoryCache.borrowers);
    setLocal(STORAGE_KEYS.loans, memoryCache.loans);
    setLocal(STORAGE_KEYS.payments, memoryCache.payments);

    if (isIndexedDBSupported()) {
      const db = await getDB();
      const txB = db.transaction('borrowers', 'readwrite');
      if (mode === 'replace') await txB.store.clear();
      for (const b of memoryCache.borrowers) await txB.store.put(b);
      await txB.done;

      const txL = db.transaction('loans', 'readwrite');
      if (mode === 'replace') await txL.store.clear();
      for (const l of memoryCache.loans) await txL.store.put(l);
      await txL.done;

      const txP = db.transaction('payments', 'readwrite');
      if (mode === 'replace') await txP.store.clear();
      for (const p of memoryCache.payments) await txP.store.put(p);
      await txP.done;
    }

    notifyChange();
    return {
      success: true,
      message: 'Data berhasil dipulihkan.',
      counts: {
        borrowers: memoryCache.borrowers.length,
        loans: memoryCache.loans.length,
        payments: memoryCache.payments.length,
      },
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || 'Gagal memulihkan cadangan.',
      counts: { borrowers: 0, loans: 0, payments: 0 },
    };
  }
}

export async function clearAllData(): Promise<void> {
  memoryCache.borrowers = [];
  memoryCache.loans = [];
  memoryCache.payments = [];

  setLocal(STORAGE_KEYS.borrowers, []);
  setLocal(STORAGE_KEYS.loans, []);
  setLocal(STORAGE_KEYS.payments, []);

  if (isIndexedDBSupported()) {
    try {
      const db = await getDB();
      await db.clear('borrowers');
      await db.clear('loans');
      await db.clear('payments');
    } catch (e) {
      console.warn('Error clearing IndexedDB:', e);
    }
  }

  notifyChange();
}

// -------------------------------------------------------------
// CLOUD SYNC CONFIG
// -------------------------------------------------------------
export function getSyncConfig(): CloudSyncConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.syncConfig);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {
    enabled: false,
    supabaseUrl: '',
    supabaseAnonKey: '',
    autoSync: false,
  };
}

export function saveSyncConfig(cfg: CloudSyncConfig): void {
  try {
    localStorage.setItem(STORAGE_KEYS.syncConfig, JSON.stringify(cfg));
  } catch {}
}

// -------------------------------------------------------------
// SEED DEMO DATA
// -------------------------------------------------------------
export function seedDemoData(): void {
  if (memoryCache.borrowers.length > 0) return;

  const b1 = addBorrower({
    name: 'Ahmad Sudirman',
    phone: '081234567890',
    address: 'Jl. Merdeka No. 10, Jakarta Pusat',
    nik_identity: '3171012345670001',
    notes: 'Pelanggan tetap - Usaha Toko Kelontong',
  });
  const b2 = addBorrower({
    name: 'Siti Rahayu',
    phone: '082345678901',
    address: 'Jl. R.E. Martadinata No. 25, Bandung',
    nik_identity: '3273012345670002',
    notes: 'Usaha Kuliner Katering',
  });
  const b3 = addBorrower({
    name: 'Budi Santoso',
    phone: '083456789012',
    address: 'Jl. Pemuda No. 5, Surabaya',
    nik_identity: '3578012345670003',
    notes: 'Kolega bisnis',
  });

  // Loans: Pokok + Jasa Pinjam
  const l1 = addLoan({
    borrower_id: b1.id,
    principal_amount: 1000000,
    interest_fee: 200000,
    total_due: 1200000,
    loan_date: '2026-09-01T08:00:00.000Z',
    notes: 'Pinjaman modal usaha',
  });

  const l2 = addLoan({
    borrower_id: b2.id,
    principal_amount: 2000000,
    interest_fee: 100000,
    total_due: 2100000,
    loan_date: '2026-09-10T10:30:00.000Z',
    notes: 'Pelunasan peralatan dapur',
  });

  const l3 = addLoan({
    borrower_id: b3.id,
    principal_amount: 5000000,
    interest_fee: 500000,
    total_due: 5500000,
    loan_date: '2026-09-15T14:15:00.000Z',
    notes: 'Pinjaman stok bengkel',
  });

  // Payments
  addPayment({
    loan_id: l1.id,
    borrower_id: b1.id,
    payment_date: '2026-09-20T09:00:00.000Z',
    amount: 300000,
    payment_method: 'Transfer Bank',
    notes: 'Cicilan ke-1',
  });

  addPayment({
    loan_id: l2.id,
    borrower_id: b2.id,
    payment_date: '2026-09-25T11:00:00.000Z',
    amount: 2100000,
    payment_method: 'Transfer Bank',
    notes: 'Pelunasan penuh',
  });
}
