import { useEffect, useState } from 'react';
import axios from 'axios';
import { Download, TrendingUp, TrendingDown, Calculator } from 'lucide-react';
import Topbar from '../components/Topbar';
import { formatINR } from '../utils/currency';
import InvoiceStatusBadge from '../components/InvoiceStatusBadge';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export default function GSTSummary() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    axios.get('/api/gst/summary', { params: { month, year } }).then(r => { setData(r.data); setLoading(false); });
  }, [month, year]);

  const downloadCSV = () => {
    if (!data) return;
    const { sales, purchases, net } = data;
    const rows = [
      ['GST Summary Report', `${MONTHS[month-1]} ${year}`],
      [],
      ['Category', 'CGST', 'SGST', 'IGST', 'Total'],
      ['Output Tax (Sales)', sales.cgst, sales.sgst, sales.igst, sales.cgst + sales.sgst + sales.igst],
      ['Input Tax Credit (Purchases)', purchases.cgst, purchases.sgst, purchases.igst, purchases.cgst + purchases.sgst + purchases.igst],
      ['Net Payable', net.cgst_payable, net.sgst_payable, net.igst_payable, net.total_payable],
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `GST-${month}-${year}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Topbar
        title="GST Summary"
        subtitle="GSTR-3B Preview"
        actions={[{ label: 'Download GSTR-3B CSV', icon: Download, onClick: downloadCSV }]}
      />
      <div className="flex-1 overflow-y-auto p-6">
        {/* Month selector */}
        <div className="flex items-center gap-3 mb-6">
          <select value={month} onChange={e => setMonth(parseInt(e.target.value))} className="px-3 py-2 text-sm rounded-lg border border-[#2e2e36]">
            {MONTHS.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
          </select>
          <select value={year} onChange={e => setYear(parseInt(e.target.value))} className="px-3 py-2 text-sm rounded-lg border border-[#2e2e36]">
            {[2023,2024,2025,2026].map(y => <option key={y}>{y}</option>)}
          </select>
          <div className="text-sm text-[#666]">
            {loading ? 'Loading...' : `Period: ${data?.period?.dateFrom} to ${data?.period?.dateTo}`}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><div className="w-8 h-8 border-2 border-kraft-accent border-t-transparent rounded-full spin" /></div>
        ) : data && (
          <div className="space-y-5">
            {/* Top Metric Cards */}
            <div className="grid grid-cols-3 gap-4">
              <div className="kraft-card p-5">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp size={16} className="text-kraft-blue" />
                  <div className="text-xs font-semibold text-[#666] uppercase tracking-wide">Sales (Output Tax)</div>
                </div>
                <div className="text-2xl font-bold mono text-kraft-blue mb-2">{formatINR(data.sales.taxable)}</div>
                <div className="text-xs text-[#666]">Taxable Value</div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                  {[['CGST', data.sales.cgst], ['SGST', data.sales.sgst], ['IGST', data.sales.igst]].map(([label, val]) => (
                    <div key={label} className="bg-kraft-surface2 rounded p-2 text-center">
                      <div className="text-[#555] mb-0.5">{label}</div>
                      <div className="mono font-semibold text-white">{formatINR(val)}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-2 text-xs text-[#555]">{data.sales.invoice_count} invoice(s)</div>
              </div>

              <div className="kraft-card p-5">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingDown size={16} className="text-kraft-green" />
                  <div className="text-xs font-semibold text-[#666] uppercase tracking-wide">Purchases (ITC)</div>
                </div>
                <div className="text-2xl font-bold mono text-kraft-green mb-2">{formatINR(data.purchases.taxable)}</div>
                <div className="text-xs text-[#666]">Taxable Value</div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                  {[['CGST', data.purchases.cgst], ['SGST', data.purchases.sgst], ['IGST', data.purchases.igst]].map(([label, val]) => (
                    <div key={label} className="bg-kraft-surface2 rounded p-2 text-center">
                      <div className="text-[#555] mb-0.5">{label}</div>
                      <div className="mono font-semibold text-white">{formatINR(val)}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-2 text-xs text-[#555]">{data.purchases.bill_count} bill(s)</div>
              </div>

              <div className="kraft-card p-5 border-kraft-accent/30">
                <div className="flex items-center gap-2 mb-3">
                  <Calculator size={16} className="text-kraft-accent" />
                  <div className="text-xs font-semibold text-[#666] uppercase tracking-wide">Net GST Payable</div>
                </div>
                <div className="text-3xl font-bold mono text-kraft-accent mb-2">{formatINR(data.net.total_payable)}</div>
                <div className="text-xs text-[#666] mb-3">Due by 20th of next month</div>
                <div className="space-y-1.5 text-xs">
                  {[['CGST Payable', data.net.cgst_payable], ['SGST Payable', data.net.sgst_payable], ['IGST Payable', data.net.igst_payable]].map(([label, val]) => (
                    <div key={label} className="flex justify-between">
                      <span className="text-[#666]">{label}</span>
                      <span className="mono text-white">{formatINR(val)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Full Breakup Table */}
            <div className="kraft-card overflow-hidden">
              <div className="px-5 py-3 border-b border-[#2a2a32] text-xs font-semibold text-[#666] uppercase tracking-wide">Tax Breakup</div>
              <table className="kraft-table">
                <thead>
                  <tr>
                    <th>Tax Type</th>
                    <th className="text-right">Output (Sales)</th>
                    <th className="text-right">ITC (Purchases)</th>
                    <th className="text-right">Net Payable</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['CGST', data.sales.cgst, data.purchases.cgst, data.net.cgst_payable],
                    ['SGST', data.sales.sgst, data.purchases.sgst, data.net.sgst_payable],
                    ['IGST', data.sales.igst, data.purchases.igst, data.net.igst_payable],
                  ].map(([type, output, itc, net]) => (
                    <tr key={type}>
                      <td className="font-semibold text-white">{type}</td>
                      <td className="text-right mono text-kraft-blue">{formatINR(output)}</td>
                      <td className="text-right mono text-kraft-green">{formatINR(itc)}</td>
                      <td className="text-right mono font-bold text-kraft-accent">{formatINR(net)}</td>
                    </tr>
                  ))}
                  <tr className="bg-kraft-surface2/50">
                    <td className="font-bold text-white">Total</td>
                    <td className="text-right mono font-bold text-kraft-blue">{formatINR(data.sales.cgst + data.sales.sgst + data.sales.igst)}</td>
                    <td className="text-right mono font-bold text-kraft-green">{formatINR(data.purchases.cgst + data.purchases.sgst + data.purchases.igst)}</td>
                    <td className="text-right mono font-bold text-2xl text-kraft-accent">{formatINR(data.net.total_payable)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Sales Detail */}
            {data.sales_detail?.length > 0 && (
              <div className="kraft-card overflow-hidden">
                <div className="px-5 py-3 border-b border-[#2a2a32] text-xs font-semibold text-[#666] uppercase tracking-wide">Sales Invoices — {MONTHS[month-1]} {year}</div>
                <table className="kraft-table">
                  <thead><tr><th>Invoice No</th><th>Date</th><th>Client</th><th>Type</th><th className="text-right">Taxable</th><th className="text-right">CGST</th><th className="text-right">SGST</th><th className="text-right">IGST</th><th className="text-right">Total</th></tr></thead>
                  <tbody>
                    {data.sales_detail.map(inv => (
                      <tr key={inv.id}>
                        <td className="text-kraft-accent font-mono text-xs">{inv.invoice_no}</td>
                        <td className="text-[#888] text-xs">{inv.issue_date}</td>
                        <td className="text-sm">{inv.client_name}</td>
                        <td><span className={`badge text-[10px] ${inv.supply_type === 'inter' ? 'bg-kraft-blue/20 text-kraft-blue' : 'bg-purple-900/40 text-purple-400'}`}>{inv.supply_type === 'inter' ? 'IGST' : 'CGST/SGST'}</span></td>
                        <td className="text-right mono text-xs">{formatINR(inv.subtotal)}</td>
                        <td className="text-right mono text-xs">{formatINR(inv.total_cgst)}</td>
                        <td className="text-right mono text-xs">{formatINR(inv.total_sgst)}</td>
                        <td className="text-right mono text-xs">{formatINR(inv.total_igst)}</td>
                        <td className="text-right mono font-bold text-white">{formatINR(inv.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Purchase Detail */}
            {data.purchase_detail?.length > 0 && (
              <div className="kraft-card overflow-hidden">
                <div className="px-5 py-3 border-b border-[#2a2a32] text-xs font-semibold text-[#666] uppercase tracking-wide">Purchase Bills (ITC) — {MONTHS[month-1]} {year}</div>
                <table className="kraft-table">
                  <thead><tr><th>Bill No</th><th>Date</th><th>Vendor</th><th>GSTIN</th><th className="text-right">Taxable</th><th className="text-right">CGST</th><th className="text-right">SGST</th><th className="text-right">IGST</th><th className="text-right">Total</th></tr></thead>
                  <tbody>
                    {data.purchase_detail.map(pb => (
                      <tr key={pb.id}>
                        <td className="text-kraft-blue font-mono text-xs">{pb.bill_no || `PB-${pb.id}`}</td>
                        <td className="text-[#888] text-xs">{pb.issue_date}</td>
                        <td className="text-sm">{pb.vendor_name}</td>
                        <td className="mono text-xs text-[#888]">{pb.vendor_gstin}</td>
                        <td className="text-right mono text-xs">{formatINR(pb.subtotal)}</td>
                        <td className="text-right mono text-xs">{formatINR(pb.total_cgst)}</td>
                        <td className="text-right mono text-xs">{formatINR(pb.total_sgst)}</td>
                        <td className="text-right mono text-xs">{formatINR(pb.total_igst)}</td>
                        <td className="text-right mono font-bold text-white">{formatINR(pb.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Big Total Box */}
            <div className="kraft-card p-6 border-kraft-accent/40">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-[#666] uppercase tracking-wide mb-1">Total GST Payable for {MONTHS[month-1]} {year}</div>
                  <div className="text-4xl font-bold mono text-kraft-accent">{formatINR(data.net.total_payable)}</div>
                  <div className="text-xs text-[#555] mt-1">Due by 20th {MONTHS[month < 12 ? month : 0]} {month < 12 ? year : year + 1}</div>
                </div>
                <div className="text-right text-sm">
                  <div className="text-[#666]">GSTR-3B Filing Deadline</div>
                  <div className="font-semibold text-white mt-1">20th of next month</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
