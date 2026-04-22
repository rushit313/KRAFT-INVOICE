import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { TrendingUp, Clock, AlertTriangle, CheckCircle, Plus, Upload, ArrowRight, Users, Package, FileText, ShoppingCart } from 'lucide-react';
import Topbar from '../components/Topbar';
import InvoiceStatusBadge from '../components/InvoiceStatusBadge';
import { formatINR, formatINRCompact } from '../utils/currency';

function MetricCard({ label, value, icon: Icon, color, sub }) {
  return (
    <div className="kraft-card p-5 fade-in">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs text-[#666670] uppercase tracking-wide font-semibold mb-1">{label}</div>
          <div className="text-2xl font-bold mono text-white">{value}</div>
          {sub && <div className="text-xs text-[#555560] mt-1">{sub}</div>}
        </div>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
          <Icon size={18} />
        </div>
      </div>
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
          <span className="w-2 h-2 rounded-full" style={{ background: p.fill }} />
          <span className="text-[#ccc]">{p.name}: </span>
          <span className="text-white font-mono">{formatINR(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    axios.get('/api/dashboard').then(r => { setData(r.data); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex-1 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-kraft-accent border-t-transparent rounded-full spin" />
    </div>
  );

  const { metrics, counts, recent_invoices, recent_purchases, monthly_chart, gst_preview } = data || {};

  const chartData = (monthly_chart || []).map(m => ({
    name: m.month?.slice(5) + '/' + m.month?.slice(2, 4),
    Invoiced: m.invoiced,
    Collected: m.collected,
  }));

  return (
    <div className="flex-1 overflow-y-auto">
      <Topbar
        title="Dashboard"
        subtitle="Welcome back — here's your business overview"
        actions={[
          { label: 'New Invoice', icon: Plus, primary: true, onClick: () => navigate('/invoices/new') },
          { label: 'Upload Bill', icon: Upload, onClick: () => navigate('/purchases/upload') },
        ]}
      />
      <div className="p-6 space-y-6">
        {/* Metrics */}
        <div className="grid grid-cols-4 gap-4">
          <MetricCard label="Total Invoiced" value={formatINRCompact(metrics?.total_invoiced)} icon={TrendingUp} color="bg-kraft-blue/20 text-kraft-blue" />
          <MetricCard label="Received (90d)" value={formatINRCompact(metrics?.received_90d)} icon={CheckCircle} color="bg-kraft-green/20 text-kraft-green" />
          <MetricCard label="Outstanding" value={formatINRCompact(metrics?.outstanding)} icon={Clock} color="bg-amber-500/20 text-amber-400" />
          <MetricCard label="Overdue" value={formatINRCompact(metrics?.overdue)} icon={AlertTriangle} color="bg-kraft-red/20 text-kraft-red" />
        </div>

        {/* Entity Counts */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Clients', value: counts?.clients ?? '—', icon: Users, color: 'bg-purple-900/30 text-purple-400', to: '/clients' },
            { label: 'Items & Services', value: counts?.items ?? '—', icon: Package, color: 'bg-teal-900/30 text-teal-400', to: '/items' },
            { label: 'Sales Invoices', value: counts?.invoices ?? '—', icon: FileText, color: 'bg-kraft-blue/20 text-kraft-blue', to: '/invoices' },
            { label: 'Purchase Bills', value: counts?.purchases ?? '—', icon: ShoppingCart, color: 'bg-amber-900/30 text-amber-400', to: '/purchases' },
          ].map(c => (
            <button key={c.label} onClick={() => navigate(c.to)}
              className="kraft-card p-4 flex items-center gap-3 text-left hover:border-white/10 transition-all group">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${c.color}`}>
                <c.icon size={15} />
              </div>
              <div>
                <div className="text-2xl font-bold mono text-white">{c.value}</div>
                <div className="text-xs text-[#555] mt-0.5">{c.label}</div>
              </div>
              <ArrowRight size={13} className="ml-auto text-[#333] group-hover:text-[#666] transition-colors" />
            </button>
          ))}
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-3 gap-4">
          {/* Bar Chart */}
          <div className="col-span-2 kraft-card p-5">
            <div className="text-sm font-semibold text-white mb-4">Invoiced vs Collected (Last 6 Months)</div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} barSize={14} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a32" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: '#666670', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#666670', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => formatINRCompact(v)} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                <Bar dataKey="Invoiced" fill="#5b9cf6" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Collected" fill="#4caf7d" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* GST Preview */}
          <div className="kraft-card p-5">
            <div className="text-sm font-semibold text-white mb-4">GST Preview (This Month)</div>
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between items-center text-[10px] font-black text-[#555] uppercase tracking-widest mb-1">
                  <span>Output Tax (Sales)</span>
                  <span className="text-white mono">{formatINR(gst_preview?.output_cgst + gst_preview?.output_sgst + gst_preview?.output_igst)}</span>
                </div>
                {[
                  { label: 'CGST', val: gst_preview?.output_cgst },
                  { label: 'SGST', val: gst_preview?.output_sgst },
                  { label: 'IGST', val: gst_preview?.output_igst },
                ].map(row => (
                  <div key={row.label} className="flex justify-between text-xs font-medium">
                    <span className="text-[#444]">{row.label}</span>
                    <span className="mono text-[#888]">{formatINR(row.val)}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-2 border-t border-white/5 pt-4">
                <div className="flex justify-between items-center text-[10px] font-black text-[#555] uppercase tracking-widest mb-1">
                  <span>Input Tax Credit (Purchases)</span>
                  <span className="text-kraft-green mono">{formatINR(gst_preview?.itc_cgst + gst_preview?.itc_sgst + gst_preview?.itc_igst)}</span>
                </div>
                {[
                  { label: 'ITC CGST', val: gst_preview?.itc_cgst },
                  { label: 'ITC SGST', val: gst_preview?.itc_sgst },
                  { label: 'ITC IGST', val: gst_preview?.itc_igst },
                ].map(row => (
                  <div key={row.label} className="flex justify-between text-xs font-medium">
                    <span className="text-[#444]">{row.label}</span>
                    <span className="mono text-kraft-green">-{formatINR(row.val)}</span>
                  </div>
                ))}
              </div>

              <div className="border-t-[3px] border-kraft-accent/30 pt-4 relative flex justify-between items-end">
                <div className="absolute -top-[1.5px] left-0 right-0 border-t border-kraft-accent" />
                <span className="font-black text-xs text-white uppercase tracking-tighter">Net Payable Amount</span>
                <span className="mono font-black text-2xl text-kraft-accent tracking-tighter drop-shadow-[0_0_15px_rgba(200,169,110,0.3)]">{formatINR(gst_preview?.total_payable)}</span>
              </div>
            </div>
            <button onClick={() => navigate('/gst-summary')} className="mt-6 w-full py-3 bg-white/5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] text-[#555] hover:text-kraft-accent hover:border-kraft-accent/30 transition-all border border-transparent">
               Comprehensive GST Audit <ArrowRight size={12} className="inline ml-1" />
            </button>
          </div>
        </div>

        {/* Recent Tables */}
        <div className="grid grid-cols-2 gap-4">
          {/* Recent Invoices */}
          <div className="kraft-card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-[#2a2a32]">
              <div className="text-sm font-semibold text-white">Recent Invoices</div>
              <button onClick={() => navigate('/invoices')} className="text-xs text-kraft-accent hover:underline flex items-center gap-1">View all <ArrowRight size={11} /></button>
            </div>
            <table className="kraft-table">
              <thead><tr><th>Invoice</th><th>Client</th><th className="text-right">Amount</th><th>Status</th></tr></thead>
              <tbody>
                {(recent_invoices || []).map(inv => (
                  <tr key={inv.id} className="cursor-pointer" onClick={() => navigate(`/invoices/${inv.id}`)}>
                    <td className="font-mono text-xs text-kraft-accent">{inv.invoice_no}</td>
                    <td className="text-[#aaa]">{inv.client_name}</td>
                    <td className="text-right mono text-xs">{formatINR(inv.total)}</td>
                    <td><InvoiceStatusBadge status={inv.status} /></td>
                  </tr>
                ))}
                {!recent_invoices?.length && <tr><td colSpan={4} className="text-center text-[#555] py-6">No invoices yet</td></tr>}
              </tbody>
            </table>
          </div>

          {/* Recent Purchases */}
          <div className="kraft-card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-[#2a2a32]">
              <div className="text-sm font-semibold text-white">Recent Purchases</div>
              <button onClick={() => navigate('/purchases')} className="text-xs text-kraft-accent hover:underline flex items-center gap-1">View all <ArrowRight size={11} /></button>
            </div>
            <table className="kraft-table">
              <thead><tr><th>Bill No</th><th>Vendor</th><th className="text-right">Amount</th><th>Status</th></tr></thead>
              <tbody>
                {(recent_purchases || []).map(pb => (
                  <tr key={pb.id} className="cursor-pointer" onClick={() => navigate(`/purchases/${pb.id}`)}>
                    <td className="font-mono text-xs text-kraft-blue">{pb.bill_no || `PB-${pb.id}`}</td>
                    <td className="text-[#aaa]">{pb.vendor_name}</td>
                    <td className="text-right mono text-xs">{formatINR(pb.total)}</td>
                    <td><InvoiceStatusBadge status={pb.status} /></td>
                  </tr>
                ))}
                {!recent_purchases?.length && <tr><td colSpan={4} className="text-center text-[#555] py-6">No purchases yet</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
