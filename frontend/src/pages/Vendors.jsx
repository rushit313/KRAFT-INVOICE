import { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { Plus, Search, Store, Phone, Mail, Edit, Trash2, Upload } from 'lucide-react';
import * as XLSX from 'xlsx';
import Topbar from '../components/Topbar';

function VendorModal({ vendor, onClose, onSaved }) {
  const [form, setForm] = useState(vendor || { company_name: '', contact_person: '', phone: '', email: '', gstin: '', pan: '', billing_address: '', city: '', state: 'Maharashtra', pin: '' });
  const [saving, setSaving] = useState(false);
  const [captchaModal, setCaptchaModal] = useState(null);
  const [captchaInput, setCaptchaInput] = useState('');
  const [validatingGst, setValidatingGst] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      if (vendor?.id) await axios.put(`/api/vendors/${vendor.id}`, form);
      else await axios.post('/api/vendors', form);
      onSaved();
    } catch (e) { alert(e.response?.data?.error || 'Error'); }
    finally { setSaving(false); }
  };

  const fetchCaptcha = async () => {
    setValidatingGst(true);
    try {
      const sid = Math.random().toString(36).substring(7);
      const res = await axios.get(`/api/gst/verify/captcha?sid=${sid}`);
      setCaptchaModal({ ...res.data, sid });
      setCaptchaInput('');
    } catch (e) { alert('Failed to fetch captcha'); }
    finally { setValidatingGst(false); }
  };

  const submitGstVerify = async () => {
    if (!captchaInput) return;
    setValidatingGst(true);
    try {
      const res = await axios.post('/api/gst/verify/details', {
        gstin: form.gstin.toUpperCase(),
        captcha: captchaInput,
        sid: captchaModal.sid
      });
      if (res.data && res.data.success) {
        const d = res.data.taxpayerDetails;
        const officialName = d.lgnm || d.tradeNam;
        let shouldUpdateName = !form.company_name;
        if (form.company_name && form.company_name.toLowerCase().trim() !== officialName.toLowerCase().trim()) {
          shouldUpdateName = window.confirm(`Official Name: "${officialName}"\nUpdate Vendor Name?`);
        }
        setForm(f => ({
          ...f,
          company_name: shouldUpdateName ? officialName : f.company_name,
          billing_address: f.billing_address || (d.pradr ? `${d.pradr.addr.bnm || ''} ${d.pradr.addr.st || ''} ${d.pradr.addr.loc || ''}`.trim() : ''),
          city: f.city || (d.pradr ? d.pradr.addr.dst : ''),
          state: f.state || (d.pradr ? d.pradr.addr.stc : ''),
          pin: f.pin || (d.pradr ? d.pradr.addr.pncd : ''),
          pan: f.pan || form.gstin.substring(2, 12),
          gst_verified: true
        }));
        setCaptchaModal(null);
      } else {
        alert(res.data?.error || 'Invalid. Refreshing captcha...');
        fetchCaptcha();
      }
    } catch (e) { alert('Verification failed'); fetchCaptcha(); }
    finally { setValidatingGst(false); }
  };

  const fields = [
    ['Company Name *', 'company_name'], ['Contact Person', 'contact_person'],
    ['Phone', 'phone'], ['Email', 'email'],
    ['GSTIN', 'gstin'], ['PAN', 'pan'],
    ['Address', 'billing_address'], ['City', 'city'],
    ['State', 'state'], ['PIN', 'pin'],
  ];

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-kraft-surface border border-[#2a2a32] rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto fade-in">
        <div className="px-6 py-4 border-b border-[#2a2a32] flex items-center justify-between">
          <div className="font-semibold text-white">{vendor ? 'Edit Vendor' : 'New Vendor'}</div>
          <button onClick={onClose} className="text-[#555] hover:text-white text-lg">&times;</button>
        </div>
        <div className="p-6 grid grid-cols-2 gap-4">
          {fields.map(([label, key]) => (
            <div key={key} className={key === 'billing_address' ? 'col-span-2' : ''}>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs text-[#888]">{label}</label>
                {key === 'gstin' && (
                  <div className="flex items-center gap-1.5">
                    {form.gst_verified && <div className="text-[10px] text-green-500 font-bold flex items-center gap-0.5">✓ Verified</div>}
                    <button onClick={() => fetchCaptcha()} disabled={validatingGst} className="text-[10px] text-kraft-accent hover:underline disabled:opacity-50">
                      {validatingGst ? 'Capturing...' : 'Verify @ Official Portal'}
                    </button>
                  </div>
                )}
              </div>
              <input 
                value={form[key] || ''} 
                onChange={e => setForm(f => ({ ...f, [key]: e.target.value, gst_verified: key === 'gstin' ? false : f.gst_verified }))} 
                className={`w-full px-3 py-2 text-sm rounded-lg border ${key === 'gstin' && form.gst_verified ? 'border-green-500/50 bg-green-500/5 shadow-[0_0_10px_rgba(34,197,94,0.1)]' : 'border-[#2e2e36]'}`}
              />
            </div>
          ))}
          {captchaModal && (
            <div className="col-span-2 p-5 bg-kraft-surface2 rounded-2xl border-2 border-kraft-accent/30 animate-in fade-in zoom-in-95 duration-200 shadow-[0_0_40px_rgba(200,169,110,0.15)] mt-2">
              <div className="text-[11px] text-kraft-accent font-black uppercase tracking-[0.2em] mb-4 text-center">🔐 Solve Official GST Portal Captcha</div>
              <div className="flex flex-col gap-4 items-center">
                <div className="bg-white p-2.5 rounded-xl shadow-inner border-2 border-kraft-accent/30 flex items-center justify-center overflow-hidden">
                  <img src={captchaModal.image} alt="captcha" className="h-16 w-48 object-contain contrast-125 brightness-110" />
                </div>
                <div className="w-full flex gap-2">
                  <input 
                    autoFocus
                    placeholder="Enter exactly as shown" 
                    value={captchaInput} 
                    onChange={e => setCaptchaInput(e.target.value)} 
                    onKeyPress={e => e.key === 'Enter' && submitGstVerify()}
                    className="flex-1 bg-kraft-surface border-2 border-kraft-accent/20 text-center text-lg font-black tracking-widest px-4 py-3 rounded-xl focus:border-kraft-accent outline-none"
                  />
                  <button 
                    onClick={submitGstVerify}
                    disabled={validatingGst || !captchaInput}
                    className="px-8 bg-kraft-accent text-kraft-bg font-black rounded-xl hover:bg-kraft-accent/90 disabled:opacity-50 transition-all active:scale-95 shadow-lg shadow-kraft-accent/20"
                  >
                    VERIFY
                  </button>
                </div>
                <button onClick={fetchCaptcha} className="text-[10px] text-[#666] hover:text-white underline">Regenerate Captcha</button>
              </div>
            </div>
          )}
        </div>
        <div className="px-6 pb-5 flex gap-3">
          <button onClick={save} disabled={saving} className="flex-1 py-2.5 bg-kraft-accent text-kraft-bg font-bold rounded-lg hover:bg-kraft-accent/90 disabled:opacity-50">
            {saving ? 'Saving...' : 'Save Vendor'}
          </button>
          <button onClick={onClose} className="px-5 py-2.5 bg-kraft-surface2 text-[#888] rounded-lg hover:text-white">Cancel</button>
          {vendor && vendor.id && (
            <button 
              onClick={(e) => { 
                e.preventDefault();
                axios.delete(`/api/vendors/${vendor.id}`).then(()=>onSaved()).catch(e=>console.log(e));
              }} 
              className="px-4 py-2.5 bg-red-950/30 text-kraft-red rounded-lg hover:bg-red-900/50 hover:text-white border border-red-900/30 flex items-center justify-center"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Vendors() {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const fileRef = useRef(null);

  const fetch = () => {
    const params = search ? { search } : {};
    axios.get('/api/vendors', { params }).then(r => { setVendors(r.data); setLoading(false); });
  };

  useEffect(() => { fetch(); }, [search]);

  const doDeleteVendor = async () => {
    if (!confirmDeleteId) return;
    try {
      await axios.delete(`/api/vendors/${confirmDeleteId}`);
      setConfirmDeleteId(null);
      fetch();
    } catch (e) {
      alert(e.response?.data?.error || 'Cannot delete vendor. They might have active purchase bills preventing deletion.');
      setConfirmDeleteId(null);
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

        const payload = rows.map(row => {
          const v = {};
          const entries = Object.entries(row);
          const find = (keywords) => {
            const entry = entries.find(([k]) => keywords.some(kw => k.toLowerCase().replace(/[^a-z0-9]/g, '').includes(kw.toLowerCase().replace(/[^a-z0-9]/g, ''))));
            return entry ? entry[1] : '';
          };

          v.company_name = find(['vendorname', 'companyname', 'name', 'suppliername']);
          v.contact_person = find(['contactname', 'contactperson', 'primarycontact']);
          v.email = find(['email', 'emailaddress']);
          v.phone = find(['phone', 'mobile', 'tele']);
          v.billing_address = find(['billingaddress', 'address', 'street']);
          v.pin = find(['billingzip', 'billingpin', 'zip', 'pin', 'postal']);
          v.city = find(['billingcity', 'city']);
          v.state = find(['billingstate', 'state']);
          v.gstin = find(['gstin', 'gstno', 'taxregistration']);
          v.pan = find(['pan', 'panno']);

          if (v.email && !v.email.toString().includes('@')) {
            if (!v.phone) v.phone = v.email;
            v.email = '';
          }

          if (v.gstin && v.gstin.toString().length > 20) {
            if (!v.billing_address) v.billing_address = v.gstin;
            v.gstin = '';
          }

          return v;
        }).filter(v => v.company_name);

        if (payload.length === 0) return alert('No valid vendor rows found');
        await axios.post('/api/vendors/bulk', { vendors: payload });
        fetch();
        alert(`Successfully imported ${payload.length} vendors`);
      } catch (err) {
        alert('Import failed: ' + (err.response?.data?.error || err.message));
      }
    };

    if (isExcel) reader.readAsBinaryString(file);
    else reader.readAsText(file);
    e.target.value = null;
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <input type="file" accept=".csv,.xls,.xlsx" className="hidden" ref={fileRef} onChange={handleImport} />
      {confirmDeleteId && (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center fade-in">
          <div className="bg-kraft-surface border border-[#3a3a44] p-6 rounded-xl w-80 text-center shadow-2xl">
            <Trash2 size={32} className="mx-auto text-kraft-red mb-4" />
            <h3 className="text-white font-bold mb-2">Delete Vendor?</h3>
            <p className="text-[#888] text-sm mb-6">This action cannot be undone. Associated bills will be orphaned.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDeleteId(null)} className="flex-1 py-2 rounded bg-[#2e2e36] text-white hover:bg-[#3e3e46]">Cancel</button>
              <button onClick={doDeleteVendor} className="flex-1 py-2 rounded bg-kraft-red text-white hover:bg-red-600 font-medium">Delete</button>
            </div>
          </div>
        </div>
      )}
      {modal && <VendorModal vendor={modal === 'new' ? null : modal} onClose={() => setModal(null)} onSaved={() => { setModal(null); fetch(); }} />}
      <Topbar 
        title="Vendors" 
        subtitle="Manage supplier database" 
        actions={[
          { label: 'Import XLS/CSV', icon: Upload, onClick: () => fileRef.current?.click() },
          { label: 'New Vendor', icon: Plus, primary: true, onClick: () => setModal('new') }
        ]} 
      />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mb-4 relative max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#555]" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search vendors..." className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-[#2e2e36]" />
        </div>
        {loading ? (
          <div className="flex justify-center py-16"><div className="w-6 h-6 border-2 border-kraft-accent border-t-transparent rounded-full spin" /></div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {vendors.map(v => (
              <div key={v.id} className="kraft-card p-5 group hover:border-[#3a3a44] transition-all">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-kraft-blue/15 flex items-center justify-center">
                    <Store size={18} className="text-kraft-blue" />
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                    <button onClick={() => setModal(v)} className="p-1.5 rounded hover:bg-white/10 text-[#666] hover:text-white"><Edit size={13} /></button>
                    <button onClick={e => { e.stopPropagation(); setConfirmDeleteId(v.id); }} className="p-1.5 rounded hover:bg-red-950/50 text-[#666] hover:text-kraft-red"><Trash2 size={13} /></button>
                  </div>
                </div>
                <div className="font-semibold text-white">{v.company_name}</div>
                {v.contact_person && <div className="text-xs text-[#888] mt-0.5">{v.contact_person}</div>}
                <div className="mt-3 space-y-1">
                  {v.phone && <div className="flex items-center gap-1.5 text-xs text-[#666]"><Phone size={11} />{v.phone}</div>}
                  {v.email && <div className="flex items-center gap-1.5 text-xs text-[#666]"><Mail size={11} />{v.email}</div>}
                  {v.gstin && <div className="text-xs font-mono text-kraft-blue/80 mt-2">{v.gstin}</div>}
                </div>
                {v.city && <div className="mt-3 text-xs text-[#555]">{v.city}, {v.state}</div>}
              </div>
            ))}
            {!vendors.length && (
              <div className="col-span-3 text-center py-16 text-[#555]">
                No vendors found. <button className="text-kraft-accent hover:underline" onClick={() => setModal('new')}>Add one?</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
