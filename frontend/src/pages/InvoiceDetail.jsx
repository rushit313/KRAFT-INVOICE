import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Download, Plus, ArrowLeft, Edit, Trash2, Layout, Maximize2, Printer } from 'lucide-react';
import Topbar from '../components/Topbar';
import VisualInvoice from '../components/VisualInvoice';
import { formatINR } from '../utils/currency';

export default function InvoiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState(null);
  const [company, setCompany] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPayForm, setShowPayForm] = useState(false);
  const [payForm, setPayForm] = useState({ payment_date: new Date().toISOString().split('T')[0], amount: '', method: 'NEFT', reference_no: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState('');

  const [pdfOptions, setPdfOptions] = useState({
    label: 'Original Copy',
    template: 'model-1',
    color: '#1a1a2e',
    layout: 'a4-portrait'
  });

  const loadData = async () => {
    const [invRes, payRes, coRes] = await Promise.all([
      axios.get(`/api/invoices/${id}`),
      axios.get(`/api/invoices/${id}/payments`),
      axios.get('/api/company'),
    ]);
    setInvoice(invRes.data);
    setPayments(payRes.data);
    setCompany(coRes.data);
    setPayForm(f => ({ ...f, amount: invRes.data.balance_due || '' }));
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [id]);

  const downloadPDF = async () => {
    setPdfLoading(true);
    try {
      const q = new URLSearchParams(pdfOptions).toString();
      const res = await axios.get(`/api/invoices/${id}/pdf?${q}`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url; a.download = `${invoice.invoice_no}.pdf`; a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      const msg = e.response?.data ? (typeof e.response.data === 'string' ? e.response.data : JSON.stringify(e.response.data)) : e.message;
      alert('PDF generation failed: ' + msg);
    } finally { setPdfLoading(false); }
  };

  const recordPayment = async () => {
    setSaving(true);
    try {
      await axios.post(`/api/invoices/${id}/payments`, payForm);
      setShowPayForm(false);
      loadData();
    } catch (e) { alert(e.response?.data?.error || 'Failed to record payment'); }
    finally { setSaving(false); }
  };

  const deleteInvoice = async () => {
    setSaving(true);
    try {
      await axios.delete(`/api/invoices/${id}`);
      navigate('/invoices');
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to delete invoice');
      setShowDeleteConfirm(false);
    } finally { setSaving(false); }
  };

  if (loading) return <div className="flex-1 flex items-center justify-center"><div className="w-8 h-8 border-2 border-kraft-accent border-t-transparent rounded-full animate-spin" /></div>;
  if (!invoice) return <div className="flex-1 flex items-center justify-center text-[#555]">Invoice not found</div>;

  const TEMPLATES = [
    { value: 'model-1', label: 'Modern', desc: 'Dark header + banner' },
    { value: 'model-2', label: 'Classic', desc: 'Traditional bordered' },
    { value: 'model-3', label: 'Minimal', desc: 'Clean SaaS style' },
  ];

  const COLORS = ['#1a1a2e', '#0f2744', '#1a2e1a', '#2e1a0e', '#c8a96e', '#4f46e5', '#e11d48', '#0891b2'];

  const LAYOUTS = [
    { value: 'a4-portrait', label: 'A4 Portrait', icon: <Layout size={16} /> },
    { value: 'a4-landscape', label: 'A4 Landscape', icon: <Layout size={16} className="rotate-90" /> },
    { value: 'a5-portrait', label: 'A5 Portrait', icon: <Maximize2 size={16} /> },
    { value: 'a5-landscape', label: 'A5 Landscape', icon: <Maximize2 size={16} className="rotate-90" /> },
  ];

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Topbar
        title={invoice.invoice_no}
        subtitle={invoice.client_name}
        actions={[
          { label: 'Back', icon: ArrowLeft, onClick: () => navigate('/invoices') },
          { label: 'Edit', icon: Edit, onClick: () => navigate(`/invoices/${id}/edit`) },
          { label: pdfLoading ? 'Generating...' : 'Download PDF', icon: Download, onClick: downloadPDF },
          { label: 'Record Payment', icon: Plus, primary: true, onClick: () => setShowPayForm(true) },
        ]}
      />

      {/* Delete Confirm Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/90 z-[300] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-kraft-surface border border-red-900/30 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-red-950/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 size={32} className="text-kraft-red" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Delete Invoice?</h3>
              <p className="text-xs text-[#666] leading-relaxed">
                This will permanently remove <span className="text-white font-mono">{invoice.invoice_no}</span> and all associated payment records.
              </p>
            </div>
            <div className="p-4 bg-white/[0.02] flex gap-3">
              <button onClick={deleteInvoice} disabled={saving}
                className="flex-1 py-2.5 bg-kraft-red text-white font-bold rounded-xl hover:bg-kraft-red/90 disabled:opacity-50 transition-all text-xs">
                {saving ? 'Deleting...' : 'Confirm Delete'}
              </button>
              <button onClick={() => setShowDeleteConfirm(false)}
                className="px-6 py-2.5 bg-kraft-surface2 text-[#888] rounded-xl hover:text-white transition-all text-xs font-medium">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {error && <div className="mx-6 mt-4 px-4 py-3 bg-red-950/50 border border-red-800/50 rounded-lg text-red-400 text-sm">{error}</div>}

        <div className="flex gap-0 h-full">
          {/* ── Left: PDF Options Panel ── */}
          <div className="w-64 flex-shrink-0 border-r border-[#2a2a32] overflow-y-auto p-4 space-y-5">

            {/* Template */}
            <div>
              <div className="text-[10px] font-bold text-[#555] uppercase tracking-widest mb-2">Template</div>
              <div className="space-y-1.5">
                {TEMPLATES.map(t => (
                  <button key={t.value} onClick={() => setPdfOptions(f => ({ ...f, template: t.value }))}
                    className={`w-full p-2.5 rounded-lg border text-left transition-all ${pdfOptions.template === t.value ? 'border-kraft-accent bg-kraft-accent/5' : 'border-[#2a2a32] bg-kraft-surface2 hover:border-[#444]'}`}>
                    <div className={`text-xs font-bold ${pdfOptions.template === t.value ? 'text-kraft-accent' : 'text-white'}`}>{t.label}</div>
                    <div className="text-[9px] text-[#555] mt-0.5">{t.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Label */}
            <div>
              <div className="text-[10px] font-bold text-[#555] uppercase tracking-widest mb-2">Document Label</div>
              <select value={pdfOptions.label} onChange={e => setPdfOptions(f => ({ ...f, label: e.target.value }))}
                className="w-full px-3 py-2 text-xs rounded-lg border border-[#2a2a32] bg-kraft-surface2 text-white">
                {['Original Copy', 'Duplicate Copy', 'Triplicate Copy', 'Extra Copy'].map(l => <option key={l}>{l}</option>)}
              </select>
            </div>

            {/* Color */}
            <div>
              <div className="text-[10px] font-bold text-[#555] uppercase tracking-widest mb-2">Theme Color</div>
              <div className="flex flex-wrap gap-2 mb-2">
                {COLORS.map(c => (
                  <button key={c} onClick={() => setPdfOptions(f => ({ ...f, color: c }))} title={c}
                    className={`w-6 h-6 rounded-full transition-all ${pdfOptions.color === c ? 'ring-2 ring-white ring-offset-1 ring-offset-kraft-bg scale-110' : 'hover:scale-105'}`}
                    style={{ backgroundColor: c }} />
                ))}
                <input type="color" value={pdfOptions.color} onChange={e => setPdfOptions(f => ({ ...f, color: e.target.value }))}
                  title="Custom" className="w-6 h-6 rounded-full cursor-pointer border-0 overflow-hidden p-0 bg-transparent"
                  style={{ WebkitAppearance: 'none' }} />
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: pdfOptions.color }} />
                <input type="text" value={pdfOptions.color}
                  onChange={e => { if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) setPdfOptions(f => ({ ...f, color: e.target.value })); }}
                  className="text-[10px] text-[#888] mono bg-transparent border-b border-[#2a2a32] focus:outline-none focus:border-kraft-accent w-20 pb-0.5"
                  maxLength={7} />
              </div>
            </div>

            {/* Layout */}
            <div>
              <div className="text-[10px] font-bold text-[#555] uppercase tracking-widest mb-2">Page Layout</div>
              <div className="grid grid-cols-2 gap-1.5">
                {LAYOUTS.map(l => (
                  <button key={l.value} onClick={() => setPdfOptions(f => ({ ...f, layout: l.value }))}
                    className={`flex flex-col items-center gap-1 p-2.5 rounded-lg border transition-all ${pdfOptions.layout === l.value ? 'border-kraft-accent bg-kraft-accent/5 text-kraft-accent' : 'border-[#2a2a32] bg-kraft-surface2 text-[#555] hover:text-[#aaa]'}`}>
                    {l.icon}
                    <span className="text-[9px] font-bold">{l.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Download */}
            <button onClick={downloadPDF} disabled={pdfLoading}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-kraft-accent text-kraft-bg font-bold rounded-lg text-xs hover:opacity-90 disabled:opacity-50">
              <Printer size={14} /> {pdfLoading ? 'Preparing...' : 'Download PDF'}
            </button>

            <div className="border-t border-[#2a2a32] pt-4 space-y-2">
              {/* Balance summary */}
              <div className="bg-kraft-surface2 rounded-lg p-3 space-y-1.5">
                <div className="flex justify-between text-xs"><span className="text-[#666]">Total</span><span className="mono text-white">{formatINR(invoice.total)}</span></div>
                <div className="flex justify-between text-xs"><span className="text-kraft-green">Paid</span><span className="mono text-kraft-green">{formatINR(invoice.total_paid || 0)}</span></div>
                <div className="flex justify-between text-xs font-bold border-t border-[#2a2a32] pt-1.5"><span className="text-white">Balance Due</span><span className="mono text-kraft-red">{formatINR(invoice.balance_due || invoice.total)}</span></div>
              </div>

              {/* Record payment inline */}
              {showPayForm && (
                <div className="space-y-2 pt-1">
                  <div className="text-[10px] font-bold text-[#555] uppercase tracking-widest">Record Payment</div>
                  <input type="date" value={payForm.payment_date} onChange={e => setPayForm(f => ({ ...f, payment_date: e.target.value }))}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-[#2a2a32] bg-kraft-surface2 text-white" />
                  <input type="number" placeholder="Amount" value={payForm.amount} onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-[#2a2a32] bg-kraft-surface2 text-white mono" />
                  <select value={payForm.method} onChange={e => setPayForm(f => ({ ...f, method: e.target.value }))}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-[#2a2a32] bg-kraft-surface2 text-white">
                    {['Cash','Cheque','NEFT','UPI','Card'].map(m => <option key={m}>{m}</option>)}
                  </select>
                  <input placeholder="Reference No" value={payForm.reference_no} onChange={e => setPayForm(f => ({ ...f, reference_no: e.target.value }))}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-[#2a2a32] bg-kraft-surface2 text-white mono" />
                  <div className="flex gap-1.5">
                    <button onClick={recordPayment} disabled={saving}
                      className="flex-1 py-1.5 bg-kraft-green/20 text-kraft-green rounded-lg text-xs font-bold hover:bg-kraft-green/30">
                      {saving ? '...' : 'Record'}
                    </button>
                    <button onClick={() => setShowPayForm(false)} className="px-3 py-1.5 bg-kraft-surface2 text-[#888] rounded-lg text-xs">Cancel</button>
                  </div>
                </div>
              )}

              {/* Payment history */}
              {payments.length > 0 && (
                <div>
                  <div className="text-[10px] font-bold text-[#555] uppercase tracking-widest mb-1.5">Payments</div>
                  <div className="space-y-1">
                    {payments.map(p => (
                      <div key={p.id} className="flex justify-between items-center text-[10px] py-1 border-b border-[#1e1e26]">
                        <div><div className="text-[#888]">{p.payment_date}</div><div className="text-[#555]">{p.method}</div></div>
                        <div className="mono text-kraft-green font-semibold">{formatINR(p.amount)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button onClick={() => setShowDeleteConfirm(true)}
                className="w-full py-2 flex items-center justify-center gap-1.5 text-xs text-kraft-red hover:bg-red-950/30 rounded-lg transition-all border border-red-950/50">
                <Trash2 size={12} /> Delete Invoice
              </button>
            </div>
          </div>

          {/* ── Right: White Invoice Preview ── */}
          <div className="flex-1 overflow-y-auto bg-[#f0f0f0] p-6">
            <VisualInvoice
              invoice={invoice}
              company={company}
              themeColor={pdfOptions.color}
              docLabel={pdfOptions.label}
              template={pdfOptions.template}
              layout={pdfOptions.layout}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
