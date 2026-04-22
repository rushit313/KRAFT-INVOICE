import { useEffect, useState } from 'react';
import axios from 'axios';
import { BarChart2, Users, Package, FileText, Download, Filter, TrendingUp, ArrowUpRight } from 'lucide-react';
import Topbar from '../components/Topbar';
import { formatINR } from '../utils/currency';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend } from 'recharts';

const COLORS = ['#5b9cf6','#4caf7d','#f6c94e','#e05858','#a78bfa','#38bdf8','#fb923c','#34d399'];

function DateRangePicker({ from, setFrom, to, setTo }) {
  return (
    <div className="flex items-center gap-2">
      <Filter size={13} className="text-[#555]" />
      <input type="date" value={from} onChange={e => setFrom(e.target.value)}
        className="px-3 py-1.5 text-sm rounded-lg border border-[#2e2e36] bg-kraft-surface text-white" />
      <span className="text-[#444] text-xs">to</span>
      <input type="date" value={to} onChange={e => setTo(e.target.value)}
        className="px-3 py-1.5 text-sm rounded-lg border border-[#2e2e36] bg-kraft-surface text-white" />
      {(from || to) && (
        <button onClick={() => { setFrom(''); setTo(''); }} className="text-xs text-kraft-red hover:underline">Clear</button>
      )}
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-kraft-surface2 border border-[#2e2e36] rounded-lg p-3 text-xs">
      <div className="text-[#aaa] mb-2">{label}</div>
      {payload.map(p => (
        <div key={p.dataKey} className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full" style={{ background: p.fill || p.color }} />
          <span className="text-[#ccc]">{p.name}: </span>
          <span className="text-white font-mono">{typeof p.value === 'number' && p.value > 1000 ? formatINR(p.value) : p.value}</span>
        </div>
      ))}
    </div>
  );
};

export default function Reports() {
  const [activeTab, setActiveTab] = useState('sales-by-client');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [clientData, setClientData] = useState([]);
  const [itemData, setItemData] = useState([]);
  const [taxData, setTaxData] = useState([]);
  const [loading, setLoading] = useState(false);

  const params = {};
  if (dateFrom) params.from = dateFrom;
  if (dateTo)   params.to   = dateTo;

  const fetchAll = () => {
    setLoading(true);
    Promise.all([
      axios.get('/api/reports/sales-by-client', { params }),
      axios.get('/api/reports/sales-by-item', { params }),
      axios.get('/api/reports/invoice-tax', { params, responseType: 'text' }),
    ]).then(([c, it, tx]) => {
      setClientData(c.data);
      setItemData(it.data);
      // Parse CSV for tax breakdown
      const lines = tx.data.split('\n').filter(Boolean);
      const headers = lines[0].split(',');
      const rows = lines.slice(1).map(l => {
        const vals = l.split(',');
        const obj = {};
        headers.forEach((h, i) => obj[h.trim()] = vals[i]?.trim().replace(/^"|"$/g,''));
        return obj;
      });
      setTaxData(rows);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => { fetchAll(); }, [dateFrom, dateTo]);

  const clientChartData = clientData.slice(0, 10).map(c => ({
    name: c.company_name?.split(' ')[0] || 'N/A',
    Amount: c.total_amount || 0,
    Paid: c.total_paid || 0,
    Outstanding: c.outstanding || 0,
  }));

  const itemChartData = itemData.slice(0, 8).map(it => ({
    name: it.description?.slice(0, 20) || 'N/A',
    value: it.total_amount || 0,
  }));

  const totalClientSales = clientData.reduce((s, c) => s + (c.total_amount || 0), 0);
  const totalItemSales   = itemData.reduce((s, i) => s + (i.total_amount || 0), 0);
  const totalTax = taxData.reduce((s, r) => ({
    cgst: s.cgst + parseFloat(r['CGST'] || 0),
    sgst: s.sgst + parseFloat(r['SGST'] || 0),
    igst: s.igst + parseFloat(r['IGST'] || 0),
    total: s.total + parseFloat(r['Total'] || 0),
  }), { cgst: 0, sgst: 0, igst: 0, total: 0 });

  const downloadReport = (type) => {
    const p = new URLSearchParams(params).toString();
    const url = type === 'invoice-tax'
      ? `/api/reports/invoice-tax${p ? '?' + p : ''}`
      : '#';
    if (type === 'invoice-tax') { const a = document.createElement('a'); a.href = url; a.download = 'invoice-tax.csv'; a.click(); return; }
    // Client / item JSON -> CSV
    const data = type === 'sales-by-client' ? clientData : itemData;
    const keys = data.length ? Object.keys(data[0]) : [];
    const csv = [keys.join(','), ...data.map(r => keys.map(k => r[k]).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const burl = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = burl; a.download = `${type}.csv`; a.click();
    URL.revokeObjectURL(burl);
  };

  const tabs = [
    { id: 'sales-by-client', label: 'Sales by Client', icon: Users },
    { id: 'sales-by-item',   label: 'Sales by Item',   icon: Package },
    { id: 'invoice-tax',     label: 'Invoice Tax',     icon: FileText },
  ];

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Topbar
        title="Reports"
        subtitle="Sales analytics and tax breakdown"
        actions={[{ label: 'Export CSV', icon: Download, onClick: () => downloadReport(activeTab) }]}
      />
      <div className="flex-1 overflow-y-auto p-6 space-y-5">

        {/* Tabs + Date Filter */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex gap-1 bg-kraft-surface2 rounded-xl p-1">
            {tabs.map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-2 px-4 py-2 text-sm rounded-lg font-medium transition-all ${activeTab === t.id ? 'bg-kraft-accent text-black' : 'text-[#888] hover:text-white'}`}>
                <t.icon size={13} />{t.label}
              </button>
            ))}
          </div>
          <DateRangePicker from={dateFrom} setFrom={setDateFrom} to={dateTo} setTo={setDateTo} />
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-kraft-accent border-t-transparent rounded-full spin" />
          </div>
        ) : (
          <>
            {/* ─── SALES BY CLIENT ─── */}
            {activeTab === 'sales-by-client' && (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Total Sales', value: formatINR(totalClientSales), color: 'text-kraft-blue' },
                    { label: 'Clients', value: clientData.length, color: 'text-white' },
                    { label: 'Total Outstanding', value: formatINR(clientData.reduce((s,c) => s + (c.outstanding||0), 0)), color: 'text-amber-400' },
                  ].map(c => (
                    <div key={c.label} className="kraft-card p-4">
                      <div className="text-xs text-[#555] uppercase tracking-wide mb-1">{c.label}</div>
                      <div className={`text-xl font-bold mono ${c.color}`}>{c.value}</div>
                    </div>
                  ))}
                </div>

                {clientChartData.length > 0 && (
                  <div className="kraft-card p-5">
                    <div className="text-sm font-semibold text-white mb-4">Sales by Client (Top 10)</div>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={clientChartData} barSize={18} barGap={4}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#2a2a32" vertical={false} />
                        <XAxis dataKey="name" tick={{ fill: '#666', fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: '#666', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => formatINR(v)} width={80} />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                        <Bar dataKey="Amount" fill="#5b9cf6" radius={[3,3,0,0]} name="Total" />
                        <Bar dataKey="Paid" fill="#4caf7d" radius={[3,3,0,0]} name="Collected" />
                        <Bar dataKey="Outstanding" fill="#f6c94e" radius={[3,3,0,0]} name="Outstanding" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                <div className="kraft-card overflow-hidden">
                  <table className="kraft-table">
                    <thead>
                      <tr>
                        <th>#</th><th>Client</th><th>GSTIN</th><th>State</th>
                        <th className="text-right">Invoices</th>
                        <th className="text-right">Taxable</th>
                        <th className="text-right">Tax</th>
                        <th className="text-right">Total</th>
                        <th className="text-right">Collected</th>
                        <th className="text-right">Outstanding</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clientData.map((c, i) => (
                        <tr key={c.id}>
                          <td className="text-[#444] text-xs">{i+1}</td>
                          <td className="font-semibold text-white">{c.company_name}</td>
                          <td className="mono text-xs text-[#666]">{c.gstin || '—'}</td>
                          <td className="text-xs text-[#777]">{c.state || '—'}</td>
                          <td className="text-right text-xs">{c.invoice_count}</td>
                          <td className="text-right mono text-xs">{formatINR(c.total_taxable)}</td>
                          <td className="text-right mono text-xs text-purple-400">{formatINR((c.total_cgst||0)+(c.total_sgst||0)+(c.total_igst||0))}</td>
                          <td className="text-right mono font-bold text-white">{formatINR(c.total_amount)}</td>
                          <td className="text-right mono text-kraft-green">{formatINR(c.total_paid)}</td>
                          <td className="text-right mono text-amber-400">{formatINR(c.outstanding)}</td>
                        </tr>
                      ))}
                      {!clientData.length && (
                        <tr><td colSpan={10} className="text-center py-10 text-[#444]">No data for this period</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ─── SALES BY ITEM ─── */}
            {activeTab === 'sales-by-item' && (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Total Sales', value: formatINR(totalItemSales), color: 'text-kraft-green' },
                    { label: 'Unique Items', value: itemData.length, color: 'text-white' },
                    { label: 'Total Tax', value: formatINR(itemData.reduce((s,i) => s+(i.total_cgst||0)+(i.total_sgst||0)+(i.total_igst||0),0)), color: 'text-purple-400' },
                  ].map(c => (
                    <div key={c.label} className="kraft-card p-4">
                      <div className="text-xs text-[#555] uppercase tracking-wide mb-1">{c.label}</div>
                      <div className={`text-xl font-bold mono ${c.color}`}>{c.value}</div>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {itemChartData.length > 0 && (
                    <div className="kraft-card p-5">
                      <div className="text-sm font-semibold text-white mb-4">Revenue by Item</div>
                      <ResponsiveContainer width="100%" height={200}>
                        <PieChart>
                          <Pie data={itemChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={false}>
                            {itemChartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                          </Pie>
                          <Tooltip content={<CustomTooltip />} />
                          <Legend formatter={(v) => <span className="text-xs text-[#aaa]">{v}</span>} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                  <div className="kraft-card p-5">
                    <div className="text-sm font-semibold text-white mb-4">Top Items by Revenue</div>
                    <div className="space-y-2">
                      {itemData.slice(0, 6).map((it, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                          <div className="flex-1 text-sm text-[#bbb] truncate">{it.description}</div>
                          <div className="mono text-xs text-white">{formatINR(it.total_amount)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="kraft-card overflow-hidden">
                  <table className="kraft-table">
                    <thead>
                      <tr>
                        <th>#</th><th>Description</th><th>HSN/SAC</th>
                        <th className="text-right">Qty</th>
                        <th className="text-right">Invoices</th>
                        <th className="text-right">Taxable</th>
                        <th className="text-right">CGST</th>
                        <th className="text-right">SGST</th>
                        <th className="text-right">IGST</th>
                        <th className="text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {itemData.map((it, i) => (
                        <tr key={i}>
                          <td className="text-[#444] text-xs">{i+1}</td>
                          <td className="font-medium text-white">{it.description}</td>
                          <td className="mono text-xs text-[#555]">{it.hsn_sac || '—'}</td>
                          <td className="text-right text-xs">{it.total_qty}</td>
                          <td className="text-right text-xs">{it.invoice_count}</td>
                          <td className="text-right mono text-xs">{formatINR(it.total_taxable)}</td>
                          <td className="text-right mono text-xs text-purple-400">{formatINR(it.total_cgst)}</td>
                          <td className="text-right mono text-xs text-purple-400">{formatINR(it.total_sgst)}</td>
                          <td className="text-right mono text-xs text-kraft-blue">{formatINR(it.total_igst)}</td>
                          <td className="text-right mono font-bold text-white">{formatINR(it.total_amount)}</td>
                        </tr>
                      ))}
                      {!itemData.length && (
                        <tr><td colSpan={10} className="text-center py-10 text-[#444]">No data for this period</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ─── INVOICE TAX BREAKDOWN ─── */}
            {activeTab === 'invoice-tax' && (
              <div className="space-y-4">
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { label: 'Invoices', value: taxData.length, color: 'text-white' },
                    { label: 'CGST', value: formatINR(totalTax.cgst), color: 'text-purple-400' },
                    { label: 'SGST', value: formatINR(totalTax.sgst), color: 'text-purple-400' },
                    { label: 'IGST', value: formatINR(totalTax.igst), color: 'text-kraft-blue' },
                  ].map(c => (
                    <div key={c.label} className="kraft-card p-4">
                      <div className="text-xs text-[#555] uppercase tracking-wide mb-1">{c.label}</div>
                      <div className={`text-xl font-bold mono ${c.color}`}>{c.value}</div>
                    </div>
                  ))}
                </div>

                <div className="kraft-card overflow-hidden">
                  <div className="px-5 py-3 border-b border-[#2a2a32] flex items-center justify-between">
                    <div className="text-xs font-semibold text-[#666] uppercase tracking-wide">Invoice-wise Tax Breakdown</div>
                    <button onClick={() => downloadReport('invoice-tax')} className="flex items-center gap-1.5 text-xs text-kraft-accent hover:underline">
                      <Download size={11} /> Export CSV
                    </button>
                  </div>
                  <table className="kraft-table">
                    <thead>
                      <tr>
                        <th>Invoice No</th><th>Date</th><th>Client</th><th>Client GSTIN</th>
                        <th>Supply Type</th>
                        <th className="text-right">Taxable</th>
                        <th className="text-right">CGST</th>
                        <th className="text-right">SGST</th>
                        <th className="text-right">IGST</th>
                        <th className="text-right">Total</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {taxData.map((r, i) => (
                        <tr key={i}>
                          <td className="mono text-xs text-kraft-accent">{r['Invoice No']}</td>
                          <td className="text-xs text-[#888]">{r['Date']}</td>
                          <td className="text-sm">{r['Client']}</td>
                          <td className="mono text-xs text-[#666]">{r['Client GSTIN'] || '—'}</td>
                          <td>
                            <span className={`badge text-[10px] ${r['Supply Type'] === 'inter' ? 'bg-kraft-blue/20 text-kraft-blue' : 'bg-purple-900/40 text-purple-400'}`}>
                              {r['Supply Type'] === 'inter' ? 'IGST' : 'CGST/SGST'}
                            </span>
                          </td>
                          <td className="text-right mono text-xs">{formatINR(parseFloat(r['Taxable Value']))}</td>
                          <td className="text-right mono text-xs text-purple-400">{formatINR(parseFloat(r['CGST']))}</td>
                          <td className="text-right mono text-xs text-purple-400">{formatINR(parseFloat(r['SGST']))}</td>
                          <td className="text-right mono text-xs text-kraft-blue">{formatINR(parseFloat(r['IGST']))}</td>
                          <td className="text-right mono font-bold text-white">{formatINR(parseFloat(r['Total']))}</td>
                          <td>
                            <span className={`badge text-[10px] ${
                              r['Status'] === 'paid' ? 'bg-green-900/40 text-green-400'
                              : r['Status'] === 'partial' ? 'bg-amber-900/40 text-amber-400'
                              : 'bg-red-900/40 text-red-400'
                            }`}>{r['Status']}</span>
                          </td>
                        </tr>
                      ))}
                      {!taxData.length && (
                        <tr><td colSpan={11} className="text-center py-10 text-[#444]">No invoices in this period</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
