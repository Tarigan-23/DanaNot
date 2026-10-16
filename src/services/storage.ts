import { 
  Borrower, Loan, Payment, DashboardStats, DatabaseBackup, 
  CloudSyncConfig, SavingsTransaction, AppSettings, BorrowerSavingsSummary 
} from '../types';
import { generateId, generateReceiptNo, calculateLoan, calculateSavingsDeposit } from '../utils';
import { getDB, isIndexedDBSupported } from './db';

const STORAGE_KEYS = {
  borrowers: 'dananote_borrowers',
  loans: 'dananote_loans',
  payments: 'dananote_payments',
  savings: 'dananote_savings_transactions',
  settings: 'dananote_app_settings',
  syncConfig: 'dananote_sync_config',
  initializedFlag: 'dananote_user_initialized',
};

const DEFAULT_SETTINGS: AppSettings = {
  defaultInterestRate: 20, // 20% default bunga
  defaultSavingsRate: 5,   // 5% default tabungan
  appName: 'DanaNote',
  updated_at: new Date().toISOString(),
};

// In-memory cache for instant zero-latency reads
let memoryCache = {
  borrowers: [] as Borrower[],
  loans: [] as Loan[],
  payments: [] as Payment[],
  savings: [] as SavingsTransaction[],
  settings: { ...DEFAULT_SETTINGS } as AppSettings,
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

// LocalStorage Helpers with error handling
function getLocal<T>(key: string, defaultValue: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return defaultValue;
    return JSON.parse(raw);
  } catch (e) {
    console.error(`Error reading ${key} from localStorage:`, e);
    return defaultValue;
  }
}

function setLocal<T>(key: string, data: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.warn(`Error writing ${key} to localStorage:`, e);
  }
}

// Persist single entity to IndexedDB in background
async function persistToIndexedDB(
  storeName: 'borrowers' | 'loans' | 'payments' | 'savings_transactions',
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

// Migration normalization for loans: preserve rate snapshot or calculate from fee
function normalizeLoan(l: any): Loan {
  const principal = Math.max(0, Math.round(Number(l.principal_amount || 0)));
  const fee = Math.max(0, Math.round(Number(l.interest_fee ?? l.total_interest ?? 0)));
  const totalDue = Math.max(0, Math.round(Number(l.total_due || principal + fee)));
  
  // Calculate or preserve interest rate snapshot
  let rate = l.interest_rate !== undefined ? Number(l.interest_rate) : undefined;
  if (rate === undefined || isNaN(rate)) {
    rate = principal > 0 ? Math.round(((fee / principal) * 100) * 100) / 100 : 20;
  }

  return {
    ...l,
    principal_amount: principal,
    interest_rate: rate,
    interest_fee: fee,
    total_due: totalDue,
    status: l.status === 'lunas' ? 'lunas' : 'belum_lunas',
    savings_deposit_rate: l.savings_deposit_rate !== undefined ? Number(l.savings_deposit_rate) : undefined,
    savings_deposit_amount: l.savings_deposit_amount !== undefined ? Number(l.savings_deposit_amount) : undefined,
    loan_date: l.loan_date || new Date().toISOString(),
  };
}

// -------------------------------------------------------------
// APP SETTINGS
// -------------------------------------------------------------
export function getAppSettings(): AppSettings {
  if (!memoryCache.initialized) {
    memoryCache.settings = getLocal<AppSettings>(STORAGE_KEYS.settings, { ...DEFAULT_SETTINGS });
  }
  return { ...memoryCache.settings };
}

export function updateAppSettings(settings: Partial<AppSettings>): AppSettings {
  const updated: AppSettings = {
    ...memoryCache.settings,
    ...settings,
    updated_at: new Date().toISOString(),
  };

  memoryCache.settings = updated;
  setLocal(STORAGE_KEYS.settings, updated);

  if (isIndexedDBSupported()) {
    getDB().then((db) => {
      db.put('settings', { key: 'app_settings', value: updated }).catch((e) =>
        console.warn('Failed to save settings to IDB:', e)
      );
    });
  }

  notifyChange();
  return updated;
}

// -------------------------------------------------------------
// INITIALIZE STORAGE
// -------------------------------------------------------------
export async function initializeStorage(): Promise<void> {
  if (memoryCache.initialized) return;

  // 1. Initial read from localStorage
  const localBorrowers = getLocal<Borrower[]>(STORAGE_KEYS.borrowers, []);
  const localLoans = getLocal<any[]>(STORAGE_KEYS.loans, []).map(normalizeLoan);
  const localPayments = getLocal<Payment[]>(STORAGE_KEYS.payments, []);
  const localSavings = getLocal<SavingsTransaction[]>(STORAGE_KEYS.savings, []);
  const localSettings = getLocal<AppSettings>(STORAGE_KEYS.settings, { ...DEFAULT_SETTINGS });

  memoryCache.borrowers = localBorrowers;
  memoryCache.loans = localLoans;
  memoryCache.payments = localPayments;
  memoryCache.savings = localSavings;
  memoryCache.settings = localSettings;
  memoryCache.initialized = true;

  // 2. Hydrate & sync with IndexedDB safely
  if (isIndexedDBSupported()) {
    try {
      const db = await getDB();
      const idbBorrowers = await db.getAll('borrowers');
      const idbLoansRaw = await db.getAll('loans');
      const idbLoans = idbLoansRaw.map(normalizeLoan);
      const idbPayments = await db.getAll('payments');
      const idbSavings = (await db.getAll('savings_transactions')) || [];
      const idbSettingsRecord = await db.get('settings', 'app_settings');

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

        const txS = db.transaction('savings_transactions', 'readwrite');
        for (const s of localSavings) await txS.store.put(s);
        await txS.done;
      } else if (idbBorrowers.length > 0) {
        // Hydrate from IndexedDB if it holds the authority data
        memoryCache.borrowers = idbBorrowers;
        memoryCache.loans = idbLoans;
        memoryCache.payments = idbPayments;
        memoryCache.savings = idbSavings;

        setLocal(STORAGE_KEYS.borrowers, idbBorrowers);
        setLocal(STORAGE_KEYS.loans, idbLoans);
        setLocal(STORAGE_KEYS.payments, idbPayments);
        setLocal(STORAGE_KEYS.savings, idbSavings);
      }

      if (idbSettingsRecord && idbSettingsRecord.value) {
        memoryCache.settings = { ...DEFAULT_SETTINGS, ...idbSettingsRecord.value };
        setLocal(STORAGE_KEYS.settings, memoryCache.settings);
      }
    } catch (e) {
      console.error('Failed to initialize IndexedDB:', e);
    }
  }

  // 3. Check initialized flag: ONLY seed demo data if this is the very first install
  // If the user has initialized or cleared data intentionally, DO NOT seed demo data again.
  const hasEverInitialized = localStorage.getItem(STORAGE_KEYS.initializedFlag);
  if (!hasEverInitialized && memoryCache.borrowers.length === 0) {
    seedDemoData();
    localStorage.setItem(STORAGE_KEYS.initializedFlag, 'true');
  } else if (!hasEverInitialized) {
    localStorage.setItem(STORAGE_KEYS.initializedFlag, 'true');
  }

  notifyChange();
}

// -------------------------------------------------------------
// BORROWERS CRUD
// -------------------------------------------------------------
export function getBorrowers(): Borrower[] {
  if (!memoryCache.initialized) {
    memoryCache.borrowers = getLocal<Borrower[]>(STORAGE_KEYS.borrowers, []);
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
  const paymentsToDelete = memoryCache.payments.filter((p) => loanIdsToDelete.has(p.loan_id) || p.borrower_id === id);
  memoryCache.payments = memoryCache.payments.filter((p) => !loanIdsToDelete.has(p.loan_id) && p.borrower_id !== id);
  setLocal(STORAGE_KEYS.payments, memoryCache.payments);
  paymentsToDelete.forEach((p) => persistToIndexedDB('payments', 'delete', p.id));

  // Cascade delete savings transactions
  const savingsToDelete = memoryCache.savings.filter((s) => s.borrower_id === id);
  memoryCache.savings = memoryCache.savings.filter((s) => s.borrower_id !== id);
  setLocal(STORAGE_KEYS.savings, memoryCache.savings);
  savingsToDelete.forEach((s) => persistToIndexedDB('savings_transactions', 'delete', s.id));

  notifyChange();
  return true;
}

// -------------------------------------------------------------
// LOANS CRUD WITH DYNAMIC INTEREST & AUTO SAVINGS
// -------------------------------------------------------------
export function getLoans(): Loan[] {
  if (!memoryCache.initialized) {
    memoryCache.loans = getLocal<any[]>(STORAGE_KEYS.loans, []).map(normalizeLoan);
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
  data: Omit<Loan, 'id' | 'created_at' | 'updated_at' | 'status'> & { 
    status?: 'lunas' | 'belum_lunas';
    skipSavingsDeposit?: boolean;
  }
): Loan {
  const now = new Date().toISOString();
  const settings = getAppSettings();
  
  const principal = Math.max(0, Math.round(Number(data.principal_amount) || 0));
  
  // Dynamic interest rate snapshot
  const interestRate = data.interest_rate !== undefined 
    ? Number(data.interest_rate) 
    : settings.defaultInterestRate;

  // Calculate interest fee from rate or provided fee
  const interestFee = data.interest_fee !== undefined
    ? Math.max(0, Math.round(Number(data.interest_fee)))
    : Math.round((principal * interestRate) / 100);

  const totalDue = data.total_due !== undefined && data.total_due > 0
    ? Math.round(Number(data.total_due))
    : principal + interestFee;

  // Automatic savings addition (default 5% from principal)
  const savingsRate = data.savings_deposit_rate !== undefined
    ? Number(data.savings_deposit_rate)
    : settings.defaultSavingsRate;

  const savingsAmount = data.savings_deposit_amount !== undefined
    ? Number(data.savings_deposit_amount)
    : calculateSavingsDeposit(principal, savingsRate);

  const loanId = generateId();

  const loan: Loan = {
    ...data,
    id: loanId,
    principal_amount: principal,
    interest_rate: interestRate,
    interest_fee: interestFee,
    total_due: totalDue,
    status: data.status || 'belum_lunas',
    savings_deposit_rate: savingsRate,
    savings_deposit_amount: savingsAmount,
    loan_date: data.loan_date || now,
    created_at: now,
    updated_at: now,
    sync_status: 'pending',
  };

  memoryCache.loans.push(loan);
  setLocal(STORAGE_KEYS.loans, memoryCache.loans);
  persistToIndexedDB('loans', 'put', loan);

  // Automatically record savings transaction if savingsAmount > 0 and not skipped
  if (!data.skipSavingsDeposit && savingsAmount > 0) {
    addSavingsTransaction({
      borrower_id: data.borrower_id,
      loan_id: loanId,
      type: 'deposit_loan',
      amount: savingsAmount,
      date: loan.loan_date,
      notes: `Tabungan otomatis pinjaman baru (${savingsRate}% dari pokok ${principal.toLocaleString('id-ID')})`,
    });
  }

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
  const targetLoan = getLoan(id);
  if (!targetLoan) return false;

  memoryCache.loans = memoryCache.loans.filter((l) => l.id !== id);
  setLocal(STORAGE_KEYS.loans, memoryCache.loans);
  persistToIndexedDB('loans', 'delete', id);

  // Cascade delete payments
  const paymentsToDelete = memoryCache.payments.filter((p) => p.loan_id === id);
  memoryCache.payments = memoryCache.payments.filter((p) => p.loan_id !== id);
  setLocal(STORAGE_KEYS.payments, memoryCache.payments);
  paymentsToDelete.forEach((p) => persistToIndexedDB('payments', 'delete', p.id));

  // Cascade delete savings transactions tied to this loan
  const savingsToDelete = memoryCache.savings.filter((s) => s.loan_id === id);
  memoryCache.savings = memoryCache.savings.filter((s) => s.loan_id !== id);
  setLocal(STORAGE_KEYS.savings, memoryCache.savings);
  savingsToDelete.forEach((s) => persistToIndexedDB('savings_transactions', 'delete', s.id));

  notifyChange();
  return true;
}

// -------------------------------------------------------------
// PAYMENTS CRUD (CASH & SAVINGS)
// -------------------------------------------------------------
export function getPayments(): Payment[] {
  if (!memoryCache.initialized) {
    memoryCache.payments = getLocal<Payment[]>(STORAGE_KEYS.payments, []);
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
  const paymentId = generateId();
  const isSavings = data.is_savings_payment || data.payment_method === 'Tabungan';

  const loan = getLoan(data.loan_id);
  const borrowerId = data.borrower_id || loan?.borrower_id;

  if (isSavings && borrowerId) {
    const summary = getBorrowerSavings(borrowerId);
    if (data.amount > summary.currentBalance) {
      throw new Error(`Saldo tabungan tidak mencukupi. Saldo tersedia: Rp${summary.currentBalance.toLocaleString('id-ID')}`);
    }
  }

  const payment: Payment = {
    ...data,
    id: paymentId,
    borrower_id: borrowerId,
    receipt_no: data.receipt_no || generateReceiptNo(),
    payment_date: data.payment_date || now,
    is_savings_payment: isSavings,
    payment_method: isSavings ? 'Tabungan' : data.payment_method || 'Tunai',
    created_at: now,
    sync_status: 'pending',
  };

  memoryCache.payments.push(payment);
  setLocal(STORAGE_KEYS.payments, memoryCache.payments);
  persistToIndexedDB('payments', 'put', payment);

  // If paid via savings, record savings usage deduction
  if (isSavings && borrowerId) {
    addSavingsTransaction({
      borrower_id: borrowerId,
      loan_id: data.loan_id,
      payment_id: paymentId,
      type: 'payment_usage',
      amount: data.amount,
      date: payment.payment_date,
      notes: `Pembayaran pinjaman menggunakan tabungan (Kuitansi: ${payment.receipt_no})`,
    });
  }

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

  // If this was a savings payment, delete associated savings deduction
  if (payment.is_savings_payment) {
    const relatedSavings = memoryCache.savings.filter((s) => s.payment_id === id);
    memoryCache.savings = memoryCache.savings.filter((s) => s.payment_id !== id);
    setLocal(STORAGE_KEYS.savings, memoryCache.savings);
    relatedSavings.forEach((s) => persistToIndexedDB('savings_transactions', 'delete', s.id));
  }

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
// SAVINGS TRANSACTIONS CRUD
// -------------------------------------------------------------
export function getSavingsTransactions(): SavingsTransaction[] {
  if (!memoryCache.initialized) {
    memoryCache.savings = getLocal<SavingsTransaction[]>(STORAGE_KEYS.savings, []);
  }
  return [...memoryCache.savings];
}

export function getSavingsByBorrower(borrowerId: string): SavingsTransaction[] {
  return getSavingsTransactions()
    .filter((s) => s.borrower_id === borrowerId)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export function getBorrowerSavings(borrowerId: string): BorrowerSavingsSummary {
  const txs = getSavingsByBorrower(borrowerId);
  let totalDeposited = 0;
  let totalUsed = 0;
  let totalWithdrawn = 0;

  for (const t of txs) {
    const amt = Number(t.amount) || 0;
    if (t.type === 'deposit_loan' || (t.type === 'adjustment' && amt > 0)) {
      totalDeposited += amt;
    } else if (t.type === 'payment_usage') {
      totalUsed += amt;
    } else if (t.type === 'withdrawal' || (t.type === 'adjustment' && amt < 0)) {
      totalWithdrawn += Math.abs(amt);
    }
  }

  const currentBalance = Math.max(0, totalDeposited - totalUsed - totalWithdrawn);
  return {
    totalDeposited,
    totalUsed,
    totalWithdrawn,
    currentBalance,
  };
}

export function addSavingsTransaction(
  data: Omit<SavingsTransaction, 'id' | 'created_at'>
): SavingsTransaction {
  // Prevent duplicate automated deposit if loan_id already deposited
  if (data.type === 'deposit_loan' && data.loan_id) {
    const existing = memoryCache.savings.find(
      (s) => s.loan_id === data.loan_id && s.type === 'deposit_loan'
    );
    if (existing) {
      return existing;
    }
  }

  const now = new Date().toISOString();
  const tx: SavingsTransaction = {
    ...data,
    id: generateId(),
    amount: Math.round(Number(data.amount) || 0),
    date: data.date || now,
    created_at: now,
    sync_status: 'pending',
  };

  memoryCache.savings.push(tx);
  setLocal(STORAGE_KEYS.savings, memoryCache.savings);
  persistToIndexedDB('savings_transactions', 'put', tx);
  notifyChange();
  return tx;
}

export function withdrawSavings(
  borrowerId: string,
  amount: number,
  notes?: string
): SavingsTransaction {
  const validAmount = Math.max(0, Math.round(Number(amount) || 0));
  const summary = getBorrowerSavings(borrowerId);

  if (validAmount <= 0) {
    throw new Error('Nominal penarikan tabungan harus lebih dari 0.');
  }

  if (validAmount > summary.currentBalance) {
    throw new Error(`Nominal penarikan (Rp${validAmount.toLocaleString('id-ID')}) melebihi saldo tersedia (Rp${summary.currentBalance.toLocaleString('id-ID')}).`);
  }

  return addSavingsTransaction({
    borrower_id: borrowerId,
    type: 'withdrawal',
    amount: validAmount,
    date: new Date().toISOString(),
    notes: notes || 'Penarikan tabungan peminjam',
  });
}

// -------------------------------------------------------------
// DASHBOARD & STATS
// -------------------------------------------------------------
export function getDashboardStats(): DashboardStats {
  const loans = getLoans();
  const payments = getPayments();
  const borrowers = getBorrowers();
  const savings = getSavingsTransactions();

  const totalPrincipal = loans.reduce((sum, l) => sum + (l.principal_amount || 0), 0);
  const totalInterestFee = loans.reduce((sum, l) => sum + (l.interest_fee || 0), 0);
  const totalDue = loans.reduce((sum, l) => sum + (l.total_due || 0), 0);
  
  // Total payments separated into cash vs savings
  const totalPaidCash = payments
    .filter((p) => !p.is_savings_payment && p.payment_method !== 'Tabungan')
    .reduce((sum, p) => sum + (p.amount || 0), 0);
  
  const totalPaidSavings = payments
    .filter((p) => p.is_savings_payment || p.payment_method === 'Tabungan')
    .reduce((sum, p) => sum + (p.amount || 0), 0);

  const totalPaid = totalPaidCash + totalPaidSavings;
  const totalRemaining = Math.max(0, totalDue - totalPaid);
  const totalBorrowers = borrowers.length;

  const unpaidLoans = loans.filter((l) => l.status === 'belum_lunas').length;
  const paidLoans = loans.filter((l) => l.status === 'lunas').length;

  // Active borrowers with at least 1 unpaid loan
  const borrowerWithUnpaidLoan = new Set(
    loans.filter((l) => l.status === 'belum_lunas').map((l) => l.borrower_id)
  );
  const activeBorrowersCount = borrowerWithUnpaidLoan.size;

  const recoveryRate = totalDue > 0 ? Math.min(100, Math.round((totalPaid / totalDue) * 100)) : 0;

  // Total active savings balance across all borrowers
  let totalSavingsBalance = 0;
  for (const b of borrowers) {
    totalSavingsBalance += getBorrowerSavings(b.id).currentBalance;
  }

  return {
    totalPrincipal,
    totalInterestFee,
    totalDue,
    totalPaid,
    totalPaidCash,
    totalPaidSavings,
    totalSavingsBalance,
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
    version: 3,
    exported_at: new Date().toISOString(),
    data: {
      borrowers: getBorrowers(),
      loans: getLoans(),
      payments: getPayments(),
      savings_transactions: getSavingsTransactions(),
      settings: getAppSettings(),
    },
  };
}

export async function restoreBackup(
  backupData: any,
  mode: 'replace' | 'merge' = 'replace'
): Promise<{ 
  success: boolean; 
  message: string; 
  counts: { borrowers: number; loans: number; payments: number; savings: number } 
}> {
  try {
    if (!backupData || !backupData.data || !Array.isArray(backupData.data.borrowers)) {
      throw new Error('Format file cadangan tidak valid. Data peminjam tidak ditemukan.');
    }

    const newBorrowers: Borrower[] = backupData.data.borrowers || [];
    const newLoans: Loan[] = (backupData.data.loans || []).map(normalizeLoan);
    const newPayments: Payment[] = backupData.data.payments || [];
    const newSavings: SavingsTransaction[] = backupData.data.savings_transactions || [];
    const newSettings: AppSettings = backupData.data.settings || DEFAULT_SETTINGS;

    if (mode === 'replace') {
      memoryCache.borrowers = newBorrowers;
      memoryCache.loans = newLoans;
      memoryCache.payments = newPayments;
      memoryCache.savings = newSavings;
      memoryCache.settings = { ...DEFAULT_SETTINGS, ...newSettings };
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

      const sMap = new Map(memoryCache.savings.map((s) => [s.id, s]));
      newSavings.forEach((s) => sMap.set(s.id, s));
      memoryCache.savings = Array.from(sMap.values());
    }

    setLocal(STORAGE_KEYS.borrowers, memoryCache.borrowers);
    setLocal(STORAGE_KEYS.loans, memoryCache.loans);
    setLocal(STORAGE_KEYS.payments, memoryCache.payments);
    setLocal(STORAGE_KEYS.savings, memoryCache.savings);
    setLocal(STORAGE_KEYS.settings, memoryCache.settings);
    localStorage.setItem(STORAGE_KEYS.initializedFlag, 'true');

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

      const txS = db.transaction('savings_transactions', 'readwrite');
      if (mode === 'replace') await txS.store.clear();
      for (const s of memoryCache.savings) await txS.store.put(s);
      await txS.done;

      await db.put('settings', { key: 'app_settings', value: memoryCache.settings });
    }

    notifyChange();
    return {
      success: true,
      message: 'Data berhasil dipulihkan dengan sukses.',
      counts: {
        borrowers: memoryCache.borrowers.length,
        loans: memoryCache.loans.length,
        payments: memoryCache.payments.length,
        savings: memoryCache.savings.length,
      },
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || 'Gagal memulihkan cadangan.',
      counts: { borrowers: 0, loans: 0, payments: 0, savings: 0 },
    };
  }
}

export async function clearAllData(): Promise<void> {
  memoryCache.borrowers = [];
  memoryCache.loans = [];
  memoryCache.payments = [];
  memoryCache.savings = [];

  setLocal(STORAGE_KEYS.borrowers, []);
  setLocal(STORAGE_KEYS.loans, []);
  setLocal(STORAGE_KEYS.payments, []);
  setLocal(STORAGE_KEYS.savings, []);
  
  // Set flag so demo data is NOT re-seeded automatically after intentional clear
  localStorage.setItem(STORAGE_KEYS.initializedFlag, 'true');

  if (isIndexedDBSupported()) {
    try {
      const db = await getDB();
      await db.clear('borrowers');
      await db.clear('loans');
      await db.clear('payments');
      await db.clear('savings_transactions');
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

  // Loans: Pokok + Bunga Dinamis 20% + Tabungan 5%
  const l1 = addLoan({
    borrower_id: b1.id,
    principal_amount: 1000000,
    interest_rate: 20,
    interest_fee: 200000,
    total_due: 1200000,
    loan_date: '2026-09-01T08:00:00.000Z',
    notes: 'Pinjaman modal usaha',
  });

  const l2 = addLoan({
    borrower_id: b2.id,
    principal_amount: 2000000,
    interest_rate: 20,
    interest_fee: 400000,
    total_due: 2400000,
    loan_date: '2026-09-10T10:30:00.000Z',
    notes: 'Pelunasan peralatan dapur',
  });

  const l3 = addLoan({
    borrower_id: b3.id,
    principal_amount: 5000000,
    interest_rate: 20,
    interest_fee: 1000000,
    total_due: 6000000,
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
    amount: 2400000,
    payment_method: 'Transfer Bank',
    notes: 'Pelunasan penuh',
  });
}
