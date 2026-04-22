import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Plus, Search, Download, Upload, Trash2, Eye, Edit3, Trash, Maximize2, Printer, Layout, Monitor } from 'lucide-react';
import * as XLSX from 'xlsx';
import Topbar from '../components/Topbar';
import InvoiceStatusBadge from '../components/InvoiceStatusBadge';
import { formatINR } from '../utils/currency';
import VisualInvoice from '../components/VisualInvoice';

const TABS = ['all', 'unpaid', 'partial', 'paid', 'overdue', 'draft'];

export default function Invoices() {
  const [invoices, setInvoices] = useState([]);
  const [company, setCompany] = useState({});
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState(null); // id and no
  const [deleting, setDeleting] = useState(false);
  const navigate = useNavigate();
  const fileRef = useRef(null);
  const pdfRef = useRef(null);
  const [bulkStatus, setBulkStatus] = useState({ active: false, current: 0, total: 0, log: [] });

  const fetchInvoices = async () => {
    setLoading(true);
    const params = {};
    if (activeTab !== 'all') params.status = activeTab;
    if (search) params.search = search;
    try {
      const [invRes, compRes] = await Promise.all([
        axios.get('/api/invoices', { params }),
        axios.get('/api/company')
      ]);
      setInvoices(invRes.data);
      setCompany(compRes.data);
      if (invRes.data.length > 0 && !selectedInvoice) {
        // Automatically fetch full details for the first invoice to show in preview
        const first = await axios.get(`/api/invoices/${invRes.data[0].id}`);
        setSelectedInvoice(first.data);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchInvoices(); }, [activeTab, search]);

  const selectInvoice = async (id) => {
    try {
      const r = await axios.get(`/api/invoices/${id}`);
      setSelectedInvoice(r.data);
    } catch (e) { console.error(e); }
  };

  const handleDeleteAll = async () => {
    try {
      await axios.delete('/api/invoices');
      setConfirmDeleteAll(false);
      fetchInvoices();
      setSelectedInvoice(null);
    } catch (e) {
      alert('Failed to delete all invoices: ' + (e.response?.data?.error || e.message));
    }
  };

  const deleteInvoice = async () => {
    if (!invoiceToDelete) return;
    setDeleting(true);
    try {
      await axios.delete(`/api/invoices/${invoiceToDelete.id}`);
      setInvoiceToDelete(null);
      fetchInvoices();
      if (selectedInvoice?.id === invoiceToDelete.id) setSelectedInvoice(null);
    } catch (e) {
      alert('Failed to delete invoice: ' + (e.response?.data?.error || e.message));
    } finally {
      setDeleting(false);
    }
  };

  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const isExcel = file.name.endsWith('.xls') || file.name.endsWith('.xlsx');
    const reader = new FileReader();

    reader.onload = async (evt) => {
      try {
        let rows = [];
        if (isExcel) {
          const bstr = evt.target.result;
          const wb = XLSX.read(bstr, { type: 'binary' });
          const ws = wb.Sheets[wb.SheetNames[0]];
          rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
        } else {
          const text = evt.target.result;
          const wb = XLSX.read(text, { type: 'string' });
          rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" });
        }

        if (!rows.length) return alert('No data found in file. Ensure the Excel sheet is not empty.');
        
        console.log('First Row Sample:', rows[0]);
        console.log('Detected Headers:', Object.keys(rows[0]));

        const invoicesMap = {};
        rows.forEach((row, idx) => {
          const entries = Object.entries(row);
          const find = (keywords) => {
            // Priority 1: Exact normalized match
            let found = entries.find(([k]) => {
              const normalizedK = k.toLowerCase().replace(/[^a-z0-9]/g, '');
              return keywords.some(kw => normalizedK === kw.toLowerCase().replace(/[^a-z0-9]/g, ''));
            });
            if (found) return found[1];

            // Priority 2: Fuzzy include match
            found = entries.find(([k]) => {
              const normalizedK = k.toLowerCase().replace(/[^a-z0-9]/g, '');
              return keywords.some(kw => {
                 const normalizedKW = kw.toLowerCase().replace(/[^a-z0-9]/g, '');
                 return normalizedK.includes(normalizedKW);
              });
            });
            return found ? found[1] : '';
          };

          const invNo = find(['invoiceno', 'billno', 'billnumber', 'invoiceid', 'invoicenum', 'docno', 'voucher']);
          if (!invNo) return;

          if (!invoicesMap[invNo]) {
            invoicesMap[invNo] = {
              invoice_no: invNo,
              issue_date: find(['issuedate', 'invoicedate', 'billdate', 'billdt', 'date', 'voucherdate', 'docdate', 'invdate', 'dt']) || new Date().toISOString().split('T')[0],
              client_name: find(['clientname', 'customername', 'partyname', 'party', 'client', 'customer', 'buyer', 'soldto']),
              client_gstin: find(['clientgst', 'gstin', 'gstno', 'registration', 'legal']),
              client_phone: find(['clientphon', 'phone', 'mobile', 'contact']),
              client_email: find(['clientemai', 'email', 'emailaddress']),
              client_city: find(['clientcity', 'city', 'location']),
              client_state: find(['clientstate', 'state', 'region']),
              client_pin: find(['clientpin', 'pin', 'zip', 'pincode']),
              place_of_supply: find(['placeofsupply', 'pos', 'supplystate', 'clientstate']) || 'Maharashtra',
              supply_type: find(['supplytype', 'type', 'gsttype']).toString().toLowerCase().includes('inter') ? 'inter' : 'intra',
              status: find(['status', 'paymentstatus', 'paid']) || 'unpaid',
              items: []
            };
          }
          
          const amount = parseFloat(find(['taxable', 'taxablevalue', 'amount', 'taxableamt'])) || 0;
          const tax = parseFloat(find(['tax', 'gstamount', 'gstamt', 'totaltax'])) || 0;
          let taxRate = parseFloat(find(['taxrate', 'taxpct', 'gstpct', 'gsttarget', 'rate'])) || 18;
          
          if (amount > 0 && tax > 0 && (!find(['taxrate']) || taxRate === 18)) {
            taxRate = Math.round((tax / amount) * 100);
          }

          invoicesMap[invNo].items.push({
            description: find(['item', 'description', 'particulars', 'product', 'service']) || 'Service',
            qty: parseFloat(find(['qty', 'quantity', 'units'])) || 1,
            price: amount,
            tax_rate: taxRate,
            hsn_sac: find(['hsnsac', 'hsncode', 'saccode', 'code'])
          });
        });

        const payload = Object.values(invoicesMap);
        if (!payload.length) return alert('No valid invoices found. Check your column headers (Date, Client, Item, etc.)');

        await axios.post('/api/invoices/bulk', { invoices: payload });
        fetchInvoices();
        alert(`Successfully imported ${payload.length} sales bills`);
      } catch (err) {
        console.error(err);
        alert('Import failed: ' + (err.response?.data?.error || err.message));
      }
    };

    if (isExcel) reader.readAsBinaryString(file);
    else reader.readAsText(file);
    e.target.value = null;
  };

  const handleBulkPdf = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    
    setBulkStatus({ active: true, current: 0, total: files.length, log: [`Staging ${files.length} documents for AI analysis...`] });
    
    for (let i = 0; i < files.length; i++) {
       const file = files[i];
       setBulkStatus(prev => ({ ...prev, current: i + 1, log: [`Analyzing ${file.name}...`, ...prev.log.slice(0, 5)] }));
       
       try {
          const formData = new FormData();
          formData.append('file', file);
          const extRes = await axios.post('/api/invoices/extract', formData);
          
          if (extRes.data.success) {
             const { extracted } = extRes.data;
             await axios.post('/api/invoices/confirm-extract', { extracted });
             setBulkStatus(prev => ({ ...prev, log: [`✓ Digitised: ${extracted.invoice_no || file.name.slice(0, 10)}`, ...prev.log.slice(0, 10)] }));
          }
       } catch (err) {
          const errMsg = err.response?.data?.error || err.message;
          console.error('[Bulk Error]:', errMsg);
          setBulkStatus(prev => ({ ...prev, log: [`❌ Failed: ${file.name.slice(0, 15)}.. (${errMsg})`, ...prev.log.slice(0, 10)] }));
       }
    }
    
    fetchInvoices();
    setTimeout(() => setBulkStatus(prev => ({ ...prev, active: false })), 2000);
    e.target.value = null;
  };

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-kraft-bg">
      {confirmDeleteAll && (
        <div className="fixed inset-0 bg-black/95 z-[110] flex items-center justify-center backdrop-blur-sm">
          <div className="bg-kraft-surface border border-red-900/40 p-10 rounded-[2rem] w-[450px] text-center shadow-[0_0_50px_rgba(255,0,0,0.1)]">
            <div className="w-20 h-20 bg-red-950/20 rounded-full flex items-center justify-center mx-auto mb-8">
              <Trash2 size={40} className="text-kraft-red animate-pulse" />
            </div>
            <h3 className="text-white text-2xl font-black mb-4 tracking-tight">Purge Sales Database?</h3>
            <p className="text-[#888] text-base mb-10 leading-relaxed font-medium">
              This will <strong className="text-white">permanently destroy</strong> all sales invoices and payment records. Your history will be unrecoverable.
            </p>
            <div className="space-y-4">
              <button 
                onClick={handleDeleteAll} 
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-red-600 to-kraft-red text-white hover:from-red-500 hover:to-red-600 font-bold transition-all shadow-lg text-lg"
              >
                Yes, Purge Everything
              </button>
              <button 
                onClick={() => setConfirmDeleteAll(false)} 
                className="w-full py-4 rounded-2xl bg-white/5 text-[#999] hover:text-white hover:bg-white/10 transition-all font-bold text-lg"
              >
                No, Keep My Data
              </button>
            </div>
          </div>
        </div>
      )}

      {invoiceToDelete && (
        <div className="fixed inset-0 bg-black/90 z-[300] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-kraft-surface border border-red-900/30 rounded-2xl w-full max-w-sm shadow-2xl scale-in overflow-hidden">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-red-950/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 size={32} className="text-kraft-red" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Delete Invoice?</h3>
              <p className="text-xs text-[#666] leading-relaxed">
                Permanently remove <span className="text-white font-mono">{invoiceToDelete.invoice_no}</span>?
              </p>
            </div>
            <div className="p-4 bg-white/[0.02] flex gap-3">
              <button 
                onClick={deleteInvoice} 
                disabled={deleting}
                className="flex-1 py-2.5 bg-kraft-red text-white font-bold rounded-xl hover:bg-kraft-red/90 disabled:opacity-50 transition-all text-xs"
              >
                {deleting ? 'Deleting...' : 'Confirm'}
              </button>
              <button 
                onClick={() => setInvoiceToDelete(null)}
                className="px-6 py-2.5 bg-kraft-surface2 text-[#888] rounded-xl hover:text-white transition-all text-xs font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {bulkStatus.active && (
        <div className="fixed inset-0 bg-black/90 z-[300] flex items-center justify-center backdrop-blur-xl">
          <div className="bg-kraft-surface border border-white/5 p-10 rounded-[2.5rem] w-full max-w-lg shadow-2xl scale-in overflow-hidden relative">
            <div className="absolute top-0 left-0 h-1 bg-gradient-to-r from-transparent via-kraft-accent to-transparent transition-all duration-500" style={{ width: `${(bulkStatus.current / bulkStatus.total) * 100}%` }} />
            <div className="mb-8 text-center">
              <div className="text-[10px] font-black text-kraft-accent uppercase tracking-[0.4em] mb-4">Neural Extraction Engine</div>
              <h3 className="text-2xl font-black text-white tracking-tight">Bulk Processing PDFs</h3>
              <p className="text-xs text-[#555] font-black mt-2 uppercase tracking-widest">{bulkStatus.current} of {bulkStatus.total} Digitised</p>
            </div>
            
            <div className="space-y-2 mb-8 max-h-40 overflow-y-auto custom-scrollbar pr-2">
              {bulkStatus.log.map((entry, idx) => (
                <div key={idx} className={`text-[10px] font-black uppercase tracking-widest ${entry.includes('❌') ? 'text-kraft-red' : entry.includes('✓') ? 'text-kraft-green' : 'text-[#444]'}`}>
                  {entry}
                </div>
              ))}
            </div>

            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden mb-8">
              <div 
                className="h-full bg-kraft-accent transition-all duration-700 ease-out shadow-[0_0_15px_rgba(200,169,110,0.5)]"
                style={{ width: `${(bulkStatus.current / bulkStatus.total) * 100}%` }}
              />
            </div>
            <p className="text-[10px] text-center text-[#333] font-black italic">Operating in high-fidelity mode. Please do not close the workspace.</p>
          </div>
        </div>
      )}

      <Topbar
        title="Sales Bills"
        subtitle="Manage your outgoing invoices"
        actions={[
          { label: 'Delete All', icon: Trash2, danger: true, onClick: () => setConfirmDeleteAll(true) },
          { label: 'Import XLS/CSV', icon: Upload, onClick: () => fileRef.current?.click() },
          { label: 'Bulk PDF Import', icon: Layout, onClick: () => pdfRef.current?.click() },
          { label: 'New Invoice', icon: Plus, primary: true, onClick: () => navigate('/invoices/new') }
        ]}
      />
      
      <input type="file" accept=".csv,.xls,.xlsx" className="hidden" ref={fileRef} onChange={handleImport} />
      <input type="file" accept=".pdf" className="hidden" ref={pdfRef} multiple onChange={handleBulkPdf} />

      <div className="flex-1 flex overflow-hidden">
        {/* LEFT PANEL: LIST */}
        <div className={`flex-1 flex flex-col border-r border-white/5 transition-all duration-500 ${selectedInvoice ? 'max-w-[45%]' : 'max-w-full'}`}>
          <div className="p-6 pb-2">
            <div className="flex items-center justify-between mb-6 gap-6">
              <div className="flex bg-[#1a1a23] rounded-2xl p-1.5 border border-white/5 shadow-inner">
                {TABS.map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all
                      ${activeTab === tab ? 'bg-kraft-surface text-kraft-accent shadow-lg scale-105' : 'text-[#555] hover:text-[#999]'}`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
              <div className="relative flex-1 group">
                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#444] group-focus-within:text-kraft-accent transition-colors" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Seach bills or clients..."
                  className="w-full pl-12 pr-4 py-3 text-sm rounded-2xl border border-white/5 bg-[#12121a] focus:bg-kraft-surface focus:border-kraft-accent/30 transition-all outline-none"
                />
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-6 pb-20 custom-scrollbar">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-32 space-y-4">
                <div className="w-10 h-10 border-2 border-kraft-accent border-t-transparent rounded-full animate-spin shadow-[0_0_20px_rgba(200,169,110,0.2)]" />
                <span className="text-[10px] font-black text-[#555] uppercase tracking-widest">Hydrating Sales Data...</span>
              </div>
            ) : (
              <div className="kraft-card overflow-hidden rounded-[2rem] border-white/5 shadow-2xl">
                <table className="kraft-table w-full">
                  <thead className="bg-[#12121a]">
                    <tr>
                      <th className="pl-6 uppercase tracking-[0.2em] text-[9px]">Bill INFO</th>
                      <th className="uppercase tracking-[0.2em] text-[9px]">Client</th>
                      <th className="text-right uppercase tracking-[0.2em] text-[9px]">Total</th>
                      <th className="text-right pr-6 uppercase tracking-[0.2em] text-[9px]">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {[...invoices].sort((a, b) => new Date(b.issue_date || 0) - new Date(a.issue_date || 0)).map(inv => (
                      <tr 
                        key={inv.id} 
                        onClick={() => selectInvoice(inv.id)}
                        className={`group cursor-pointer transition-all duration-300 ${selectedInvoice?.id === inv.id ? 'bg-white/[0.03]' : 'hover:bg-white/[0.01]'}`}
                      >
                        <td className="pl-6">
                           <div className="flex items-center gap-2">
                             <div className={`text-sm font-black transition-colors ${selectedInvoice?.id === inv.id ? 'text-kraft-accent' : 'text-white'}`}>{inv.invoice_no}</div>
                             {inv.type === 'quote' && <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 text-[8px] font-black uppercase tracking-widest border border-blue-500/20">Quote</span>}
                             {inv.type === 'proforma' && <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 text-[8px] font-black uppercase tracking-widest border border-purple-500/20">Proforma</span>}
                           </div>
                           <div className="text-[10px] text-[#555] font-bold mt-1 uppercase tracking-tight">{inv.issue_date}</div>
                        </td>
                        <td>
                           <div className="text-sm font-black text-white/90">{inv.client_name}</div>
                           <div className="text-[10px] text-[#555] font-bold mt-1 uppercase tracking-tight">{inv.supply_type === 'inter' ? 'IGST' : 'CGST/SGST'}</div>
                        </td>
                        <td className="text-right">
                           <div className="text-sm font-black text-white">{formatINR(inv.total)}</div>
                           <div className="text-[10px] text-kraft-accent font-bold mt-1 opacity-50">{formatINR(inv.subtotal)}</div>
                        </td>
                        <td className="text-right pr-6">
                            <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-all scale-90 group-hover:scale-100">
                              <button onClick={(e) => { e.stopPropagation(); navigate(`/invoices/${inv.id}`); }} className="p-2 bg-white/5 rounded-lg text-[#666] hover:text-white hover:bg-white/10 transition-all"><Eye size={16} /></button>
                              <button onClick={(e) => { e.stopPropagation(); navigate(`/invoices/${inv.id}/edit`); }} className="p-2 bg-white/5 rounded-lg text-[#666] hover:text-white hover:bg-white/10 transition-all"><Edit3 size={16} /></button>
                              <button onClick={(e) => { e.stopPropagation(); setInvoiceToDelete({ id: inv.id, invoice_no: inv.invoice_no }); }} className="p-2 bg-white/5 rounded-lg text-[#666] hover:text-kraft-red hover:bg-red-950/20 transition-all"><Trash size={16} /></button>
                            </div>
                           <div className="mt-2 group-hover:scale-95 transition-all"><InvoiceStatusBadge status={inv.status} /></div>
                        </td>
                      </tr>
                    ))}
                    {!invoices.length && (
                      <tr><td colSpan={4} className="text-center py-32">
                        <div className="text-[10px] font-black text-[#444] uppercase tracking-[0.3em] mb-4">No Sales Found</div>
                        <button onClick={() => navigate('/invoices/new')} className="text-xs font-black text-kraft-accent px-6 py-3 bg-kraft-accent/5 rounded-xl hover:bg-kraft-accent/10 transition-all uppercase tracking-widest border border-kraft-accent/20">Initialise First Invoice</button>
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT PANEL: PREVIEW */}
        <div className="flex-1 bg-[#0a0a0f] flex flex-col pt-6 pb-12 px-10 relative overflow-hidden">
          <div className="absolute inset-0 bg-[#c8a96e]/[0.02] pointer-events-none" />
          
          <div className="flex items-center justify-between mb-8 relative z-10">
            <div>
              <h2 className="text-[10px] font-black text-[#555] uppercase tracking-[0.3em] mb-2">Live Document Preview</h2>
              {selectedInvoice && (
                <div className="flex items-center gap-3">
                   <span className="text-2xl font-black text-white tracking-tight">{selectedInvoice.invoice_no}</span>
                   <InvoiceStatusBadge status={selectedInvoice.status} />
                </div>
              )}
            </div>
            {selectedInvoice && (
              <div className="flex items-center gap-3">
                 <button onClick={() => navigate(`/invoices/${selectedInvoice.id}`)} className="p-3 bg-kraft-accent/10 text-kraft-accent rounded-xl font-black text-xs uppercase tracking-widest hover:bg-kraft-accent/20 transition-all border border-kraft-accent/20 flex items-center gap-2">
                   <Maximize2 size={14} /> Full View
                 </button>
                 <button onClick={() => setSelectedInvoice(null)} className="p-3 bg-white/5 text-[#555] rounded-xl hover:text-white transition-all font-black text-xs uppercase tracking-widest">
                   Close
                 </button>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar relative z-10 flex justify-center pb-20">
            {selectedInvoice ? (
              <div className="scale-[0.85] lg:scale-100 origin-top shadow-[0_0_100px_rgba(0,0,0,0.5)]">
                 <VisualInvoice invoice={selectedInvoice} company={company} />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center text-center space-y-6 max-w-sm">
                 <div className="w-24 h-24 bg-white/5 rounded-[2.5rem] flex items-center justify-center border border-white/5 shadow-2xl">
                    <Layout size={40} className="text-[#333]" />
                 </div>
                 <div>
                    <h3 className="text-lg font-black text-white mb-2">No Document Selected</h3>
                    <p className="text-sm text-[#555] font-medium leading-relaxed">Choose an invoice from the list to preview its exact professional design.</p>
                 </div>
              </div>
            )}
          </div>
          
          {selectedInvoice && (
            <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-20 flex gap-4 p-2 bg-[#1a1a23]/90 backdrop-blur-xl border border-white/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
               <button onClick={() => navigate(`/invoices/${selectedInvoice.id}/edit`)} className="px-6 py-3 bg-white/5 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-white/10 transition-all">Modify Details</button>
               <button onClick={() => window.open(`/api/invoices/${selectedInvoice.id}/pdf`, '_blank')} className="px-6 py-3 bg-kraft-accent text-kraft-bg rounded-xl text-xs font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-[0_0_20px_rgba(200,169,110,0.3)] flex items-center gap-2">
                  <Printer size={14} /> Download PDF
               </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
