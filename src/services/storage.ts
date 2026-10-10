import { Borrower, Loan, Payment } from '../types';
import { generateId } from '../utils';

const KEYS = {
  borrowers: 'dananote_borrowers',
  loans: 'dananote_loans',
  payments: 'dananote_payments',
  theme: 'dananote_theme',
};

function get<T>(key: string): T[] {
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : [];
}

function set<T>(key: string, data: T[]): void {
  localStorage.setItem(key, JSON.stringify(data));
}

// Borrowers
export function getBorrowers(): Borrower[] {
  return get<Borrower>(KEYS.borrowers);
}

export function getBorrower(id: string): Borrower | undefined {
  return getBorrowers().find(b => b.id === id);
}

export function addBorrower(data: Omit<Borrower, 'id' | 'created_at' | 'updated_at'>): Borrower {
  const borrowers = getBorrowers();
  const now = new Date().toISOString();
  const borrower: Borrower = {
    ...data,
    id: generateId(),
    created_at: now,
    updated_at: now,
  };
  borrowers.push(borrower);
  set(KEYS.borrowers, borrowers);
  return borrower;
}

export function updateBorrower(id: string, data: Partial<Omit<Borrower, 'id' | 'created_at'>>): Borrower | null {
  const borrowers = getBorrowers();
  const idx = borrowers.findIndex(b => b.id === id);
  if (idx === -1) return null;
  borrowers[idx] = { ...borrowers[idx], ...data, updated_at: new Date().toISOString() };
  set(KEYS.borrowers, borrowers);
  return borrowers[idx];
}

export function deleteBorrower(id: string): boolean {
  const borrowers = getBorrowers().filter(b => b.id !== id);
  set(KEYS.borrowers, borrowers);
  // Also delete related loans and payments
  const loans = getLoans().filter(l => l.borrower_id !== id);
  set(KEYS.loans, loans);
  const loanIds = getLoans().map(l => l.id);
  const payments = getPayments().filter(p => loanIds.includes(p.loan_id));
  set(KEYS.payments, payments);
  return true;
}

// Loans
export function getLoans(): Loan[] {
  return get<Loan>(KEYS.loans);
}

export function getLoansByBorrower(borrowerId: string): Loan[] {
  return getLoans().filter(l => l.borrower_id === borrowerId);
}

export function getLoan(id: string): Loan | undefined {
  return getLoans().find(l => l.id === id);
}

export function addLoan(data: Omit<Loan, 'id' | 'created_at' | 'updated_at' | 'status'>): Loan {
  const loans = getLoans();
  const now = new Date().toISOString();
  const loan: Loan = {
    ...data,
    id: generateId(),
    status: 'belum_lunas',
    created_at: now,
    updated_at: now,
  };
  loans.push(loan);
  set(KEYS.loans, loans);
  return loan;
}

export function updateLoan(id: string, data: Partial<Omit<Loan, 'id' | 'created_at'>>): Loan | null {
  const loans = getLoans();
  const idx = loans.findIndex(l => l.id === id);
  if (idx === -1) return null;
  loans[idx] = { ...loans[idx], ...data, updated_at: new Date().toISOString() };
  set(KEYS.loans, loans);
  return loans[idx];
}

export function deleteLoan(id: string): boolean {
  const loans = getLoans().filter(l => l.id !== id);
  set(KEYS.loans, loans);
  const payments = getPayments().filter(p => p.loan_id !== id);
  set(KEYS.payments, payments);
  return true;
}

// Payments
export function getPayments(): Payment[] {
  return get<Payment>(KEYS.payments);
}

export function getPaymentsByLoan(loanId: string): Payment[] {
  return getPayments().filter(p => p.loan_id === loanId).sort((a, b) => 
    new Date(a.payment_date).getTime() - new Date(b.payment_date).getTime()
  );
}

export function getTotalPaidForLoan(loanId: string): number {
  return getPaymentsByLoan(loanId).reduce((sum, p) => sum + p.amount, 0);
}

export function addPayment(data: Omit<Payment, 'id' | 'created_at'>): Payment {
  const payments = getPayments();
  const payment: Payment = {
    ...data,
    id: generateId(),
    created_at: new Date().toISOString(),
  };
  payments.push(payment);
  set(KEYS.payments, payments);
  
  // Update loan status
  const loan = getLoan(data.loan_id);
  if (loan) {
    const totalPaid = getTotalPaidForLoan(data.loan_id);
    const newStatus = totalPaid >= loan.total_due ? 'lunas' : 'belum_lunas';
    updateLoan(data.loan_id, { status: newStatus });
  }
  
  return payment;
}

export function deletePayment(id: string): boolean {
  const payment = getPayments().find(p => p.id === id);
  if (!payment) return false;
  
  const payments = getPayments().filter(p => p.id !== id);
  set(KEYS.payments, payments);
  
  // Recalculate loan status
  const loan = getLoan(payment.loan_id);
  if (loan) {
    const totalPaid = getTotalPaidForLoan(payment.loan_id);
    const newStatus = totalPaid >= loan.total_due ? 'lunas' : 'belum_lunas';
    updateLoan(payment.loan_id, { status: newStatus });
  }
  
  return true;
}

// Seed demo data
export function seedDemoData(): void {
  if (getBorrowers().length > 0) return; // Don't seed if data exists
  
  const now = new Date().toISOString();
  
  // Create borrowers
  const b1 = addBorrower({ name: 'Ahmad Sudirman', phone: '081234567890', address: 'Jl. Merdeka No. 10, Jakarta', notes: 'Pelanggan tetap' });
  const b2 = addBorrower({ name: 'Siti Rahayu', phone: '082345678901', address: 'Jl. Sudirman No. 25, Bandung', notes: '' });
  const b3 = addBorrower({ name: 'Budi Santoso', phone: '083456789012', address: 'Jl. Gatot Subroto No. 5, Surabaya', notes: 'Teman kantor' });
  const b4 = addBorrower({ name: 'Dewi Lestari', phone: '', address: 'Jl. Diponegoro No. 15, Yogyakarta', notes: '' });
  const b5 = addBorrower({ name: 'Rudi Hermawan', phone: '085678901234', address: 'Jl. Ahmad Yani No. 8, Semarang', notes: '' });

  // Create loans
  const l1 = addLoan({ borrower_id: b1.id, principal_amount: 5000000, interest_rate: 10, interest_type: 'once', total_interest: 500000, total_due: 5500000, loan_date: '2024-01-15', due_date: '2024-07-15', notes: '' });
  const l2 = addLoan({ borrower_id: b2.id, principal_amount: 2000000, interest_rate: 5, interest_type: 'once', total_interest: 100000, total_due: 2100000, loan_date: '2024-03-01', due_date: '2024-09-01', notes: '' });
  const l3 = addLoan({ borrower_id: b3.id, principal_amount: 10000000, interest_rate: 15, interest_type: 'once', total_interest: 1500000, total_due: 11500000, loan_date: '2024-02-10', due_date: '2024-05-10', notes: 'Pinjaman usaha' });
  const l4 = addLoan({ borrower_id: b4.id, principal_amount: 1000000, interest_rate: 8, interest_type: 'once', total_interest: 80000, total_due: 1080000, loan_date: '2024-04-01', due_date: '2024-10-01', notes: '' });
  const l5 = addLoan({ borrower_id: b1.id, principal_amount: 3000000, interest_rate: 12, interest_type: 'once', total_interest: 360000, total_due: 3360000, loan_date: '2024-05-01', due_date: '2024-11-01', notes: 'Pinjaman kedua' });

  // Create payments
  addPayment({ loan_id: l1.id, payment_date: '2024-02-15', amount: 1000000, payment_method: 'Transfer Bank', notes: 'Cicilan 1' });
  addPayment({ loan_id: l1.id, payment_date: '2024-03-15', amount: 1000000, payment_method: 'Transfer Bank', notes: 'Cicilan 2' });
  addPayment({ loan_id: l1.id, payment_date: '2024-04-15', amount: 1500000, payment_method: 'Tunai', notes: 'Cicilan 3' });
  
  addPayment({ loan_id: l2.id, payment_date: '2024-04-01', amount: 2100000, payment_method: 'Transfer Bank', notes: 'Pelunasan' });
  
  addPayment({ loan_id: l3.id, payment_date: '2024-03-10', amount: 3000000, payment_method: 'Transfer Bank', notes: 'Cicilan 1' });
  addPayment({ loan_id: l3.id, payment_date: '2024-04-10', amount: 3000000, payment_method: 'Transfer Bank', notes: 'Cicilan 2' });
  
  addPayment({ loan_id: l5.id, payment_date: '2024-06-01', amount: 1000000, payment_method: 'Tunai', notes: 'Cicilan 1' });
}

// Theme
export function getTheme(): 'light' | 'dark' {
  return (localStorage.getItem(KEYS.theme) as 'light' | 'dark') || 'light';
}

export function setTheme(theme: 'light' | 'dark'): void {
  localStorage.setItem(KEYS.theme, theme);
}

// Dashboard stats
export function getDashboardStats() {
  const loans = getLoans();
  const payments = getPayments();
  
  const totalPrincipal = loans.reduce((sum, l) => sum + l.principal_amount, 0);
  const totalDue = loans.reduce((sum, l) => sum + l.total_due, 0);
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  const totalRemaining = totalDue - totalPaid;
  const totalBorrowers = getBorrowers().length;
  const unpaidLoans = loans.filter(l => l.status === 'belum_lunas').length;
  
  return { totalPrincipal, totalDue, totalPaid, totalRemaining, totalBorrowers, unpaidLoans };
}

// Recent activity
export function getRecentPayments(limit: number = 5): (Payment & { loan?: Loan; borrower_name?: string })[] {
  const payments = getPayments()
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, limit);
  
  return payments.map(p => {
    const loan = getLoan(p.loan_id);
    const borrower = loan ? getBorrower(loan.borrower_id) : undefined;
    return { ...p, loan, borrower_name: borrower?.name };
  });
}

export function getRecentLoans(limit: number = 5): (Loan & { borrower_name?: string })[] {
  const loans = getLoans()
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, limit);
  
  return loans.map(l => {
    const borrower = getBorrower(l.borrower_id);
    return { ...l, borrower_name: borrower?.name };
  });
}

export function getOverdueLoans(): (Loan & { borrower_name?: string })[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  return getLoans()
    .filter(l => {
      if (l.status === 'lunas' || !l.due_date) return false;
      const due = new Date(l.due_date);
      due.setHours(0, 0, 0, 0);
      return due < today;
    })
    .map(l => {
      const borrower = getBorrower(l.borrower_id);
      return { ...l, borrower_name: borrower?.name };
    });
}
