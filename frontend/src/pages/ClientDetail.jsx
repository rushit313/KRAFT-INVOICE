import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Building2, Phone, Mail } from 'lucide-react';
import Topbar from '../components/Topbar';
import InvoiceStatusBadge from '../components/InvoiceStatusBadge';
import { formatINR } from '../utils/currency';

export default function ClientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [client, setClient] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      axios.get(`/api/clients/${id}`),
      axios.get(`/api/clients/${id}/invoices`)
    ]).then(([c, inv]) => { setClient(c.data); setInvoices(inv.data); setLoading(false); });
  }, [id]);

  if (loading) return <div className="flex-1 flex items-center justify-center"><div className="w-8 h-8 border-2 border-kraft-accent border-t-transparent rounded-full spin" /></div>;
  if (!client) return <div className="flex-1 flex items-center justify-center text-[#555]">Not found</div>;

  const totalInvoiced = invoices.reduce((s, i) => s + (i.total || 0), 0);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Topbar title={client.company_name} subtitle="Client Details" actions={[{ label: 'Back', icon: ArrowLeft, onClick: () => navigate('/clients') }]} />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-3 gap-5">
          <div className="space-y-4">
            <div className="kraft-card p-5">
              <div className="w-12 h-12 rounded-xl bg-kraft-accent/15 flex items-center justify-center mb-3">
                <Building2 size={22} className="text-kraft-accent" />
              </div>
              <div className="text-xl font-bold text-white">{client.company_name}</div>
              {client.contact_person && <div className="text-sm text-[#888] mt-1">{client.contact_person}</div>}
              <div className="mt-4 space-y-2">
                {client.phone && <div className="flex items-center gap-2 text-sm text-[#888]"><Phone size={13} />{client.phone}</div>}
                {client.email && <div className="flex items-center gap-2 text-sm text-[#888]"><Mail size={13} />{client.email}</div>}
              </div>
              {client.gstin && <div className="mt-3 px-3 py-2 bg-kraft-surface2 rounded-lg text-xs mono text-kraft-accent">{client.gstin}</div>}
              <div className="mt-3 text-xs text-[#666]">{client.billing_address}<br />{client.city}, {client.state} - {client.pin}</div>
            </div>
            <div className="kraft-card p-5">
              <div className="text-xs text-[#666] uppercase tracking-wide mb-3">Summary</div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm"><span className="text-[#888]">Total Invoices</span><span className="text-white">{invoices.length}</span></div>
                <div className="flex justify-between text-sm"><span className="text-[#888]">Total Invoiced</span><span className="mono text-kraft-accent">{formatINR(totalInvoiced)}</span></div>
              </div>
            </div>
          </div>
          <div className="col-span-2">
            <div className="kraft-card overflow-hidden">
              <div className="px-5 py-3 border-b border-[#2a2a32] text-xs font-semibold text-[#666] uppercase tracking-wide">Invoice History</div>
              <table className="kraft-table">
                <thead><tr><th>Invoice No</th><th>Date</th><th>Due Date</th><th className="text-right">Total</th><th>Status</th></tr></thead>
                <tbody>
                  {invoices.map(inv => (
                    <tr key={inv.id} className="cursor-pointer" onClick={() => navigate(`/invoices/${inv.id}`)}>
                      <td className="text-kraft-accent font-mono text-xs">{inv.invoice_no}</td>
                      <td className="text-[#888] text-xs">{inv.issue_date}</td>
                      <td className="text-[#888] text-xs">{inv.due_date || '—'}</td>
                      <td className="text-right mono font-bold text-white">{formatINR(inv.total)}</td>
                      <td><InvoiceStatusBadge status={inv.status} /></td>
                    </tr>
                  ))}
                  {!invoices.length && <tr><td colSpan={5} className="text-center text-[#555] py-10">No invoices for this client</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
