import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Upload, FileText, CheckCircle, AlertCircle, Loader2, ArrowLeft,
  Trash2, ArrowRight, Eye, Plus, Minus, ChevronRight, Database
} from 'lucide-react';
import Topbar from '../components/Topbar';
import VisualInvoice from '../components/VisualInvoice';
import { formatINR } from '../utils/currency';

const EMPTY_ITEM = { description: '', hsn_sac: '', qty: 1, unit: 'Nos', price: 0, tax_rate: 18 };

export default function BillExtractor() {
  const [files, setFiles] = useState([]);          // { id, file, status, data, error }
  const [selected, setSelected] = useState(null);  // id of selected file
  const [processing, setProcessing] = useState(false);
  const [company, setCompany] = useState(null);
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  // Load company once for preview
  const ensureCompany = async () => {
    if (company) return company;
    try { const r = await axios.get('/api/company'); setCompany(r.data); return r.data; } catch { return {}; }
  };

  const addFiles = (e) => {
    const newFiles = Array.from(e.target.files).filter(f =>
      ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg', 'image/webp'].includes(f.type)
    );
    if (!newFiles.length) return;
    const staged = newFiles.map(file => ({ file, status: 'pending', data: null, error: null, id: crypto.randomUUID() }));
    setFiles(prev => [...prev, ...staged]);
    if (!selected && staged.length) setSelected(staged[0].id);
    e.target.value = null;
  };

  const processOne = async (item) => {
    await ensureCompany();
    setFiles(prev => prev.map(f => f.id === item.id ? { ...f, status: 'processing' } : f));
    try {
      const fd = new FormData();
      fd.append('file', item.file);
      const res = await axios.post('/api/invoices/extract', fd);
      if (res.data.success) {
        const data = res.data.extracted;
        // Ensure items have all fields
        data.items = (data.items || []).map(it => ({ ...EMPTY_ITEM, ...it }));
        setFiles(prev => prev.map(f => f.id === item.id ? { ...f, status: 'extracted', data } : f));
        setSelected(item.id);
      } else throw new Error(res.data.error || 'Extraction failed');
    } catch (err) {
      setFiles(prev => prev.map(f => f.id === item.id ? { ...f, status: 'error', error: err.response?.data?.error || err.message } : f));
    }
  };

  const processAll = async () => {
    setProcessing(true);
    const pending = files.filter(f => f.status === 'pending');
    for (const item of pending) await processOne(item);
    setProcessing(false);
  };

  const confirmOne = async (item) => {
    setFiles(prev => prev.map(f => f.id === item.id ? { ...f, status: 'saving' } : f));
    try {
      await axios.post('/api/invoices/confirm-extract', { extracted: item.data });
      setFiles(prev => prev.map(f => f.id === item.id ? { ...f, status: 'saved' } : f));
    } catch (err) {
      alert('Import failed: ' + (err.response?.data?.error || err.message));
      setFiles(prev => prev.map(f => f.id === item.id ? { ...f, status: 'extracted' } : f));
    }
  };

  const confirmAll = async () => {
    const ready = files.filter(f => f.status === 'extracted');
    for (const item of ready) await confirmOne(item);
  };

  const updateData = (id, patch) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, data: { ...f.data, ...patch } } : f));
  };
  const updateItem = (id, idx, patch) => {
    setFiles(prev => prev.map(f => {
      if (f.id !== id) return f;
      const items = [...(f.data.items || [])];
      items[idx] = { ...items[idx], ...patch };
      return { ...f, data: { ...f.data, items } };
    }));
  };
  const addItem = (id) => {
    setFiles(prev => prev.map(f => f.id !== id ? f : { ...f, data: { ...f.data, items: [...(f.data.items || []), { ...EMPTY_ITEM }] } }));
  };
  const removeItem = (id, idx) => {
    setFiles(prev => prev.map(f => f.id !== id ? f : { ...f, data: { ...f.data, items: f.data.items.filter((_, i) => i !== idx) } }));
  };

  const selectedFile = files.find(f => f.id === selected);

  // Build preview invoice object from extracted data
  const buildPreviewInvoice = (data) => {
    if (!data) return null;
    const items = (data.items || []).map(it => {
      const taxable = (it.qty || 1) * (it.price || 0);
      const rate = it.tax_rate || 18;
      const cgst = Math.round(taxable * (rate / 2) / 100 * 100) / 100;
      const sgst = cgst;
      return { ...it, taxable_value: taxable, cgst_pct: rate / 2, cgst_amt: cgst, sgst_pct: rate / 2, sgst_amt: sgst, igst_pct: 0, igst_amt: 0, amount: taxable + cgst + sgst };
    });
    const subtotal = items.reduce((s, i) => s + (i.taxable_value || 0), 0);
    const total_cgst = items.reduce((s, i) => s + (i.cgst_amt || 0), 0);
    const total_sgst = items.reduce((s, i) => s + (i.sgst_amt || 0), 0);
    const total = Math.round(subtotal + total_cgst + total_sgst);
    return {
      invoice_no: data.invoice_no || 'PREVIEW',
      issue_date: data.issue_date,
      due_date: data.due_date,
      place_of_supply: data.place_of_supply,
      supply_type: data.supply_type || 'intra',
      status: 'unpaid',
      client_name: data.client_name || data.matched_client?.company_name || 'Client',
      client_billing_address: data.client_address || data.matched_client?.billing_address,
      client_city: data.client_city || data.matched_client?.city,
      client_state: data.client_state || data.matched_client?.state,
      client_gstin: data.client_gstin,
      terms: data.terms,
      items, subtotal, total_cgst, total_sgst, total_igst: 0, total,
      total_paid: 0, balance_due: total, rounded_off: 0,
    };
  };

  const statusColor = { pending: '#555', processing: '#c8a96e', extracted: '#22c55e', saving: '#c8a96e', saved: '#4f46e5', error: '#ef4444' };
  const statusLabel = { pending: 'Pending', processing: 'Extracting…', extracted: 'Ready', saving: 'Saving…', saved: 'Imported', error: 'Error' };

  const stats = { total: files.length, extracted: files.filter(f => f.status === 'extracted').length, saved: files.filter(f => f.status === 'saved').length };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Topbar
        title="Migrate Database"
        subtitle={`Import historical bills from other apps · ${stats.saved}/${stats.total} imported`}
        actions={[
          { label: 'Back to Bills', icon: ArrowLeft, onClick: () => navigate('/invoices') },
        ]}
      />

      <div className="flex-1 flex overflow-hidden">

        {/* ── Left: Queue Panel ── */}
        <div className="w-72 flex-shrink-0 flex flex-col border-r border-[#2a2a32] overflow-hidden">
          {/* Upload zone */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="m-3 p-4 border-2 border-dashed border-[#2a2a32] rounded-xl cursor-pointer hover:border-kraft-accent/50 hover:bg-kraft-accent/5 transition-all text-center group"
          >
            <Upload size={20} className="mx-auto mb-1.5 text-[#444] group-hover:text-kraft-accent transition-colors" />
            <div className="text-xs font-bold text-[#555] group-hover:text-kraft-accent transition-colors">Add PDF or Images</div>
            <div className="text-[10px] text-[#333] mt-0.5">PDF, JPG, PNG supported</div>
            <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp" className="hidden" ref={fileInputRef} onChange={addFiles} />
          </div>

          {/* Action buttons */}
          {files.length > 0 && (
            <div className="px-3 pb-3 flex gap-2">
              <button
                onClick={processAll}
                disabled={processing || !files.some(f => f.status === 'pending')}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-kraft-accent text-kraft-bg text-xs font-bold rounded-lg disabled:opacity-30 hover:opacity-90"
              >
                {processing ? <Loader2 size={13} className="animate-spin" /> : <ArrowRight size={13} />}
                {processing ? 'Extracting…' : 'Extract All'}
              </button>
              {stats.extracted > 0 && (
                <button
                  onClick={confirmAll}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-kraft-green/20 text-kraft-green text-xs font-bold rounded-lg hover:bg-kraft-green/30"
                >
                  <Database size={13} />
                  Import All ({stats.extracted})
                </button>
              )}
            </div>
          )}

          {/* File list */}
          <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-1.5">
            {files.length === 0 && (
              <div className="py-12 text-center">
                <FileText size={28} className="mx-auto mb-3 text-[#2a2a32]" />
                <div className="text-xs text-[#333] font-bold uppercase tracking-widest">No files staged</div>
              </div>
            )}
            {files.map(item => (
              <div
                key={item.id}
                onClick={() => setSelected(item.id)}
                className={`p-3 rounded-xl cursor-pointer transition-all border ${selected === item.id ? 'border-kraft-accent/40 bg-kraft-accent/5' : 'border-[#1e1e26] hover:border-[#2e2e38] bg-kraft-surface2'}`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: statusColor[item.status] + '20' }}>
                    {item.status === 'processing' || item.status === 'saving'
                      ? <Loader2 size={14} className="animate-spin" style={{ color: statusColor[item.status] }} />
                      : item.status === 'saved' ? <CheckCircle size={14} style={{ color: statusColor[item.status] }} />
                      : item.status === 'error' ? <AlertCircle size={14} style={{ color: statusColor[item.status] }} />
                      : <FileText size={14} style={{ color: statusColor[item.status] }} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-white truncate">{item.file.name}</div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[9px] font-bold uppercase" style={{ color: statusColor[item.status] }}>{statusLabel[item.status]}</span>
                      {item.data?.client_name && <span className="text-[9px] text-[#555] truncate">· {item.data.client_name}</span>}
                    </div>
                  </div>
                  {item.status === 'pending' && (
                    <button onClick={e => { e.stopPropagation(); setFiles(prev => prev.filter(f => f.id !== item.id)); }} className="p-1 text-[#333] hover:text-kraft-red">
                      <Trash2 size={12} />
                    </button>
                  )}
                  {item.status === 'pending' && (
                    <button onClick={e => { e.stopPropagation(); processOne(item); }} className="p-1 text-[#444] hover:text-kraft-accent">
                      <ChevronRight size={12} />
                    </button>
                  )}
                </div>
                {item.status === 'extracted' && item.data && (
                  <div className="mt-2 pt-2 border-t border-[#1e1e26] grid grid-cols-2 gap-x-3 gap-y-0.5">
                    <div className="text-[9px] text-[#555]">Invoice <span className="text-[#888]">{item.data.invoice_no}</span></div>
                    <div className="text-[9px] text-[#555]">Date <span className="text-[#888]">{item.data.issue_date}</span></div>
                    <div className="col-span-2 text-[9px] text-kraft-accent truncate">{item.data.matched_client ? '✓ Client matched' : '+ New client'}</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ── Right: Review + Preview Panel ── */}
        {!selectedFile ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-12">
            <div className="w-20 h-20 rounded-3xl border-2 border-dashed border-[#2a2a32] flex items-center justify-center mb-6">
              <Database size={32} className="text-[#2a2a32]" />
            </div>
            <div className="text-lg font-black text-[#333] uppercase tracking-widest mb-2">Migration Engine</div>
            <div className="text-sm text-[#444] max-w-sm">Upload your historical sales bills (PDF or images) from your previous software. Each bill will be extracted and imported as an invoice.</div>
          </div>
        ) : (
          <div className="flex-1 flex overflow-hidden">

            {/* Edit Form */}
            <div className="w-96 flex-shrink-0 border-r border-[#2a2a32] overflow-y-auto p-5 space-y-5">

              {selectedFile.status === 'pending' && (
                <div className="text-center py-12">
                  <button onClick={() => processOne(selectedFile)} className="flex items-center gap-2 mx-auto px-6 py-3 bg-kraft-accent text-kraft-bg text-sm font-bold rounded-xl hover:opacity-90">
                    <ArrowRight size={16} /> Extract This Bill
                  </button>
                  <div className="text-xs text-[#444] mt-3">{selectedFile.file.name}</div>
                </div>
              )}

              {(selectedFile.status === 'processing' || selectedFile.status === 'saving') && (
                <div className="flex flex-col items-center justify-center py-16 gap-4">
                  <Loader2 size={36} className="animate-spin text-kraft-accent" />
                  <div className="text-sm text-[#666]">{selectedFile.status === 'processing' ? 'Extracting data…' : 'Saving invoice…'}</div>
                </div>
              )}

              {selectedFile.status === 'error' && (
                <div className="p-4 bg-red-950/20 border border-red-800/30 rounded-xl">
                  <div className="text-xs font-bold text-kraft-red mb-1">Extraction Failed</div>
                  <div className="text-xs text-[#888]">{selectedFile.error}</div>
                  <button onClick={() => processOne(selectedFile)} className="mt-3 px-4 py-1.5 bg-kraft-surface2 text-[#888] text-xs rounded-lg hover:text-white">Retry</button>
                </div>
              )}

              {selectedFile.status === 'saved' && (
                <div className="text-center py-12 space-y-3">
                  <CheckCircle size={40} className="mx-auto text-kraft-green" />
                  <div className="text-sm font-bold text-white">Invoice Imported Successfully</div>
                  <div className="text-xs text-[#555]">Invoice {selectedFile.data?.invoice_no} is now under Sales Bills</div>
                  <button onClick={() => navigate('/invoices')} className="mt-2 px-5 py-2 bg-kraft-accent text-kraft-bg text-xs font-bold rounded-lg">View in Sales Bills</button>
                </div>
              )}

              {(selectedFile.status === 'extracted') && selectedFile.data && (
                <>
                  <div>
                    <div className="text-[10px] font-bold text-[#555] uppercase tracking-widest mb-3">Invoice Details</div>
                    <div className="space-y-2.5">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-[#555] uppercase font-bold mb-1 block">Invoice No</label>
                          <input value={selectedFile.data.invoice_no || ''} onChange={e => updateData(selectedFile.id, { invoice_no: e.target.value })}
                            className="w-full px-2.5 py-2 text-xs rounded-lg border border-[#2a2a32] bg-kraft-surface2 text-white mono" />
                        </div>
                        <div>
                          <label className="text-[10px] text-[#555] uppercase font-bold mb-1 block">Issue Date</label>
                          <input type="date" value={selectedFile.data.issue_date || ''} onChange={e => updateData(selectedFile.id, { issue_date: e.target.value })}
                            className="w-full px-2.5 py-2 text-xs rounded-lg border border-[#2a2a32] bg-kraft-surface2 text-white" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-[#555] uppercase font-bold mb-1 block">Due Date</label>
                          <input type="date" value={selectedFile.data.due_date || ''} onChange={e => updateData(selectedFile.id, { due_date: e.target.value })}
                            className="w-full px-2.5 py-2 text-xs rounded-lg border border-[#2a2a32] bg-kraft-surface2 text-white" />
                        </div>
                        <div>
                          <label className="text-[10px] text-[#555] uppercase font-bold mb-1 block">Place of Supply</label>
                          <input value={selectedFile.data.place_of_supply || ''} onChange={e => updateData(selectedFile.id, { place_of_supply: e.target.value })}
                            className="w-full px-2.5 py-2 text-xs rounded-lg border border-[#2a2a32] bg-kraft-surface2 text-white" />
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] text-[#555] uppercase font-bold mb-1 block">Supply Type</label>
                        <select value={selectedFile.data.supply_type || 'intra'} onChange={e => updateData(selectedFile.id, { supply_type: e.target.value })}
                          className="w-full px-2.5 py-2 text-xs rounded-lg border border-[#2a2a32] bg-kraft-surface2 text-white">
                          <option value="intra">Intra-State (CGST + SGST)</option>
                          <option value="inter">Inter-State (IGST)</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] font-bold text-[#555] uppercase tracking-widest mb-2">Client</div>
                    {selectedFile.data.matched_client && (
                      <div className="mb-2 px-3 py-2 bg-kraft-green/10 border border-kraft-green/20 rounded-lg text-xs text-kraft-green">
                        ✓ Matched: {selectedFile.data.matched_client.company_name}
                      </div>
                    )}
                    <div className="space-y-2">
                      <input value={selectedFile.data.client_name || ''} onChange={e => updateData(selectedFile.id, { client_name: e.target.value })}
                        placeholder="Client / Company Name *" className="w-full px-2.5 py-2 text-xs rounded-lg border border-[#2a2a32] bg-kraft-surface2 text-white" />
                      <input value={selectedFile.data.client_gstin || ''} onChange={e => updateData(selectedFile.id, { client_gstin: e.target.value })}
                        placeholder="GSTIN" className="w-full px-2.5 py-2 text-xs rounded-lg border border-[#2a2a32] bg-kraft-surface2 text-white mono" />
                      <input value={selectedFile.data.client_address || ''} onChange={e => updateData(selectedFile.id, { client_address: e.target.value })}
                        placeholder="Billing Address" className="w-full px-2.5 py-2 text-xs rounded-lg border border-[#2a2a32] bg-kraft-surface2 text-white" />
                      <div className="grid grid-cols-2 gap-2">
                        <input value={selectedFile.data.client_city || ''} onChange={e => updateData(selectedFile.id, { client_city: e.target.value })}
                          placeholder="City" className="w-full px-2.5 py-2 text-xs rounded-lg border border-[#2a2a32] bg-kraft-surface2 text-white" />
                        <input value={selectedFile.data.client_state || ''} onChange={e => updateData(selectedFile.id, { client_state: e.target.value })}
                          placeholder="State" className="w-full px-2.5 py-2 text-xs rounded-lg border border-[#2a2a32] bg-kraft-surface2 text-white" />
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-[10px] font-bold text-[#555] uppercase tracking-widest">Line Items</div>
                      <button onClick={() => addItem(selectedFile.id)} className="text-[10px] text-kraft-accent hover:underline flex items-center gap-1">
                        <Plus size={11} /> Add Item
                      </button>
                    </div>
                    <div className="space-y-2">
                      {(selectedFile.data.items || []).map((item, idx) => (
                        <div key={idx} className="bg-kraft-surface2 rounded-lg p-2.5 space-y-2">
                          <div className="flex gap-1.5 items-start">
                            <input value={item.description} onChange={e => updateItem(selectedFile.id, idx, { description: e.target.value })}
                              placeholder="Description *" className="flex-1 px-2 py-1.5 text-xs rounded border border-[#2a2a32] bg-[#0f0f14] text-white" />
                            <button onClick={() => removeItem(selectedFile.id, idx)} className="p-1.5 text-[#333] hover:text-kraft-red mt-0.5">
                              <Minus size={11} />
                            </button>
                          </div>
                          <div className="grid grid-cols-4 gap-1.5">
                            <input value={item.hsn_sac || ''} onChange={e => updateItem(selectedFile.id, idx, { hsn_sac: e.target.value })}
                              placeholder="HSN" className="px-2 py-1.5 text-xs rounded border border-[#2a2a32] bg-[#0f0f14] text-white mono" />
                            <input type="number" value={item.qty} onChange={e => updateItem(selectedFile.id, idx, { qty: parseFloat(e.target.value) || 1 })}
                              placeholder="Qty" className="px-2 py-1.5 text-xs rounded border border-[#2a2a32] bg-[#0f0f14] text-white mono" />
                            <input type="number" value={item.price} onChange={e => updateItem(selectedFile.id, idx, { price: parseFloat(e.target.value) || 0 })}
                              placeholder="Rate" className="px-2 py-1.5 text-xs rounded border border-[#2a2a32] bg-[#0f0f14] text-white mono" />
                            <div className="flex items-center gap-1">
                              <input type="number" value={item.tax_rate} onChange={e => updateItem(selectedFile.id, idx, { tax_rate: parseFloat(e.target.value) || 18 })}
                                placeholder="Tax%" className="w-full px-2 py-1.5 text-xs rounded border border-[#2a2a32] bg-[#0f0f14] text-white mono" />
                              <span className="text-[9px] text-[#444]">%</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={() => confirmOne(selectedFile)}
                    className="w-full py-3 bg-kraft-accent text-kraft-bg font-bold rounded-xl text-sm hover:opacity-90 flex items-center justify-center gap-2"
                  >
                    <Database size={16} /> Confirm & Import Invoice
                  </button>
                </>
              )}
            </div>

            {/* Live White Preview */}
            <div className="flex-1 overflow-y-auto bg-[#e8e8e8] p-6">
              {selectedFile.status === 'extracted' || selectedFile.status === 'saving' || selectedFile.status === 'saved' ? (
                <VisualInvoice
                  invoice={buildPreviewInvoice(selectedFile.data)}
                  company={company || {}}
                  themeColor="#1a1a2e"
                  docLabel="Original Copy"
                  template="model-1"
                  layout="a4-portrait"
                />
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center text-[#aaa]">
                  <Eye size={40} className="mb-4 opacity-20" />
                  <div className="text-sm font-bold opacity-40">Invoice preview will appear here after extraction</div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
