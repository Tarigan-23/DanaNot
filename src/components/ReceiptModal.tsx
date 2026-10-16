import { useRef } from 'react';
import { X, Printer } from 'lucide-react';
import { formatCurrency, formatDate } from '../utils';
import { Payment, Loan, Borrower } from '../types';

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'payment' | 'loan_statement';
  payment?: Payment;
  loan?: Loan;
  borrower?: Borrower;
  totalPaid?: number;
  remaining?: number;
}

export default function ReceiptModal({
  isOpen,
  onClose,
  type,
  payment,
  loan,
  borrower,
  totalPaid = 0,
  remaining = 0,
}: ReceiptModalProps) {
  const receiptRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !borrower) return null;

  const handlePrint = () => {
    window.print();
  };

  const fee = loan ? (loan.interest_fee ?? (loan as any).total_interest ?? 0) : 0;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content max-w-xl w-full p-0 overflow-hidden flex flex-col max-h-[92vh] bg-[#1e293b] border-slate-700"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-4 border-b border-slate-700 flex items-center justify-between no-print bg-[#090d16]">
          <h2 className="text-base font-bold flex items-center gap-2 text-white">
            <Printer className="w-4 h-4 text-emerald-400" />
            {type === 'payment' ? 'Kuitansi Pembayaran Resmi' : 'Surat Bukti Catatan Pinjaman'}
          </h2>
          <div className="flex items-center gap-2">
            <button onClick={handlePrint} className="btn-primary text-xs flex items-center gap-1.5">
              <Printer className="w-3.5 h-3.5" /> Cetak / PDF
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Document Sheet (Always white background on print) */}
        <div
          ref={receiptRef}
          className="p-6 md:p-8 bg-white text-gray-900 overflow-y-auto flex-1 font-sans printable-sheet"
          style={{ minHeight: '380px' }}
        >
          {/* Header Brand */}
          <div className="border-b-2 border-emerald-600 pb-4 mb-5 flex justify-between items-start">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white font-bold flex items-center justify-center text-base">
                  DN
                </div>
                <h1 className="text-xl font-bold text-emerald-800 tracking-tight">DanaNote</h1>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">Sistem Catatan Pinjaman & Pembayaran</p>
            </div>
            <div className="text-right">
              <span className="inline-block bg-emerald-100 text-emerald-800 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                {type === 'payment' ? 'KUITANSI PEMBAYARAN' : 'BUKTI PINJAMAN'}
              </span>
              <p className="text-xs text-gray-500 mt-1 font-mono">
                No: {payment?.receipt_no || `DOC-${loan?.id?.substring(0, 8).toUpperCase() || 'REF'}`}
              </p>
              <p className="text-xs text-gray-500">
                Dicetak: {formatDate(new Date().toISOString())}
              </p>
            </div>
          </div>

          {/* Borrower Information Box */}
          <div className="bg-gray-50 rounded-lg p-3.5 border border-gray-200 mb-5 grid grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-gray-500 block uppercase font-semibold text-[10px]">Data Peminjam</span>
              <p className="text-sm font-bold text-gray-900 mt-0.5">{borrower.name}</p>
              {borrower.phone && <p className="text-gray-600 mt-0.5">Telp/WA: {borrower.phone}</p>}
              {borrower.nik_identity && <p className="text-gray-600">NIK: {borrower.nik_identity}</p>}
            </div>
            <div>
              <span className="text-gray-500 block uppercase font-semibold text-[10px]">Alamat</span>
              <p className="text-gray-700 mt-0.5">{borrower.address || 'Alamat tidak dicantumkan'}</p>
            </div>
          </div>

          {type === 'payment' && payment ? (
            /* PAYMENT RECEIPT CONTENT */
            <div className="space-y-4">
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-emerald-50 text-emerald-900 font-bold border-b border-gray-200">
                    <tr>
                      <th className="p-3">Keterangan Transaksi</th>
                      <th className="p-3">Metode</th>
                      <th className="p-3 text-right">Nominal Masuk</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    <tr>
                      <td className="p-3">
                        <p className="font-semibold text-gray-900">Pembayaran Angsuran / Pelunasan</p>
                        <p className="text-gray-500 text-[11px] mt-0.5">
                          Tanggal Transaksi: {formatDate(payment.payment_date)}
                          {payment.notes ? ` • ${payment.notes}` : ''}
                        </p>
                      </td>
                      <td className="p-3 text-gray-700">{payment.payment_method || 'Tunai'}</td>
                      <td className="p-3 text-right font-bold text-sm text-emerald-700">
                        {formatCurrency(payment.amount)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {loan && (
                <div className="p-3 rounded-lg bg-gray-50 border border-gray-200 grid grid-cols-3 gap-2 text-center text-xs">
                  <div>
                    <span className="text-gray-500">Total Tagihan:</span>
                    <p className="font-semibold mt-0.5">{formatCurrency(loan.total_due)}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Telah Masuk:</span>
                    <p className="font-semibold text-emerald-600 mt-0.5">{formatCurrency(totalPaid)}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Sisa Tagihan:</span>
                    <p className="font-bold text-red-600 mt-0.5">{formatCurrency(remaining)}</p>
                  </div>
                </div>
              )}
            </div>
          ) : loan ? (
            /* LOAN STATEMENT CONTENT */
            <div className="space-y-4">
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-emerald-50 text-emerald-900 font-bold border-b border-gray-200">
                    <tr>
                      <th className="p-3">Rincian Komponen</th>
                      <th className="p-3 text-right">Nilai (Rp)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    <tr>
                      <td className="p-3">Pinjaman Pokok</td>
                      <td className="p-3 text-right font-semibold">{formatCurrency(loan.principal_amount)}</td>
                    </tr>
                    <tr>
                      <td className="p-3">
                        Bunga Pinjaman ({loan.interest_rate !== undefined ? `${loan.interest_rate}%` : '20%'})
                      </td>
                      <td className="p-3 text-right font-semibold text-purple-700">{formatCurrency(fee)}</td>
                    </tr>
                    <tr className="bg-gray-50 font-bold">
                      <td className="p-3 text-emerald-800">TOTAL TAGIHAN</td>
                      <td className="p-3 text-right text-emerald-800 text-sm">{formatCurrency(loan.total_due)}</td>
                    </tr>
                    {loan.savings_deposit_amount && loan.savings_deposit_amount > 0 ? (
                      <tr className="bg-emerald-50/40 text-emerald-800">
                        <td className="p-3">
                          Tambahan Tabungan Otomatis ({loan.savings_deposit_rate || 5}%)
                        </td>
                        <td className="p-3 text-right font-semibold">+{formatCurrency(loan.savings_deposit_amount)}</td>
                      </tr>
                    ) : null}
                    <tr>
                      <td className="p-3">Total Pembayaran Masuk</td>
                      <td className="p-3 text-right text-emerald-600 font-semibold">{formatCurrency(totalPaid)}</td>
                    </tr>
                    <tr className="bg-red-50/50 font-bold">
                      <td className="p-3 text-red-700">SISA TAGIHAN</td>
                      <td className="p-3 text-right text-red-700 text-sm">{formatCurrency(remaining)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="text-xs text-gray-500 space-y-1">
                <p>• Tanggal Pinjaman: {formatDate(loan.loan_date)}</p>
                {loan.notes && <p>• Catatan Pinjaman: {loan.notes}</p>}
              </div>
            </div>
          ) : null}

          {/* Signatures */}
          <div className="mt-8 pt-6 border-t border-gray-200 grid grid-cols-2 gap-8 text-center text-xs">
            <div>
              <p className="text-gray-500 mb-10">Peminjam,</p>
              <p className="font-bold text-gray-900 border-t border-gray-300 pt-1 inline-block min-w-[130px]">
                ( {borrower.name} )
              </p>
            </div>
            <div>
              <p className="text-gray-500 mb-10">Pemberi Pinjaman / Kasir,</p>
              <p className="font-bold text-gray-900 border-t border-gray-300 pt-1 inline-block min-w-[130px]">
                ( ______________________ )
              </p>
            </div>
          </div>

          <div className="mt-6 text-center text-[10px] text-gray-400">
            Dokumen ini dicatat secara resmi melalui sistem aplikasi DanaNote.
          </div>
        </div>
      </div>
    </div>
  );
}
