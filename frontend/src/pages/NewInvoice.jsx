import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Plus, Trash2, Search, FileText, Save, MapPin, Hash } from 'lucide-react';
import Topbar from '../components/Topbar';
import { formatINR, round2 } from '../utils/currency';
import { amountInWords } from '../utils/amountInWords';

const STATES = ['Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal','Andaman and Nicobar Islands','Chandigarh','Dadra and Nagar Haveli and Daman and Diu','Delhi','Jammu and Kashmir','Ladakh','Lakshadweep','Puducherry'];
const UNITS = ['Nos','Kg','Gm','Ltr','Mtr','Sqft','Hours','Days','Months','Pieces','Sets','Pairs','Numbers','PCS'];

function emptyItem() {
  return { description: '', hsn_sac: '', qty: 1, unit: 'Nos', price: 0, discount_pct: 0, tax_rate: 18, item_id: null };
}

function calcItem(li, supplyType) {
  const taxable = round2(li.qty * li.price * (1 - (li.discount_pct || 0) / 100));
  const half = li.tax_rate / 2;
  const cgst_pct = supplyType === 'intra' ? half : 0;
  const cgst_amt = round2(taxable * cgst_pct / 100);
  const sgst_pct = supplyType === 'intra' ? half : 0;
  const sgst_amt = round2(taxable * sgst_pct / 100);
  const igst_pct = supplyType === 'inter' ? li.tax_rate : 0;
  const igst_amt = round2(taxable * igst_pct / 100);
  const amount = round2(taxable + cgst_amt + sgst_amt + igst_amt);
  return { ...li, taxable_value: taxable, cgst_pct, cgst_amt, sgst_pct, sgst_amt, igst_pct, igst_amt, amount };
}

function ItemModal({ onClose, onSaved }) {
  const [form, setForm] = useState({ name: '', type: 'service', description: '', hsn: '', sac: '', unit: 'Nos', sale_price: 0, purchase_price: 0, tax_rate: 18, current_stock: 0 });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.name) return;
    setSaving(true);
    try {
      const res = await axios.post('/api/items', form);
      onSaved(res.data);
    } catch (e) { alert('Error saving item'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/95 z-[200] flex items-center justify-center p-4 backdrop-blur-md">
      <div className="bg-kraft-surface border border-white/5 rounded-[2.5rem] w-full max-w-lg shadow-[0_30px_100px_rgba(0,0,0,0.8)] overflow-hidden animate-scale-in">
        <div className="px-8 py-6 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
          <div className="text-xl font-black text-white flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-kraft-accent/10 flex items-center justify-center">
              <Plus size={20} className="text-kraft-accent" />
            </div>
            Quick Item Creation
          </div>
          <button onClick={onClose} className="w-10 h-10 rounded-full hover:bg-white/5 flex items-center justify-center text-[#555] hover:text-white transition-all">&times;</button>
        </div>
        <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-5">
            <div className="col-span-2">
              <label className="block text-xs font-bold text-[#555] uppercase tracking-widest mb-2">Item Name *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full px-4 py-3 rounded-2xl border border-white/5 bg-black/20 focus:border-kraft-accent/50 outline-none transition-all text-white font-medium" placeholder="e.g. Website Development" />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#555] uppercase tracking-widest mb-2">Classification</label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className="w-full px-4 py-3 rounded-2xl border border-white/5 bg-black/20 focus:border-kraft-accent/50 outline-none transition-all text-white font-medium">
                <option value="service" className="bg-kraft-surface">Service</option>
                <option value="product" className="bg-kraft-surface">Product</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-[#555] uppercase tracking-widest mb-2">Measure Unit</label>
              <select value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} className="w-full px-4 py-3 rounded-2xl border border-white/5 bg-black/20 focus:border-kraft-accent/50 outline-none transition-all text-white font-medium">
                {UNITS.map(u => <option key={u} className="bg-kraft-surface">{u}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-[#555] uppercase tracking-widest mb-2">HSN/SAC Code</label>
              <input value={form.hsn || form.sac || ''} onChange={e => setForm(f => ({ ...f, hsn: e.target.value, sac: e.target.value }))} className="w-full px-4 py-3 rounded-2xl border border-white/5 bg-black/20 focus:border-kraft-accent/50 outline-none transition-all text-white font-medium mono" />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#555] uppercase tracking-widest mb-2">Default Tax (%)</label>
              <select value={form.tax_rate} onChange={e => setForm(f => ({ ...f, tax_rate: parseFloat(e.target.value) }))} className="w-full px-4 py-3 rounded-2xl border border-white/5 bg-black/20 focus:border-kraft-accent/50 outline-none transition-all text-white font-medium">
                {[0,5,12,18,28].map(r => <option key={r} value={r} className="bg-kraft-surface">{r}%</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-[#555] uppercase tracking-widest mb-2">Sale Price (₹)</label>
              <input type="number" value={form.sale_price} onChange={e => setForm(f => ({ ...f, sale_price: parseFloat(e.target.value) || 0 }))} className="w-full px-4 py-3 rounded-2xl border border-white/5 bg-black/20 focus:border-kraft-accent/50 outline-none transition-all text-kraft-accent font-black text-lg mono" />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#555] uppercase tracking-widest mb-2">Purchase Price (₹)</label>
              <input type="number" value={form.purchase_price} onChange={e => setForm(f => ({ ...f, purchase_price: parseFloat(e.target.value) || 0 }))} className="w-full px-4 py-3 rounded-2xl border border-white/5 bg-black/20 focus:border-kraft-accent/50 outline-none transition-all text-[#666] font-black text-lg mono" />
            </div>
          </div>
        </div>
        <div className="px-8 py-6 bg-white/[0.01] flex gap-4">
          <button onClick={save} disabled={saving} className="flex-1 py-4 bg-kraft-accent shadow-[0_10px_30px_rgba(255,184,0,0.2)] text-kraft-bg font-black rounded-2xl hover:scale-[1.02] transition-all disabled:opacity-50 text-lg">
            {saving ? 'Creating Item...' : 'Add to Catalog & Invoice'}
          </button>
          <button onClick={onClose} className="px-8 py-4 bg-kraft-surface2 text-[#888] rounded-2xl hover:text-white transition-all font-bold">Discard</button>
        </div>
      </div>
    </div>
  );
}

function ItemSelector({ selectedId, items, onSelect, onAddNew }) {
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const filtered = items.filter(it => it.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="relative group">
      <div 
        className="flex items-center justify-between px-3 py-2 rounded-xl border border-white/5 bg-kraft-surface2/30 cursor-pointer hover:border-kraft-accent/50 transition-all shadow-inner"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className={`text-xs font-medium ${selectedId ? 'text-white' : 'text-[#444]'}`}>
          {items.find(i => i.id === selectedId)?.name || 'Search product or service...'}
        </span>
        <Search size={12} className="text-[#444] group-hover:text-kraft-accent transition-colors" />
      </div>

      {isOpen && (
        <div className="absolute z-[150] top-full left-0 right-0 mt-2 bg-kraft-surface border border-kraft-accent/30 rounded-[2rem] shadow-[0_20px_60px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col scale-in origin-top">
          <div className="p-3 border-b border-white/5 bg-white/[0.02]">
            <input 
              autoFocus 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
              placeholder="Type to search..." 
              className="w-full px-4 py-2 bg-black/40 border border-white/5 rounded-2xl text-xs outline-none focus:border-kraft-accent/50 text-white"
            />
          </div>
          <div className="max-h-56 overflow-y-auto custom-scrollbar">
            {filtered.map(it => (
              <div 
                key={it.id} 
                className="px-5 py-3 hover:bg-kraft-accent text-xs text-[#aaa] hover:text-kraft-bg transition-all border-b border-white/[0.02] last:border-0"
                onClick={() => { onSelect(it); setIsOpen(false); setSearch(''); }}
              >
                <div className="font-bold flex justify-between items-center">
                   <span>{it.name}</span>
                   <span className="opacity-60 font-black">₹{it.sale_price}</span>
                </div>
                <div className="text-[10px] opacity-70 mt-0.5">{it.hsn || it.sac || 'NO CODE'} • Tax {it.tax_rate}%</div>
              </div>
            ))}
            {filtered.length === 0 && <div className="px-5 py-5 text-[11px] text-[#444] italic text-center">No catalog matches</div>}
          </div>
          <div 
            className="p-4 bg-kraft-accent/5 border-t border-white/5 text-kraft-accent font-black text-xs cursor-pointer hover:bg-kraft-accent/10 text-center flex items-center justify-center gap-2 group/add transition-all active:scale-95"
            onClick={() => { onAddNew(); setIsOpen(false); }}
          >
            <Plus size={16} className="group-hover/add:rotate-90 transition-transform" /> + Create New Item
          </div>
        </div>
      )}
    </div>
  );
}

export default function NewInvoice({ editData, onSaved }) {
  const navigate = useNavigate();
  const [clients, setClients] = useState([]);
  const [items, setItems] = useState([]);
  const [clientSearch, setClientSearch] = useState('');
  const [showClientDrop, setShowClientDrop] = useState(false);
  const [company, setCompany] = useState({});
  const clientDropRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showItemModal, setShowItemModal] = useState(null); // line idx
  const [selectedClient, setSelectedClient] = useState(null);

  const today = new Date().toISOString().split('T')[0];
  const dueDate = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

  const [form, setForm] = useState({
    invoice_no: '', client_id: '', client_name: '', place_of_supply: '', supply_type: 'intra',
    issue_date: today, due_date: dueDate, po_number: '', terms: '', notes: '', status: 'unpaid', type: 'invoice',
    ...(editData || {})
  });
  const [lineItems, setLineItems] = useState(editData?.items?.length ? editData.items.map(i => ({...i, amount: i.amount || 0})) : [emptyItem()]);

  const fetchItems = async () => {
    const r = await axios.get('/api/items');
    setItems(r.data);
  };

  useEffect(() => {
    (async () => {
      try {
        const { data: clientsData } = await axios.get('/api/clients');
        setClients(clientsData);
        if (editData?.client_id) {
          const client = clientsData.find(c => c.id === editData.client_id);
          if (client) setSelectedClient(client);
        }
      } catch (e) { console.error('Failed to load clients', e); }

      try {
        const { data: companyData } = await axios.get('/api/company');
        setCompany(companyData);
      } catch (e) { console.error('Failed to load company', e); }

      if (!editData) {
        try {
          const { data: nextNo } = await axios.get('/api/invoices/next-no');
          setForm(f => ({ ...f, invoice_no: nextNo.next_no }));
        } catch (e) { console.error('Failed to get next invoice no', e); }
      }
    })();

    fetchItems();
    if (editData?.client_name) setClientSearch(editData.client_name);
  }, [editData]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (clientDropRef.current && !clientDropRef.current.contains(e.target)) {
        setShowClientDrop(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filteredClients = clients.filter(c =>
    c.company_name.toLowerCase().includes(clientSearch.toLowerCase()) ||
    (c.gstin || '').toLowerCase().includes(clientSearch.toLowerCase())
  );

  const selectClient = (client) => {
    const companyState = company.state || 'Maharashtra';
    const supplyType = client.state && client.state !== companyState ? 'inter' : 'intra';
    setForm(f => ({ ...f, client_id: client.id, client_name: client.company_name, place_of_supply: client.state || '', supply_type: supplyType }));
    setClientSearch(client.company_name);
    setShowClientDrop(false);
    setSelectedClient(client);
  };

  const selectItem = (lineIdx, item) => {
    setLineItems(prev => prev.map((li, i) => i !== lineIdx ? li : {
      ...li, item_id: item.id, description: item.name, hsn_sac: item.sac || item.hsn || '', unit: item.unit || 'Nos', price: item.sale_price || 0, tax_rate: item.tax_rate || 18
    }));
  };

  const updateLine = (idx, field, value) => {
    setLineItems(prev => prev.map((li, i) => i !== idx ? li : { ...li, [field]: value }));
  };

  const calcedItems = lineItems.map(li => calcItem(li, form.supply_type));
  const subtotal = round2(calcedItems.reduce((s, li) => s + (li.taxable_value || 0), 0));
  const total_cgst = round2(calcedItems.reduce((s, li) => s + (li.cgst_amt || 0), 0));
  const total_sgst = round2(calcedItems.reduce((s, li) => s + (li.sgst_amt || 0), 0));
  const total_igst = round2(calcedItems.reduce((s, li) => s + (li.igst_amt || 0), 0));
  const unrounded = round2(subtotal + total_cgst + total_sgst + total_igst);
  const total = Math.round(unrounded);
  const rounded_off = round2(total - unrounded);

  const handleSave = async (asDraft = false) => {
    if (!form.client_id) return setError('Please select a client');
    if (!calcedItems.some(li => li.description)) return setError('Add at least one line item');
    setSaving(true); setError('');
    try {
      const payload = { ...form, status: asDraft ? 'draft' : form.status, items: calcedItems };
      let res;
      if (editData?.id) {
        res = await axios.put(`/api/invoices/${editData.id}`, payload);
      } else {
        res = await axios.post('/api/invoices', payload);
      }
      if (onSaved) onSaved(res.data);
      else navigate(`/invoices/${res.data.id}`);
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to save invoice');
    } finally {
      setSaving(false);
    }
  };

  const isInter = form.supply_type === 'inter';

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-kraft-bg select-none">
      {showItemModal !== null && (
        <ItemModal 
          onClose={() => setShowItemModal(null)} 
          onSaved={(newItem) => {
            fetchItems();
            selectItem(showItemModal, newItem);
            setShowItemModal(null);
          }} 
        />
      )}
      <Topbar
        title={editData ? 'Edit Invoice' : 'New Invoice'}
        subtitle="Create a GST compliant tax invoice"
        actions={[
          { label: 'Save Draft', icon: Save, onClick: () => handleSave(true) },
          { label: saving ? 'Saving...' : 'Save Invoice', icon: FileText, primary: true, onClick: () => handleSave(false) },
        ]}
      />
      <div className="flex-1 overflow-y-auto p-6 scroll-smooth">
        {error && <div className="mb-4 px-4 py-3 bg-red-950/50 border border-red-800/50 rounded-2xl text-red-400 text-sm animate-shake">{error}</div>}

        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2 space-y-6">
            <div className="kraft-card p-6 border-white/5 bg-white/[0.01]">
              <div className="text-[10px] font-black text-[#555] uppercase tracking-widest mb-4 flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-kraft-accent" /> Header Information
              </div>
              <div className="grid grid-cols-2 gap-5">
                <div className="col-span-2 relative">
                  <label className="block text-[10px] font-black text-[#444] uppercase tracking-wider mb-2">Customer / Client Selection *</label>
                  <div className="relative group" ref={clientDropRef}>
                    <Search size={13} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#444] group-focus-within:text-kraft-accent transition-colors" />
                    <input
                      value={clientSearch}
                      onChange={e => { setClientSearch(e.target.value); setShowClientDrop(true); }}
                      onFocus={() => setShowClientDrop(true)}
                      placeholder="Search by name or GSTIN..."
                      className="w-full pl-10 pr-4 py-3 text-sm rounded-2xl border border-white/5 bg-kraft-surface2/20 focus:border-kraft-accent/50 transition-all outline-none text-white font-medium"
                    />
                    {showClientDrop && (
                      <div className="absolute z-[200] top-full left-0 right-0 mt-2 bg-kraft-surface border border-kraft-accent/30 rounded-2xl shadow-2xl overflow-y-auto max-h-64">
                        {filteredClients.length === 0 ? (
                          <div className="px-6 py-4 text-xs text-[#555] text-center">
                            {clientSearch ? `No clients matching "${clientSearch}"` : 'No clients yet'}
                          </div>
                        ) : (
                          filteredClients.slice(0, 20).map(c => (
                            <div key={c.id} className="px-6 py-3 hover:bg-kraft-accent/10 cursor-pointer border-b border-white/[0.02] last:border-0" onMouseDown={e => { e.preventDefault(); selectClient(c); }}>
                              <div className="text-sm font-bold text-white">{c.company_name}</div>
                              <div className="text-[10px] text-[#555] mt-0.5 tracking-wider">{c.gstin} • {c.state}</div>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {selectedClient && (
                  <div className="col-span-2 p-5 rounded-3xl bg-kraft-accent/5 border border-kraft-accent/10 flex gap-6 animate-scale-in">
                    <div className="flex-1 space-y-4">
                      <div className="flex items-start gap-3">
                         <MapPin size={16} className="text-kraft-accent mt-1 shrink-0" />
                         <div>
                            <div className="text-[9px] font-black text-kraft-accent uppercase tracking-widest mb-1">Billing Address</div>
                            <div className="text-xs text-[#aaa] font-medium leading-relaxed">{selectedClient.billing_address || 'No billing address'}</div>
                            <div className="text-[10px] text-[#555] font-bold mt-1 uppercase">{selectedClient.city} • {selectedClient.state} • {selectedClient.pin}</div>
                         </div>
                      </div>
                      <div className="flex items-start gap-3 border-t border-white/5 pt-4">
                         <MapPin size={16} className="text-kraft-blue mt-1 shrink-0" />
                         <div>
                            <div className="text-[9px] font-black text-kraft-blue uppercase tracking-widest mb-1">Shipping Address</div>
                            <div className="text-xs text-[#aaa] font-medium leading-relaxed">{selectedClient.shipping_address || 'Same as billing'}</div>
                         </div>
                      </div>
                    </div>
                    <div className="w-px bg-white/5" />
                    <div className="w-48 space-y-4">
                       <div className="flex items-center gap-3">
                          <Hash size={16} className="text-green-500 shrink-0" />
                          <div>
                             <div className="text-[9px] font-black text-green-500 uppercase tracking-widest mb-0.5">GSTIN NO</div>
                             <div className="text-sm text-white font-black mono">{selectedClient.gstin || 'UNREGISTERED'}</div>
                          </div>
                       </div>
                    </div>
                  </div>
                )}

                <div className="col-span-2 grid grid-cols-3 gap-5 border-t border-white/5 pt-5 mt-2">
                   <div>
                      <label className="block text-[10px] font-black text-[#666] uppercase mb-2">Invoice Number *</label>
                      <input value={form.invoice_no} onChange={e => setForm(f => ({ ...f, invoice_no: e.target.value }))} className="w-full px-4 py-3 rounded-2xl border border-white/5 bg-kraft-surface2/20 text-kraft-accent font-black text-sm outline-none focus:border-kraft-accent/50 transition-all mono" />
                   </div>
                   <div>
                      <label className="block text-[10px] font-black text-[#666] uppercase mb-2">Invoice Date</label>
                      <input type="date" value={form.issue_date} onChange={e => setForm(f => ({ ...f, issue_date: e.target.value }))} className="w-full px-4 py-3 rounded-2xl border border-white/5 bg-kraft-surface2/20 text-white text-sm outline-none" />
                   </div>
                   <div>
                      <label className="block text-[10px] font-black text-[#666] uppercase mb-2">Due Date</label>
                      <input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} className="w-full px-4 py-3 rounded-2xl border border-white/5 bg-kraft-surface2/20 text-white text-sm outline-none" />
                   </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-[#444] uppercase mb-2">Ref/PO Number</label>
                  <input value={form.po_number} onChange={e => setForm(f => ({ ...f, po_number: e.target.value }))} placeholder="Optional" className="w-full px-4 py-3 rounded-2xl border border-white/5 bg-kraft-surface2/20 text-white text-sm outline-none" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-[#444] uppercase mb-2">Place of Supply</label>
                  <select value={form.place_of_supply} onChange={e => setForm(f => ({ ...f, place_of_supply: e.target.value }))} className="w-full px-4 py-3 rounded-2xl border border-white/5 bg-kraft-surface2/20 text-white text-sm outline-none">
                    <option value="" className="bg-kraft-surface">Select State</option>
                    {STATES.map(s => <option key={s} value={s} className="bg-kraft-surface">{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-[#444] uppercase mb-2">Document Type</label>
                  <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className="w-full px-4 py-3 rounded-2xl border border-white/5 bg-kraft-surface2/20 text-white text-sm outline-none">
                    <option value="invoice" className="bg-kraft-surface">Tax Invoice</option>
                    <option value="quote" className="bg-kraft-surface">Quote / Estimate</option>
                    <option value="proforma" className="bg-kraft-surface">Proforma Invoice</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <div className="grid grid-cols-2 gap-3 p-1.5 bg-black/40 rounded-[1.5rem] border border-white/5 shadow-inner">
                    <button onClick={() => setForm(f => ({ ...f, supply_type: 'intra' }))} className={`py-3 rounded-[1.2rem] text-[10px] font-black uppercase tracking-widest transition-all ${form.supply_type === 'intra' ? 'bg-kraft-accent text-kraft-bg shadow-xl scale-[1.02]' : 'text-[#444] hover:text-white'}`}>Intra-State (CGST+SGST)</button>
                    <button onClick={() => setForm(f => ({ ...f, supply_type: 'inter' }))} className={`py-3 rounded-[1.2rem] text-[10px] font-black uppercase tracking-widest transition-all ${form.supply_type === 'inter' ? 'bg-kraft-blue text-white shadow-xl scale-[1.02]' : 'text-[#444] hover:text-white'}`}>Inter-State (IGST)</button>
                  </div>
                </div>
              </div>
            </div>

            <div className="kraft-card p-6 border-white/5 bg-white/[0.01]">
              <div className="text-[10px] font-black text-[#555] uppercase tracking-widest mb-4 flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-kraft-green" /> Billable Items
              </div>
              <div className="overflow-visible min-h-[400px]">
                <table className="w-full">
                  <thead>
                    <tr className="text-[10px] font-black text-[#444] uppercase tracking-wider border-b border-white/5">
                      <th className="text-left py-3 pr-4 w-72">Item Description</th>
                      <th className="text-left py-3 pr-4 w-28">HSN/SAC</th>
                      <th className="text-right py-3 pr-4 w-20">Quantity</th>
                      <th className="text-left py-3 pr-4 w-24">Unit</th>
                      <th className="text-right py-3 pr-4 w-28">Price</th>
                      <th className="text-right py-3 pr-4 w-16">Disc%</th>
                      <th className="text-right py-3 pr-4 w-16">GST%</th>
                      <th className="text-right py-3 w-32">Line Total</th>
                      <th className="w-10" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.02]">
                    {calcedItems.map((li, idx) => (
                      <tr key={idx} className="group/row">
                        <td className="py-4 pr-4 align-top">
                          <ItemSelector items={items} selectedId={li.item_id} onSelect={(it) => selectItem(idx, it)} onAddNew={() => setShowItemModal(idx)} />
                          <textarea value={li.description} onChange={e => updateLine(idx, 'description', e.target.value)} placeholder="Enter details..." rows={1} className="mt-3 w-full px-4 py-3 text-[11px] font-medium leading-relaxed rounded-2xl border border-white/5 bg-kraft-surface2/10 focus:border-white/20 transition-all resize-none outline-none text-[#999]" />
                        </td>
                        <td className="py-4 pr-4 align-top"><input value={li.hsn_sac} onChange={e => updateLine(idx, 'hsn_sac', e.target.value)} className="w-full px-3 py-3 text-xs rounded-xl border border-white/5 bg-kraft-surface2/10 mono text-white outline-none" /></td>
                        <td className="py-4 pr-4 align-top"><input type="number" value={li.qty} onChange={e => updateLine(idx, 'qty', parseFloat(e.target.value) || 0)} className="w-full px-3 py-3 text-xs rounded-xl border border-white/5 bg-kraft-surface2/10 mono text-right text-white outline-none" /></td>
                        <td className="py-4 pr-4 align-top">
                          <select value={li.unit} onChange={e => updateLine(idx, 'unit', e.target.value)} className="w-full px-3 py-3 text-xs rounded-xl border border-white/5 bg-kraft-surface2/10 text-white outline-none">
                            {UNITS.map(u => <option key={u} className="bg-kraft-surface">{u}</option>)}
                          </select>
                        </td>
                        <td className="py-4 pr-4 align-top"><input type="number" value={li.price} onChange={e => updateLine(idx, 'price', parseFloat(e.target.value) || 0)} className="w-full px-3 py-3 text-xs rounded-xl border border-white/5 bg-kraft-surface2/10 mono text-right text-white font-bold outline-none" /></td>
                        <td className="py-4 pr-4 align-top"><input type="number" value={li.discount_pct} onChange={e => updateLine(idx, 'discount_pct', parseFloat(e.target.value) || 0)} className="w-full px-3 py-3 text-xs rounded-xl border border-white/5 bg-kraft-surface2/10 mono text-right text-[#555] outline-none" /></td>
                        <td className="py-4 pr-4 align-top">
                          <select value={li.tax_rate} onChange={e => updateLine(idx, 'tax_rate', parseFloat(e.target.value))} className="w-full px-3 py-3 text-xs rounded-xl border border-white/5 bg-kraft-surface2/10 text-[#888] outline-none">
                            {[0,5,12,18,28].map(r => <option key={r} value={r} className="bg-kraft-surface">{r}%</option>)}
                          </select>
                        </td>
                        <td className="py-4 text-right align-top">
                          <div className="font-black text-white text-base mono leading-tight translate-y-2">{formatINR(li.amount)}</div>
                        </td>
                        <td className="py-4 pl-4 align-top">
                          {lineItems.length > 1 && (
                            <button onClick={() => setLineItems(prev => prev.filter((_, i) => i !== idx))} className="w-10 h-10 rounded-2xl flex items-center justify-center bg-red-950/10 text-[#333] hover:text-kraft-red hover:bg-red-950/20 transition-all">
                              <Trash2 size={14} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button onClick={() => setLineItems(prev => [...prev, emptyItem()])} className="mt-8 w-full py-4 border-2 border-dashed border-white/5 rounded-[2rem] flex items-center justify-center gap-3 text-xs font-black uppercase tracking-widest text-[#444] hover:text-kraft-accent hover:border-kraft-accent/50 transition-all hover:bg-kraft-accent/5">
                <Plus size={16} /> Insert New Line
              </button>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="kraft-card p-6 border-white/5 bg-white/[0.01]">
                <label className="block text-[10px] font-black text-[#444] uppercase tracking-widest mb-3">Terms & Conditions</label>
                <textarea value={form.terms} onChange={e => setForm(f => ({ ...f, terms: e.target.value }))} rows={4} className="w-full p-4 rounded-[1.5rem] bg-black/20 border border-white/5 text-xs text-[#999] outline-none focus:border-white/20 transition-all resize-none leading-relaxed" placeholder="Legal terms and payment info..." />
              </div>
              <div className="kraft-card p-6 border-white/5 bg-white/[0.01]">
                <label className="block text-[10px] font-black text-[#444] uppercase tracking-widest mb-3">Document Notes</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={4} className="w-full p-4 rounded-[1.5rem] bg-black/20 border border-white/5 text-xs text-[#999] outline-none focus:border-white/20 transition-all resize-none leading-relaxed" placeholder="Internal remarks (not shared with client)..." />
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="kraft-card p-8 sticky top-8 border-white/10 bg-white/[0.02] shadow-[0_40px_80px_rgba(0,0,0,0.4)]">
              <div className="text-[10px] font-black text-[#444] uppercase tracking-widest mb-6 flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-kraft-accent" /> Statement of Account
              </div>
              
              <div className="space-y-5">
                <div className="flex justify-between items-center text-xs font-bold">
                  <span className="text-[#555] uppercase tracking-tighter">Gross Subtotal</span>
                  <span className="mono text-white text-lg">{formatINR(subtotal)}</span>
                </div>
                
                <div className="space-y-2 border-t border-white/5 pt-5">
                  {!isInter ? (<>
                    <div className="flex justify-between items-center text-[11px] font-medium">
                      <span className="text-[#444]">CGST Output</span>
                      <span className="mono text-[#888]">{formatINR(total_cgst)}</span>
                    </div>
                    <div className="flex justify-between items-center text-[11px] font-medium">
                      <span className="text-[#444]">SGST Output</span>
                      <span className="mono text-[#888]">{formatINR(total_sgst)}</span>
                    </div>
                  </>) : (
                    <div className="flex justify-between items-center text-[11px] font-medium">
                      <span className="text-[#444]">IGST Total</span>
                      <span className="mono text-[#888]">{formatINR(total_igst)}</span>
                    </div>
                  )}
                </div>

                {rounded_off !== 0 && (
                  <div className="flex justify-between items-center text-[10px] text-[#333] font-black tracking-tighter pt-2 italic">
                    <span>ROUNDING ADJUSTMENT</span>
                    <span className="mono">{rounded_off > 0 ? '+' : ''}{rounded_off.toFixed(2)}</span>
                  </div>
                )}

                <div className="border-t-[3px] border-kraft-accent/30 pt-6 mt-4 relative">
                  <div className="absolute -top-[1.5px] left-0 right-0 border-t border-kraft-accent" />
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] font-black text-kraft-accent uppercase tracking-widest mb-1">Total Payable Amount</span>
                    <span className="mono font-black text-4xl text-kraft-accent drop-shadow-[0_0_20px_rgba(255,184,0,0.4)] tracking-tighter">{formatINR(total)}</span>
                  </div>
                </div>
              </div>

              <div className="mt-10 p-6 bg-black/60 rounded-[2rem] border border-white/5 shadow-inner">
                <div className="text-[8px] font-black text-[#333] uppercase tracking-[0.2em] mb-3">Taxable Value Lexicon</div>
                <div className="text-[11px] text-[#aaa] font-bold leading-relaxed italic tracking-tight">RUPEES {amountInWords(total).toUpperCase()} ONLY</div>
              </div>

              <div className="mt-10 border-t border-white/5 pt-8">
                <label className="block text-[10px] font-black text-[#555] uppercase tracking-widest mb-4">Document Status Control</label>
                <div className="grid grid-cols-3 gap-3">
                  {['unpaid', 'paid', 'draft'].map(s => (
                    <button 
                      key={s} 
                      onClick={() => setForm(f => ({ ...f, status: s }))}
                      className={`py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all ${form.status === s ? 'border-kraft-accent text-kraft-accent bg-kraft-accent/10 shadow-[0_0_15px_rgba(255,184,0,0.1)]' : 'border-white/5 text-[#444] hover:border-white/20'}`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              
              <button 
                onClick={() => handleSave(false)} 
                disabled={saving} 
                className="mt-10 w-full py-5 bg-kraft-accent text-kraft-bg font-black rounded-[2rem] hover:scale-[1.03] active:scale-[0.97] transition-all shadow-[0_15px_40px_rgba(255,184,0,0.3)] disabled:opacity-50 text-lg flex items-center justify-center gap-3 uppercase tracking-widest"
              >
                {saving ? 'Finalizing...' : (
                  <><FileText size={22} /> {editData ? 'Update Record' : 'Deploy Invoice'}</>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
