import { useState, useEffect } from 'react';
import { 
  Download, Printer, FileText, Filter, RotateCcw, 
  BarChart3, PieChart as PieIcon, Calendar, PiggyBank,
  TrendingUp, Users, CheckCircle2, Clock
} from 'lucide-react';
import { 
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, 
  Tooltip, Legend, PieChart, Pie, Cell 
} from 'recharts';
import { formatCurrency, formatDate, exportToCSV } from '../utils';
import { 
  getLoans, getBorrower, getPayments, getLoan, 
  getTotalPaidForLoan, getSavingsTransactions, getBorrowers,
  subscribeDataChanges 
} from '../services/storage';

type PeriodMode = 'all' | 'daily' | 'monthly' | 'custom';
type ReportType = 'all' | 'unpaid' | 'paid' | 'payments' | 'savings';

export default function Reports() {
  const [periodMode, setPeriodMode] = useState<PeriodMode>('all');
  const [reportType, setReportType] = useState<ReportType>('all');

  // Date filters
  const [singleDate, setSingleDate] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(''); // Format: YYYY-MM
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Data states
  const [loans, setLoans] = useState(getLoans());
  const [payments, setPayments] = useState(getPayments());
  const [savingsTxs, setSavingsTxs] = useState(getSavingsTransactions());
  const [borrowers, setBorrowers] = useState(getBorrowers());

  const refreshData = () => {
    setLoans(getLoans());
    setPayments(getPayments());
    setSavingsTxs(getSavingsTransactions());
    setBorrowers(getBorrowers());
  };

  useEffect(() => {
    refreshData();
    const unsub = subscribeDataChanges(refreshData);
    return () => unsub();
  }, []);

  const resetFilters = () => {
    setPeriodMode('all');
    setReportType('all');
    setSingleDate('');
    setSelectedMonth('');
    setDateFrom('');
    setDateTo('');
  };

  // Helper date checking in local timezone format (YYYY-MM-DD)
  const isDateInSelectedPeriod = (isoDateStr?: string): boolean => {
    if (!isoDateStr) return false;
    const dateObj = new Date(isoDateStr);
    if (isNaN(dateObj.getTime())) return false;

    // Local YYYY-MM-DD
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    const localDateStr = `${year}-${month}-${day}`;
    const localMonthStr = `${year}-${month}`;

    if (periodMode === 'daily') {
      if (!singleDate) return true;
      return localDateStr === singleDate;
    }

    if (periodMode === 'monthly') {
      if (!selectedMonth) return true;
      return localMonthStr === selectedMonth;
    }

    if (periodMode === 'custom') {
      if (dateFrom && localDateStr < dateFrom) return false;
      if (dateTo && localDateStr > dateTo) return false;
      return true;
    }

    return true; // 'all'
  };

  // 1. Filtered Loans
  const filteredLoans = loans
    .filter((l) => isDateInSelectedPeriod(l.loan_date))
    .map((l) => {
      const borrower = getBorrower(l.borrower_id);
      const totalPaid = getTotalPaidForLoan(l.id);
      return {
        ...l,
        borrower_name: borrower?.name || '-',
        borrower_phone: borrower?.phone,
        total_paid: totalPaid,
        remaining: Math.max(0, l.total_due - totalPaid),
      };
    })
    .filter((l) => {
      if (reportType === 'unpaid') return l.status === 'belum_lunas';
      if (reportType === 'paid') return l.status === 'lunas';
      return true;
    });

  // 2. Filtered Payments
  const filteredPayments = payments
    .filter((p) => isDateInSelectedPeriod(p.payment_date))
    .map((p) => {
      const loan = getLoan(p.loan_id);
      const borrower = loan ? getBorrower(loan.borrower_id) : undefined;
      return {
        ...p,
        borrower_name: borrower?.name || '-',
        loan_date: loan?.loan_date || '',
      };
    })
    .sort((a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime());

  // 3. Filtered Savings Transactions
  const filteredSavings = savingsTxs
    .filter((s) => isDateInSelectedPeriod(s.date))
    .map((s) => {
      const borrower = getBorrower(s.borrower_id);
      return {
        ...s,
        borrower_name: borrower?.name || '-',
      };
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // 4. Filtered New Borrowers registered in this period
  const filteredBorrowersCount = borrowers.filter((b) => isDateInSelectedPeriod(b.created_at)).length;

  // Aggregate Metrics for this period
  const totalPrincipal = filteredLoans.reduce((s, l) => s + (l.principal_amount || 0), 0);
  const totalInterestFee = filteredLoans.reduce((s, l) => s + (l.interest_fee || 0), 0);
  const totalDue = filteredLoans.reduce((s, l) => s + (l.total_due || 0), 0);

  // Separate cash vs savings payments received in this period
  const totalPaidCash = filteredPayments
    .filter((p) => !p.is_savings_payment && p.payment_method !== 'Tabungan')
    .reduce((s, p) => s + (p.amount || 0), 0);

  const totalPaidSavings = filteredPayments
    .filter((p) => p.is_savings_payment || p.payment_method === 'Tabungan')
    .reduce((s, p) => s + (p.amount || 0), 0);

  const totalPaidAll = totalPaidCash + totalPaidSavings;

  // Savings deposits added vs used in this period
  const totalSavingsAdded = filteredSavings
    .filter((s) => s.type === 'deposit_loan' || (s.type === 'adjustment' && s.amount > 0))
    .reduce((s, x) => s + x.amount, 0);

  const totalSavingsUsed = filteredSavings
    .filter((s) => s.type === 'payment_usage')
    .reduce((s, x) => s + x.amount, 0);

  const totalSavingsWithdrawn = filteredSavings
    .filter((s) => s.type === 'withdrawal')
    .reduce((s, x) => s + x.amount, 0);

  const totalRemaining = Math.max(0, totalDue - totalPaidAll);
  const totalUnpaidLoansCount = filteredLoans.filter((l) => l.status === 'belum_lunas').length;
  const totalPaidLoansCount = filteredLoans.filter((l) => l.status === 'lunas').length;

  // Chart Data
  const overviewChartData = [
    { name: 'Pokok', amount: totalPrincipal, fill: '#3b82f6' },
    { name: 'Bunga', amount: totalInterestFee, fill: '#a855f7' },
    { name: 'Bayar Tunai', amount: totalPaidCash, fill: '#10b981' },
    { name: 'Bayar Tabungan', amount: totalPaidSavings, fill: '#8b5cf6' },
  ];

  const pieChartData = [
    { name: 'Bayar Tunai', value: totalPaidCash, color: '#10b981' },
    { name: 'Bayar Tabungan', value: totalPaidSavings, color: '#8b5cf6' },
    { name: 'Sisa Tagihan', value: totalRemaining, color: '#ef4444' },
  ].filter((d) => d.value > 0);

  const handleExportCSV = () => {
    if (reportType === 'payments') {
      const data = filteredPayments.map((p) => ({
        'No. Kuitansi': p.receipt_no || '-',
        'Tanggal Pembayaran': formatDate(p.payment_date),
        'Nama Peminjam': p.borrower_name,
        'Nominal Masuk (Rp)': p.amount,
        'Metode Pembayaran': p.is_savings_payment ? 'Tabungan' : p.payment_method || 'Tunai',
        'Kategori': p.is_savings_payment ? 'Potong Saldo Tabungan' : 'Kas Masuk',
        'Catatan': p.notes || '-',
      }));
      exportToCSV(data, 'laporan_riwayat_pembayaran_dananote');
    } else if (reportType === 'savings') {
      const data = filteredSavings.map((s) => ({
        'Tanggal': formatDate(s.date),
        'Nama Peminjam': s.borrower_name,
        'Jenis Mutasi': s.type === 'deposit_loan' ? 'Tambahan Otomatis Pinjaman' : s.type === 'payment_usage' ? 'Gunakan Bayar Tagihan' : 'Penarikan',
        'Nominal (Rp)': s.amount,
        'Catatan': s.notes || '-',
      }));
      exportToCSV(data, 'laporan_mutasi_tabungan_dananote');
    } else {
      const data = filteredLoans.map((l) => ({
        'Nama Peminjam': l.borrower_name,
        'Tanggal Pinjam': formatDate(l.loan_date),
        'Pokok Pinjaman (Rp)': l.principal_amount,
        'Persentase Bunga': `${l.interest_rate !== undefined ? l.interest_rate : 20}%`,
        'Nominal Bunga (Rp)': l.interest_fee || 0,
        'Total Tagihan (Rp)': l.total_due,
        'Total Dibayar (Rp)': l.total_paid,
        'Sisa Tagihan (Rp)': l.remaining,
        'Status': l.status === 'lunas' ? 'Lunas' : 'Belum Lunas',
        'Catatan': l.notes || '-',
      }));
      exportToCSV(data, 'laporan_rekap_pinjaman_dananote');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Laporan & Rekapitulasi Keuangan</h1>
          <p className="text-xs text-slate-400 mt-1">
            Filter fleksibel: harian, bulanan (per tahun), rentang tanggal, pokok, bunga, pembayaran tunai & tabungan
          </p>
        </div>
        <div className="flex gap-2 no-print">
          <button
            onClick={handleExportCSV}
            className="btn-secondary flex items-center gap-1.5 text-xs shadow-xs"
          >
            <Download className="w-4 h-4 text-emerald-400" /> Ekspor CSV / Excel
          </button>
          <button
            onClick={handlePrint}
            className="btn-primary flex items-center gap-1.5 text-xs shadow-xs"
          >
            <Printer className="w-4 h-4" /> Cetak Laporan
          </button>
        </div>
      </div>

      {/* Complete Filter Card */}
      <div className="card p-4.5 no-print space-y-4 bg-[#1e293b] border-slate-700/80">
        <div className="flex items-center justify-between border-b border-slate-700 pb-2.5">
          <div className="flex items-center gap-2 font-semibold text-xs text-white">
            <Filter className="w-4 h-4 text-emerald-400" />
            <span>Filter Periode & Tipe Laporan</span>
          </div>
          <button
            onClick={resetFilters}
            className="text-slate-400 hover:text-white text-xs flex items-center gap-1"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset Filter
          </button>
        </div>

        {/* Periode Mode Selector */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-400 font-semibold mr-1">Pilih Mode Periode:</span>
          <button
            type="button"
            onClick={() => setPeriodMode('all')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
              periodMode === 'all'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            Semua Periode
          </button>
          <button
            type="button"
            onClick={() => setPeriodMode('daily')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
              periodMode === 'daily'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            Harian (Date Picker)
          </button>
          <button
            type="button"
            onClick={() => setPeriodMode('monthly')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
              periodMode === 'monthly'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            Bulanan (Bulan & Tahun)
          </button>
          <button
            type="button"
            onClick={() => setPeriodMode('custom')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
              periodMode === 'custom'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            Rentang Tanggal
          </button>
        </div>

        {/* Secondary Inputs: Specific Date Pickers */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs pt-1 border-t border-slate-700/60">
          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">Tipe Data Rekap</label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value as ReportType)}
              className="input-field text-xs"
            >
              <option value="all">Semua Data Pinjaman</option>
              <option value="unpaid">Pinjaman Belum Lunas</option>
              <option value="paid">Pinjaman Sudah Lunas</option>
              <option value="payments">Riwayat Pembayaran</option>
              <option value="savings">Mutasi Tabungan Peminjam</option>
            </select>
          </div>

          {periodMode === 'daily' && (
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">Pilih Tanggal Transaksi</label>
              <input
                type="date"
                value={singleDate}
                onChange={(e) => setSingleDate(e.target.value)}
                className="input-field text-xs"
              />
            </div>
          )}

          {periodMode === 'monthly' && (
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">Pilih Bulan & Tahun</label>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="input-field text-xs"
              />
            </div>
          )}

          {periodMode === 'custom' && (
            <>
              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">Dari Tanggal</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="input-field text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">Sampai Tanggal</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="input-field text-xs"
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Comprehensive Metric Cards (Section 3 Requirement) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="card p-3.5 bg-[#1e293b] border-slate-700/80">
          <p className="text-[11px] text-slate-400">Total Pokok</p>
          <p className="text-base font-bold mt-1 text-white tracking-tight">{formatCurrency(totalPrincipal)}</p>
        </div>
        <div className="card p-3.5 bg-[#1e293b] border-slate-700/80">
          <p className="text-[11px] text-purple-400 font-medium">Total Bunga (Jasa)</p>
          <p className="text-base font-bold mt-1 text-purple-400 tracking-tight">{formatCurrency(totalInterestFee)}</p>
        </div>
        <div className="card p-3.5 bg-[#1e293b] border-slate-700/80">
          <p className="text-[11px] text-emerald-400 font-medium">Pembayaran Tunai</p>
          <p className="text-base font-bold mt-1 text-emerald-400 tracking-tight">{formatCurrency(totalPaidCash)}</p>
        </div>
        <div className="card p-3.5 bg-[#1e293b] border-slate-700/80">
          <p className="text-[11px] text-purple-300 font-medium">Bayar via Tabungan</p>
          <p className="text-base font-bold mt-1 text-purple-300 tracking-tight">{formatCurrency(totalPaidSavings)}</p>
        </div>
        <div className="card p-3.5 bg-[#1e293b] border-slate-700/80">
          <p className="text-[11px] text-teal-400 font-medium">Tabungan Ditambahkan</p>
          <p className="text-base font-bold mt-1 text-teal-400 tracking-tight">{formatCurrency(totalSavingsAdded)}</p>
        </div>
        <div className="card p-3.5 bg-red-950/30 border-red-800/60">
          <p className="text-[11px] text-red-400 font-semibold">Sisa Tagihan Periode Ini</p>
          <p className="text-base font-bold mt-1 text-red-400 tracking-tight">{formatCurrency(totalRemaining)}</p>
        </div>
      </div>

      {/* Operational Highlights Badges */}
      <div className="flex flex-wrap items-center gap-3 text-xs bg-slate-900/60 p-3 rounded-xl border border-slate-700/60">
        <span className="flex items-center gap-1.5 text-slate-300">
          <Users className="w-4 h-4 text-emerald-400" /> Peminjam Baru: <strong>{filteredBorrowersCount}</strong>
        </span>
        <span className="text-slate-600">•</span>
        <span className="flex items-center gap-1.5 text-slate-300">
          <FileText className="w-4 h-4 text-blue-400" /> Transaksi Pinjaman: <strong>{filteredLoans.length}</strong>
        </span>
        <span className="text-slate-600">•</span>
        <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
          <CheckCircle2 className="w-4 h-4" /> Pinjaman Lunas: {totalPaidLoansCount}
        </span>
        <span className="text-slate-600">•</span>
        <span className="flex items-center gap-1.5 text-amber-400 font-semibold">
          <Clock className="w-4 h-4" /> Belum Lunas: {totalUnpaidLoansCount}
        </span>
      </div>

      {/* Visual Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 no-print">
        <div className="card p-5 lg:col-span-2 space-y-3 bg-[#1e293b] border-slate-700/80">
          <h2 className="font-semibold text-xs flex items-center gap-2 text-white">
            <BarChart3 className="w-4 h-4 text-emerald-400" /> Komparasi Keuangan (Rupiah)
          </h2>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={overviewChartData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} stroke="#475569" />
                <YAxis
                  tickFormatter={(v) => (v >= 1000000 ? `${(v / 1000000).toFixed(0)}Jt` : v)}
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  stroke="#475569"
                />
                <Tooltip
                  formatter={(value: any) => [formatCurrency(Number(value)), 'Jumlah']}
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc', fontSize: '12px' }}
                />
                <Bar dataKey="amount" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-5 space-y-3 bg-[#1e293b] border-slate-700/80">
          <h2 className="font-semibold text-xs flex items-center gap-2 text-white">
            <PieIcon className="w-4 h-4 text-purple-400" /> Pembayaran Tunai vs Tabungan
          </h2>
          <div className="h-64 w-full flex items-center justify-center">
            {pieChartData.length === 0 ? (
              <p className="text-xs text-slate-500">Belum ada data pada periode ini</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={75}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {pieChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: any) => [formatCurrency(Number(value)), 'Nilai']}
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc', fontSize: '12px' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Report Data Tables */}
      {reportType === 'payments' ? (
        <div className="card overflow-hidden bg-[#1e293b] border-slate-700/80">
          <div className="p-4 border-b border-slate-700 bg-slate-900/60">
            <h2 className="font-semibold text-xs flex items-center gap-2 text-white">
              <FileText className="w-4 h-4 text-emerald-400" /> Riwayat Pembayaran Periode Terpilih ({filteredPayments.length})
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="border-b border-slate-700 bg-slate-900/40">
                <tr>
                  <th className="text-left p-3 font-bold text-slate-400">Tanggal</th>
                  <th className="text-left p-3 font-bold text-slate-400">No. Kuitansi</th>
                  <th className="text-left p-3 font-bold text-slate-400">Peminjam</th>
                  <th className="text-right p-3 font-bold text-slate-400">Nominal Masuk</th>
                  <th className="text-left p-3 font-bold text-slate-400">Metode / Jenis</th>
                  <th className="text-left p-3 font-bold text-slate-400">Catatan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/60">
                {filteredPayments.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-500">
                      Data tidak ditemukan untuk periode yang dipilih.
                    </td>
                  </tr>
                ) : (
                  filteredPayments.map((p) => {
                    const isSavings = p.is_savings_payment || p.payment_method === 'Tabungan';

                    return (
                      <tr key={p.id} className="table-row">
                        <td className="p-3 font-medium text-slate-300">{formatDate(p.payment_date)}</td>
                        <td className="p-3 font-mono text-slate-400">{p.receipt_no || '-'}</td>
                        <td className="p-3 font-bold text-white">{p.borrower_name}</td>
                        <td className={`p-3 text-right font-bold ${isSavings ? 'text-purple-400' : 'text-emerald-400'}`}>
                          {formatCurrency(p.amount)}
                        </td>
                        <td className="p-3">
                          <span
                            className={`badge text-[10px] ${
                              isSavings ? 'bg-purple-950/80 text-purple-300 border-purple-800' : 'badge-secondary'
                            }`}
                          >
                            {isSavings ? 'Tabungan Peminjam' : p.payment_method || 'Tunai'}
                          </span>
                        </td>
                        <td className="p-3 text-slate-400">{p.notes || '-'}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : reportType === 'savings' ? (
        <div className="card overflow-hidden bg-[#1e293b] border-slate-700/80">
          <div className="p-4 border-b border-slate-700 bg-slate-900/60">
            <h2 className="font-semibold text-xs flex items-center gap-2 text-white">
              <PiggyBank className="w-4 h-4 text-purple-400" /> Mutasi Tabungan Peminjam Periode Terpilih ({filteredSavings.length})
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="border-b border-slate-700 bg-slate-900/40">
                <tr>
                  <th className="text-left p-3 font-bold text-slate-400">Tanggal</th>
                  <th className="text-left p-3 font-bold text-slate-400">Nama Peminjam</th>
                  <th className="text-left p-3 font-bold text-slate-400">Jenis Mutasi</th>
                  <th className="text-right p-3 font-bold text-slate-400">Nominal</th>
                  <th className="text-left p-3 font-bold text-slate-400">Keterangan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/60">
                {filteredSavings.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-500">
                      Data mutasi tabungan tidak ditemukan untuk periode yang dipilih.
                    </td>
                  </tr>
                ) : (
                  filteredSavings.map((s) => {
                    const isDeposit = s.type === 'deposit_loan' || (s.type === 'adjustment' && s.amount > 0);
                    const isUsage = s.type === 'payment_usage';

                    return (
                      <tr key={s.id} className="table-row">
                        <td className="p-3 font-medium text-slate-300">{formatDate(s.date)}</td>
                        <td className="p-3 font-bold text-white">{s.borrower_name}</td>
                        <td className="p-3">
                          <span
                            className={`badge text-[10px] ${
                              isDeposit
                                ? 'badge-success'
                                : isUsage
                                ? 'bg-purple-950/80 text-purple-300 border-purple-800'
                                : 'badge-warning'
                            }`}
                          >
                            {isDeposit ? 'Tambahan Otomatis 5%' : isUsage ? 'Bayar Tagihan' : 'Penarikan'}
                          </span>
                        </td>
                        <td
                          className={`p-3 text-right font-bold ${
                            isDeposit ? 'text-emerald-400' : isUsage ? 'text-purple-400' : 'text-amber-400'
                          }`}
                        >
                          {isDeposit ? '+' : '-'}{formatCurrency(s.amount)}
                        </td>
                        <td className="p-3 text-slate-400">{s.notes || '-'}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="card overflow-hidden bg-[#1e293b] border-slate-700/80">
          <div className="p-4 border-b border-slate-700 bg-slate-900/60">
            <h2 className="font-semibold text-xs flex items-center gap-2 text-white">
              <FileText className="w-4 h-4 text-emerald-400" />
              {reportType === 'all'
                ? 'Rekapitulasi Semua Pinjaman Periode Terpilih'
                : reportType === 'unpaid'
                ? 'Rekapitulasi Pinjaman Belum Lunas Periode Terpilih'
                : 'Rekapitulasi Pinjaman Lunas Periode Terpilih'}{' '}
              ({filteredLoans.length})
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="border-b border-slate-700 bg-slate-900/40">
                <tr>
                  <th className="text-left p-3 font-bold text-slate-400">Peminjam</th>
                  <th className="text-left p-3 font-bold text-slate-400">Tgl Pinjam</th>
                  <th className="text-right p-3 font-bold text-slate-400">Pokok</th>
                  <th className="text-right p-3 font-bold text-slate-400">Bunga (%)</th>
                  <th className="text-right p-3 font-bold text-slate-400">Nominal Bunga</th>
                  <th className="text-right p-3 font-bold text-slate-400">Total Tagihan</th>
                  <th className="text-right p-3 font-bold text-slate-400">Telah Dibayar</th>
                  <th className="text-right p-3 font-bold text-slate-400">Sisa Tagihan</th>
                  <th className="text-center p-3 font-bold text-slate-400">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/60">
                {filteredLoans.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-slate-500">
                      Data tidak ditemukan untuk periode yang dipilih.
                    </td>
                  </tr>
                ) : (
                  filteredLoans.map((l) => (
                    <tr key={l.id} className="table-row">
                      <td className="p-3 font-bold text-white">{l.borrower_name}</td>
                      <td className="p-3 text-slate-300">{formatDate(l.loan_date)}</td>
                      <td className="p-3 text-right font-medium text-slate-200">{formatCurrency(l.principal_amount)}</td>
                      <td className="p-3 text-right font-semibold text-purple-400">
                        {l.interest_rate !== undefined ? `${l.interest_rate}%` : '20%'}
                      </td>
                      <td className="p-3 text-right text-purple-400 font-medium">
                        {formatCurrency(l.interest_fee || 0)}
                      </td>
                      <td className="p-3 text-right font-bold text-white">{formatCurrency(l.total_due)}</td>
                      <td className="p-3 text-right font-bold text-emerald-400">{formatCurrency(l.total_paid)}</td>
                      <td className="p-3 text-right font-bold text-red-400">{formatCurrency(l.remaining)}</td>
                      <td className="p-3 text-center">
                        <span
                          className={`badge ${
                            l.status === 'lunas' ? 'badge-success' : 'badge-warning'
                          } text-[10px]`}
                        >
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
