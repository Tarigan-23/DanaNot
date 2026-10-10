import { useState, useEffect } from 'react';
import { 
  Download, Printer, FileText, Filter, RotateCcw, 
  BarChart3, PieChart as PieIcon 
} from 'lucide-react';
import { 
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, 
  Tooltip, Legend, PieChart, Pie, Cell 
} from 'recharts';
import { formatCurrency, formatDate, exportToCSV } from '../utils';
import { 
  getLoans, getBorrower, getPayments, getLoan, 
  getTotalPaidForLoan, subscribeDataChanges 
} from '../services/storage';

type ReportType = 'all' | 'unpaid' | 'paid' | 'payments';

export default function Reports() {
  const [reportType, setReportType] = useState<ReportType>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [loans, setLoans] = useState(getLoans());
  const [payments, setPayments] = useState(getPayments());

  const refreshData = () => {
    setLoans(getLoans());
    setPayments(getPayments());
  };

  useEffect(() => {
    refreshData();
    const unsub = subscribeDataChanges(refreshData);
    return () => unsub();
  }, []);

  const getFilteredLoans = () => {
    let filtered = loans.map((l) => {
      const borrower = getBorrower(l.borrower_id);
      const totalPaid = getTotalPaidForLoan(l.id);
      return {
        ...l,
        borrower_name: borrower?.name || '-',
        borrower_phone: borrower?.phone,
        total_paid: totalPaid,
        remaining: Math.max(0, l.total_due - totalPaid),
      };
    });

    if (reportType === 'unpaid') filtered = filtered.filter((l) => l.status === 'belum_lunas');
    if (reportType === 'paid') filtered = filtered.filter((l) => l.status === 'lunas');

    if (dateFrom) filtered = filtered.filter((l) => l.loan_date >= dateFrom);
    if (dateTo) filtered = filtered.filter((l) => l.loan_date <= dateTo);

    return filtered;
  };

  const getFilteredPayments = () => {
    let filtered = payments.map((p) => {
      const loan = getLoan(p.loan_id);
      const borrower = loan ? getBorrower(loan.borrower_id) : undefined;
      return {
        ...p,
        borrower_name: borrower?.name || '-',
        loan_date: loan?.loan_date || '',
      };
    });

    if (dateFrom) filtered = filtered.filter((p) => p.payment_date >= dateFrom);
    if (dateTo) filtered = filtered.filter((p) => p.payment_date <= dateTo);

    return filtered.sort((a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime());
  };

  const filteredLoans = getFilteredLoans();
  const filteredPayments = getFilteredPayments();

  const totalPrincipal = filteredLoans.reduce((s, l) => s + (l.principal_amount || 0), 0);
  const totalInterestFee = filteredLoans.reduce((s, l) => s + (l.interest_fee || (l as any).total_interest || 0), 0);
  const totalDue = filteredLoans.reduce((s, l) => s + (l.total_due || 0), 0);
  const totalPaid =
    reportType === 'payments'
      ? filteredPayments.reduce((s, p) => s + (p.amount || 0), 0)
      : filteredLoans.reduce((s, l) => s + l.total_paid, 0);
  const totalRemaining = Math.max(0, totalDue - totalPaid);

  // Chart Data
  const overviewChartData = [
    { name: 'Pokok', amount: totalPrincipal, fill: '#3b82f6' },
    { name: 'Jasa Pinjam', amount: totalInterestFee, fill: '#a855f7' },
    { name: 'Dibayar', amount: totalPaid, fill: '#10b981' },
    { name: 'Sisa Tagihan', amount: totalRemaining, fill: '#ef4444' },
  ];

  const pieChartData = [
    { name: 'Telah Masuk', value: totalPaid, color: '#10b981' },
    { name: 'Sisa Tagihan', value: totalRemaining, color: '#ef4444' },
  ].filter((d) => d.value > 0);

  const handleExportCSV = () => {
    if (reportType === 'payments') {
      const data = filteredPayments.map((p) => ({
        'No. Kuitansi': p.receipt_no || '-',
        'Tanggal Pembayaran': formatDate(p.payment_date),
        'Nama Peminjam': p.borrower_name,
        'Nominal Masuk (Rp)': p.amount,
        'Metode Pembayaran': p.payment_method || 'Tunai',
        'Catatan': p.notes || '-',
      }));
      exportToCSV(data, 'laporan_riwayat_pembayaran_dananote');
    } else {
      const data = filteredLoans.map((l) => ({
        'Nama Peminjam': l.borrower_name,
        'Tanggal Pinjam': formatDate(l.loan_date),
        'Pokok Pinjaman (Rp)': l.principal_amount,
        'Jasa Pinjam (Rp)': l.interest_fee || (l as any).total_interest || 0,
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
            Statistik pencairan, jasa pinjam, pembayaran, dan ekspor data ke Excel / CSV
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

      {/* Filter Card */}
      <div className="card p-4.5 no-print space-y-3 bg-[#1e293b] border-slate-700/80">
        <div className="flex items-center gap-2 font-semibold text-xs text-white">
          <Filter className="w-4 h-4 text-emerald-400" />
          <span>Filter Laporan</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">Jenis Laporan</label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value as ReportType)}
              className="input-field text-xs"
            >
              <option value="all">Semua Data Pinjaman</option>
              <option value="unpaid">Pinjaman Belum Lunas</option>
              <option value="paid">Pinjaman Sudah Lunas</option>
              <option value="payments">Riwayat Pembayaran Masuk</option>
            </select>
          </div>
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
          <div className="flex items-end">
            <button
              onClick={() => {
                setReportType('all');
                setDateFrom('');
                setDateTo('');
              }}
              className="btn-secondary text-xs flex items-center justify-center gap-1.5 w-full h-[38px]"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reset Filter
            </button>
          </div>
        </div>
      </div>

      {/* Financial Summary Highlight Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="card p-4 bg-[#1e293b] border-slate-700/80">
          <p className="text-[11px] text-slate-400">Total Pokok Pinjaman</p>
          <p className="text-lg font-bold mt-1 text-white tracking-tight">{formatCurrency(totalPrincipal)}</p>
        </div>
        <div className="card p-4 bg-[#1e293b] border-slate-700/80">
          <p className="text-[11px] text-slate-400">Total Tagihan (Pokok + Jasa)</p>
          <p className="text-lg font-bold mt-1 text-blue-400 tracking-tight">{formatCurrency(totalDue)}</p>
        </div>
        <div className="card p-4 bg-[#1e293b] border-slate-700/80">
          <p className="text-[11px] text-slate-400">Total Pembayaran Masuk</p>
          <p className="text-lg font-bold mt-1 text-emerald-400 tracking-tight">{formatCurrency(totalPaid)}</p>
        </div>
        <div className="card p-4 bg-red-950/30 border-red-800/60">
          <p className="text-[11px] text-red-400 font-semibold">Sisa Tagihan</p>
          <p className="text-lg font-bold mt-1 text-red-400 tracking-tight">{formatCurrency(totalRemaining)}</p>
        </div>
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
            <PieIcon className="w-4 h-4 text-purple-400" /> Rasio Pelunasan
          </h2>
          <div className="h-64 w-full flex items-center justify-center">
            {pieChartData.length === 0 ? (
              <p className="text-xs text-slate-500">Belum ada data</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
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

      {/* Report Data Table */}
      {reportType === 'payments' ? (
        <div className="card overflow-hidden bg-[#1e293b] border-slate-700/80">
          <div className="p-4 border-b border-slate-700 bg-slate-900/60">
            <h2 className="font-semibold text-xs flex items-center gap-2 text-white">
              <FileText className="w-4 h-4 text-emerald-400" /> Rekapitulasi Riwayat Pembayaran ({filteredPayments.length})
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
                  <th className="text-left p-3 font-bold text-slate-400">Metode</th>
                  <th className="text-left p-3 font-bold text-slate-400">Catatan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/60">
                {filteredPayments.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-500">
                      Tidak ada data pembayaran yang sesuai kriteria.
                    </td>
                  </tr>
                ) : (
                  filteredPayments.map((p) => (
                    <tr key={p.id} className="table-row">
                      <td className="p-3 font-medium text-slate-300">{formatDate(p.payment_date)}</td>
                      <td className="p-3 font-mono text-slate-400">{p.receipt_no || '-'}</td>
                      <td className="p-3 font-bold text-white">{p.borrower_name}</td>
                      <td className="p-3 text-right font-bold text-emerald-400">{formatCurrency(p.amount)}</td>
                      <td className="p-3 text-slate-300">{p.payment_method || 'Tunai'}</td>
                      <td className="p-3 text-slate-400">{p.notes || '-'}</td>
                    </tr>
                  ))
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
                ? 'Rekapitulasi Semua Pinjaman'
                : reportType === 'unpaid'
                ? 'Rekapitulasi Pinjaman Belum Lunas'
                : 'Rekapitulasi Pinjaman Lunas'}{' '}
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
                  <th className="text-right p-3 font-bold text-slate-400">Jasa Pinjam</th>
                  <th className="text-right p-3 font-bold text-slate-400">Total Tagihan</th>
                  <th className="text-right p-3 font-bold text-slate-400">Telah Dibayar</th>
                  <th className="text-right p-3 font-bold text-slate-400">Sisa Tagihan</th>
                  <th className="text-center p-3 font-bold text-slate-400">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/60">
                {filteredLoans.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-500">
                      Tidak ada data pinjaman yang sesuai.
                    </td>
                  </tr>
                ) : (
                  filteredLoans.map((l) => (
                    <tr key={l.id} className="table-row">
                      <td className="p-3 font-bold text-white">{l.borrower_name}</td>
                      <td className="p-3 text-slate-300">{formatDate(l.loan_date)}</td>
                      <td className="p-3 text-right font-medium text-slate-200">{formatCurrency(l.principal_amount)}</td>
                      <td className="p-3 text-right text-purple-400 font-medium">
                        {formatCurrency(l.interest_fee || (l as any).total_interest || 0)}
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
