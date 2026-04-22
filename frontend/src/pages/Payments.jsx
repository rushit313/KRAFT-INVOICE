import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { CreditCard, Search, Download, Filter, Calendar, TrendingUp, Plus } from 'lucide-react';
import Topbar from '../components/Topbar';
import { formatINR } from '../utils/currency';

const METHOD_COLORS = {
  cash:   'bg-green-900/40 text-green-400',
  bank:   'bg-blue-900/40 text-blue-400',
  upi:    'bg-purple-900/40 text-purple-400',
  cheque: 'bg-amber-900/40 text-amber-400',
  neft:   'bg-cyan-900/40 text-cyan-400',
  rtgs:   'bg-indigo-900/40 text-indigo-400',
  imps:   'bg-teal-900/40 text-teal-400',
  other:  'bg-gray-800 text-gray-400',
};

function MethodBadge({ method }) {
  const m = (method || 'other').toLowerCase();
  return (
    <span className={`badge text-[10px] uppercase tracking-wider font-semibold ${METHOD_COLORS[m] || METHOD_COLORS.other}`}>
      {method || '—'}
    </span>
  );
}

export default function Payments() {
  const navigate = useNavigate();
  const [payments, setPayments] = useState([]);
  const [summary, setSummary] = useState({ total: 0, count: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [method, setMethod] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo]   = useState('');

  const fetchData = () => {
    setLoading(true);
    const params = {};
    if (method)   params.method   = method;
    if (dateFrom) params.date_from = dateFrom;
    if (dateTo)   params.date_to   = dateTo;
    if (search)   params.search    = search;

    Promise.all([
      axios.get('/api/payments', { params }),
      axios.get('/api/payments/summary', { params: { date_from: dateFrom, date_to: dateTo } })
    ]).then(([p, s]) => {
      setPayments(p.data);
      setSummary(s.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, [method, dateFrom, dateTo]);

  const handleSearch = (e) => { if (e.key === 'Enter') fetchData(); };

  const exportCSV = () => {
    const headers = ['Date', 'Reference No', 'Invoice No', 'Client', 'Method', 'Amount'];
    const rows = payments.map(p => [
      p.payment_date, p.reference_no || '', p.invoice_no, `"${p.client_name || ''}"`,
      p.method || '', p.amount
    ].join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'payments.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Topbar
        title="Payments"
        subtitle="All payment receipts across invoices"
        actions={[
          { label: 'New Receipt', icon: Plus, primary: true, onClick: () => navigate('/payments/new') },
          { label: 'Export CSV', icon: Download, onClick: exportCSV }
        ]}
      />
      <div className="flex-1 overflow-y-auto p-6 space-y-5">

        {/* Summary Strip */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total Received', value: formatINR(summary.total), icon: TrendingUp, color: 'text-kraft-green' },
            { label: 'No. of Payments', value: summary.count, icon: CreditCard, color: 'text-kraft-blue' },
            { label: 'Avg. per Payment', value: summary.count ? formatINR(summary.total / summary.count) : '—', icon: Calendar, color: 'text-kraft-accent' },
          ].map(c => (
            <div key={c.label} className="kraft-card p-5 flex items-center gap-4">
              <div className={`w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center ${c.color}`}>
                <c.icon size={18} />
              </div>
              <div>
                <div className="text-xs text-[#666] uppercase tracking-wide mb-0.5">{c.label}</div>
                <div className={`text-xl font-bold mono ${c.color}`}>{c.value}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="kraft-card p-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#555]" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={handleSearch}
              placeholder="Search invoice / client / ref…"
              className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-[#2e2e36] bg-transparent text-white placeholder-[#555] focus:outline-none focus:border-kraft-accent"
            />
          </div>
          <select value={method} onChange={e => setMethod(e.target.value)} className="px-3 py-2 text-sm rounded-lg border border-[#2e2e36] bg-kraft-surface text-white">
            <option value="">All Methods</option>
            {['cash','bank','upi','cheque','neft','rtgs','imps','other'].map(m => (
              <option key={m} value={m}>{m.toUpperCase()}</option>
            ))}
          </select>
          <div className="flex items-center gap-2">
            <Filter size={13} className="text-[#555]" />
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="px-3 py-2 text-sm rounded-lg border border-[#2e2e36] bg-kraft-surface text-white" />
            <span className="text-[#444] text-xs">to</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="px-3 py-2 text-sm rounded-lg border border-[#2e2e36] bg-kraft-surface text-white" />
          </div>
          {(method || dateFrom || dateTo || search) && (
            <button onClick={() => { setMethod(''); setDateFrom(''); setDateTo(''); setSearch(''); }}
              className="text-xs text-kraft-red hover:underline">Clear</button>
          )}
        </div>

        {/* Table */}
        <div className="kraft-card overflow-hidden">
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="w-8 h-8 border-2 border-kraft-accent border-t-transparent rounded-full spin" />
            </div>
          ) : (
            <table className="kraft-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Reference No</th>
                  <th>Invoice No</th>
                  <th>Type</th>
                  <th>Client</th>
                  <th>Method</th>
                  <th>Account/Notes</th>
                  <th className="text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {payments.map(p => (
                  <tr key={p.id}>
                    <td className="text-[#888] text-xs whitespace-nowrap">{p.payment_date}</td>
                    <td className="mono text-xs text-[#aaa]">{p.reference_no || <span className="text-[#444]">—</span>}</td>
                    <td className="mono text-xs text-kraft-accent">{p.invoice_no}</td>
                    <td>
                      <span className="badge text-[10px] bg-kraft-blue/20 text-kraft-blue">Receipt</span>
                    </td>
                    <td className="text-sm text-[#ccc]">{p.client_name || '—'}</td>
                    <td><MethodBadge method={p.method} /></td>
                    <td className="text-xs text-[#666]">{p.notes || '—'}</td>
                    <td className="text-right mono font-semibold text-kraft-green">{formatINR(p.amount)}</td>
                  </tr>
                ))}
                {!payments.length && (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-[#444]">
                      <CreditCard size={28} className="mx-auto mb-2 text-[#333]" />
                      No payments found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
