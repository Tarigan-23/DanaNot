export interface Borrower {
  id: string;
  name: string;
  phone?: string;
  address?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface Loan {
  id: string;
  borrower_id: string;
  principal_amount: number;
  interest_rate: number;
  interest_type: 'once' | 'monthly';
  total_interest: number;
  total_due: number;
  loan_date: string;
  due_date?: string;
  notes?: string;
  status: 'lunas' | 'belum_lunas';
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: string;
  loan_id: string;
  payment_date: string;
  amount: number;
  payment_method?: string;
  notes?: string;
  created_at: string;
}

export interface LoanWithBorrower extends Loan {
  borrower_name: string;
  total_paid: number;
  remaining: number;
}

export interface DashboardStats {
  totalPrincipal: number;
  totalDue: number;
  totalPaid: number;
  totalRemaining: number;
  totalBorrowers: number;
  unpaidLoans: number;
}
