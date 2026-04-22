import { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { Plus, Package, Wrench, Edit, Trash2, Search, Trash, Upload } from 'lucide-react';
import * as XLSX from 'xlsx';
import Topbar from '../components/Topbar';
import { formatINR } from '../utils/currency';

function ItemModal({ item, onClose, onSaved }) {
  const [form, setForm] = useState(item || { name: '', type: 'service', description: '', hsn: '', sac: '', unit: 'Nos', sale_price: 0, purchase_price: 0, tax_rate: 18, current_stock: 0 });
  const [saving, setSaving] = useState(false);
  const [hsnResults, setHsnResults] = useState([]);
  const [showHsnDrop, setShowHsnDrop] = useState(false);

  const searchHsn = async (val, sourceField) => {
    // sourceField can be 'name', 'hsn', or 'sac'
    if (sourceField === 'name') setForm(f => ({ ...f, name: val }));
    else {
      const field = form.type === 'service' ? 'sac' : 'hsn';
      setForm(f => ({ ...f, [field]: val }));
    }

    if (val.length < 3) { setHsnResults([]); return; }
    try {
      const res = await axios.get(`/api/gst/hsn/search?q=${val}`);
      setHsnResults(res.data);
      setShowHsnDrop(true);
    } catch (e) {}
  };

  const selectHsn = (h) => {
    const field = form.type === 'service' ? 'sac' : 'hsn';
    setForm(f => ({ 
      ...f, 
      [field]: h.hsn, 
      description: f.description || h.description, 
      tax_rate: h.igst || f.tax_rate 
    }));
    setShowHsnDrop(false);
  };

  const save = async () => {
    setSaving(true);
    try {
      if (item?.id) await axios.put(`/api/items/${item.id}`, form);
      else await axios.post('/api/items', form);
      onSaved();
    } catch (e) { alert(e.response?.data?.error || 'Error'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-kraft-surface border border-[#2a2a32] rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto fade-in">
        <div className="px-6 py-4 border-b border-[#2a2a32] flex items-center justify-between">
          <div className="font-semibold text-white">{item ? 'Edit Item' : 'New Item / Service'}</div>
          <button onClick={onClose} className="text-[#555] hover:text-white text-lg">&times;</button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 relative">
              <label className="block text-xs text-[#888] mb-1">Name *</label>
              <input 
                value={form.name} 
                onChange={e => searchHsn(e.target.value, 'name')} 
                onBlur={() => setTimeout(() => setShowHsnDrop(false), 200)}
                placeholder="Ex. Software Development or Laptop"
                className="w-full px-3 py-2 text-sm rounded-lg border border-[#2e2e36]" 
              />
              {showHsnDrop && hsnResults.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-kraft-surface border border-[#2a2a32] rounded-xl shadow-2xl z-[60] max-h-60 overflow-y-auto backdrop-blur-md">
                  {hsnResults.map(h => (
                    <div key={h.hsn} onClick={() => selectHsn(h)} className="p-3 border-b border-[#2a2a32] last:border-0 hover:bg-kraft-accent/10 cursor-pointer text-xs group transition-colors">
                      <div className="flex justify-between items-start mb-1">
                        <div className="font-black text-kraft-accent group-hover:text-white transition-colors">{h.hsn}</div>
                        <div className="px-1.5 py-0.5 rounded bg-kraft-green/20 text-kraft-green font-bold text-[9px]">{h.igst}% GST</div>
                      </div>
                      <div className="text-[#888] group-hover:text-[#ccc] line-clamp-2 leading-relaxed">{h.description}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs text-[#888] mb-1">Type</label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className="w-full px-3 py-2 text-sm rounded-lg border border-[#2e2e36]">
                <option value="service">Service</option>
                <option value="product">Product</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-[#888] mb-1">Unit</label>
              <select value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} className="w-full px-3 py-2 text-sm rounded-lg border border-[#2e2e36]">
                {['Nos','Kg','Gm','Ltr','Mtr','Sqft','Hours','Days','Months','Pieces','Sets','Numbers','PCS'].map(u => <option key={u}>{u}</option>)}
              </select>
            </div>
            <div className="relative">
              <label className="block text-xs text-[#888] mb-1">HSN Code</label>
              <input 
                value={form.hsn || ''} 
                onChange={e => searchHsn(e.target.value)} 
                onBlur={() => setTimeout(() => setShowHsnDrop(false), 200)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-[#2e2e36] mono" 
              />
              {showHsnDrop && hsnResults.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-kraft-surface border border-[#2a2a32] rounded-lg shadow-xl z-10 max-h-40 overflow-y-auto">
                  {hsnResults.map(h => (
                    <div 
                      key={h.hsn} 
                      onClick={() => selectHsn(h)}
                      className="p-2 border-b border-[#2a2a32] last:border-0 hover:bg-kraft-accent/10 cursor-pointer text-xs"
                    >
                      <div className="font-bold text-kraft-accent">{h.hsn}</div>
                      <div className="text-[#888] line-clamp-1">{h.description}</div>
                      <div className="text-[10px] text-kraft-green">GST: {h.igst}%</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="relative">
              <label className="block text-xs text-[#888] mb-1">SAC Code</label>
              <input 
                value={form.sac || ''} 
                onChange={e => searchHsn(e.target.value)} 
                onBlur={() => setTimeout(() => setShowHsnDrop(false), 200)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-[#2e2e36] mono" 
              />
              {showHsnDrop && form.type === 'service' && hsnResults.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-kraft-surface border border-[#2a2a32] rounded-lg shadow-xl z-10 max-h-40 overflow-y-auto">
                  {hsnResults.map(h => (
                    <div key={h.hsn} onClick={() => selectHsn(h)} className="p-2 border-b border-[#2a2a32] last:border-0 hover:bg-kraft-accent/10 cursor-pointer text-xs">
                      <div className="font-bold text-kraft-accent">{h.hsn}</div>
                      <div className="text-[#888] line-clamp-1">{h.description}</div>
                      <div className="text-[10px] text-kraft-green">GST: {h.igst}%</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs text-[#888] mb-1">Sale Price (₹)</label>
              <input type="number" value={form.sale_price} onChange={e => setForm(f => ({ ...f, sale_price: parseFloat(e.target.value) || 0 }))} className="w-full px-3 py-2 text-sm rounded-lg border border-[#2e2e36] mono" />
            </div>
            <div>
              <label className="block text-xs text-[#888] mb-1">Purchase Price (₹)</label>
              <input type="number" value={form.purchase_price} onChange={e => setForm(f => ({ ...f, purchase_price: parseFloat(e.target.value) || 0 }))} className="w-full px-3 py-2 text-sm rounded-lg border border-[#2e2e36] mono" />
            </div>
            <div>
              <label className="block text-xs text-[#888] mb-1">Tax Rate (%)</label>
              <select value={form.tax_rate} onChange={e => setForm(f => ({ ...f, tax_rate: parseFloat(e.target.value) }))} className="w-full px-3 py-2 text-sm rounded-lg border border-[#2e2e36]">
                {[0,5,12,18,28].map(r => <option key={r} value={r}>{r}%</option>)}
              </select>
            </div>
            {form.type === 'product' && (
              <div>
                <label className="block text-xs text-[#888] mb-1">Current Stock</label>
                <input type="number" value={form.current_stock} onChange={e => setForm(f => ({ ...f, current_stock: parseFloat(e.target.value) || 0 }))} className="w-full px-3 py-2 text-sm rounded-lg border border-[#2e2e36] mono" />
              </div>
            )}
            <div className="col-span-2">
              <label className="block text-xs text-[#888] mb-1">Description</label>
              <textarea value={form.description || ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} className="w-full px-3 py-2 text-sm rounded-lg border border-[#2e2e36] resize-none" />
            </div>
          </div>
        </div>
        <div className="px-6 pb-5 flex gap-3">
          <button onClick={save} disabled={saving} className="flex-1 py-2.5 bg-kraft-accent text-kraft-bg font-bold rounded-lg hover:bg-kraft-accent/90 disabled:opacity-50">
            {saving ? 'Saving...' : 'Save Item'}
          </button>
          <button onClick={onClose} className="px-5 py-2.5 bg-kraft-surface2 text-[#888] rounded-lg">Cancel</button>
        </div>
      </div>
    </div>
  );
}

export default function Items() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const fileRef = useRef(null);

  const fetch = () => {
    const params = {};
    if (filter !== 'all') params.type = filter;
    if (search) params.search = search;
    axios.get('/api/items', { params }).then(r => { setItems(r.data); setLoading(false); });
  };

  useEffect(() => { fetch(); }, [filter, search]);

  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });

        if (!rows.length) return alert('No data found');

        const payload = rows.map(row => {
          const entries = Object.entries(row);
          const find = (keywords) => {
            const entry = entries.find(([k]) => {
              const nk = k.toLowerCase().replace(/[^a-z0-9]/g, '');
              return keywords.some(kw => nk.includes(kw.toLowerCase().replace(/[^a-z0-9]/g, '')) || kw.toLowerCase().replace(/[^a-z0-9]/g, '').includes(nk));
            });
            return entry ? entry[1] : '';
          };

          const name = find(['productname', 'itemname', 'name', 'item', 'product']);
          if (!name) return null;

          const unit = find(['uom', 'unit', 'measure']) || 'Nos';
          const hsnRaw = String(find(['hsnsac', 'hsn', 'sac', 'code']) || '').split('/')[0].trim();
          const providedType = (find(['type']) || '').toLowerCase();
          
          // INTELLIGENT TYPE DETECTION
          let type = 'product';
          const serviceKeywords = ['service', 'amc', 'maintenance', 'consultancy', 'development', 'support', 'installation', 'training', 'professional', 'fee', 'charge', 'annual'];
          const serviceUnits = ['hours', 'days', 'months', 'sqft', 'visit'];
          
          if (hsnRaw.startsWith('99')) type = 'service';
          else if (serviceUnits.some(u => unit.toLowerCase().includes(u))) type = 'service';
          else if (serviceKeywords.some(kw => name.toLowerCase().includes(kw))) type = 'service';
          else if (providedType.includes('service')) type = 'service';

          return {
            name,
            type,
            unit,
            sale_price: parseFloat(find(['saleprice', 'unitprice', 'price', 'rate', 'sellingprice'])) || 0,
            purchase_price: parseFloat(find(['purchaseprice', 'costprice', 'purchase'])) || 0,
            tax_rate: parseFloat(find(['tax', 'gst', 'taxrate', 'gstpct', 'tax%'])) || 18,
            current_stock: parseFloat(find(['quantity', 'qty', 'stock', 'currentstock'])) || 0,
            description: find(['description', 'desc', 'summary']),
            hsn: type === 'product' ? hsnRaw : '',
            sac: type === 'service' ? hsnRaw : ''
          };
        }).filter(Boolean);

        if (payload.length === 0) return alert('No valid items found. Check your column headers (Product Name, Unit Price, etc.)');
        
        await axios.post('/api/items/bulk', payload);
        alert(`Imported ${payload.length} items successfully!`);
        fetch();
      } catch (err) { alert('Import failed: ' + err.message); }
    };
    reader.readAsBinaryString(file);
    e.target.value = null;
  };

  const handleDeleteAll = async () => {
    try {
      await axios.delete('/api/items');
      setConfirmDeleteAll(false);
      fetch();
    } catch (e) { alert('Delete failed'); }
  };

  const deleteItem = async (e, id) => {
    e.stopPropagation();
    if (!confirm('Delete this item?')) return;
    await axios.delete(`/api/items/${id}`);
    fetch();
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-kraft-bg">
      {modal && <ItemModal item={modal === 'new' ? null : modal} onClose={() => setModal(null)} onSaved={() => { setModal(null); fetch(); }} />}

      {confirmDeleteAll && (
        <div className="fixed inset-0 bg-black/95 z-[110] flex items-center justify-center backdrop-blur-sm">
          <div className="bg-kraft-surface border border-red-900/40 p-10 rounded-[2rem] w-[450px] text-center shadow-[0_0_50px_rgba(255,0,0,0.1)]">
            <div className="w-20 h-20 bg-red-950/20 rounded-full flex items-center justify-center mx-auto mb-8">
              <Trash2 size={40} className="text-kraft-red animate-pulse" />
            </div>
            <h3 className="text-white text-2xl font-black mb-4 tracking-tight">Purge Item Catalog?</h3>
            <p className="text-[#888] text-base mb-10 leading-relaxed font-medium">
              This will <strong className="text-white">permanently destroy</strong> all products and services from your catalog. This cannot be undone.
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
                No, Keep My Items
              </button>
            </div>
          </div>
        </div>
      )}
      
      <Topbar 
        title="Items & Services" 
        subtitle="Product and service catalog" 
        actions={[
          { label: 'Delete All', icon: Trash, danger: true, onClick: () => setConfirmDeleteAll(true) },
          { label: 'Import XLS/CSV', icon: Upload, onClick: () => fileRef.current?.click() },
          { label: 'New Item', icon: Plus, primary: true, onClick: () => setModal('new') }
        ]} 
      />
      <input type="file" accept=".csv,.xls,.xlsx" className="hidden" ref={fileRef} onChange={handleImport} />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="flex items-center gap-4 mb-4">
          <div className="flex gap-1 bg-kraft-surface2 rounded-lg p-1">
            {['all', 'product', 'service'].map(t => (
              <button key={t} onClick={() => setFilter(t)} className={`px-3 py-1.5 rounded-md text-xs font-semibold capitalize ${filter === t ? 'bg-kraft-surface text-white' : 'text-[#666] hover:text-white'}`}>{t}</button>
            ))}
          </div>
          <div className="relative max-w-xs">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#555]" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-[#2e2e36]" />
          </div>
        </div>
        <div className="kraft-card overflow-hidden">
          {loading ? (
            <div className="flex justify-center py-16"><div className="w-6 h-6 border-2 border-kraft-accent border-t-transparent rounded-full spin" /></div>
          ) : (
            <table className="kraft-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>HSN / SAC</th>
                  <th>Unit</th>
                  <th className="text-right">Sale Price</th>
                  <th className="text-right">Purchase Price</th>
                  <th className="text-right">Tax Rate</th>
                  <th className="text-right">Stock</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <tr key={item.id} className="group">
                    <td>
                      <div className="flex items-center gap-2">
                        <div className={`w-6 h-6 rounded flex items-center justify-center ${item.type === 'product' ? 'bg-amber-900/40' : 'bg-kraft-blue/20'}`}>
                          {item.type === 'product' ? <Package size={12} className="text-amber-400" /> : <Wrench size={12} className="text-kraft-blue" />}
                        </div>
                        <div>
                          <div className="font-medium text-white text-sm">{item.name}</div>
                          {item.description && <div className="text-xs text-[#555]">{item.description.slice(0, 40)}</div>}
                        </div>
                      </div>
                    </td>
                    <td><span className={`badge text-[10px] ${item.type === 'product' ? 'bg-amber-900/40 text-amber-400' : 'bg-kraft-blue/20 text-kraft-blue'}`}>{item.type}</span></td>
                    <td className="mono text-xs text-[#888]">{item.hsn || item.sac || '—'}</td>
                    <td className="text-[#888] text-xs">{item.unit}</td>
                    <td className="text-right mono text-sm">{formatINR(item.sale_price)}</td>
                    <td className="text-right mono text-xs text-[#888]">{formatINR(item.purchase_price)}</td>
                    <td className="text-right">
                      <span className="badge bg-kraft-green/20 text-kraft-green text-[10px]">{item.tax_rate}%</span>
                    </td>
                    <td className="text-right mono text-xs">{item.type === 'product' ? item.current_stock : '—'}</td>
                    <td>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                        <button onClick={() => setModal(item)} className="p-1.5 rounded hover:bg-white/10 text-[#555] hover:text-white"><Edit size={12} /></button>
                        <button onClick={e => deleteItem(e, item.id)} className="p-1.5 rounded hover:bg-red-950/50 text-[#555] hover:text-kraft-red"><Trash2 size={12} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!items.length && <tr><td colSpan={9} className="text-center text-[#555] py-12">No items found. <button className="text-kraft-accent hover:underline" onClick={() => setModal('new')}>Add one?</button></td></tr>}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
