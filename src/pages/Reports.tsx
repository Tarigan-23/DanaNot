import { useState } from 'react';
import { Download, Printer, FileText, Filter } from 'lucide-react';
import { formatCurrency, formatDate, exportToCSV } from '../utils';
import { getLoans, getBorrower, getPayments, getLoan, getTotalPaidForLoan } from '../services/storage';

type ReportType = 'all' | 'unpaid' | 'paid' | 'payments';

export default function Reports() {
  const [reportType, setReportType] = useState<ReportType>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const loans = getLoans();
  const payments = getPayments();

  const getFilteredLoans = () => {
    let filtered = loans.map(l => {
      const borrower = getBorrower(l.borrower_id);
      const totalPaid = getTotalPaidForLoan(l.id);
      return { ...l, borrower_name: borrower?.name || '-', total_paid: totalPaid, remaining: Math.max(0, l.total_due - totalPaid) };
    });

    if (reportType === 'unpaid') filtered = filtered.filter(l => l.status === 'belum_lunas');
    if (reportType === 'paid') filtered = filtered.filter(l => l.status === 'lunas');

    if (dateFrom) filtered = filtered.filter(l => l.loan_date >= dateFrom);
    if (dateTo) filtered = filtered.filter(l => l.loan_date <= dateTo);

    return filtered;
  };

  const getFilteredPayments = () => {
    let filtered = payments.map(p => {
      const loan = getLoan(p.loan_id);
      const borrower = loan ? getBorrower(loan.borrower_id) : undefined;
      return { ...p, borrower_name: borrower?.name || '-', loan_date: loan?.loan_date || '' };
    });

    if (dateFrom) filtered = filtered.filter(p => p.payment_date >= dateFrom);
    if (dateTo) filtered = filtered.filter(p => p.payment_date <= dateTo);

    return filtered.sort((a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime());
  };

  const filteredLoans = getFilteredLoans();
  const filteredPayments = getFilteredPayments();

  const totalPrincipal = filteredLoans.reduce((s, l) => s + l.principal_amount, 0);
  const totalDue = filteredLoans.reduce((s, l) => s + l.total_due, 0);
  const totalPaid = reportType === 'payments' 
    ? filteredPayments.reduce((s, p) => s + p.amount, 0)
    : filteredLoans.reduce((s, l) => s + l.total_paid, 0);
  const totalRemaining = totalDue - totalPaid;

  const handleExportCSV = () => {
    if (reportType === 'payments') {
      const data = filteredPayments.map(p => ({
        'Tanggal': formatDate(p.payment_date),
        'Peminjam': p.borrower_name,
        'Jumlah': p.amount,
        'Metode': p.payment_method || '-',
        'Catatan': p.notes || '-',
      }));
      exportToCSV(data, `laporan_pembayaran_dananote`);
    } else {
      const data = filteredLoans.map(l => ({
        'Peminjam': l.borrower_name,
        'Tanggal': formatDate(l.loan_date),
        'Pokok': l.principal_amount,
        'Bunga (%)': l.interest_rate,
        'Total Tagihan': l.total_due,
        'Total Dibayar': l.total_paid,
        'Sisa': l.remaining,
        'Status': l.status === 'lunas' ? 'Lunas' : 'Belum Lunas',
      }));
      exportToCSV(data, `laporan_pinjaman_dananote`);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Laporan</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Rekap dan ekspor data peminjaman</p>
        </div>
        <div className="flex gap-2 no-print">
          <button onClick={handleExportCSV} className="btn-secondary flex items-center gap-2 text-sm">
            <Download className="w-4 h-4" /> Ekspor CSV
          </button>
          <button onClick={handlePrint} className="btn-primary flex items-center gap-2 text-sm">
            <Printer className="w-4 h-4" /> Cetak
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4 no-print">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-emerald-600" />
          <span className="text-sm font-medium">Filter Laporan</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <select value={reportType} onChange={e => setReportType(e.target.value as ReportType)} className="input-field">
            <option value="all">Semua Pinjaman</option>
            <option value="unpaid">Belum Lunas</option>
            <option value="paid">Sudah Lunas</option>
            <option value="payments">Riwayat Pembayaran</option>
          </select>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Dari Tanggal</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="input-field" />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Sampai Tanggal</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="input-field" />
          </div>
          <button onClick={() => { setReportType('all'); setDateFrom(''); setDateTo(''); }} className="btn-secondary text-sm mt-auto">
            Reset Filter
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4">
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Total Pokok</p>
          <p className="text-lg font-bold mt-1">{formatCurrency(totalPrincipal)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Total Tagihan</p>
          <p className="text-lg font-bold mt-1">{formatCurrency(totalDue)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Total Dibayar</p>
          <p className="text-lg font-bold mt-1 text-emerald-600">{formatCurrency(totalPaid)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Sisa Tunggakan</p>
          <p className="text-lg font-bold mt-1 text-red-600">{formatCurrency(Math.max(0, totalRemaining))}</p>
        </div>
      </div>

      {/* Report Content */}
      {reportType === 'payments' ? (
        <div className="card overflow-hidden">
          <div className="p-4 border-b" style={{ borderColor: 'var(--border-color)' }}>
            <h3 className="font-semibold flex items-center gap-2">
              <FileText className="w-4 h-4 text-emerald-600" /> Riwayat Pembayaran
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b" style={{ borderColor: 'var(--border-color)' }}>
                  <th className="text-left p-3 font-medium" style={{ color: 'var(--text-secondary)' }}>Tanggal</th>
                  <th className="text-left p-3 font-medium" style={{ color: 'var(--text-secondary)' }}>Peminjam</th>
                  <th className="text-right p-3 font-medium" style={{ color: 'var(--text-secondary)' }}>Jumlah</th>
                  <th className="text-left p-3 font-medium" style={{ color: 'var(--text-secondary)' }}>Metode</th>
                  <th className="text-left p-3 font-medium" style={{ color: 'var(--text-secondary)' }}>Catatan</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayments.length === 0 ? (
                  <tr><td colSpan={5} className="p-8 text-center" style={{ color: 'var(--text-secondary)' }}>Tidak ada data</td></tr>
                ) : (
                  filteredPayments.map(p => (
                    <tr key={p.id} className="table-row">
                      <td className="p-3">{formatDate(p.payment_date)}</td>
                      <td className="p-3 font-medium">{p.borrower_name}</td>
                      <td className="p-3 text-right font-semibold text-emerald-600">{formatCurrency(p.amount)}</td>
                      <td className="p-3">{p.payment_method || '-'}</td>
                      <td className="p-3">{p.notes || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="p-4 border-b" style={{ borderColor: 'var(--border-color)' }}>
            <h3 className="font-semibold flex items-center gap-2">
              <FileText className="w-4 h-4 text-emerald-600" /> 
              {reportType === 'all' ? 'Semua Pinjaman' : reportType === 'unpaid' ? 'Pinjaman Belum Lunas' : 'Pinjaman Lunas'}
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b" style={{ borderColor: 'var(--border-color)' }}>
                  <th className="text-left p-3 font-medium" style={{ color: 'var(--text-secondary)' }}>Peminjam</th>
                  <th className="text-left p-3 font-medium" style={{ color: 'var(--text-secondary)' }}>Tanggal</th>
                  <th className="text-right p-3 font-medium" style={{ color: 'var(--text-secondary)' }}>Pokok</th>
                  <th className="text-right p-3 font-medium" style={{ color: 'var(--text-secondary)' }}>Tagihan</th>
                  <th className="text-right p-3 font-medium" style={{ color: 'var(--text-secondary)' }}>Dibayar</th>
                  <th className="text-right p-3 font-medium" style={{ color: 'var(--text-secondary)' }}>Sisa</th>
                  <th className="text-center p-3 font-medium" style={{ color: 'var(--text-secondary)' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredLoans.length === 0 ? (
                  <tr><td colSpan={7} className="p-8 text-center" style={{ color: 'var(--text-secondary)' }}>Tidak ada data</td></tr>
                ) : (
                  filteredLoans.map(l => (
                    <tr key={l.id} className="table-row">
                      <td className="p-3 font-medium">{l.borrower_name}</td>
                      <td className="p-3">{formatDate(l.loan_date)}</td>
                      <td className="p-3 text-right">{formatCurrency(l.principal_amount)}</td>
                      <td className="p-3 text-right">{formatCurrency(l.total_due)}</td>
                      <td className="p-3 text-right text-emerald-600">{formatCurrency(l.total_paid)}</td>
                      <td className="p-3 text-right font-medium">{formatCurrency(l.remaining)}</td>
                      <td className="p-3 text-center">
                        <span className={`badge ${l.status === 'lunas' ? 'badge-success' : 'badge-warning'}`}>
                          {l.status === 'lunas' ? 'Lunas' : 'Belum Lunas'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
