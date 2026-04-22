import { useEffect, useState } from 'react';
import axios from 'axios';
import { Download, FileSpreadsheet, FileJson, BarChart2, Filter } from 'lucide-react';
import Topbar from '../components/Topbar';
import { formatINR } from '../utils/currency';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

// Build financial year quarters
function getFinancialYears() {
  const thisYear = new Date().getFullYear();
  const years = [];
  for (let y = thisYear - 1; y <= thisYear + 1; y++) {
    years.push(`${y}-${String(y + 1).slice(-2)}`);
  }
  return years;
}

function fyDates(fy) {
  // fy like "2025-26"
  const startYear = parseInt(fy.split('-')[0]);
  return { from: `${startYear}-04-01`, to: `${startYear + 1}-03-31` };
}

// Parse "2025-26" -> April 2025 – March 2026
function fyLabel(fy) {
  const y = parseInt(fy.split('-')[0]);
  return `Apr ${y} – Mar ${y + 1}`;
}

export default function GSTR1() {
  const now = new Date();
  const currentFY = now.getMonth() >= 3
    ? `${now.getFullYear()}-${String(now.getFullYear() + 1).slice(-2)}`
    : `${now.getFullYear() - 1}-${String(now.getFullYear()).slice(-2)}`;

  const [fy, setFy] = useState(currentFY);
  const [period, setPeriod] = useState('fy'); // 'fy' | 'quarter' | 'month' | 'custom'
  const [quarter, setQuarter] = useState('Q1');
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);

  const getDateRange = () => {
    if (period === 'fy') return fyDates(fy);
    if (period === 'quarter') {
      const startYear = parseInt(fy.split('-')[0]);
      const q = { Q1: [4,6], Q2: [7,9], Q3: [10,12], Q4: [1,3] };
      const [sm, em] = q[quarter];
      const sy = sm >= 4 ? startYear : startYear + 1;
      const ey = em >= 4 ? startYear : startYear + 1;
      const lastDay = new Date(ey, em, 0).getDate();
      return { from: `${sy}-${String(sm).padStart(2,'0')}-01`, to: `${ey}-${String(em).padStart(2,'0')}-${lastDay}` };
    }
    if (period === 'month') {
      const lastDay = new Date(year, month, 0).getDate();
      return { from: `${year}-${String(month).padStart(2,'0')}-01`, to: `${year}-${String(month).padStart(2,'0')}-${lastDay}` };
    }
    return { from: customFrom, to: customTo };
  };

  const fetchData = () => {
    const { from, to } = getDateRange();
    if (!from || !to) return;
    setLoading(true);
    axios.get('/api/reports/gstr1', { params: { from, to, format: 'json' } })
      .then(r => { setData(r.data); setLoading(false); setFetched(true); })
      .catch(() => setLoading(false));
  };

  const downloadFile = (format) => {
    const { from, to } = getDateRange();
    if (!from || !to) return;
    const url = `/api/reports/gstr1?from=${from}&to=${to}&format=${format}`;
    const a = document.createElement('a'); a.href = url; a.download = `GSTR1-${from}-${to}.${format === 'json' ? 'json' : 'csv'}`; a.click();
  };

  // Summary
  const totalTaxable = data.reduce((s, r) => s + (r.taxable_value || 0), 0);
  const totalCGST = data.reduce((s, r) => s + (r.cgst || 0), 0);
  const totalSGST = data.reduce((s, r) => s + (r.sgst || 0), 0);
  const totalIGST = data.reduce((s, r) => s + (r.igst || 0), 0);
  const totalAmt = data.reduce((s, r) => s + (r.total || 0), 0);
  const b2bCount = data.filter(r => r.receiver_gstin).length;
  const b2cCount = data.filter(r => !r.receiver_gstin).length;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Topbar
        title="GSTR-1 Report"
        subtitle="Outward supplies for filing"
        actions={[
          { label: 'Download CSV', icon: FileSpreadsheet, onClick: () => downloadFile('csv') },
          { label: 'Download JSON', icon: FileJson, onClick: () => downloadFile('json') },
        ]}
      />
      <div className="flex-1 overflow-y-auto p-6 space-y-5">

        {/* Period Selector */}
        <div className="kraft-card p-5 space-y-4">
          <div className="text-sm font-semibold text-white flex items-center gap-2">
            <Filter size={14} className="text-kraft-accent" /> Select Period
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {/* Period type tabs */}
            {['fy','quarter','month','custom'].map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-all ${period === p ? 'bg-kraft-accent text-black' : 'bg-white/5 text-[#888] hover:text-white'}`}>
                {p === 'fy' ? 'Full Year' : p === 'quarter' ? 'Quarter' : p === 'month' ? 'Month' : 'Custom'}
              </button>
            ))}

            {/* Context-sensitive selectors */}
            {(period === 'fy' || period === 'quarter') && (
              <select value={fy} onChange={e => setFy(e.target.value)} className="px-3 py-2 text-sm rounded-lg border border-[#2e2e36] bg-kraft-surface text-white">
                {getFinancialYears().map(y => <option key={y} value={y}>FY {y} ({fyLabel(y)})</option>)}
              </select>
            )}
            {period === 'quarter' && (
              <select value={quarter} onChange={e => setQuarter(e.target.value)} className="px-3 py-2 text-sm rounded-lg border border-[#2e2e36] bg-kraft-surface text-white">
                {['Q1 (Apr–Jun)','Q2 (Jul–Sep)','Q3 (Oct–Dec)','Q4 (Jan–Mar)'].map((q,i) => (
                  <option key={i} value={`Q${i+1}`}>{q}</option>
                ))}
              </select>
            )}
            {period === 'month' && (
              <>
                <select value={month} onChange={e => setMonth(parseInt(e.target.value))} className="px-3 py-2 text-sm rounded-lg border border-[#2e2e36] bg-kraft-surface text-white">
                  {MONTHS.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
                </select>
                <select value={year} onChange={e => setYear(parseInt(e.target.value))} className="px-3 py-2 text-sm rounded-lg border border-[#2e2e36] bg-kraft-surface text-white">
                  {[2023,2024,2025,2026,2027].map(y => <option key={y}>{y}</option>)}
                </select>
              </>
            )}
            {period === 'custom' && (
              <>
                <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                  className="px-3 py-2 text-sm rounded-lg border border-[#2e2e36] bg-kraft-surface text-white" />
                <span className="text-[#555] text-xs">to</span>
                <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                  className="px-3 py-2 text-sm rounded-lg border border-[#2e2e36] bg-kraft-surface text-white" />
              </>
            )}

            <button onClick={fetchData}
              className="px-4 py-2 text-sm font-semibold bg-kraft-accent text-black rounded-lg hover:opacity-90 transition-opacity">
              Generate Report
            </button>
          </div>
          {fetched && (
            <div className="text-xs text-[#555]">
              Period: <span className="text-[#888]">{getDateRange().from}</span> to <span className="text-[#888]">{getDateRange().to}</span>
            </div>
          )}
        </div>

        {loading && (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-kraft-accent border-t-transparent rounded-full spin" />
          </div>
        )}

        {fetched && !loading && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-5 gap-3">
              {[
                { label: 'Invoices', value: data.length },
                { label: 'B2B', value: b2bCount, sub: 'Reg. recipients' },
                { label: 'B2C', value: b2cCount, sub: 'Unregistered' },
                { label: 'Taxable Value', value: formatINR(totalTaxable), mono: true },
                { label: 'Total Tax', value: formatINR(totalCGST + totalSGST + totalIGST), mono: true },
              ].map(c => (
                <div key={c.label} className="kraft-card p-4">
                  <div className="text-xs text-[#555] uppercase tracking-wide mb-1">{c.label}</div>
                  <div className={`text-xl font-bold text-white ${c.mono ? 'mono' : ''}`}>{c.value}</div>
                  {c.sub && <div className="text-[10px] text-[#444] mt-0.5">{c.sub}</div>}
                </div>
              ))}
            </div>

            {/* Tax Summary Row */}
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: 'CGST', value: totalCGST, color: 'text-purple-400' },
                { label: 'SGST', value: totalSGST, color: 'text-purple-400' },
                { label: 'IGST', value: totalIGST, color: 'text-kraft-blue' },
                { label: 'Invoice Total', value: totalAmt, color: 'text-kraft-accent' },
              ].map(c => (
                <div key={c.label} className="kraft-card p-4">
                  <div className="text-xs text-[#555] uppercase tracking-wide mb-1">{c.label}</div>
                  <div className={`text-lg font-bold mono ${c.color}`}>{formatINR(c.value)}</div>
                </div>
              ))}
            </div>

            {/* Invoice Detail Table */}
            <div className="kraft-card overflow-hidden">
              <div className="px-5 py-3 border-b border-[#2a2a32] flex items-center justify-between">
                <div className="text-xs font-semibold text-[#666] uppercase tracking-wide flex items-center gap-2">
                  <BarChart2 size={13} /> GSTR-1 Invoice Details ({data.length} invoices)
                </div>
                <div className="flex gap-2">
                  <button onClick={() => downloadFile('csv')} className="flex items-center gap-1.5 text-xs text-kraft-accent hover:underline">
                    <FileSpreadsheet size={11} /> CSV
                  </button>
                  <button onClick={() => downloadFile('json')} className="flex items-center gap-1.5 text-xs text-kraft-blue hover:underline">
                    <FileJson size={11} /> JSON
                  </button>
                </div>
              </div>
              <table className="kraft-table">
                <thead>
                  <tr>
                    <th>Invoice No</th>
                    <th>Date</th>
                    <th>Receiver</th>
                    <th>GSTIN</th>
                    <th>Place of Supply</th>
                    <th>Type</th>
                    <th className="text-right">Taxable</th>
                    <th className="text-right">CGST</th>
                    <th className="text-right">SGST</th>
                    <th className="text-right">IGST</th>
                    <th className="text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((r, i) => (
                    <tr key={i}>
                      <td className="mono text-xs text-kraft-accent">{r.invoice_no}</td>
                      <td className="text-xs text-[#888]">{r.issue_date}</td>
                      <td className="text-sm">{r.receiver_name || <span className="text-[#444]">—</span>}</td>
                      <td className="mono text-xs text-[#666]">{r.receiver_gstin || <span className="text-[#333]">B2C</span>}</td>
                      <td className="text-xs text-[#888]">{r.place_of_supply}</td>
                      <td>
                        <span className={`badge text-[10px] ${r.supply_type === 'inter' ? 'bg-kraft-blue/20 text-kraft-blue' : 'bg-purple-900/40 text-purple-400'}`}>
                          {r.supply_type === 'inter' ? 'IGST' : 'CGST/SGST'}
                        </span>
                      </td>
                      <td className="text-right mono text-xs">{formatINR(r.taxable_value)}</td>
                      <td className="text-right mono text-xs">{formatINR(r.cgst)}</td>
                      <td className="text-right mono text-xs">{formatINR(r.sgst)}</td>
                      <td className="text-right mono text-xs">{formatINR(r.igst)}</td>
                      <td className="text-right mono font-bold text-white">{formatINR(r.total)}</td>
                    </tr>
                  ))}
                  {!data.length && (
                    <tr><td colSpan={11} className="text-center py-10 text-[#444]">No invoices in this period</td></tr>
                  )}
                  {data.length > 0 && (
                    <tr className="bg-kraft-surface2/60 font-bold">
                      <td colSpan={6} className="text-[#666] text-xs uppercase">Total</td>
                      <td className="text-right mono text-white">{formatINR(totalTaxable)}</td>
                      <td className="text-right mono text-purple-400">{formatINR(totalCGST)}</td>
                      <td className="text-right mono text-purple-400">{formatINR(totalSGST)}</td>
                      <td className="text-right mono text-kraft-blue">{formatINR(totalIGST)}</td>
                      <td className="text-right mono text-kraft-accent">{formatINR(totalAmt)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {!fetched && !loading && (
          <div className="kraft-card p-12 flex flex-col items-center justify-center text-center">
            <FileSpreadsheet size={40} className="text-[#333] mb-3" />
            <div className="text-white font-semibold mb-1">Select a period and generate your GSTR-1 report</div>
            <div className="text-xs text-[#555]">Supports Full Year, Quarter, Month, or Custom date range</div>
          </div>
        )}
      </div>
    </div>
  );
}
