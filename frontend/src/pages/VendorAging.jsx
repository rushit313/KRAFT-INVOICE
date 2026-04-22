import { useEffect, useState } from 'react';
import axios from 'axios';
import { AlertTriangle, Store, Download, ChevronDown, ChevronRight, Clock } from 'lucide-react';
import Topbar from '../components/Topbar';
import { formatINR } from '../utils/currency';

function AgingBadge({ days }) {
  const d = Math.floor(days || 0);
  if (d <= 0) return <span className="badge bg-green-900/40 text-green-400 text-[10px]">Current</span>;
  if (d <= 30) return <span className="badge bg-amber-900/40 text-amber-400 text-[10px]">{d}d overdue</span>;
  if (d <= 60) return <span className="badge bg-orange-900/40 text-orange-400 text-[10px]">{d}d overdue</span>;
  return <span className="badge bg-red-900/40 text-red-400 text-[10px]">{d}d overdue</span>;
}

export default function VendorAging() {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState({});

  useEffect(() => {
    axios.get('/api/reports/vendor-outstanding')
      .then(r => { setVendors(r.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const toggle = (name) => setExpanded(e => ({ ...e, [name]: !e[name] }));

  const totalPending = vendors.reduce((s, v) => s + v.total_pending, 0);
  const totalBills   = vendors.reduce((s, v) => s + v.bills.length, 0);
  const overdueVendors = vendors.filter(v => v.bills.some(b => b.overdue_days > 0)).length;

  const exportCSV = () => {
    const rows = [];
    vendors.forEach(v => {
      v.bills.forEach(b => {
        rows.push([v.vendor_name, v.vendor_gstin || '', b.bill_no || `PB-${b.id}`,
          b.issue_date, b.due_date || '', b.total, Math.floor(b.overdue_days || 0)
        ].join(','));
      });
    });
    const csv = ['Vendor,GSTIN,Bill No,Issue Date,Due Date,Total,Overdue Days', ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'vendor-aging.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Topbar
        title="Vendor Outstanding & Aging"
        subtitle="Pending purchase bills with overdue analysis"
        actions={[{ label: 'Export CSV', icon: Download, onClick: exportCSV }]}
      />
      <div className="flex-1 overflow-y-auto p-6 space-y-5">

        {/* Summary */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total Payable', value: formatINR(totalPending), icon: Store, color: 'text-kraft-red' },
            { label: 'Pending Bills', value: totalBills, icon: Clock, color: 'text-amber-400' },
            { label: 'Overdue Vendors', value: overdueVendors, icon: AlertTriangle, color: 'text-orange-400' },
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

        {/* Aging Buckets */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Not Due', days: null, color: 'text-green-400', check: d => d <= 0 },
            { label: '1–30 Days', color: 'text-amber-400', check: d => d > 0 && d <= 30 },
            { label: '31–60 Days', color: 'text-orange-400', check: d => d > 30 && d <= 60 },
            { label: '60+ Days', color: 'text-red-400', check: d => d > 60 },
          ].map(bucket => {
            const bills = vendors.flatMap(v => v.bills).filter(b => bucket.check(b.overdue_days || 0));
            const amt = bills.reduce((s, b) => s + (b.total || 0), 0);
            return (
              <div key={bucket.label} className="kraft-card p-4">
                <div className="text-xs text-[#555] uppercase tracking-wide mb-2">{bucket.label}</div>
                <div className={`text-lg font-bold mono ${bucket.color}`}>{formatINR(amt)}</div>
                <div className="text-xs text-[#444] mt-1">{bills.length} bill(s)</div>
              </div>
            );
          })}
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-kraft-accent border-t-transparent rounded-full spin" />
          </div>
        ) : vendors.length === 0 ? (
          <div className="kraft-card p-12 flex flex-col items-center justify-center text-center">
            <Store size={40} className="text-[#333] mb-3" />
            <div className="text-white font-semibold mb-1">No pending vendor bills</div>
            <div className="text-xs text-[#555]">All purchase bills are paid</div>
          </div>
        ) : (
          <div className="space-y-3">
            {vendors.map(vendor => (
              <div key={vendor.vendor_name} className="kraft-card overflow-hidden">
                {/* Vendor Header */}
                <button
                  onClick={() => toggle(vendor.vendor_name)}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/3 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-kraft-red/15 flex items-center justify-center">
                      <Store size={14} className="text-kraft-red" />
                    </div>
                    <div className="text-left">
                      <div className="font-semibold text-white">{vendor.vendor_name}</div>
                      <div className="text-xs text-[#555]">{vendor.vendor_gstin || 'No GSTIN'} · {vendor.bills.length} bill(s)</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-xs text-[#555] mb-0.5">Total Pending</div>
                      <div className="font-bold mono text-kraft-red">{formatINR(vendor.total_pending)}</div>
                    </div>
                    {expanded[vendor.vendor_name]
                      ? <ChevronDown size={16} className="text-[#555]" />
                      : <ChevronRight size={16} className="text-[#555]" />}
                  </div>
                </button>

                {/* Bill Detail */}
                {expanded[vendor.vendor_name] && (
                  <div className="border-t border-[#2a2a32]">
                    <table className="kraft-table">
                      <thead>
                        <tr>
                          <th>Bill No</th>
                          <th>Issue Date</th>
                          <th>Due Date</th>
                          <th>Aging</th>
                          <th className="text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {vendor.bills.map(bill => (
                          <tr key={bill.id}>
                            <td className="mono text-xs text-kraft-blue">{bill.bill_no || `PB-${bill.id}`}</td>
                            <td className="text-xs text-[#888]">{bill.issue_date}</td>
                            <td className="text-xs text-[#888]">{bill.due_date || <span className="text-[#444]">—</span>}</td>
                            <td><AgingBadge days={bill.overdue_days} /></td>
                            <td className="text-right mono font-semibold text-kraft-red">{formatINR(bill.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
