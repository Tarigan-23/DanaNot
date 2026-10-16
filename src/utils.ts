import { Loan, DatabaseBackup } from './types';

/**
 * Format currency as IDR (Rp)
 */
export function formatCurrency(amount: number): string {
  if (isNaN(amount) || amount === null || amount === undefined) return 'Rp 0';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(amount));
}

/**
 * Format Date to Indonesian localized format (e.g. 11 Okt 2026)
 */
export function formatDate(dateStr?: string): string {
  if (!dateStr) return '-';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

/**
 * Format Date & Time with minutes (e.g. 11 Okt 2026, 14:30)
 */
export function formatDateTime(dateStr?: string): string {
  if (!dateStr) return '-';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

/**
 * Get current ISO date YYYY-MM-DD
 */
export function getTodayISO(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get current ISO Timestamp (Full ISO with time)
 */
export function getNowISO(): string {
  return new Date().toISOString();
}

/**
 * Generate unique crypto or timestamp ID
 */
export function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'dn_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}

/**
 * Generate official receipt number
 */
export function generateReceiptNo(): string {
  const d = new Date();
  const datePart = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `KWT-${datePart}-${rand}`;
}

/**
 * Calculate loan: Nominal bunga = pokok * (persentase / 100), Total Tagihan = Pokok + Nominal Bunga
 */
export function calculateLoan(
  principal: number,
  interestRateOrFee: number = 20,
  isRate: boolean = true
): {
  principal: number;
  interestRate: number;
  interestFee: number;
  totalDue: number;
} {
  const validPrincipal = Math.max(0, Math.round(Number(principal) || 0));
  if (isRate) {
    const rate = Math.max(0, Number(interestRateOrFee) || 0);
    const fee = Math.round((validPrincipal * rate) / 100);
    const totalDue = validPrincipal + fee;
    return {
      principal: validPrincipal,
      interestRate: rate,
      interestFee: fee,
      totalDue,
    };
  } else {
    const fee = Math.max(0, Math.round(Number(interestRateOrFee) || 0));
    const rate = validPrincipal > 0 ? (fee / validPrincipal) * 100 : 0;
    const totalDue = validPrincipal + fee;
    return {
      principal: validPrincipal,
      interestRate: Math.round(rate * 100) / 100,
      interestFee: fee,
      totalDue,
    };
  }
}

/**
 * Calculate automatic savings addition from principal amount
 */
export function calculateSavingsDeposit(principal: number, savingsRate: number = 5): number {
  const validPrincipal = Math.max(0, Math.round(Number(principal) || 0));
  const rate = Math.max(0, Number(savingsRate) || 0);
  return Math.round((validPrincipal * rate) / 100);
}

/**
 * Calculate remaining balance
 */
export function calculateRemaining(totalDue: number, totalPaid: number): number {
  return Math.max(0, totalDue - totalPaid);
}

/**
 * Generate WhatsApp reminder message & link (No due date, straightforward debt update)
 */
export function generateWhatsAppReminder(
  borrowerName: string,
  phone: string | undefined,
  loan: { principal_amount: number; interest_fee?: number; total_due: number; loan_date: string },
  totalPaid: number,
  remaining: number
): { url: string; text: string } {
  if (!phone) return { url: '', text: '' };

  let cleanPhone = phone.replace(/[^0-9]/g, '');
  if (cleanPhone.startsWith('0')) {
    cleanPhone = '62' + cleanPhone.slice(1);
  } else if (!cleanPhone.startsWith('62')) {
    cleanPhone = '62' + cleanPhone;
  }

  const fee = loan.interest_fee ?? ((loan as any).total_interest || 0);

  const message =
    `Halo Bapak/Ibu *${borrowerName}*,\n\n` +
    `Berikut rincian catatan pinjaman Anda di *DanaNote*:\n` +
    `📅 Tanggal Pinjam: ${formatDate(loan.loan_date)}\n` +
    `💰 Pinjaman Pokok: ${formatCurrency(loan.principal_amount)}\n` +
    `🏷️ Jasa Pinjam: ${formatCurrency(fee)}\n` +
    `📋 Total Tagihan: ${formatCurrency(loan.total_due)}\n` +
    `✅ Total Sudah Dibayar: ${formatCurrency(totalPaid)}\n` +
    `⚠️ *Sisa Tagihan: ${formatCurrency(remaining)}*\n\n` +
    `Mohon konfirmasi jika telah melakukan pembayaran. Terima kasih! 🙏`;

  const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
  return { url, text: message };
}

/**
 * Export data to CSV
 */
export function exportToCSV(data: Record<string, any>[], filename: string): void {
  if (!data || data.length === 0) return;
  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map((row) =>
      headers
        .map((h) => {
          const val = row[h];
          if (typeof val === 'string') {
            const escaped = val.replace(/"/g, '""');
            return `"${escaped}"`;
          }
          return val ?? '';
        })
        .join(',')
    ),
  ].join('\r\n');

  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}_${getTodayISO()}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

/**
 * Export full database to JSON file
 */
export function exportToJSONFile(backup: DatabaseBackup, filename: string): void {
  const jsonStr = JSON.stringify(backup, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}_${getTodayISO()}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}
