export type LoanStatus = 'lunas' | 'belum_lunas';
export type PaymentMethod = 'Tunai' | 'Transfer Bank' | 'E-Wallet' | 'Lainnya';
export type SyncStatus = 'synced' | 'pending' | 'failed';

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
  interest_fee: number; // Jasa Pinjam dalam Rupiah (nominal tetap)
  total_due: number; // Pokok + Jasa Pinjam
  loan_date: string; // Tanggal & waktu otomatis transaksi pinjaman
  notes?: string;
  status: LoanStatus;
  created_at: string;
  updated_at: string;
  sync_status?: SyncStatus;
  // Legacy optional fields for backward compatibility
  interest_rate?: number;
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
  notes?: string;
  created_at: string;
  sync_status?: SyncStatus;
}

export interface LoanWithBorrower extends Loan {
  borrower_name: string;
  borrower_phone?: string;
  borrower_address?: string;
  total_paid: number;
  remaining: number;
  payments_count?: number;
}

export interface DashboardStats {
  totalPrincipal: number;
  totalInterestFee: number;
  totalDue: number;
  totalPaid: number;
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
