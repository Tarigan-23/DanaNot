export type LoanStatus = 'lunas' | 'belum_lunas';
export type PaymentMethod = 'Tunai' | 'Transfer Bank' | 'E-Wallet' | 'Tabungan' | 'Lainnya';
export type SyncStatus = 'synced' | 'pending' | 'failed';

export type SavingsTransactionType = 'deposit_loan' | 'payment_usage' | 'withdrawal' | 'adjustment';

export interface SavingsTransaction {
  id: string;
  borrower_id: string;
  loan_id?: string;
  payment_id?: string;
  type: SavingsTransactionType;
  amount: number;
  date: string;
  notes?: string;
  created_at: string;
  sync_status?: SyncStatus;
}

export interface BorrowerSavingsSummary {
  totalDeposited: number;
  totalUsed: number;
  totalWithdrawn: number;
  currentBalance: number;
}

export interface Borrower {
  id: string;
  name: string;
  phone?: string;
  address?: string;
  nik_identity?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  sync_status?: SyncStatus;
}

export interface Loan {
  id: string;
  borrower_id: string;
  principal_amount: number;
  interest_rate: number; // Persentase bunga snapshot saat pinjaman dibuat (default 20%)
  interest_fee: number; // Jasa Pinjam dalam Rupiah = pokok * (bunga / 100)
  total_due: number; // Pokok + Jasa Pinjam
  loan_date: string; // Tanggal & waktu otomatis transaksi pinjaman
  notes?: string;
  status: LoanStatus;
  savings_deposit_rate?: number; // Persentase tabungan snapshot (default 5%)
  savings_deposit_amount?: number; // Nominal tabungan yang diberikan otomatis
  created_at: string;
  updated_at: string;
  sync_status?: SyncStatus;
  // Legacy optional fields for backward compatibility
  interest_type?: string;
  tenor_months?: number;
  due_date?: string;
  total_interest?: number;
}

export interface Payment {
  id: string;
  loan_id: string;
  borrower_id?: string;
  receipt_no?: string;
  payment_date: string; // Tanggal & waktu otomatis transaksi pembayaran
  amount: number;
  payment_method?: PaymentMethod | string;
  is_savings_payment?: boolean; // Penanda pembayaran menggunakan saldo tabungan
  notes?: string;
  created_at: string;
  sync_status?: SyncStatus;
}

export interface LoanWithBorrower extends Loan {
  borrower_name: string;
  borrower_phone?: string;
  borrower_address?: string;
  total_paid: number;
  total_paid_cash: number;
  total_paid_savings: number;
  remaining: number;
  payments_count?: number;
}

export interface AppSettings {
  defaultInterestRate: number; // default 20%
  defaultSavingsRate: number; // default 5%
  appName?: string;
  updated_at?: string;
}

export interface DashboardStats {
  totalPrincipal: number;
  totalInterestFee: number;
  totalDue: number;
  totalPaid: number;
  totalPaidCash: number;
  totalPaidSavings: number;
  totalSavingsBalance: number;
  totalRemaining: number;
  totalBorrowers: number;
  activeBorrowersCount: number;
  unpaidLoans: number;
  paidLoans: number;
  recoveryRate: number;
}

export interface DatabaseBackup {
  app: 'DanaNote';
  version: number;
  exported_at: string;
  data: {
    borrowers: Borrower[];
    loans: Loan[];
    payments: Payment[];
    savings_transactions?: SavingsTransaction[];
    settings?: AppSettings;
  };
  checksum?: string;
}

export interface CloudSyncConfig {
  enabled: boolean;
  supabaseUrl: string;
  supabaseAnonKey: string;
  autoSync: boolean;
  lastSyncedAt?: string;
  userId?: string;
}

